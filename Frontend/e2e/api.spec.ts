import { test, expect } from "@playwright/test";

/**
 * Contract smoke tests, driven through the Next.js rewrite rather than
 * straight at Express — that proves the proxy the browser actually uses is
 * wired up, not just that the backend is alive.
 */
test.describe("api via the Next.js proxy", () => {
    test("healthcheck responds", async ({ request }) => {
        const res = await request.get("/api/v1/healthcheck");
        expect(res.status()).toBe(200);
        expect((await res.json()).message).toBe("OK");
    });

    test("responses use the ApiResponse envelope", async ({ request }) => {
        const res = await request.get("/api/v1/videos?limit=2");
        expect(res.ok()).toBeTruthy();

        const body = await res.json();
        expect(body).toMatchObject({ statusCode: 200, success: true });
        expect(Array.isArray(body.data.docs)).toBe(true);
        expect(typeof body.data.totalDocs).toBe("number");
    });

    test("anonymous feed reports a strategy", async ({ request }) => {
        const res = await request.get("/api/v1/recommendations/feed?limit=5");
        expect(res.ok()).toBeTruthy();

        const { data } = await res.json();
        expect(["personalised", "cold_start", "fallback"]).toContain(data.strategy);
        expect(Array.isArray(data.items)).toBe(true);
    });

    test("protected routes reject anonymous callers", async ({ request }) => {
        const res = await request.get("/api/v1/dashboard/stats");
        expect(res.status()).toBe(401);
        expect((await res.json()).success).toBe(false);
    });

    test("errors come back as JSON, never an HTML stack trace", async ({ request }) => {
        const res = await request.get("/api/v1/videos/not-a-valid-id");
        expect(res.status()).toBeGreaterThanOrEqual(400);
        expect(res.headers()["content-type"]).toContain("application/json");

        const body = await res.json();
        expect(body.success).toBe(false);
        expect(typeof body.message).toBe("string");
    });
});
