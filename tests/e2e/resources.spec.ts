import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Public Resources page verification (AGENTS.md §13).
 *
 * Beyond the shell checks every public route shares, this pins the two things
 * that make this page different from About: the entries are marked samples and
 * must never read as published resources (MPS-REQ-020/021, MPS-ACC-009/010),
 * and the search field and category cards are real in-page filters rather than
 * links to routes that do not exist.
 */

/* MDS DESIGN-SYSTEM.md §8: mobile 0–639, tablet 640–1023, desktop 1024–1439, wide 1440+. */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

const SAMPLE_COUNT = 5

async function gotoResources(page: Page) {
  await page.goto("/resources")
  await page.waitForLoadState("networkidle")
}

/** The entry cards, not the four category cards above them. */
function entryCards(page: Page) {
  return page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Sample resource:" })
}

test.describe("accessibility", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoResources(page)
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("interaction targets meet the 44 px minimum", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await gotoResources(page)

    const targets = page.locator(
      "button:visible, a:visible, input:visible, [role='searchbox']:visible",
    )
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

  test("the search field has a real label, not a placeholder alone", async ({
    page,
  }) => {
    await gotoResources(page)
    const search = page.getByRole("searchbox", { name: "Find a resource" })
    await expect(search).toBeVisible()
    /* A placeholder disappears the moment a visitor types. The visible label
       stays (DESIGN-SYSTEM.md §10). */
    await expect(
      page.getByText("Find a resource", { exact: true }),
    ).toBeVisible()
  })
})

