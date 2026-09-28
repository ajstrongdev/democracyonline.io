import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 360, height: 800 },
  isMobile: true,
  hasTouch: true,
});

test("mobile dashboard controls and workspace fit on narrow screens", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ajstrongdev@pm.me");
  await page.getByLabel("Password").fill("local-e2e-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect
    .poll(async () =>
      (await page.context().cookies()).some(
        (cookie) => cookie.name === "__session" && !!cookie.value,
      ),
    )
    .toBe(true);

  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/dashboard");
    await expect(
      page.getByText("Your next moves", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    for (const name of [
      "Open command palette",
      "Choose theme",
      "Account settings",
      "Sign out",
    ]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box, `${name} should be visible at ${width}px`).not.toBeNull();
      expect(
        box!.width,
        `${name} should be at least 44px wide`,
      ).toBeGreaterThanOrEqual(44);
      expect(
        box!.height,
        `${name} should be at least 44px high`,
      ).toBeGreaterThanOrEqual(44);
    }

    const privilegedLink = page.getByRole("link", {
      name: /^(Admin tools|Moderation queue)$/,
    });
    if (await privilegedLink.count()) {
      const box = await privilegedLink.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("button", { name: "Open command palette" }).click();
    const commandPalette = page.getByRole("dialog", {
      name: "Where do you want to go?",
    });
    await expect(commandPalette).toBeVisible();
    const paletteBox = await commandPalette.boundingBox();
    expect(paletteBox).not.toBeNull();
    expect(paletteBox!.x).toBeGreaterThanOrEqual(0);
    expect(paletteBox!.x + paletteBox!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Account settings" }).click();
    const settingsDialog = page.getByRole("dialog", {
      name: "Account settings",
    });
    await expect(settingsDialog).toBeVisible();
    const settingsBox = await settingsDialog.boundingBox();
    expect(settingsBox).not.toBeNull();
    expect(settingsBox!.x).toBeGreaterThanOrEqual(0);
    expect(settingsBox!.x + settingsBox!.width).toBeLessThanOrEqual(width);
    await page.getByRole("tab", { name: "Alerts" }).click();
    await expect(settingsDialog).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/dashboard/social");
    const workspace = page.getByRole("dialog", { name: "Dashboard workspace" });
    await expect(workspace).toBeVisible();
    const workspaceBox = await workspace.boundingBox();
    expect(workspaceBox).not.toBeNull();
    expect(workspaceBox!.x).toBeGreaterThanOrEqual(0);
    expect(workspaceBox!.x + workspaceBox!.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
