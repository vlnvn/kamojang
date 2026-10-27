import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
await mkdir(".private/model-audit", { recursive: true });
const results = {};
for (const variant of ["optimized", "source"]) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 960 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (variant === "source")
    await page.route("**/models/steam-turbine.glb", (route) =>
      route.fulfill({
        path: ".private/turbine-source/source-preview.glb",
        contentType: "model/gltf-binary",
      }),
    );
  await page.goto("http://127.0.0.1:5173/#/turbin");
  await expect(page.locator(".turbine-viewer")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 60000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator(".turbine-canvas")
    .screenshot({ path: `.private/model-audit/${variant}.png` });
  results[variant] = {
    metrics: JSON.parse(
      await page.locator(".turbine-viewer").getAttribute("data-metrics"),
    ),
    errors,
  };
  await page.close();
}
await sharp(await readFile(".private/model-audit/optimized.png"))
  .webp({ quality: 88 })
  .toFile("public/models/steam-turbine-poster.webp");
await writeFile(
  ".private/model-audit/render-metrics.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
await browser.close();
