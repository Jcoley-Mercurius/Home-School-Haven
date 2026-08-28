import { loadEnvConfig } from "@next/env"
import { defineConfig, devices } from "@playwright/test"

/**
 * Give the test runner the same environment the app gets.
 *
 * Next.js loads `.env.local` itself, but the Playwright process does not, so
 * `process.env.NEXT_PUBLIC_SUPABASE_URL` was undefined in tests even with a
 * project configured. Every `test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL)`
 * guard therefore skipped unconditionally — the cross-role authorization matrix
 * would have reported "skipped" forever while looking perfectly healthy.
 *
 * A test that can never run is worse than no test, so the runner reads the same
 * env files, in the same order, as the app under test.
 */
loadEnvConfig(process.cwd())

/**
 * Foundation Review verification harness (AGENTS.md §13).
 * Runs against a production build so what is verified is what ships.
 * Viewports follow the MDS approved breakpoints (DESIGN-SYSTEM.md §8).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
