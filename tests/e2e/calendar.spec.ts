import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Public calendar: published entries only, a month grid that is real tabular
 * data, and the list transformation below the desktop breakpoint.
 *
 * Covers MPS-ACC-009, MPS-ACC-010; import rules 1 and 3 (nothing plotted
 * without a published day and year); owner evidence of 2026-09-14 (weekly
 * schedules and month seasons listed beside the grid, never turned into dates,
 * never given a year); DESIGN-SYSTEM.md §8 responsive behavior and §10
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
    await expect(grid).toContainText("Summer Break")
    /* Art Lab's range left with the offering. */
    await expect(grid).not.toContainText("Art Lab")
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

  test("a schedule or season published without a date is never plotted", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.wide)
    /* November: Crochet publishes "Mondays in November" and no year. Placing
       it on a dated grid would invent both the dates and the year. */
    await gotoCalendar(page, new Date("2026-11-10T12:00:00+00:00"))
    const grid = page.getByRole("table")
    for (const name of ["Crochet", "Sewing", "Gardening", "Monthly Clubs"]) {
      await expect(grid).not.toContainText(name)
    }
  })

  test("lists weekly schedules and seasons exactly as published, with no year", async ({
    page,
  }) => {
    await gotoCalendar(page)
    const schedules = page.getByRole("region", {
      name: "Weekly schedules and seasons",
    })
    await expect(schedules.getByRole("heading", { level: 3 })).toHaveText([
      "Haven Days",
      "Ready Set Prep",
      "Ready Set Learn",
      "Ready Set Sensory",
      "Sewing",
      "Crochet",
      "Gardening",
      "Tutoring",
      "Monthly Clubs",
    ])
    const card = (name: string) =>
      schedules
        .getByRole("listitem")
        .filter({ has: page.getByRole("heading", { name, exact: true }) })
    await expect(card("Haven Days")).toContainText(
      "Tuesday, Wednesday, and Thursday, 9:00 AM–1:30 PM",
    )
    await expect(card("Haven Days")).toContainText("September–June")
    await expect(card("Ready Set Prep")).toContainText("August–May")
    await expect(card("Crochet")).toContainText(
      "Mondays in November, 2:00–4:00 PM",
    )
    await expect(card("Gardening")).toContainText(
      "October–June; no class during the final week of October",
    )
    await expect(card("Monthly Clubs")).toContainText("Thursday, 4:30–6:30 PM")

    /* QA-002 retired: the owner evidence gives Ready Set as August–May, and
       no year is supplied in place of the anomalous one. */
    const text = await schedules.innerText()
    expect(text).not.toMatch(/\b20\d{2}\b/)
    await expect(page.locator("body")).not.toContainText("August 2026–May 2026")
  })

  test("names no archived offering anywhere on the page", async ({ page }) => {
    await gotoCalendar(page)
    const body = page.locator("body")
    for (const name of [
      "Art Lab",
      "Etiquette Series",
      "Harvest Explorers",
      "History Explorers",
      "Ready Set Prep & Learn",
    ]) {
      await expect(body).not.toContainText(name)
    }
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
    /* The month switch stays usable without the Month/List toggle. */
    await page.getByRole("button", { name: /Next month/ }).click()
    await expect(
      page.getByText("Haven Days Enrichment begins", { exact: true }),
    ).toBeVisible()
  })

  for (const name of ["mobile", "tablet"] as const) {
    test(`schedules and seasons stay readable in one column at ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS[name])
      await gotoCalendar(page)
      const cards = page
        .getByRole("region", { name: "Weekly schedules and seasons" })
        .getByRole("listitem")
      await expect(cards).toHaveCount(9)
      const box = await cards.first().boundingBox()
      const viewportWidth = VIEWPORTS[name].width
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth)
      /* Month navigation remains on screen and inside the viewport. */
      for (const label of [/Previous month/, /Next month/]) {
        const control = await page
          .getByRole("button", { name: label })
          .boundingBox()
        expect(control!.x + control!.width).toBeLessThanOrEqual(viewportWidth)
      }
    })
  }

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
      page.getByRole("region", { name: "Weekly schedules and seasons" }),
    ).toMatchAriaSnapshot({ name: "calendar-schedules.aria.yml" })
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
