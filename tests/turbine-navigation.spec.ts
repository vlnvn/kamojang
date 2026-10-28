import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("both turbine entry buttons visibly expand inspection and restore focus", async ({
  page,
}) => {
  await page.goto("/#/ringkasan?sensor=ncg_percent_mass&z=4");
  await expect(page.locator(".turbine-viewer")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30000 },
  );
  const small = (await page.locator(".model-stage").boundingBox())!.width;
  for (const name of ["Jelajahi turbin", "Lihat objek"]) {
    const trigger = page.getByRole("button", { name, exact: true });
    await trigger.click();
    await expect(
      page.getByRole("heading", { name: "Inspeksi turbin 3D", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/turbin\?sensor=ncg_percent_mass&z=4/);
    expect(
      (await page.locator(".model-stage").boundingBox())!.width,
    ).toBeGreaterThan(small * 1.5);
    await expect(
      page.getByRole("group", { name: "Inspeksi turbin 3D", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "← Ringkasan", exact: true })
      .click();
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/ringkasan\?sensor=ncg_percent_mass&z=4/);
  }
});
test("expanded mobile inspection remains accessible and can return from fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/models/steam-turbine.glb", (r) =>
    r.fulfill({ status: 404, body: "" }),
  );
  await page.goto("/#/turbin");
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 30000 });
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
  await page.getByRole("button", { name: "← Ringkasan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kondisi uap.", exact: true }),
  ).toBeVisible();
});
