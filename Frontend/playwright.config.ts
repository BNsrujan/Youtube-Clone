import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * Ports are deliberately not 3000/8000: this machine routinely has other dev
 * servers on both, and a suite that silently tests somebody else's app is
 * worse than one that fails to start. `reuseExistingServer` is off in CI so a
 * stale process can never be mistaken for a passing run.
 */
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 3100);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8100);

const BASE_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const API_ORIGIN = process.env.E2E_API_ORIGIN ?? `http://127.0.0.1:${BACKEND_PORT}`;

export default defineConfig({
    testDir: "./e2e",
    // The app is a shared, stateful backend: comments and likes written by one
    // test are visible to every other. Serial execution keeps that honest.
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

    // Server rendering fans out to five retrieval sources per feed request, so
    // first paint on a cold Next.js dev compile is genuinely slow.
    timeout: 60_000,
    expect: { timeout: 15_000 },

    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },

    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ],

    webServer: process.env.E2E_NO_SERVER
        ? undefined
        : [
              {
                  command: "npm --prefix ../Backend run start",
                  port: BACKEND_PORT,
                  reuseExistingServer: !process.env.CI,
                  timeout: 120_000,
                  stdout: "pipe",
                  stderr: "pipe",
                  env: { PORT: String(BACKEND_PORT) },
              },
              {
                  command: `npm run dev -- --port ${FRONTEND_PORT}`,
                  port: FRONTEND_PORT,
                  reuseExistingServer: !process.env.CI,
                  timeout: 120_000,
                  stdout: "pipe",
                  stderr: "pipe",
                  env: { API_ORIGIN },
              },
          ],
});
