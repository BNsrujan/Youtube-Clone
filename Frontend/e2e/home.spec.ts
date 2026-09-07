import { test, expect } from "@playwright/test";
import { videoCards, videoCount, signIn } from "./support/helpers";

test.describe("home feed", () => {
    test("renders the anonymous feed server-side", async ({ page, request }) => {
        const count = await videoCount(request);
        test.skip(count === 0, "database has no videos — run npm run seed:media");

        const response = await page.goto("/");
        expect(response?.status()).toBe(200);

        // Signed out, the feed is the cold-start slate.
        await expect(page.getByRole("heading", { name: "Popular now" })).toBeVisible();

        const cards = videoCards(page);
        await expect(cards.first()).toBeVisible();
        expect(await cards.count()).toBeGreaterThan(0);
    });

    test("feed content is in the initial HTML, not fetched after hydration", async ({ page, request }) => {
        test.skip((await videoCount(request)) === 0, "database has no videos");

        // The point of putting the feed in a Server Component is that it
        // survives with JS disabled and is visible to a crawler. Asserting on
        // the raw response body is the only way to prove it actually did.
        const response = await page.goto("/");
        const html = await response!.text();

        expect(html).toContain("Popular now");
        expect(html).toMatch(/href="\/watch\/[a-f0-9]{24}/);
    });

    test("announces which retrieval strategy produced the feed", async ({ page, request }) => {
        test.skip((await videoCount(request)) === 0, "database has no videos");

        await page.goto("/");
        await expect(
            page.locator("text=/personalised · \\d+ candidates ranked|cold start · trending \\+ freshness|fallback/")
        ).toBeVisible();
    });

    test("a card navigates to its watch page", async ({ page, request }) => {
        test.skip((await videoCount(request)) === 0, "database has no videos");

        await page.goto("/");
        const first = videoCards(page).first();
        const href = await first.getAttribute("href");
        expect(href).toMatch(/^\/watch\/[a-f0-9]{24}/);

        await first.click();
        await expect(page).toHaveURL(/\/watch\/[a-f0-9]{24}/);
        await expect(page.locator("video")).toBeVisible();
    });

    test("signed in, the feed becomes personalised and offers scoring", async ({ page, request }) => {
        test.skip((await videoCount(request)) === 0, "database has no videos");

        await signIn(page);
        await page.goto("/");

        await expect(page.getByRole("heading", { name: "For you" })).toBeVisible();

        // Scoring toggle is URL state, so it must survive a reload.
        const toggle = page.getByRole("button", { name: /show scoring/i });
        await expect(toggle).toBeVisible();
        await toggle.click();
        await expect(page).toHaveURL(/explain=true/);
        await expect(page.getByRole("button", { name: /hide scoring/i })).toBeVisible();

        await page.reload();
        await expect(page.getByRole("button", { name: /hide scoring/i })).toBeVisible();
    });
});
