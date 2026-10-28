import { chromium, expect } from "@playwright/test";
const base = process.env.KAMOJANG_BASE_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
await page.goto(base + "/#/turbin");
await expect(page.locator(".turbine-viewer")).toHaveAttribute(
  "data-state",
  "ready",
  { timeout: 30000 },
);
await page.getByRole("button", { name: "Dekatkan", exact: true }).click();
await page.getByRole("link", { name: "Metode", exact: true }).click();
const rows = Array.from(
  { length: 25 },
  (_, i) =>
    `${2022 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01,${7 + i * 0.01},${170 + i * 0.1},${99 - i * 0.01},${0.3 + i * 0.001},${1 + i * 0.01}`,
);
const csv =
  "date,pressure_bara,temperature_degC,steam_quality_percent,ncg_percent_mass,tds_ppm\n" +
  rows.join("\n");
await page.getByLabel("Unggah Excel atau CSV").setInputFiles({
  name: "production-synthetic.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(csv),
});
await expect(page.getByRole("status")).toContainText("25 pembacaan berhasil");
await page.getByRole("button", { name: "Hitung ulang analisis" }).click();
await expect(page.getByRole("status")).toContainText(
  "125 penilaian dihitung ulang",
);
await page.getByRole("button", { name: "GPR · prediksi" }).click();
await page.getByRole("button", { name: "Jalankan benchmark GPR" }).click();
await expect(page.locator(".forecast-panel [role=status]")).toContainText(
  "Benchmark selesai",
  { timeout: 60000 },
);
await expect(page.locator(".forecast-panel tbody tr")).toHaveCount(23);
await page.getByRole("link", { name: "Analisis", exact: true }).click();
await expect(page.locator(".data-table tbody tr")).toHaveCount(25);
const download = page.waitForEvent("download");
await page.getByRole("button", { name: "Unduh JSON penilaian" }).click();
expect((await download).suggestedFilename()).toBe("penilaian.json");
expect(errors).toEqual([]);
await browser.close();
console.log(
  "PASS: production mesh, controls, built import worker, synthetic CSV, robust recomputation, actual local GPR, chart/table and export; no required HTTP/runtime errors.",
);
