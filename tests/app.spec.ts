import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureCSV, fixtureXLSX } from "./fixtures";
async function methods(page: Page) {
  await page.getByRole("link", { name: "Metode", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Siapkan analisis" }),
  ).toBeVisible();
}
test("cancel an import while its worker is loading, and report worker network failure", async ({
  page,
}) => {
  await page.goto("/#/metode");
  await page.route("**/*import.worker*", () => {});
  const request = page.waitForRequest(/import\.worker/);
  await page.getByLabel("Unggah Excel atau CSV").setInputFiles({
    name: "example.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(fixtureCSV()),
  });
  await request;
  await page.getByRole("button", { name: "Batalkan impor" }).click();
  await expect(page.getByRole("status")).toContainText("dibatalkan");
  await page.unroute("**/*import.worker*");
  await page.route("**/*import.worker*", (route) => route.abort());
  await page.getByLabel("Unggah Excel atau CSV").setInputFiles({
    name: "example.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(fixtureCSV()),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Pemroses lokal gagal dimuat",
  );
  await page.getByRole("button", { name: "Lihat hasil analisis" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(25);
});
test("navigation, selections, browser history, refresh and all sensor views", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kondisi uap." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Telusuri pengukuran" }).hover();
  await page.getByRole("button", { name: "Telusuri pengukuran" }).click();
  for (const name of ["NCG", "Kualitas uap", "TDS", "Suhu", "Tekanan"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("tbody tr")).toHaveCount(25);
  }
  await page
    .getByRole("button", { name: "Pilih baris 3", exact: true })
    .click();
  await expect(
    page
      .getByRole("complementary", { name: "Rincian pengukuran" })
      .locator("dd")
      .first(),
  ).toHaveText("3");
  for (let i = 0; i < 3; i++) {
    await methods(page);
    await page.getByRole("link", { name: "Analisis", exact: true }).click();
    await expect(
      page
        .getByRole("complementary", { name: "Rincian pengukuran" })
        .locator("dd")
        .first(),
    ).toHaveText("3");
  }
  await page.getByRole("button", { name: "TDS", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Tekanan", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "TDS", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
test("dialogs trap focus, close with Escape and restore trigger focus", async ({
  page,
}) => {
  await page.goto("/#/analisis");
  const trigger = page.getByRole("button", { name: "Periksa kualitas data" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest("dialog") !== null,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest("dialog") !== null,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await expect(trigger).toBeFocused();
});
test("upload computes, thresholds recalculate, export matches and clear gives empty state", async ({
  page,
}) => {
  await page.goto("/#/metode");
  const file = page.getByLabel("Unggah Excel atau CSV");
  await file.setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(fixtureCSV()),
  });
  await expect(page.getByRole("status")).toContainText("12 pembacaan berhasil");
  await page
    .getByRole("button", { name: "Lebih sensitif", exact: true })
    .click();
  await expect(page).toHaveURL(/z=3$/);
  await page.getByRole("button", { name: "Hitung ulang analisis" }).click();
  await expect(page.getByRole("status")).toContainText(
    "60 penilaian dihitung ulang",
  );
  await page.getByRole("button", { name: "Lihat hasil analisis" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh JSON penilaian" }).click();
  const d = await downloaded;
  const stream = await d.createReadStream();
  let text = "";
  for await (const chunk of stream!) text += chunk.toString();
  const json = JSON.parse(text);
  expect(json.threshold).toBe(3);
  expect(json.assessments).toHaveLength(60);
  expect(json.source_file_hash).toMatch(/^[a-f0-9]{64}$/);
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh CSV penilaian" }).click();
  expect((await csv).suggestedFilename()).toBe("penilaian.csv");
  await methods(page);
  await page.getByRole("button", { name: "Hapus data", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hitung ulang analisis" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Analisis", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Belum ada pengukuran" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buka sumber data" }).click();
  await page.getByRole("button", { name: "Muat contoh sintetis" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Contoh sintetis dimuat",
  );
  const template = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh templat CSV" }).click();
  expect((await template).suggestedFilename()).toBe("templat.csv");
});
test("XLSX parser handles values, formula rejection, extra sheets and decompression limits", async ({
  page,
}) => {
  await page.goto("/#/metode");
  const input = page.getByLabel("Unggah Excel atau CSV");
  const mimeType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await input.setInputFiles({
    name: "fixture.xlsx",
    mimeType,
    buffer: fixtureXLSX(),
  });
  await expect(page.getByRole("status")).toContainText("8 pembacaan berhasil");
  for (const [options, message] of [
    [{ formula: true }, "Formula"],
    [{ extraSheet: true }, "tepat satu lembar"],
    [{ large: true }, "terlalu besar"],
  ] as const) {
    await input.setInputFiles({
      name: "bad.xlsx",
      mimeType,
      buffer: fixtureXLSX(options),
    });
    await expect(page.getByRole("alert")).toContainText(message);
  }
  await page.getByRole("button", { name: "Lihat hasil analisis" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
});
test("malformed and invalid uploads preserve previous dataset", async ({
  page,
}) => {
  await page.goto("/#/metode");
  const input = page.getByLabel("Unggah Excel atau CSV");
  for (const [name, mimeType, content, message] of [
    ["bad.csv", "text/csv", "date,x", "Kolom"],
    ["bad.exe", "application/octet-stream", "x", "Format"],
    [
      "bad.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "invalid",
      "ZIP",
    ],
    ["bad.csv", "text/csv", fixtureCSV().replace("7,170", "NaN,170"), "angka"],
  ] as const) {
    await input.setInputFiles({ name, mimeType, buffer: Buffer.from(content) });
    await expect(page.getByRole("alert")).toContainText(message);
  }
  await page.getByRole("button", { name: "Lihat hasil analisis" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(25);
});
test("method disclosure and blocked model routes have meaningful actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jelajahi turbin" }).click();
  await expect(page).toHaveURL(/turbin/);
  await page.getByRole("button", { name: "Lihat status aset" }).click();
  await expect(page.getByRole("dialog")).toContainText("belum diperoleh");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "← Ringkasan" }).click();
  await expect(page).toHaveURL(/ringkasan/);
  await page.getByRole("button", { name: "Lihat objek", exact: true }).click();
  await page.getByRole("link", { name: "Ringkasan", exact: true }).click();
  await page.getByRole("button", { name: /Sumber:/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Tidak mewakili");
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await methods(page);
  for (const name of [
    "Periksa sumber data",
    "Acuan statistik robust",
    "GPR · riset",
  ]) {
    await page.getByRole("button", { name, exact: false }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Lebih ketat", exact: true }).click();
  await expect(page).toHaveURL(/z=4$/);
  await page.getByRole("button", { name: "Standar", exact: true }).click();
  await expect(page).toHaveURL(/z=3.5$/);
});
for (const viewport of [
  { width: 1600, height: 960 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
])
  test(`responsive screenshots, axe and offline ${viewport.width}`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    for (const route of ["ringkasan", "analisis", "metode"]) {
      await page.goto(`/#/${route}`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${route}-${viewport.width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(axe.violations).toEqual([]);
    }
    expect(failed).toEqual([]);
    await context.setOffline(true);
    await expect(page.getByRole("status")).toContainText("luring");
    await page.getByRole("button", { name: "Hitung ulang analisis" }).click();
    await expect(page.locator(".messages")).toContainText(
      "penilaian dihitung ulang",
    );
  });
test("authorized private workbook browser verification", async ({ page }) => {
  test.skip(
    !process.env.KAMOJANG_PRIVATE_SOURCE,
    "Optional local-only source gate",
  );
  await page.goto("/#/metode");
  await page
    .getByLabel("Unggah Excel atau CSV")
    .setInputFiles(process.env.KAMOJANG_PRIVATE_SOURCE!);
  await expect(page.getByRole("status")).toContainText("44 pembacaan berhasil");
  for (const [button, count] of [
    ["Standar", 7],
    ["Lebih sensitif", 9],
    ["Lebih ketat", 6],
  ] as const) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.locator(".method-panel")).toContainText(
      `${count} indikasi`,
    );
  }
});
