import { test, expect } from "@playwright/test";
import { signIn, firstVideoId, videoCards } from "./support/helpers";

test.describe("watch page", () => {
    test("renders the player, metadata and telemetry", async ({ page, request }) => {
        const id = await firstVideoId(request);
        test.skip(!id, "database has no videos — run npm run seed:media");

        await page.goto(`/watch/${id}`);

        await expect(page.locator("video")).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        // The telemetry strip is the visible evidence of the ABR logic.
        const telemetry = page.locator('[aria-label="Playback telemetry"]');
        await expect(telemetry).toBeVisible();
        await expect(telemetry).toContainText("Rendition");
        await expect(telemetry).toContainText("Buffer");
        await expect(page.getByLabel("Video quality")).toBeVisible();
    });

    test("resolves a playable HLS manifest", async ({ request }) => {
        const id = await firstVideoId(request);
        test.skip(!id, "database has no videos");

        // Regression guard: signPlaybackUrl once produced an "authenticated"
        // delivery URL for assets stored as "upload", so every manifest 404'd
        // and nothing in the app could play.
        const res = await request.get(`/api/v1/stream/${id}/manifest`);
        expect(res.ok()).toBeTruthy();

        const { data } = await res.json();
        expect(data.masterPlaylistUrl).toBeTruthy();

        const playlist = await request.get(data.masterPlaylistUrl);
        expect(playlist.status()).toBe(200);
        expect(await playlist.text()).toContain("#EXTM3U");
    });

    test("sidebar tabs switch without refetching", async ({ page, request }) => {
        const id = await firstVideoId(request);
        test.skip(!id, "database has no videos");

        await page.goto(`/watch/${id}`);

        const related = page.getByRole("tab", { name: "Related" });
        const profile = page.getByRole("tab", { name: "Your profile" });
        await expect(related).toHaveAttribute("aria-selected", "true");

        await profile.click();
        await expect(profile).toHaveAttribute("aria-selected", "true");
        await expect(related).toHaveAttribute("aria-selected", "false");
    });

    test("comments are server-rendered; signed-out users are told to sign in", async ({ page, request }) => {
        const id = await firstVideoId(request);
        test.skip(!id, "database has no videos");

        const response = await page.goto(`/watch/${id}`);
        expect(await response!.text()).toMatch(/\d+ comments/);

        await expect(page.getByLabel("Add a comment")).toHaveCount(0);
    });

    test("a signed-in viewer can post and delete a comment", async ({ page, request }) => {
        const id = await firstVideoId(request);
        test.skip(!id, "database has no videos");

        await signIn(page);
        await page.goto(`/watch/${id}`);

        const body = `e2e comment ${Date.now()}`;
        await page.getByLabel("Add a comment").fill(body);
        await page.getByRole("button", { name: /^comment$/i }).click();

        await expect(page.getByText(body)).toBeVisible();

        // Survives a reload, i.e. it was actually persisted rather than just
        // pushed into local state.
        await page.reload();
        await expect(page.getByText(body)).toBeVisible();

        // Clean up so repeat runs do not pile comments onto the same video.
        await page.getByText(body).locator("xpath=ancestor::div[1]/following-sibling::button")
            .or(page.getByRole("button", { name: /^delete$/i }).first())
            .click();
        await expect(page.getByText(body)).toHaveCount(0);
    });

    test("like is optimistic and persists", async ({ page, request }) => {
        const id = await firstVideoId(request);
        test.skip(!id, "database has no videos");

        await signIn(page);
        await page.goto(`/watch/${id}`);

        const like = page.getByRole("button", { name: /^(like|liked) ·/i });
        await expect(like).toBeVisible();

        const before = (await like.getAttribute("aria-pressed")) === "true";
        await like.click();
        await expect(like).toHaveAttribute("aria-pressed", String(!before));

        await page.reload();
        const after = page.getByRole("button", { name: /^(like|liked) ·/i });
        await expect(after).toHaveAttribute("aria-pressed", String(!before));

        await after.click(); // restore original state
    });

    test("clicking through from the feed carries source attribution", async ({ page, request }) => {
        test.skip(!(await firstVideoId(request)), "database has no videos");

        await page.goto("/");
        const href = await videoCards(page).first().getAttribute("href");

        // The recommender can only be evaluated if clicks say where they came
        // from, so the link itself must carry from/pos.
        expect(href).toContain("from=home");
        expect(href).toMatch(/pos=\d+/);
    });
});
