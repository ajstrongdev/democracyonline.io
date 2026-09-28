import { expect, test } from "@playwright/test";

test("two players see a new post without a refresh", async ({
  page,
  browser,
  request,
}) => {
  const unauthenticated = await request.get("/api/live");
  expect(unauthenticated.status()).toBe(401);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled();
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
  await page
    .getByRole("link", { name: /Z.com Join the public conversation/ })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/social/);
  await expect(
    page.getByRole("dialog", { name: "Dashboard workspace" }),
  ).toBeVisible();
  const readerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:31017",
  });
  try {
    const reader = await readerContext.newPage();
    const liveConnection = reader.waitForResponse(
      (response) =>
        response.url().endsWith("/api/live") && response.status() === 200,
    );
    await reader.goto("/login");
    await expect(reader.getByRole("button", { name: "Sign In" })).toBeEnabled();
    await reader.getByLabel("Email").fill("reader@oscana.test");
    await reader.getByLabel("Password").fill("local-e2e-password");
    await reader.getByRole("button", { name: "Sign In" }).click();
    await expect(reader).toHaveURL(/\/dashboard/);
    await reader
      .getByRole("link", { name: /Z.com Join the public conversation/ })
      .click();
    await expect(
      reader.getByRole("dialog", { name: "Dashboard workspace" }),
    ).toBeVisible();
    await liveConnection;

    const post = `E2E smoke ${Date.now()} @E2EReader`;
    await page.getByLabel("Write a post").fill(post);
    await page.getByRole("button", { name: "Publish post" }).click();
    await expect(page.getByText(post, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Write a post")).toHaveValue("");
    await expect(
      reader.getByRole("button", { name: "Show 1 new post" }),
    ).toBeVisible({ timeout: 10_000 });
    await reader.getByRole("button", { name: "Show 1 new post" }).click();
    await expect(reader.getByText(post).first()).toBeVisible();
    await reader.getByRole("group", { name: "Filter posts by account" }).getByRole("button", { name: "players" }).click();
    await expect(reader.getByText(post).first()).toBeVisible();
    await reader.getByRole("group", { name: "Filter posts by account" }).getByRole("button", { name: "all" }).click();
    await expect(reader.getByText(post).first()).toBeVisible();
    await reader.getByRole("dialog", { name: "Dashboard workspace" }).getByRole("button", { name: "Close" }).first().click();
    await expect(reader.getByText("1 mention across 1 account")).toBeVisible({ timeout: 10_000 });
    await expect(reader.locator(".wiki-record-row").filter({ hasText: post }).first()).toBeVisible();
    await reader.getByRole("button", { name: "Account settings" }).click();
    await reader.getByRole("tab", { name: "Alerts" }).click();
    await expect(reader.getByText("Web Push has not been configured on this server.")).toBeVisible();
    await reader.getByRole("checkbox", { name: "Show mention text on the lock screen" }).check();
    await reader.getByRole("checkbox", { name: "Quiet hours for Web Push" }).check();
    await reader.getByLabel("Time zone (IANA)").fill("America/New_York");
    await reader.getByRole("button", { name: "Save preferences" }).click();
    await expect(reader.getByText("Notification preferences saved")).toBeVisible();
    await reader.getByRole("dialog", { name: "Account settings" }).getByRole("button", { name: "Close" }).first().click();
    await expect(reader.getByText("1 mention across 1 account")).toBeVisible();
    await reader.getByRole("button", { name: "Account settings" }).click();
    await reader.getByRole("tab", { name: "Alerts" }).click();
    await expect(reader.getByRole("checkbox", { name: "Show mention text on the lock screen" })).toBeChecked();
    await expect(reader.getByRole("checkbox", { name: "Quiet hours for Web Push" })).toBeChecked();
    await expect(reader.getByLabel("Time zone (IANA)")).toHaveValue("America/New_York");
    await reader.getByRole("dialog", { name: "Account settings" }).getByRole("button", { name: "Close" }).first().click();
    await expect(reader.getByText("Your next moves", { exact: true })).toBeVisible();
    const deepLink = await page.goto("/dashboard/social");
    expect(deepLink?.status()).toBe(200);
    await expect(
      page.getByRole("dialog", { name: "Dashboard workspace" }),
    ).toBeVisible();
  } finally {
    await readerContext.close();
  }
});
