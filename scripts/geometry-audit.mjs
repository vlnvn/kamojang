import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 960 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
const source = process.env.KAMOJANG_PRIVATE_SOURCE;
if (source) {
  await page.goto("http://127.0.0.1:5173/#/metode");
  await page.getByLabel("Unggah Excel atau CSV").setInputFiles(source);
  await page
    .getByRole("status")
    .filter({ hasText: "44 pembacaan berhasil" })
    .waitFor();
}
const cases = {
  ringkasan: {
    ".sidebar": [0, 0, 236, 960],
    ".topbar": [283, 0, 1260, 75],
    ".hero-copy h1": [281, 177, 560, 110],
    ".model-stage": [864, 110, 695, 728],
  },
  analisis: {
    ".sidebar": [0, 0, 236, 960],
    ".chart-panel": [285, 317, 881, 517],
    ".inspector": [1185, 317, 374, 583],
    ".page-heading h1": [285, 119, 1140, 78],
  },
  metode: {
    ".source-panel": [285, 273, 603, 608],
    ".method-panel": [909, 273, 650, 608],
    ".page-heading h1": [285, 119, 1140, 78],
  },
};
const result = {};
for (const [route, targets] of Object.entries(cases)) {
  await page.goto(`http://127.0.0.1:5173/#/${route}`);
  await page.evaluate(() => document.fonts.ready);
  if (route === "ringkasan")
    await expect(page.locator(".turbine-viewer")).toHaveAttribute(
      "data-state",
      "ready",
      { timeout: 30000 },
    );
  result[route] = {};
  for (const [selector, expected] of Object.entries(targets)) {
    const actual = await page.locator(selector).evaluate((e) => {
      const b = e.getBoundingClientRect(),
        s = getComputedStyle(e);
      return {
        rect: [b.x, b.y, b.width, b.height],
        font: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        radius: s.borderRadius,
        padding: s.padding,
        shadow: s.boxShadow,
      };
    });
    const deviations = actual.rect.map((n, i) => +(n - expected[i]).toFixed(3));
    const alignmentPass = deviations.slice(0, 2).every((n) => Math.abs(n) <= 2);
    result[route][selector] = {
      expected,
      actual,
      deviations,
      alignment_gate: alignmentPass ? "PASS" : "FAIL",
      note: selector.includes("h1")
        ? "Figma text boxes are fixed widths/heights; production headings use natural CSS sizing. Position is audited separately."
        : undefined,
    };
  }
}
await mkdir(".private/continuation", { recursive: true });
await writeFile(
  ".private/continuation/geometry.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
await browser.close();
