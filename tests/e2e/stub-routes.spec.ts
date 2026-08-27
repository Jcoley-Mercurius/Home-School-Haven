import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "./fixtures"

/**
 * Stub routes added so the home page's calls to action lead somewhere real
 * (owner decision, 2026-08-27). They are deliberately NOT the approved catalog
 * or guidance-request screens, so these tests pin the boundary: they must stay
 * free of enrollment, checkout, and any family-data collection.
 */
const ROUTES = [
  { path: "/programs", h1: "Published programs" },
  { path: "/guidance", h1: "Not sure where to begin?" },
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

    test("collects no family data and offers no enrollment or checkout", async ({
      page,
    }) => {
      await page.goto(route.path)

      /* AGENTS.md §11: no child or family data until Samantha's consent,
         retention, and deletion policy is approved. */
      expect(await page.locator("form, input, textarea, select").count()).toBe(
        0,
      )

      const body = (await page.locator("body").innerText()).toLowerCase()
      for (const forbidden of [
        "enroll now",
        "register now",
        "pay now",
        "checkout",
        "seats left",
        "sold out",
        "waitlist",
      ]) {
        expect(body).not.toContain(forbidden)
      }
      expect(await page.locator('a[href*="checkout"]').count()).toBe(0)
    })

    test("publishes only the standardized phone number", async ({ page }) => {
      await page.goto(route.path)
      const body = await page.locator("body").innerText()
      /* QA-003 resolved 2026-08-27: one number everywhere. */
      expect(body).not.toContain("239-347-93556")
      expect(body).toContain("239-347-9356")
    })
  })
}

test("every placeholder image on /programs is labelled demo-only", async ({
  page,
}) => {
  await page.goto("/programs")
  const alts = await page
    .locator("main img")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("alt")))
  expect(alts.length).toBe(3)
  for (const alt of alts) {
    expect(alt).toMatch(/^Placeholder photo — demo only\./)
  }
})

test("View Details anchors resolve to a real section on /programs", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("link", { name: /^View Details for Harvest Explorers/ })
    .click()
  await expect(page).toHaveURL(/\/programs#harvest-explorers$/)
  await expect(page.locator("#harvest-explorers")).toBeVisible()
})
