import { test, expect } from "@playwright/test";
import { videoCards, videoCount } from "./support/helpers";

test.describe("trending", () => {
    test("renders with its ranking formula on show", async ({ page }) => {
        await page.goto("/trending");
        await expect(page.getByRole("heading", { name: "Trending" })).toBeVisible();
        await expect(page.getByText(/log₁₀\(engagement\)/)).toBeVisible();
    });

    test("category filter is URL state and survives reload", async ({ page, request }) => {
        test.skip((await videoCount(request)) === 0, "database has no videos");

        await page.goto("/trending");
        const filter = page.getByLabel("Filter by category");
        await expect(filter).toBeVisible();

        await filter.selectOption("music");
        await expect(page).toHaveURL(/category=music/);

        await page.reload();
        await expect(page.getByLabel("Filter by category")).toHaveValue("music");
    });

    test("shows either ranked videos or an actionable empty state", async ({ page }) => {
        await page.goto("/trending");
        const cards = videoCards(page);
        const empty = page.getByRole("heading", { name: "No trending videos" });
        await expect(cards.first().or(empty)).toBeVisible();
    });
});
