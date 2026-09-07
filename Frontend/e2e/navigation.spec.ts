import { test, expect } from "@playwright/test";
import { videoCards, videoCount } from "./support/helpers";

test.describe("navigation and search", () => {
    test("header exposes the signed-out surface", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("link", { name: "videotube" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Trending" })).toBeVisible();
        await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();

        // Upload and Studio are session-gated.
        await expect(page.getByRole("link", { name: "Upload" })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Studio" })).toHaveCount(0);
    });

    test("search box routes to the results page", async ({ page }) => {
        await page.goto("/");
        await page.getByLabel("Search videos").fill("ocean");
        await page.getByLabel("Search videos").press("Enter");

        await expect(page).toHaveURL(/\/search\?q=ocean/);
        await expect(page.getByRole("heading", { name: /Results for/ })).toBeVisible();
    });

    test("search with no query invites one instead of erroring", async ({ page }) => {
        await page.goto("/search");
        await expect(page.getByRole("heading", { name: "Search videos" })).toBeVisible();
    });

    test("a query with no matches explains itself", async ({ page }) => {
        await page.goto("/search?q=zzzznotarealquery12345");
        await expect(page.getByRole("heading", { name: /Nothing matches/ })).toBeVisible();
        await expect(page.getByRole("link", { name: "Back to feed" })).toBeVisible();
    });

    test("search results are real videos", async ({ page, request }) => {
        test.skip((await videoCount(request)) === 0, "database has no videos");

        await page.goto("/search?q=a");
        const heading = page.getByRole("heading", { name: /Results for/ });
        await expect(heading).toBeVisible();

        // Either results or the empty state — both are correct, a crash is not.
        const cards = videoCards(page);
        const empty = page.getByRole("heading", { name: /Nothing matches/ });
        await expect(cards.first().or(empty)).toBeVisible();
    });

    test("unknown routes render the 404 page", async ({ page }) => {
        const response = await page.goto("/this-route-does-not-exist");
        expect(response?.status()).toBe(404);
        await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    });

    test("a malformed video id 404s rather than crashing", async ({ page }) => {
        await page.goto("/watch/not-a-valid-object-id");
        // The backend rejects the id; the page must degrade to a readable
        // message, not an unhandled server exception.
        await expect(
            page.getByRole("heading", { name: /Page not found|Can't load this video/ })
        ).toBeVisible();
    });
});