test.describe("structure", () => {
  test("exposes one h1 and the approved section headings", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoResources(page)

    await expect(page.locator("h1")).toHaveCount(1)
    await expect(page.locator("h1")).toHaveText(
      "Support for every step of the journey",
    )
    for (const heading of [
      "Explore helpful resources",
      "Resources for enrolled families",
      "Looking for something specific?",
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
    await gotoResources(page)
    await expect(page.getByRole("main")).toMatchAriaSnapshot({
      name: "resources-main.aria.yml",
    })
  })

  test("skip link is the first tab stop and moves focus to main", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoResources(page)

    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to main content" })
    await expect(skip).toBeFocused()
    await skip.press("Enter")
    await expect(page).toHaveURL(/#main$/)
  })
})

test.describe("approved content", () => {
  test("renders the owner-approved copy verbatim", async ({ page }) => {
    await gotoResources(page)
    const body = await page.getByRole("main").innerText()

    for (const line of [
      "Useful guidance for exploring programs, preparing for participation, and staying connected.",
      "Getting Started",
      "Program Information",
      "Homeschool Support",
      "Family Guides",
      "Program-specific materials and classroom resources are available securely in your family account.",
      "Our team is here to help you find the right information for your family's needs.",
    ]) {
      expect(body).toContain(line)
    }
  })

  test("lists the four categories with descriptions", async ({ page }) => {
    await gotoResources(page)
    for (const name of [
      "Getting Started",
      "Program Information",
      "Homeschool Support",
      "Family Guides",
    ]) {
      await expect(
        page.getByRole("heading", { level: 3, name, exact: true }),
      ).toBeVisible()
    }
  })
})

test.describe("sample entries are never presented as published resources", () => {
  test("every entry keeps its Sample resource label", async ({ page }) => {
    await gotoResources(page)
    const cards = entryCards(page)
    await expect(cards).toHaveCount(SAMPLE_COUNT)

    const titles = await page
      .getByRole("heading", { level: 3 })
      .filter({ hasText: "Sample resource:" })
      .allInnerTexts()
    expect(titles).toHaveLength(SAMPLE_COUNT)
    for (const title of titles) {
      expect(title.startsWith("Sample resource:")).toBe(true)
    }
  })

  test("the placeholder notice is visible beside them", async ({ page }) => {
    await gotoResources(page)
    await expect(
      page.getByText("Sample entries for layout review"),
    ).toBeVisible()
    await expect(
      page.getByText(
        "They are not published Home School Haven resources, and they do not open, download, or link anywhere.",
        { exact: false },
      ),
    ).toBeVisible()
  })

  test("no entry offers a download, file, or outbound link", async ({
    page,
  }) => {
    await gotoResources(page)
    const cards = entryCards(page)
    /* MPS-REQ-020/021: nothing here may behave as if a real resource exists.
       No anchor, no download attribute, no storage or signed URL. */
    expect(await cards.locator("a").count()).toBe(0)
    expect(await page.locator("a[download], a[href$='.pdf']").count()).toBe(0)
    expect(
      await page.locator("a[href*='supabase'], a[href*='storage']").count(),
    ).toBe(0)
  })

  test("kind is carried by a word, not colour alone", async ({ page }) => {
    await gotoResources(page)
    /* The kind is a content type, not a status, so it is a label rather than the
       MDS §6 status `Badge`. Either way the word must be readable. */
    const labels = await entryCards(page)
      .locator("p")
      .filter({ hasText: /^(Guide|Link|Download)$/ })
      .allInnerTexts()
    expect(labels.length).toBe(SAMPLE_COUNT)
    expect(await page.locator('[data-slot="badge"]').count()).toBe(0)
  })

  test("claims no price, availability, or enrollment state", async ({
    page,
  }) => {
    await gotoResources(page)
    const body = await page.getByRole("main").innerText()
    for (const forbidden of ["Register", "Pay Now", "Enrolled", "Seats", "$"]) {
      expect(body).not.toContain(forbidden)
    }
  })
})

test.describe("search and category filtering", () => {
  test("search narrows the entries and clearing restores them", async ({
    page,
  }) => {
    await gotoResources(page)
    const cards = entryCards(page)
    const search = page.getByRole("searchbox", { name: "Find a resource" })

    await expect(cards).toHaveCount(SAMPLE_COUNT)
    await search.fill("planning")
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText("Planning Worksheet")

    await search.fill("")
    await expect(cards).toHaveCount(SAMPLE_COUNT)
  })

  test("announces the result count politely", async ({ page }) => {
    await gotoResources(page)
    const count = page.locator("[aria-live='polite']")
    await expect(count).toContainText(`${SAMPLE_COUNT} sample entries`)

    await page.getByRole("searchbox", { name: "Find a resource" }).fill("link")
    await expect(count).toContainText(`of ${SAMPLE_COUNT} sample entries shown`)
  })

  test("an unmatched search shows an empty state that can be cleared", async ({
    page,
  }) => {
    await gotoResources(page)
    await page.getByRole("searchbox", { name: "Find a resource" }).fill("xyzzy")

    await expect(entryCards(page)).toHaveCount(0)
    await expect(
      page.getByText("No sample entries match that search"),
    ).toBeVisible()

    await page.getByRole("button", { name: "Clear search and filters" }).click()
    await expect(entryCards(page)).toHaveCount(SAMPLE_COUNT)
  })

  test("a category card filters in place and exposes its pressed state", async ({
    page,
  }) => {
    await gotoResources(page)
    const explore = page.getByRole("button", {
      name: "Explore resources — Homeschool Support",
    })
    await expect(explore).toHaveAttribute("aria-pressed", "false")
    await explore.click()

    await expect(entryCards(page)).toHaveCount(2)
    await expect(
      page.getByText("Filtered to Homeschool Support."),
    ).toBeVisible()
    /* The pressed state is readable without colour: the word changes too. */
    await expect(
      page.getByRole("button", { name: "Showing — Homeschool Support" }),
    ).toHaveAttribute("aria-pressed", "true")
  })

  test("View all resources clears the filter instead of navigating", async ({
    page,
  }) => {
    await gotoResources(page)
    const viewAll = page.getByRole("button", { name: "View all resources" })
    await expect(viewAll).toBeDisabled()

    await page
      .getByRole("button", { name: "Explore resources — Family Guides" })
      .click()
    await expect(entryCards(page)).toHaveCount(1)

    await expect(viewAll).toBeEnabled()
    await viewAll.click()
    await expect(page).toHaveURL(/\/resources$/)
    await expect(entryCards(page)).toHaveCount(SAMPLE_COUNT)
  })

  test("the whole region is operable from the keyboard", async ({ page }) => {
    await gotoResources(page)
    const search = page.getByRole("searchbox", { name: "Find a resource" })
    await search.focus()
    await search.type("guide")
    await expect(entryCards(page)).toHaveCount(3)

    const explore = page.getByRole("button", {
      name: "Explore resources — Getting Started",
    })
    await explore.focus()
    await expect(explore).toBeFocused()
    await explore.press("Enter")
    await expect(entryCards(page)).toHaveCount(1)
  })

  test("no search text reaches the URL", async ({ page }) => {
    await gotoResources(page)
    await page
      .getByRole("searchbox", { name: "Find a resource" })
      .fill("planning")
    /* The query stays in the browser: it is never a query string, so it cannot
       land in a server log, a referrer header, or a screenshot of the URL bar
       (AGENTS.md §11). */
    expect(new URL(page.url()).search).toBe("")
  })
})

test.describe("responsive transformation", () => {
  test("category grid is 4 / 2 / 1 columns across the breakpoints", async ({
    page,
  }) => {
    await gotoResources(page)
    const cards = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Explore resources" })

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
      await gotoResources(page)
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
      await gotoResources(page)
      await expect(page).toHaveScreenshot(`resources-${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      })
    }
  })
})

test.describe("navigation", () => {
  test("Resources is a live destination in the header and footer", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/")
    const headerLink = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Resources" })
    await expect(headerLink).toHaveAttribute("href", "/resources")
    await headerLink.click()
    await expect(page).toHaveURL(/\/resources$/)

    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Resources" }),
    ).toHaveAttribute("href", "/resources")
  })

  test("the enrolled-families band points at the family account, not at files", async ({
    page,
  }) => {
    await gotoResources(page)
    const band = page
      .getByRole("region", { name: "Resources for enrolled families" })
      .or(
        page.locator("section", { hasText: "Resources for enrolled families" }),
      )
      .first()
    /* MPS-REQ-015: real program materials live behind the account. This band
       points there and implements nothing itself. */
    await band
      .getByRole("link", { name: "Sign In", exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test("the guidance band reaches the one inquiry surface", async ({
    page,
  }) => {
    await gotoResources(page)
    await page
      .getByRole("main")
      .getByRole("link", { name: "Request Guidance" })
      .first()
      .click()
    await expect(page).toHaveURL(/\/contact$/)
  })
})
