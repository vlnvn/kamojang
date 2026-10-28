import { chromium, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const hardware = process.argv.includes("--hardware");
const base = process.env.KAMOJANG_BASE_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({
  args: hardware ? ["--use-angle=d3d11"] : ["--enable-unsafe-swiftshader"],
});
const results = [];
for (const viewport of [
  { width: 1600, height: 960, dpr: 1 },
  { width: 430, height: 932, dpr: 2 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    reducedMotion: "reduce",
  });
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await page.goto(base + "/#/turbin");
  await expect(page.locator(".turbine-viewer")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30000 },
  );
  const metrics = JSON.parse(
    await page.locator(".turbine-viewer").getAttribute("data-metrics"),
  );
  await page.getByRole("button", { name: "Mulai orbit kamera" }).click();
  const timing = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const intervals = [];
        let first = 0,
          previous = 0;
        const tick = (now) => {
          if (!first) first = now;
          if (previous) intervals.push(now - previous);
          previous = now;
          if (now - first < 3000) requestAnimationFrame(tick);
          else {
            const sorted = [...intervals].sort((a, b) => a - b);
            resolve({
              sample_ms: now - first,
              frames: intervals.length,
              observed_browser_raf_fps:
                1000 /
                (intervals.reduce((a, b) => a + b, 0) / intervals.length),
              p95_frame_interval_ms: sorted[Math.floor(sorted.length * 0.95)],
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.getByRole("button", { name: "Jeda orbit kamera" }).click();
  const latency = await page
    .getByRole("button", { name: "Putar kiri" })
    .evaluate(
      (button) =>
        new Promise((resolve) => {
          const start = performance.now();
          button.click();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(performance.now() - start)),
          );
        }),
    );
  results.push({
    viewport,
    metrics,
    timing,
    click_to_two_raf_ms: latency,
    network: await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => r.name.endsWith(".glb"))
        .map((r) => ({
          transfer_bytes: r.transferSize,
          encoded_bytes: r.encodedBodySize,
          duration_ms: r.duration,
        })),
    ),
    failures,
    interpretation: metrics.renderer.includes("SwiftShader")
      ? "Software-rendered lab result; not physical GPU performance"
      : "Browser-reported renderer; local device lab observation, not field CWV",
  });
  await page.close();
}
await mkdir(".private/model-audit", { recursive: true });
await writeFile(
  `.private/model-audit/performance-${hardware ? "hardware-request" : "software"}.json`,
  JSON.stringify(
    { date: "2026-10-28", browser: browser.version(), base, results },
    null,
    2,
  ),
);
console.log(JSON.stringify(results, null, 2));
await browser.close();
