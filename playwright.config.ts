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
  /**
   * One worker, because every suite shares ONE database.
   *
   * The fixtures are seeded rows, and a number of tests change them: programs
   * are published and unpublished, enrollment states are moved along. With two
   * workers those mutations interleave with other tests' reads, so results
   * depended on timing rather than on the code -- a program list assertion
   * failed because a parallel test had the draft published at that instant, and
   * visual baselines captured a record mid-change. Both look like product
   * defects and are not.
   *
   * Parallelism here would need a database per worker, which the local Supabase
   * stack does not provide. Correctness first: the whole matrix is a few
   * minutes.
   */
  workers: 1,
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
