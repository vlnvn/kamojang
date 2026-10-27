import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const privateSource = process.env.KAMOJANG_PRIVATE_SOURCE;
const output = privateSource ? ".private/visual" : "docs/images";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 960 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
await page.goto("http://127.0.0.1:5173/#/metode");
if (privateSource) {
  await page.getByLabel("Unggah Excel atau CSV").setInputFiles(privateSource);
  await page
    .getByRole("status")
    .filter({ hasText: "44 pembacaan berhasil" })
    .waitFor();
}
const evidence = {};
for (const route of ["ringkasan", "analisis", "metode"]) {
  await page
    .getByRole("link", {
      name: { ringkasan: "Ringkasan", analisis: "Analisis", metode: "Metode" }[
        route
      ],
      exact: true,
    })
    .click();
  await expect(page.locator("h1")).toHaveText(
    {
      ringkasan: "Kondisi uap.",
      analisis: "Telusuri pengukuran",
      metode: "Siapkan analisis",
    }[route],
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(output, `${privateSource ? "actual-" : ""}${route}.png`),
    animations: "disabled",
  });
  evidence[route] = await page.evaluate(() => ({
    heading: document.querySelector("h1")?.getBoundingClientRect().toJSON(),
    sidebar: document
      .querySelector(".sidebar")
      ?.getBoundingClientRect()
      .toJSON(),
    fonts:
      document.fonts.check('600 77px "Instrument Sans Variable"') &&
      document.fonts.check('400 16px "IBM Plex Sans"'),
    navigation: performance
      .getEntriesByType("navigation")
      .map((e) => e.toJSON()),
    resources: performance.getEntriesByType("resource").map((e) => ({
      name: e.name,
      bytes: e.transferSize,
      duration: e.duration,
    })),
  }));
}
await writeFile(
  path.join(output, "browser-metrics.json"),
  JSON.stringify(evidence, null, 2),
);
await browser.close();
console.log(
  `Captured 1600×960 screenshots in ${output}; ${privateSource ? "private source" : "synthetic example only"}`,
);
