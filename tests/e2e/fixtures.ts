import { expect, test as base } from "@playwright/test"

/**
 * Every test runs with a console guard: no page may log an error or throw an
 * uncaught exception. This catches hydration mismatches and component misuse —
 * the Base UI `nativeButton` warning that link-styled buttons triggered was
 * exactly this class of bug.
 *
 * React strips its dev-only warnings from production bundles and this suite
 * runs a production build, so this guard covers runtime errors; the semantics
 * tests are what pin dev-only warnings like `nativeButton`.
 */
const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = []

      page.on("console", (message) => {
        if (message.type() === "error") {
          problems.push(`console.error: ${message.text()}`)
        }
      })
      page.on("pageerror", (error) => {
        problems.push(`pageerror: ${error.message}`)
      })

      await use()

      expect(problems, "page logged errors").toEqual([])
    },
    { auto: true },
  ],
})

export { test, expect }
