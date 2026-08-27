import { defineConfig, devices } from "@playwright/test"

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
