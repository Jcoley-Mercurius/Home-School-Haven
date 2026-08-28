import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Public program-conversion journey: catalog, reusable detail experience,
 * verified facts, availability states, and the external-checkout handoff.
 *
 * Covers MPS-ACC-009, 010, 011, 021 and 031; DESIGN-SYSTEM.md §6 trust-state
 * rules, §7 catalog and program-detail shells, §8 responsive behavior, §10
 * accessibility; and the MDS-QA Gate 3 resilience cases.
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

/* Every program the approved import inventory publishes (owner decision
   2026-08-27: Summer Series and Seasonal School Photos stay out until their
   catalog inclusion is decided). */
const PUBLISHED = [
  "Ready Set Prep & Learn",
  "Haven Days Enrichment",
  "Etiquette Series",
  "Art Lab",
  "Sewing",
  "Gardening",
  "Harvest Explorers",
  "History Explorers",
]

async function goto(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState("networkidle")
}

test.describe("catalog", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await goto(page, "/programs")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("lists every published program, each linking to its detail page", async ({
    page,
  }) => {
    await goto(page, "/programs")
    const cards = page.locator('[data-slot="card"]')
    await expect(cards).toHaveCount(PUBLISHED.length)

    for (const name of PUBLISHED) {
      await expect(
        page.getByRole("link", {
          name: new RegExp(`^View Details for ${name.replace(/&/g, "&")}`),
        }),
      ).toHaveCount(1)
    }

    const hrefs = await page
      .locator('main a[href^="/programs/"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")))
    expect(new Set(hrefs).size).toBe(PUBLISHED.length)
  })

  test("grid is 3 / 2 / 1 columns across the breakpoints", async ({ page }) => {
    await goto(page, "/programs")
    const cards = page.locator('[data-slot="card"]')

    const columnCount = async () => {
      await page.waitForTimeout(50)
      const tops = await cards.evaluateAll((nodes) =>
        nodes.map((n) => Math.round(n.getBoundingClientRect().top)),
      )
      return tops.filter((t) => t === tops[0]).length
    }

    await page.setViewportSize(VIEWPORTS.desktop)
    expect(await columnCount()).toBe(3)
    await page.setViewportSize(VIEWPORTS.tablet)
    expect(await columnCount()).toBe(2)
    await page.setViewportSize(VIEWPORTS.mobile)
    expect(await columnCount()).toBe(1)
  })

  test("states availability honestly and claims none", async ({ page }) => {
    await goto(page, "/programs")
    /* No program publishes capacity, so none may render as open, limited, or
       waitlisted (import rule 3 / QA-005). */
    await expect(page.locator('[data-slot="availability"]')).toHaveCount(
      PUBLISHED.length,
    )
    const states = await page
      .locator('[data-slot="availability"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-state")))
    expect(new Set(states)).toEqual(new Set(["unknown"]))
    await expect(
      page.getByText("Availability not published").first(),
    ).toBeVisible()
  })
})

test.describe("program detail", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await goto(page, "/programs/harvest-explorers")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("shows the published facts and marks the rest Contact for details", async ({
    page,
  }) => {
    await goto(page, "/programs/harvest-explorers")

    const facts = page.getByRole("region", { name: "Verified program details" })
    await expect(facts.getByText("August 20–September 24")).toBeVisible()
    await expect(facts.getByText("Six weeks", { exact: true })).toBeVisible()
    await expect(facts.getByText("$180 for all six weeks")).toBeVisible()

    /* Ages, format, location, educator, and enrollment period are unpublished
       for every program and must read as unknown, never be guessed. */
    for (const label of [
      "Ages or grades",
      "Format",
      "Location",
      "Educator",
      "Enrollment period",
    ]) {
      const value = facts
        .locator("dt", { hasText: new RegExp(`^${label}$`) })
        .locator("xpath=following-sibling::dd[1]")
      await expect(value).toHaveText("Contact for details")
    }
  })

  test("renders no unverified source detail", async ({ page }) => {
    /* QA-001: the Etiquette Series date range and the Gardening session length
       have unproven source associations and must not surface as fact. */
    await goto(page, "/programs/etiquette-series")
    expect(await page.locator("body").innerText()).not.toContain(
      "September 11–October 2",
    )

    await goto(page, "/programs/gardening")
    expect(await page.locator("body").innerText()).not.toContain(
      "Two hours per session",
    )
  })

  test("checkout handoff never implies payment or enrollment", async ({
    page,
  }) => {
    await goto(page, "/programs/art-lab")

    const registration = page.getByRole("region", { name: "Registration" })
    await expect(registration).toContainText(
      "Starting checkout does not confirm payment and does not confirm your child's place.",
    )
    await expect(registration).toContainText(
      "Enrollment is confirmed only after Home School Haven verifies it with you.",
    )

    /* No program-specific checkout URL is recorded in any approved artifact
       (gap F-1), so no checkout link may exist and none may be constructed. */
    expect(await page.locator('a[href*="pay.homeschoolhaven"]').count()).toBe(0)
    await expect(
      registration.getByText("Registration link not published"),
    ).toBeVisible()

    const body = (await page.locator("body").innerText()).toLowerCase()
    for (const forbidden of [
      "you are enrolled",
      "payment complete",
      "payment received",
      "spot reserved",
      "place reserved",
      "registration confirmed",
    ]) {
      expect(body).not.toContain(forbidden)
    }
  })

  test("action rail is sticky on desktop and inline below 1024 px", async ({
    page,
  }) => {
    const rail = page.getByRole("complementary", {
      name: "Availability and next steps",
    })

    await page.setViewportSize(VIEWPORTS.desktop)
    await goto(page, "/programs/art-lab")
    await expect(rail).toHaveCSS("position", "sticky")
    /* Beside the content, not beneath it. */
    const railBox = await rail.boundingBox()
    const headingBox = await page.locator("h1").boundingBox()
    expect(railBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width - 1)

    await page.setViewportSize(VIEWPORTS.mobile)
    await goto(page, "/programs/art-lab")
    await expect(rail).toHaveCSS("position", "static")

    /* MDS §8 and DO-DONT.md: the rail keeps its priority on mobile. It must sit
       between the program identity and the long-form content — above the
       verified-facts panel and the description, never pushed to the page
       bottom. Asserting only that it renders is what let a wrong stacking
       order through once already. */
    const inlineRail = await rail.boundingBox()
    const heading = await page.locator("h1").boundingBox()
    const facts = await page
      .getByRole("region", { name: "Verified program details" })
      .boundingBox()
    const about = await page
      .getByRole("heading", { name: "About this program" })
      .boundingBox()

    expect(inlineRail!.y).toBeGreaterThan(heading!.y)
    expect(inlineRail!.y).toBeLessThan(facts!.y)
    expect(inlineRail!.y).toBeLessThan(about!.y)
  })

  test("survives a program with no image and few published facts", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await goto(page, "/programs/etiquette-series")

    await expect(page.locator("h1")).toHaveText("Etiquette Series")
    /* No placeholder art exists for this program; nothing may render broken.
       Scoped to the hero — the related-programs list below carries the art of
       other programs. */
    expect(await page.locator('[data-slot="program-hero"] img').count()).toBe(0)
    await expect(
      page.getByRole("region", { name: "Verified program details" }),
    ).toBeVisible()

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test("an unknown program is a 404, not an invented page", async ({
    page,
  }) => {
    /* Requested rather than navigated to: a 404 navigation logs a console
       error, which the suite-wide console guard would report as a page fault. */
    const response = await page.request.get("/programs/not-a-real-program")
    expect(response.status()).toBe(404)
  })

  test("breadcrumb trails back to the catalog", async ({ page }) => {
    await goto(page, "/programs/sewing")
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" })
    await expect(crumbs.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    )
    await crumbs.getByRole("link", { name: "Programs" }).click()
    await expect(page).toHaveURL(/\/programs$/)
  })

  test("no viewport scrolls horizontally", async ({ page }) => {
    for (const viewport of Object.values(VIEWPORTS)) {
      await page.setViewportSize(viewport)
      await goto(page, "/programs/harvest-explorers")
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    }
  })

  test("interaction targets meet the 44 px minimum", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await goto(page, "/programs/art-lab")

    const boxes = await page
      .locator("button:visible, a:visible")
      .evaluateAll((nodes) =>
        nodes
          .filter((n) => !n.className.includes("sr-only"))
          /* MDS §8's 44 px rule governs controls. A link inside a sentence is
             not a control and is exempt under WCAG 2.2 SC 2.5.8; inflating one
             breaks the line rhythm of the paragraph it sits in. */
          .filter((n) => !n.hasAttribute("data-inline-link"))
          .map((n) => ({
            text: n.textContent?.trim().slice(0, 40),
            h: n.getBoundingClientRect().height,
          })),
      )
    expect(boxes.filter((b) => b.h > 0 && b.h < 44)).toEqual([])
  })
})

test.describe("keyboard journey", () => {
  test("home to detail to guidance without a mouse", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await goto(page, "/")

    await page
      .getByRole("link", { name: /^View Details for Art Lab/ })
      .press("Enter")
    await expect(page).toHaveURL(/\/programs\/art-lab$/)

    const guidance = page
      .getByRole("complementary", { name: "Availability and next steps" })
      .getByRole("link", { name: "Request Guidance" })
    await guidance.focus()
    await expect(guidance).toBeFocused()
    await guidance.press("Enter")
    await expect(page).toHaveURL(/\/guidance$/)
  })
})

test.describe("visual", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`catalog matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await goto(page, "/programs")
      await expect(page).toHaveScreenshot(`catalog-${name}.png`, {
        fullPage: true,
        animations: "disabled",
      })
    })

    test(`detail matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await goto(page, "/programs/harvest-explorers")
      await expect(page).toHaveScreenshot(`detail-${name}.png`, {
        fullPage: true,
        animations: "disabled",
      })
    })
  }
})
