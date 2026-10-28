import { test, expect } from "@playwright/test";
test("research GPR executes actual local fitting, displays holdout metrics and preserves robust screening", async ({
  page,
}) => {
  test.skip(
    !process.env.KAMOJANG_RESEARCH,
    "Requires explicit local research service, tested in research CI job",
  );
  await page.goto("/#/metode");
  await page.getByRole("button", { name: "GPR · prediksi" }).click();
  await expect(
    page.getByRole("heading", { name: "Evaluasi prediksi GPR" }),
  ).toBeInViewport();
  const request = page.waitForResponse((r) =>
    r.url().includes("/api/research/forecast"),
  );
  await page.getByRole("button", { name: "Jalankan benchmark GPR" }).click();
  const response = await request;
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.metrics).toHaveLength(15);
  expect(data.train_rows).toBe(17);
  expect(data.test_rows).toBe(8);
  expect(data.seed).toBe(1729);
  expect(
    data.metrics.every(
      (m: { mae: number; rmse: number }) =>
        Number.isFinite(m.mae) && Number.isFinite(m.rmse),
    ),
  ).toBe(true);
  await expect(page.getByRole("status")).toContainText("Benchmark selesai");
  await expect(page.locator(".forecast-panel tbody tr")).toHaveCount(23);
  await page.getByLabel("Rincian prediksi").selectOption("ncg_percent_mass");
  await expect(page.locator(".forecast-panel")).toContainText("NCG");
  await page
    .getByRole("button", { name: "Lebih sensitif", exact: true })
    .click();
  await expect(page.locator(".forecast-panel")).toContainText(
    "Benchmark selesai",
  );
  await page.getByRole("link", { name: "Analisis", exact: true }).click();
  await expect(page.locator(".data-table tbody tr")).toHaveCount(25);
});
test("research service rejects untrusted origin and malformed input", async ({
  request,
}) => {
  test.skip(
    !process.env.KAMOJANG_RESEARCH,
    "Requires explicit local research service",
  );
  const response = await request.post(
    "http://127.0.0.1:8341/api/research/forecast",
    {
      headers: { Origin: "https://untrusted.example" },
      data: { request_id: "00000000-0000-0000-0000-000000000000", rows: [] },
    },
  );
  expect(response.status()).toBe(403);
  const invalid = await request.post(
    "http://127.0.0.1:8341/api/research/forecast",
    {
      headers: { Origin: "http://127.0.0.1:5173" },
      data: { request_id: "00000000-0000-0000-0000-000000000000", rows: [] },
    },
  );
  expect(invalid.status()).toBe(400);
  const nonobject = await request.post(
    "http://127.0.0.1:8341/api/research/forecast",
    { headers: { Origin: "http://127.0.0.1:5173" }, data: [] },
  );
  expect(nonobject.status()).toBe(400);
});

test("GPR unavailable and cancelled requests preserve core data", async ({
  page,
}) => {
  await page.route("**/api/research/forecast", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Layanan riset tidak aktif." }),
    }),
  );
  await page.goto("/#/metode");
  await page.getByRole("button", { name: "GPR · prediksi" }).click();
  await page.getByRole("button", { name: "Jalankan benchmark GPR" }).click();
  await expect(page.locator(".forecast-panel [role=alert]")).toContainText(
    "Layanan riset tidak aktif",
  );
  await page.unroute("**/api/research/forecast");
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/research/forecast", async (r) => {
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
  await page.getByRole("button", { name: "Jalankan benchmark GPR" }).click();
  await page.getByRole("button", { name: "Batalkan benchmark" }).click();
  release();
  await expect(
    page.getByRole("button", { name: "Jalankan benchmark GPR" }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Analisis", exact: true }).click();
  await expect(page.locator(".data-table tbody tr")).toHaveCount(25);
});
