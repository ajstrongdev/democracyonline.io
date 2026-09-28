import { expect, test } from "@playwright/test";
import { Client } from "pg";

test("an open game page reflects committed changes without a document reload", async ({
  page,
}) => {
  const database = new Client({ connectionString: process.env.DATABASE_URL });
  let originalStat:
    | { nation_id: number; stat_key: string; value: number }
    | undefined;
  await database.connect();
  try {
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

    await page.goto("/dashboard/nation");
    await expect(
      page.getByRole("heading", { name: "National indicators" }),
    ).toBeVisible();
    const documentRequests: Array<string> = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document")
        documentRequests.push(request.url());
    });

    const [stat] = (
      await database.query<{
        nation_id: number;
        stat_key: string;
        name: string;
        value: number;
      }>(`
        SELECT nsv.nation_id, nsv.stat_key, nsd.name, nsv.value
        FROM nation_stat_values nsv
        INNER JOIN nation_stat_definitions nsd ON nsd.key = nsv.stat_key
        ORDER BY nsv.stat_key
        LIMIT 1
      `)
    ).rows;
    expect(stat).toBeDefined();
    originalStat = stat;
    const nextValue =
      Number(stat.value) >= 99
        ? Number(stat.value) - 1
        : Number(stat.value) + 1;
    await database.query(
      "UPDATE nation_stat_values SET value = $1 WHERE nation_id = $2 AND stat_key = $3",
      [nextValue, stat.nation_id, stat.stat_key],
    );

    const row = page
      .locator("details")
      .locator("div.px-4.py-3")
      .filter({ hasText: stat.name })
      .first();
    await expect(row.locator("strong")).toHaveText(
      String(Math.round(nextValue)),
      {
        timeout: 8_000,
      },
    );
    expect(documentRequests).toEqual([]);
  } finally {
    if (originalStat) {
      await database.query(
        "UPDATE nation_stat_values SET value = $1 WHERE nation_id = $2 AND stat_key = $3",
        [originalStat.value, originalStat.nation_id, originalStat.stat_key],
      );
    }
    await database.end();
  }
});
