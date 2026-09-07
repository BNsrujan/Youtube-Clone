import { expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * Seeded credentials. seedMedia.js creates these channels; the password is
 * shared across all of them and is also printed on the sign-in page.
 */
export const SEED_USER = { username: "orbitlab", password: "Password123!" };
export const SEED_USER_ALT = { username: "quietmachines", password: "Password123!" };

export const API_BASE = "/api/v1";

/** A video card is the one repeated unit on every listing page. */
export const videoCards = (page: Page) => page.locator('a[href^="/watch/"]');

/**
 * Sign in through the real form rather than by injecting a cookie — the login
 * round trip sets httpOnly cookies the Server Components read on the next
 * navigation, and faking it would skip exactly the part worth testing.
 */
export async function signIn(page: Page, user = SEED_USER) {
    await page.goto("/login");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // The header swapping to "Sign out" is the observable end of the flow:
    // it means the cookie landed and the server re-rendered with a session.
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

export async function signOut(page: Page) {
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
}

/** First video id available from the API, or null when the DB is unseeded. */
export async function firstVideoId(request: APIRequestContext): Promise<string | null> {
    const res = await request.get(`${API_BASE}/videos?limit=1`);
    if (!res.ok()) return null;
    const body = await res.json();
    return body?.data?.docs?.[0]?._id ?? null;
}

export async function videoCount(request: APIRequestContext): Promise<number> {
    const res = await request.get(`${API_BASE}/videos?limit=1`);
    if (!res.ok()) return 0;
    const body = await res.json();
    return body?.data?.totalDocs ?? 0;
}
