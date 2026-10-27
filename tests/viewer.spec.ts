import { test, expect } from "@playwright/test";
test("touch orbit, pinch, high DPR and pointer drag change the actual camera", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/#/turbin");
  await expect(page.locator(".turbine-viewer")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30000 },
  );
  const canvas = page.locator(".turbine-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  const initial = await canvas.getAttribute("data-camera");
  const cdp = await context.newCDPSession(page);
  const x = rect!.x + rect!.width / 2,
    y = rect!.y + rect!.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 60, y: y + 20, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(canvas).not.toHaveAttribute("data-camera", initial!);
  const rotated = await canvas.getAttribute("data-camera");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 25, y, id: 1 },
      { x: x + 25, y, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 60, y, id: 1 },
      { x: x + 60, y, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(canvas).not.toHaveAttribute("data-camera", rotated!);
  expect(
    JSON.parse(
      (await page.locator(".turbine-viewer").getAttribute("data-metrics")) ??
        "{}",
    ).dpr,
  ).toBe(1.5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
test("genuine viewer controls, keyboard, reduced motion and repeated resource disposal", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/turbin");
  const viewer = page.locator(".turbine-viewer");
  await expect(viewer).toHaveAttribute("data-state", "ready", {
    timeout: 30000,
  });
  const metrics = JSON.parse(
    (await viewer.getAttribute("data-metrics")) ?? "{}",
  );
  expect(metrics.triangles).toBeGreaterThan(170000);
  expect(metrics.active_viewers).toBe(1);
  const camera = page.locator(".turbine-canvas");
  const initialPose = await camera.getAttribute("data-camera");
  const rect = (await camera.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + 70,
    rect.y + rect.height / 2 + 25,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(camera).not.toHaveAttribute("data-camera", initialPose!);
  await page.getByRole("button", { name: "Atur ulang", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mulai orbit kamera" }),
  ).toHaveAttribute("aria-pressed", "false");
  for (const name of [
    "Putar kiri",
    "Putar kanan",
    "Dekatkan",
    "Jauhkan",
    "Atur ulang",
  ]) {
    const before = await camera.getAttribute("data-camera");
    await page.getByRole("button", { name, exact: true }).click();
    if (name === "Atur ulang")
      await expect(camera).toHaveAttribute("data-camera", initialPose!);
    else await expect(camera).not.toHaveAttribute("data-camera", before!);
  }
  await page.getByRole("group", { name: "Inspeksi turbin 3D" }).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("+");
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "Mulai orbit kamera" }).click();
  await expect(
    page.getByRole("button", { name: "Jeda orbit kamera" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Jeda orbit kamera" }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("link", { name: "Analisis", exact: true }).click();
    await expect(page.locator(".turbine-canvas canvas")).toHaveCount(0);
    await page.getByRole("link", { name: "Ringkasan", exact: true }).click();
    await expect(viewer).toHaveAttribute("data-state", "ready", {
      timeout: 30000,
    });
    expect(
      JSON.parse((await viewer.getAttribute("data-metrics")) ?? "{}")
        .active_viewers,
    ).toBe(1);
  }
  await page
    .getByRole("button", { name: "Gunakan gambar", exact: true })
    .click();
  await expect(viewer).toHaveAttribute("data-state", "static");
  await expect(page.locator(".turbine-canvas canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Muat ulang model" }).click();
  await expect(viewer).toHaveAttribute("data-state", "ready", {
    timeout: 30000,
  });
  expect(errors).toEqual([]);
});
for (const mode of ["404", "corrupt", "decoder", "webgl"])
  test(`3D ${mode} fails accessibly and core analysis remains available`, async ({
    page,
  }) => {
    if (mode === "webgl")
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...args: unknown[]
        ) {
          if (type === "webgl2") return null;
          return Reflect.apply(original, this, [type, ...args]);
        } as typeof original;
      });
    else if (mode === "decoder")
      await page.route("**/*meshopt*decoder*", (r) => r.abort());
    else
      await page.route("**/models/steam-turbine.glb", (r) =>
        mode === "404"
          ? r.fulfill({ status: 404, body: "" })
          : r.fulfill({ status: 200, body: "corrupt glb" }),
      );
    await page.goto("/#/turbin");
    const viewer = page.locator(".turbine-viewer");
    await expect(viewer).toHaveAttribute("data-state", "error", {
      timeout: 30000,
    });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Render statis/ }),
    ).toBeVisible();
    if (mode === "404") {
      await page.unroute("**/models/steam-turbine.glb");
      await page.getByRole("button", { name: "Muat ulang model" }).click();
      await expect(viewer).toHaveAttribute("data-state", "ready", {
        timeout: 30000,
      });
    }
    await page.getByRole("link", { name: "Analisis", exact: true }).click();
    await expect(page.locator(".data-table tbody tr")).toHaveCount(25);
  });
test("context loss offers recovery without crashing the application", async ({
  page,
}) => {
  await page.goto("/#/turbin");
  await expect(page.locator(".turbine-viewer")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30000 },
  );
  await page.locator(".turbine-canvas canvas").evaluate((canvas) => {
    (canvas as HTMLCanvasElement)
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("Konteks WebGL");
  await page.getByRole("button", { name: "Muat ulang model" }).click();
  await expect(page.locator(".turbine-viewer")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30000 },
  );
});

test("lazy viewer module failure stays inside its panel", async ({ page }) => {
  await page.route("**/src/TurbineViewer.tsx*", (r) => r.abort());
  await page.goto("/#/turbin");
  await expect(page.getByRole("alert")).toContainText(
    "Modul tampilan 3D tidak tersedia",
  );
  await page.getByRole("link", { name: "Analisis", exact: true }).click();
  await expect(page.locator(".data-table tbody tr")).toHaveCount(25);
});

test("slow model loading can switch to actual-mesh fallback immediately", async ({
  page,
}) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/models/steam-turbine.glb", async (r) => {
    await held;
    await r.abort().catch(() => {});
  });
  await page.goto("/#/turbin");
  await expect(page.locator(".turbine-viewer")).toHaveAttribute(
    "data-state",
    "loading",
  );
  await page
    .getByRole("button", { name: "Gunakan gambar", exact: true })
    .click();
  release();
  await expect(page.locator(".turbine-viewer")).toHaveAttribute(
    "data-state",
    "static",
  );
  await expect(page.locator(".turbine-canvas canvas")).toHaveCount(0);
  await page.getByRole("link", { name: "Analisis", exact: true }).click();
  await expect(page.locator(".data-table tbody tr")).toHaveCount(25);
});
