import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Public calendar: published entries only, a month grid that is real tabular
 * data, and the list transformation below the desktop breakpoint.
 *
 * Covers MPS-ACC-009, MPS-ACC-010; import rules 1 and 3 (nothing plotted
 * without a published day and year); QA-002 (a published chronology is shown,
 * never silently corrected); DESIGN-SYSTEM.md §8 responsive behavior and §10
 * accessibility.
 *
 * Every test pins the clock. The page follows the visitor's date by design, so
 * an unpinned test would change its own expectations every day.
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

/** Inside the published August 2026 window, so the grid has entries to show. */
const AUGUST_2026 = new Date("2026-08-27T12:00:00+00:00")

async function gotoCalendar(page: Page, at: Date = AUGUST_2026) {
  await page.clock.setFixedTime(at)
  await page.goto("/calendar")
  await page.waitForLoadState("networkidle")
}

test.describe("accessibility", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoCalendar(page)
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("renders one h1 inside the shared public shell", async ({ page }) => {
    await gotoCalendar(page)
    await expect(page.locator("h1")).toHaveText("Plan your learning season")
    await expect(page.getByRole("banner")).toBeVisible()
    await expect(page.getByRole("contentinfo")).toBeVisible()
  })

  test("the month grid is a table with a caption and weekday headers", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    const grid = page.getByRole("table")
    await expect(grid).toHaveAccessibleName(/August 2026/)
    for (const weekday of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await expect(
        grid.getByRole("columnheader", { name: weekday }),
      ).toBeVisible()
    }
  })

  test("today is marked in text, not by colour alone", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    const today = page.locator('td[aria-current="date"]')
    await expect(today).toHaveCount(1)
    await expect(today).toContainText("27")
    await expect(today).toContainText("Today")
  })

  test("month controls are reachable and focusable from the keyboard", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    const next = page.getByRole("button", { name: /Next month/ })
    await next.focus()
    await expect(next).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(
      page.getByText("September 2026", { exact: true }),
    ).toBeVisible()
  })
})

test.describe("published content", () => {
  test("August 2026 shows every published entry for the month", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    const grid = page.getByRole("table")
    await expect(grid).toContainText("Fall Preview Day / Open House")
    await expect(grid).toContainText("Ready Set Prep begins")
    await expect(grid).toContainText("Art Lab")
    await expect(grid).toContainText("Summer Break")
  })

  test("navigation moves to September and Today returns", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    await page.getByRole("button", { name: /Next month/ }).click()
    await expect(page.getByRole("table")).toContainText(
      "Haven Days Enrichment begins",
    )
    await page.getByRole("button", { name: "Today", exact: true }).click()
    await expect(page.getByRole("table")).toHaveAccessibleName(/August 2026/)
  })

  test("a month with nothing published offers a path, not a dead end", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page, new Date("2027-01-15T12:00:00+00:00"))
    await page.getByRole("button", { name: "List", exact: true }).click()
    await expect(
      page.getByText("Nothing is published for January 2027"),
    ).toBeVisible()
    await expect(
      page
        .getByRole("link", { name: "Request Guidance" })
        .filter({ visible: true })
        .first(),
    ).toBeVisible()
  })

  test("a range published without a year is never plotted on the grid", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    /* "September 15–October 5" (Sewing) and "August 20–September 24" (Harvest
       Explorers) publish no year. Placing them on a dated grid would invent
       one (import rule 3). */
    const grid = page.getByRole("table")
    await expect(grid).not.toContainText("Sewing")
    await expect(grid).not.toContainText("Harvest Explorers")
  })

  test("QA-002 is shown as published and not silently corrected", async ({
    page,
  }) => {
    await gotoCalendar(page)
    const ranges = page.getByRole("region", { name: "Published term ranges" })
    await expect(ranges).toContainText("August 2026–May 2026")
    await expect(ranges).toContainText("under review with Home School Haven")
    await expect(ranges).not.toContainText("August 2026–May 2027")
  })

  test("offers no invented category filters", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    /* No published source assigns an offering to Classes / Workshops /
       Community, so the proposed chips are deliberately absent (D-C1). */
    for (const chip of ["Classes", "Workshops", "Community"]) {
      await expect(page.getByRole("button", { name: chip })).toHaveCount(0)
      await expect(page.getByRole("radio", { name: chip })).toHaveCount(0)
    }
  })

  test("shows no register, pay, or checkout action", async ({ page }) => {
    await gotoCalendar(page)
    const body = page.locator("body")
    await expect(body).not.toContainText(/Register|Pay Now|Checkout/i)
  })
})

test.describe("responsive", () => {
  test("the grid becomes the list below the desktop breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await gotoCalendar(page)
    await expect(page.getByRole("table")).toHaveCount(0)
    await expect(page.getByText("Fall Preview Day / Open House")).toBeVisible()
  })

  test("the view switch shows the same entries in both views", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    await page.getByRole("button", { name: "List", exact: true }).click()
    await expect(page.getByRole("table")).toHaveCount(0)
    await expect(page.getByText("Fall Preview Day / Open House")).toBeVisible()
    await page.getByRole("button", { name: "Month", exact: true }).click()
    await expect(page.getByRole("table")).toBeVisible()
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`does not scroll horizontally at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoCalendar(page)
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      )
      expect(overflow).toBe(false)
    })
  }

  test("interaction targets meet the 44 px minimum", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await gotoCalendar(page)
    const controls = page.locator("main a, main button")
    for (let index = 0; index < (await controls.count()); index += 1) {
      const control = controls.nth(index)
      if (!(await control.isVisible())) continue
      const box = await control.boundingBox()
      if (box) expect(box.height).toBeGreaterThanOrEqual(43.5)
    }
  })
})

test.describe("visual", () => {
  test("matches the calendar aria snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    await gotoCalendar(page)
    await expect(
      page.getByRole("region", { name: "Published term ranges" }),
    ).toMatchAriaSnapshot({ name: "calendar-term-ranges.aria.yml" })
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoCalendar(page)
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(`calendar-${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: "disabled",
      })
    })
  }
})
