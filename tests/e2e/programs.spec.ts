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

/* The nine offerings in Samantha's evidence of 2026-09-14, in catalog order. */
const PUBLISHED = [
  "Haven Days",
  "Ready Set Prep",
  "Ready Set Learn",
  "Ready Set Sensory",
  "Sewing",
  "Crochet",
  "Gardening",
  "Tutoring",
  "Monthly Clubs",
]

/* Offerings that evidence no longer supports. Archived in the database; they
   must not come back on any public surface. */
const ARCHIVED = [
  { slug: "ready-set-prep-and-learn", name: "Ready Set Prep & Learn" },
  { slug: "etiquette-series", name: "Etiquette Series" },
  { slug: "art-lab", name: "Art Lab" },
  { slug: "harvest-explorers", name: "Harvest Explorers" },
  { slug: "history-explorers", name: "History Explorers" },
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
          name: new RegExp(`^View Details for ${name}$`),
        }),
      ).toHaveCount(1)
    }

    const hrefs = await page
      .locator('main a[href^="/programs/"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")))
    expect(new Set(hrefs).size).toBe(PUBLISHED.length)
  })

  test("groups offerings under one heading per offering type, in order", async ({
    page,
  }) => {
    await goto(page, "/programs")
    await expect(
      page.getByRole("main").getByRole("heading", { level: 2 }),
    ).toHaveText([
      "Haven Days",
      "Ready Set programs",
      "Individual classes",
      "Tutoring",
      "Monthly clubs",
      "Not sure which program fits your child?",
    ])

    const group = (type: string) =>
      page.locator(`[data-offering-group="${type}"] h3`)
    await expect(group("haven_days")).toHaveText(["Haven Days"])
    await expect(group("ready_set")).toHaveText([
      "Ready Set Prep",
      "Ready Set Learn",
      "Ready Set Sensory",
    ])
    /* Haven Days is its own offering, never one class among the others. */
    await expect(group("individual_class")).toHaveText([
      "Sewing",
      "Crochet",
      "Gardening",
    ])
    await expect(group("tutoring")).toHaveText(["Tutoring"])
    await expect(group("monthly_club")).toHaveText(["Monthly Clubs"])
  })

  test("shows no archived offering and archived pages are gone", async ({
    page,
  }) => {
    await goto(page, "/programs")
    const text = await page.locator("main").innerText()
    for (const { slug, name } of ARCHIVED) {
      expect(text).not.toContain(name)
      const response = await page.request.get(`/programs/${slug}`)
      expect(response.status(), slug).toBe(404)
    }
  })

  test("grid is 3 / 2 / 1 columns across the breakpoints", async ({ page }) => {
    await goto(page, "/programs")
    /* The Ready Set group holds three cards, enough to show three columns. */
    const cards = page.locator(
      '[data-offering-group="ready_set"] [data-slot="card"]',
    )

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
      await goto(page, "/programs/ready-set-prep")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("shows the published facts and marks the rest Contact for details", async ({
    page,
  }) => {
    await goto(page, "/programs/ready-set-prep")

    await expect(
      page.getByText("Ready Set program", { exact: true }),
    ).toBeVisible()

    const facts = page.getByRole("region", { name: "Verified program details" })
    const valueOf = (label: string) =>
      facts
        .locator("dt", { hasText: new RegExp(`^${label}$`) })
        .locator("xpath=following-sibling::dd[1]")
    await expect(valueOf("Dates")).toHaveText("August–May")
    await expect(valueOf("Schedule")).toHaveText(
      "Tuesday and Thursday, 9:15–11:30 AM",
    )
    await expect(valueOf("Ages or grades")).toHaveText("Ages 3–4")
    await expect(valueOf("Price")).toHaveText("$80/week")
    await expect(valueOf("Registration options")).toHaveText(
      "Ready Set Prep and Ready Set Learn combined: $140/week",
    )

    /* Format, location, educator, and enrollment period are unpublished and
       must read as unknown, never be guessed. */
    for (const label of ["Location", "Educator", "Enrollment period"]) {
      const value = facts
        .locator("dt", { hasText: new RegExp(`^${label}$`) })
        .locator("xpath=following-sibling::dd[1]")
      await expect(value).toHaveText("Contact for details")
    }
  })

  test("Gardening publishes no price while its sources disagree", async ({
    page,
  }) => {
    /* QA-007: the flyer says $35/week and the email says $35 drop-in. Neither
       may surface as fact, on the detail page or on its card. */
    await goto(page, "/programs/gardening")
    const facts = page.getByRole("region", { name: "Verified program details" })
    await expect(
      facts
        .locator("dt", { hasText: /^Price$/ })
        .locator("xpath=following-sibling::dd[1]"),
    ).toHaveText("Contact for details")
    const body = await page.locator("body").innerText()
    expect(body).not.toContain("$35")
    await expect(facts).toContainText(
      "October–June; no class during the final week of October",
    )

    await goto(page, "/programs")
    const card = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name: "Gardening" }) })
    expect(await card.innerText()).not.toContain("$")
  })

  test("verified summaries replace the not-published sentence", async ({
    page,
  }) => {
    await goto(page, "/programs/tutoring")
    await expect(
      page.getByText(
        "Academic skill building, homework help, and test preparation.",
      ),
    ).toBeVisible()
    await goto(page, "/programs/crochet")
    /* The fact values only: the panel's source line names the evidence date. */
    const facts = await page
      .getByRole("region", { name: "Verified program details" })
      .locator("dl")
      .innerText()
    expect(facts).toContain("Mondays in November, 2:00–4:00 PM")
    expect(facts).toContain("$250, including materials")
    /* No year is known for Crochet, Sewing, or the first club. */
    expect(facts).not.toMatch(/\b20\d{2}\b/)
    await expect(
      page.getByText(
        "A beginner class. No experience is required, and there is a take-home project each week.",
      ),
    ).toBeVisible()
  })

  test("checkout handoff never implies payment or enrollment", async ({
    page,
  }) => {
    await goto(page, "/programs/tutoring")

    const registration = page.getByRole("region", { name: "Registration" })
    await expect(registration).toContainText(
      "Starting checkout does not confirm payment and does not confirm your child's place.",
    )
    await expect(registration).toContainText(
      "Enrollment is confirmed only after Home School Haven verifies it with you.",
    )

    /* Tutoring has no checkout on the approved classes page, and no public
       program page renders a checkout link at all: checkout follows the
       MPS-REQ-012 evaluation (prompts/external-checkout-payment-truth.md). */
    expect(
      await page
        .locator('a[href*="pay.homeschoolhaven"], a[href*="poynt.godaddy.com"]')
        .count(),
    ).toBe(0)
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
    await goto(page, "/programs/tutoring")
    await expect(rail).toHaveCSS("position", "sticky")
    /* Beside the content, not beneath it. */
    const railBox = await rail.boundingBox()
    const headingBox = await page.locator("h1").boundingBox()
    expect(railBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width - 1)

    await page.setViewportSize(VIEWPORTS.mobile)
    await goto(page, "/programs/tutoring")
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
    await goto(page, "/programs/ready-set-sensory")

    await expect(page.locator("h1")).toHaveText("Ready Set Sensory")
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
      await goto(page, "/programs/ready-set-prep")
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
    await goto(page, "/programs/tutoring")

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
      .getByRole("link", { name: /^View Details for Sewing/ })
      .press("Enter")
    await expect(page).toHaveURL(/\/programs\/sewing$/)

    const guidance = page
      .getByRole("complementary", { name: "Availability and next steps" })
      .getByRole("link", { name: "Request Guidance" })
    await guidance.focus()
    await expect(guidance).toBeFocused()
    await guidance.press("Enter")
    /* The rail carries the program the family was reading (MPS-REQ-010). */
    await expect(page).toHaveURL(/\/contact\?program=sewing$/)
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
      await goto(page, "/programs/ready-set-prep")
      await expect(page).toHaveScreenshot(`detail-${name}.png`, {
        fullPage: true,
        animations: "disabled",
      })
    })
  }
})
