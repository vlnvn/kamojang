import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demo } from "../src/demo";
import { randomUUID } from "node:crypto";

test("research module is deferred and its load failure preserves sensor review", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.route("**/src/IsolationPanel.tsx*", (r) => r.abort());
  await page.goto("/#/metode");
  expect(requests.some((url) => url.includes("/src/IsolationPanel.tsx"))).toBe(
    false,
  );
  await page.getByRole("button", { name: "Isolation Forest · riset" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Modul eksperimen tidak dapat dimuat",
  );
  await page.getByRole("link", { name: "Analisis", exact: true }).click();
  await expect(page.locator(".data-table tbody tr")).toHaveCount(25);
});

test("isolation API enforces origin, configuration, size and pre-cancellation", async ({
  request,
}) => {
  test.skip(
    !process.env.KAMOJANG_RESEARCH,
    "Actual local research service required",
  );
  const dataset = demo();
  const payload = {
    request_id: randomUUID(),
    source_hash: dataset.hash,
    rows: dataset.rows.map((r) => ({
      date: r.date,
      source_excel_row: r.source_row,
      ...r.values,
    })),
  };
  const endpoint = "http://127.0.0.1:8341/api/research/isolation",
    headers = { Origin: "http://127.0.0.1:5173" };
  expect(
    (
      await request.post(endpoint, {
        headers: { Origin: "https://untrusted.example" },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  for (const bad of [
    { contamination: true },
    { n_estimators: 500 },
    { manual: {} },
    { rows: payload.rows.map((r) => ({ ...r, source_excel_row: 1 })) },
  ])
    expect(
      (
        await request.post(endpoint, { headers, data: { ...payload, ...bad } })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.post(endpoint, {
        headers: { ...headers, "Content-Type": "application/json" },
        data: " ".repeat(256 * 1024 + 1),
      })
    ).status(),
  ).toBe(413);
  expect(
    (
      await request.post("http://127.0.0.1:8341/api/research/cancel", {
        headers,
        data: { request_id: payload.request_id },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await request.post(endpoint, { headers, data: payload })).status(),
  ).toBe(409);
  const after = await request.post(endpoint, {
    headers,
    data: { ...payload, request_id: randomUUID(), n_estimators: 50 },
  });
  expect(after.status()).toBe(200);
});

test("multivariate configuration, manual prediction and exports execute locally without changing robust data", async ({
  page,
}) => {
  test.skip(
    !process.env.KAMOJANG_RESEARCH,
    "Actual local research service required",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/metode");
  await page.getByRole("button", { name: "Isolation Forest · riset" }).click();
  await expect(
    page.getByRole("heading", { name: "Eksperimen Isolation Forest" }),
  ).toBeInViewport();
  await page.getByLabel("Contamination", { exact: true }).fill("0.10");
  await page.getByLabel("Jumlah pohon", { exact: true }).selectOption("50");
  await page.getByLabel("Uji pengukuran manual").check();
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/research/isolation"),
  );
  await page.getByRole("button", { name: "Jalankan Isolation Forest" }).click();
  const actual = await response;
  expect(actual.status()).toBe(200);
  const result = await actual.json();
  expect(result.config.contamination).toBe(0.1);
  expect(result.config.n_estimators).toBe(50);
  expect(result.holdout.train_rows).toBe(20);
  expect(result.holdout.test_rows).toBe(5);
  expect(result.reference.observations).toHaveLength(25);
  expect(result.manual).not.toBeNull();
  await expect(page.locator(".isolation-panel [role=status]")).toContainText(
    "Eksperimen selesai",
  );
  await expect(
    page.getByRole("heading", { name: "Hasil input manual" }),
  ).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh JSON eksperimen" }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toBe("eksperimen-isolation.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(result);
  const csvDl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh CSV eksperimen" }).click();
  expect((await csvDl).suggestedFilename()).toBe("eksperimen-isolation.csv");
  await page.getByRole("link", { name: "Analisis", exact: true }).click();
  await expect(page.locator(".data-table tbody tr")).toHaveCount(25);
  await page.getByRole("link", { name: "Metode", exact: true }).click();
  await page.getByLabel("Contamination", { exact: true }).fill("0.15");
  await expect(
    page.getByRole("button", { name: "Unduh JSON eksperimen" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("multivariate unavailable, cancellation and dataset reset keep analysis usable", async ({
  page,
}) => {
  await page.route("**/api/research/isolation", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"Layanan riset tidak aktif."}',
    }),
  );
  await page.goto("/#/metode");
  await page.getByRole("button", { name: "Isolation Forest · riset" }).click();
  await page.getByRole("button", { name: "Jalankan Isolation Forest" }).click();
  await expect(page.locator(".isolation-panel [role=alert]")).toContainText(
    "Layanan riset tidak aktif",
  );
  await page.unroute("**/api/research/isolation");
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/research/isolation", async (r) => {
    await held;
    await r.abort().catch(() => {});
  });
  await page.route("**/api/research/cancel", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"cancelled":true}',
    }),
  );
  await page.getByRole("button", { name: "Jalankan Isolation Forest" }).click();
  await page.getByRole("button", { name: "Batalkan eksperimen" }).click();
  release();
  await expect(page.locator(".isolation-panel [role=status]")).toContainText(
    "dibatalkan",
  );
  await page.getByRole("button", { name: "Hapus data", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Jalankan Isolation Forest" }),
  ).toBeDisabled();
});

for (const width of [1600, 390])
  test(`multivariate form accessibility and layout at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/#/metode");
    await page
      .getByRole("button", { name: "Isolation Forest · riset" })
      .click();
    await page.getByLabel("Uji pengukuran manual").check();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
