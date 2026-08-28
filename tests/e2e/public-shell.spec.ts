import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "./fixtures"

/**
 * Shared public-shell guarantees for every public route (AGENTS.md §13).
 *
 * These routes were stubs until the program-conversion slice; the boundaries
 * they pin have not changed, only widened: no child or family data is
 * collected anywhere, the standardized phone number is the only one published,
 * and every page keeps one h1 inside the shared shell.
 */
const ROUTES = [
  { path: "/programs", h1: "Published programs" },
  { path: "/calendar", h1: "Plan your learning season" },
  { path: "/about", h1: "A haven for curious learners and connected families" },
  { path: "/programs/art-lab", h1: "Art Lab" },
  { path: "/programs/etiquette-series", h1: "Etiquette Series" },
  { path: "/guidance", h1: "Not sure where to begin?" },
  { path: "/resources", h1: "Support for every step of the journey" },
] as const

for (const route of ROUTES) {
  test.describe(route.path, () => {
    test("has no axe violations", async ({ page }) => {
      await page.goto(route.path)
      await page.waitForLoadState("networkidle")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })

    test("renders one h1 inside the shared public shell", async ({ page }) => {
      await page.goto(route.path)
      await expect(page.locator("h1")).toHaveCount(1)
      await expect(page.locator("h1")).toHaveText(route.h1)
      await expect(page.getByRole("banner")).toBeVisible()
      await expect(page.getByRole("contentinfo")).toBeVisible()
      await page.keyboard.press("Tab")
      await expect(
        page.getByRole("link", { name: "Skip to main content" }),
      ).toBeFocused()
    })

    test("publishes only the standardized phone number", async ({ page }) => {
      await page.goto(route.path)
      const body = await page.locator("body").innerText()
      /* QA-003 resolved 2026-08-27: one number everywhere. */
      expect(body).not.toContain("239-347-93556")
      expect(body).toContain("239-347-9356")
    })

    test("asks for no child or student information", async ({ page }) => {
      await page.goto(route.path)
      /* AGENTS.md §11 and MPS-RUL-006: the public journey collects nothing
         about a child. The guidance form collects adult contact details only. */
      const fieldNames = await page
        .locator("input, textarea, select")
        .evaluateAll((nodes) =>
          nodes.map((n) => `${n.getAttribute("name") ?? ""}`.toLowerCase()),
        )
      for (const name of fieldNames) {
        /* Whole-word match: "message" legitimately contains "age". */
        expect(name).not.toMatch(
          /(^|[^a-z])(child|student|birth|age|grade|dob)([^a-z]|$)/,
        )
      }

      const labels = (await page.locator("main").innerText()).toLowerCase()
      expect(labels).not.toContain("child's date of birth")
      expect(labels).not.toContain("child's name")
    })
  })
}

test("the catalog collects nothing and offers no enrollment or checkout", async ({
  page,
}) => {
  await page.goto("/programs")

  expect(await page.locator("form, input, textarea, select").count()).toBe(0)

  const body = (await page.locator("body").innerText()).toLowerCase()
  for (const forbidden of [
    "enroll now",
    "register now",
    "pay now",
    "checkout",
    "seats left",
    "sold out",
  ]) {
    expect(body).not.toContain(forbidden)
  }
  expect(await page.locator('a[href*="checkout"]').count()).toBe(0)
})

test("every placeholder image on /programs is labelled demo-only", async ({
  page,
}) => {
  await page.goto("/programs")
  const alts = await page
    .locator("main img")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("alt")))
  /* Three of the eight published programs have placeholder art; the rest
     render a decorative panel with no image at all. */
  expect(alts.length).toBe(3)
  for (const alt of alts) {
    expect(alt).toMatch(/^Placeholder photo — demo only\./)
  }
})

test("View Details opens the program's own detail page", async ({ page }) => {
  await page.goto("/")
  await page
    .getByRole("link", { name: /^View Details for Harvest Explorers/ })
    .click()
  await expect(page).toHaveURL(/\/programs\/harvest-explorers$/)
  await expect(page.locator("h1")).toHaveText("Harvest Explorers")
})
