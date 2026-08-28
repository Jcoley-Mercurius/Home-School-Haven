import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Public About page verification (AGENTS.md §13).
 *
 * Beyond the shell checks every public route shares, this pins what is specific
 * to About: the owner-approved copy renders verbatim, the values band matches
 * the home page exactly, the four-column community grid transforms correctly,
 * and the page claims nothing about enrollment, price, or a named person.
 */

/* MDS DESIGN-SYSTEM.md §8: mobile 0–639, tablet 640–1023, desktop 1024–1439, wide 1440+. */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

async function gotoAbout(page: Page) {
  await page.goto("/about")
  await page.waitForLoadState("networkidle")
}

test.describe("accessibility", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoAbout(page)
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("interaction targets meet the 44 px minimum", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await gotoAbout(page)

    const targets = page.locator("button:visible, a:visible")
    const boxes = await targets.evaluateAll((nodes) =>
      nodes
        .filter((n) => !n.className.includes("sr-only"))
        .map((n) => {
          const r = n.getBoundingClientRect()
          return { text: n.textContent?.trim().slice(0, 40), h: r.height }
        }),
    )
    expect(boxes.filter((b) => b.h > 0 && b.h < 44)).toEqual([])
  })
})

test.describe("structure", () => {
  test("exposes one h1 and the approved section headings", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoAbout(page)

    await expect(page.locator("h1")).toHaveCount(1)
    await expect(page.locator("h1")).toHaveText(
      "A haven for curious learners and connected families",
    )
    for (const heading of [
      "Our approach",
      "Faith expressed through character",
      "Meet our community",
    ]) {
      await expect(
        page.getByRole("heading", { level: 2, name: heading }),
      ).toBeVisible()
    }
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible()
  })

  test("matches its ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoAbout(page)
    await expect(page.getByRole("main")).toMatchAriaSnapshot({
      name: "about-main.aria.yml",
    })
  })

  test("skip link is the first tab stop and moves focus to main", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoAbout(page)

    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to main content" })
    await expect(skip).toBeFocused()
    await skip.press("Enter")
    await expect(page).toHaveURL(/#main$/)
  })
})

test.describe("approved content", () => {
  test("renders the owner-approved copy verbatim", async ({ page }) => {
    await gotoAbout(page)
    const body = await page.getByRole("main").innerText()

    for (const line of [
      "Our mission is simple: to cultivate calm, confident, and compassionate learners through creativity, curiosity, and connection.",
      "Calm, hands-on learning",
      "Relationship-centered community",
      "We are a Christ-centered community shaping hearts as well as minds.",
      "Ready to learn more about our programs and community?",
    ]) {
      expect(body).toContain(line)
    }
  })

  test("attributes the Scripture quote", async ({ page }) => {
    await gotoAbout(page)
    const quote = page.locator("figure").filter({ hasText: "Matthew 5:16" })
    await expect(quote).toContainText("Let your light shine before others")
    await expect(quote.locator("figcaption")).toHaveText("Matthew 5:16")
  })

  test("shows the same four values as the home page", async ({ page }) => {
    await gotoAbout(page)
    const values = [
      "Creativity over conformity",
      "Curiosity over perfection",
      "Character over performance",
      "Community over competition",
    ]
    for (const value of values) {
      await expect(
        page.getByRole("main").getByText(value, { exact: true }),
      ).toBeVisible()
    }

    await page.goto("/")
    for (const value of values) {
      await expect(
        page.getByRole("main").getByText(value, { exact: true }),
      ).toBeVisible()
    }
  })

  test("lists the four community groups", async ({ page }) => {
    await gotoAbout(page)
    const cards = page.locator('[data-slot="card"]')
    await expect(cards).toHaveCount(4)
    for (const name of ["Educators", "Mentors", "Families", "Community"]) {
      await expect(
        page.getByRole("heading", { level: 3, name, exact: true }),
      ).toBeVisible()
    }
  })

  test("claims no price, availability, or enrollment state", async ({
    page,
  }) => {
    await gotoAbout(page)
    const body = await page.getByRole("main").innerText()
    /* MPS-REQ-020/021: this page describes the community, never a commercial or
       enrollment fact. Checkout is an external handoff handled elsewhere. */
    for (const forbidden of ["Register", "Pay Now", "Enrolled", "Seats", "$"]) {
      expect(body).not.toContain(forbidden)
    }
  })

  test("hero art is labelled as a demo placeholder", async ({ page }) => {
    await gotoAbout(page)
    /* `public/placeholder/README.md`: every usage says so in its alt text, so a
       reviewer is never shown generated art as if it were real photography. */
    const hero = page.getByRole("main").locator("img").first()
    await expect(hero).toHaveAttribute(
      "alt",
      /^Placeholder photo — demo only\./,
    )
  })
})

test.describe("responsive transformation", () => {
  test("community grid is 4 / 2 / 1 columns across the breakpoints", async ({
    page,
  }) => {
    await gotoAbout(page)
    const cards = page.locator('[data-slot="card"]')

    const columnCount = async () => {
      await page.waitForTimeout(50)
      const tops = await cards.evaluateAll((nodes) =>
        nodes.map((n) => Math.round(n.getBoundingClientRect().top)),
      )
      return tops.filter((t) => t === tops[0]).length
    }

    await page.setViewportSize(VIEWPORTS.desktop)
    expect(await columnCount()).toBe(4)
    await page.setViewportSize(VIEWPORTS.tablet)
    expect(await columnCount()).toBe(2)
    await page.setViewportSize(VIEWPORTS.mobile)
    expect(await columnCount()).toBe(1)
  })

  test("no viewport scrolls horizontally", async ({ page }) => {
    for (const viewport of Object.values(VIEWPORTS)) {
      await page.setViewportSize(viewport)
      await gotoAbout(page)
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    }
  })

  test("matches the approved composition at each viewport", async ({
    page,
  }) => {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport)
      await gotoAbout(page)
      await expect(page).toHaveScreenshot(`about-${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      })
    }
  })
})

test.describe("navigation", () => {
  test("About is a live destination in the header and footer", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/")
    const headerLink = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "About" })
    await expect(headerLink).toHaveAttribute("href", "/about")
    await headerLink.click()
    await expect(page).toHaveURL(/\/about$/)

    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "About" }),
    ).toHaveAttribute("href", "/about")
  })

  test("both calls to action reach real pages", async ({ page }) => {
    await gotoAbout(page)
    await page
      .getByRole("main")
      .getByRole("link", { name: "Explore Programs" })
      .first()
      .click()
    await expect(page).toHaveURL(/\/programs$/)

    await gotoAbout(page)
    await page
      .getByRole("main")
      .getByRole("link", { name: "Request Guidance" })
      .first()
      .click()
    await expect(page).toHaveURL(/\/contact$/)
  })
})
