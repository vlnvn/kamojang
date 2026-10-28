import { chromium, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 960 },
  deviceScaleFactor: 1,
  timezoneId: "Asia/Jakarta",
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/#/metode");
await page.getByRole("button", { name: "Isolation Forest · riset" }).click();
await page.getByLabel("Uji pengukuran manual").check();
const started = performance.now();
await page.getByRole("button", { name: "Jalankan Isolation Forest" }).click();
await expect(page.locator(".isolation-panel [role=status]")).toContainText(
  "Eksperimen selesai",
  { timeout: 60000 },
);
await page.evaluate(() => document.fonts.ready);
await page
  .locator(".isolation-panel")
  .screenshot({ path: "docs/images/isolation.png" });
const runtime = {
  synthetic_only: true,
  flow_ms: performance.now() - started,
  browser: browser.version(),
  errors,
};
await page.getByRole("link", { name: "Ringkasan", exact: true }).click();
await expect(page.locator(".turbine-viewer")).toHaveAttribute(
  "data-state",
  "ready",
  { timeout: 30000 },
);
await page
  .getByRole("button", { name: "Jelajahi turbin", exact: true })
  .click();
await expect(
  page.getByRole("heading", { name: "Inspeksi turbin 3D", exact: true }),
).toBeVisible();
await page.screenshot({ path: "docs/images/turbin-inspeksi.png" });
await mkdir(".private/enhancement", { recursive: true });
await writeFile(
  ".private/enhancement/capture.json",
  JSON.stringify(runtime, null, 2),
);
expect(errors).toEqual([]);
await browser.close();
console.log(
  "PASS: captured actual synthetic multivariate results and expanded genuine turbine inspection; no page errors.",
);
