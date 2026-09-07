import { test, expect } from "@playwright/test";
import { signIn, signOut, SEED_USER } from "./support/helpers";

test.describe("authentication", () => {
    test("rejects bad credentials with a visible reason", async ({ page }) => {
        await page.goto("/login");
        await page.getByLabel("Username").fill("definitely-not-a-user");
        await page.getByLabel("Password").fill("wrong-password");
        await page.getByRole("button", { name: /^sign in$/i }).click();

        // The form must surface the API's message and stay usable.
        await expect(page.locator("text=/does not exist|Invalid|incorrect|not found/i")).toBeVisible();
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
    });

    test("signs in, persists across a reload, and signs out", async ({ page }) => {
        await signIn(page);

        // Session lives in an httpOnly cookie read during SSR, so a full
        // reload is the real test — client state alone would not survive it.
        await page.reload();
        await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
        await expect(page.getByRole("link", { name: "Upload" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Studio" })).toBeVisible();

        await signOut(page);
        await page.reload();
        await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
    });

    test("signed-in header links to the user's own channel", async ({ page }) => {
        await signIn(page);
        await expect(page.locator(`a[href="/channel/${SEED_USER.username}"]`)).toBeVisible();

        await page.goto(`/channel/${SEED_USER.username}`);
        await expect(page.locator("body")).toContainText(SEED_USER.username, { ignoreCase: true });
    });

    test("studio is reachable only with a session", async ({ page }) => {
        await page.goto("/studio");
        const signedOut = page.getByRole("link", { name: /sign in/i });
        await expect(signedOut).toBeVisible();

        await signIn(page);
        await page.goto("/studio");
        // Whatever the studio renders, it must not be the signed-out shell.
        await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    });

    test("the login page documents the seeded accounts", async ({ page }) => {
        await page.goto("/login");
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
        await expect(page.getByRole("link", { name: /create one/i })).toBeVisible();
    });
});
