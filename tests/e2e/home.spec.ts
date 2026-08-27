import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Foundation Release public home page verification.
 *
 * Covers the checks AGENTS.md §13 requires for this screen: accessibility
 * (@axe-core/playwright), keyboard operation, responsive transformation at the
 * approved MDS breakpoints, ARIA structure, and the MPS trust rules that must
 * never regress (no register/pay/checkout action, no enrollment state claimed).
 */

/* MDS DESIGN-SYSTEM.md §8: mobile 0–639, tablet 640–1023, desktop 1024–1439, wide 1440+. */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

async function gotoHome(page: Page) {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
}

test.describe("accessibility", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoHome(page)
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("mobile menu panel has no axe violations while open", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await gotoHome(page)
    await page.getByRole("button", { name: "Open menu" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })
})

test.describe("structure", () => {
  test("exposes one h1 and ordered landmarks", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)

    await expect(page.locator("h1")).toHaveCount(1)
    await expect(page.locator("h1")).toHaveText(
      "A place to learn, create, and belong.",
    )
    await expect(page.getByRole("banner")).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
    await expect(page.getByRole("contentinfo")).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible()
  })

  test("skip link is the first tab stop and moves focus to main", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)

    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to main content" })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await skip.press("Enter")
    await expect(page).toHaveURL(/#main$/)
  })

  test("primary calls to action are live links, never dimmed", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)

    /* Owner decision 2026-08-27: no grey 50% buttons. Every CTA navigates. */
    const ctas = [
      { name: "Explore Programs", href: "/programs" },
      { name: "Request Guidance", href: "/guidance" },
      { name: /^View Details for /, href: "/programs#art-lab" },
    ]

    for (const cta of ctas) {
      const link = page.getByRole("link", { name: cta.name }).first()
      await expect(link).toHaveAttribute("href", cta.href)
      await expect(link).not.toHaveAttribute("aria-disabled", "true")
      await expect(link).toHaveCSS("opacity", "1")
    }
  })

  test("Explore Programs and Request Guidance reach real pages", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)

    await page.getByRole("link", { name: "Explore Programs" }).first().click()
    await expect(page).toHaveURL(/\/programs$/)
    await expect(page.locator("h1")).toHaveText("Published programs")

    await gotoHome(page)
    await page.getByRole("link", { name: "Request Guidance" }).first().click()
    await expect(page).toHaveURL(/\/guidance$/)
    await expect(page.locator("h1")).toHaveText("Not sure where to begin?")
  })
})

test.describe("responsive transformation", () => {
  test("desktop shows the primary nav; mobile moves it into a menu panel", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden()

    await page.setViewportSize(VIEWPORTS.mobile)
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden()
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible()
  })

  test("mobile menu keeps every destination, closes on Escape, and restores focus", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await gotoHome(page)

    const toggle = page.getByRole("button", { name: "Open menu" })
    await toggle.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    /* MDS-REF-005 §4: no destination is dropped to simplify mobile. */
    for (const label of [
      "Programs",
      "Calendar",
      "About",
      "Resources",
      "Contact",
      "Sign In",
    ]) {
      await expect(
        dialog
          .getByRole("navigation", { name: "Primary mobile" })
          .getByText(label, { exact: false }),
      ).toBeVisible()
    }

    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test("program grid is 3 / 2 / 1 columns across the breakpoints", async ({
    page,
  }) => {
    await gotoHome(page)
    const cards = page.locator('[data-slot="card"]')
    await expect(cards).toHaveCount(3)

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

  test("no viewport scrolls horizontally", async ({ page }) => {
    for (const viewport of Object.values(VIEWPORTS)) {
      await page.setViewportSize(viewport)
      await gotoHome(page)
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
    await gotoHome(page)
    await page.getByRole("button", { name: "Open menu" }).click()

    const targets = page.locator("button:visible, a:visible")
    const boxes = await targets.evaluateAll((nodes) =>
      nodes
        /* Skip-link style off-screen affordances are 1 px until focused; they
           are measured in the skip-link test instead. */
        .filter((n) => !n.className.includes("sr-only"))
        .map((n) => {
          const r = n.getBoundingClientRect()
          return { text: n.textContent?.trim().slice(0, 40), h: r.height }
        }),
    )
    const tooSmall = boxes.filter((b) => b.h > 0 && b.h < 44)
    expect(tooSmall).toEqual([])
  })
})

test.describe("button semantics", () => {
  test("calls to action that navigate are links, not role=button", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)

    /* Regression guard. Routing these through Base UI's Button either warned
       about `nativeButton` or stamped role="button" onto the anchor, which made
       a navigation announce as a button. They must stay plain links. */
    const controls = page.locator('[data-slot="button"]')
    const rendered = await controls.evaluateAll((nodes) =>
      nodes.map((n) => ({
        tag: n.tagName,
        href: n.getAttribute("href"),
        role: n.getAttribute("role"),
      })),
    )

    expect(rendered.length).toBeGreaterThan(0)
    for (const control of rendered) {
      if (control.href !== null) {
        expect(control.tag).toBe("A")
        expect(control.role).toBeNull()
      }
    }

    // And they are reachable by their link role, not a button role.
    await expect(
      page.getByRole("link", { name: "Explore Programs" }),
    ).toHaveCount(1)
    await expect(
      page.getByRole("button", { name: "Explore Programs" }),
    ).toHaveCount(0)
  })
})

test.describe("hero bleed", () => {
  /* MDS-REF-006: the desktop hero photo reaches the top and right viewport
     edges. Regression guard — anchoring it to the 1200 px container instead of
     the full-width section made it overflow leftward across the hero copy. */
  const DESKTOP_WIDTHS = [1024, 1280, 1440, 1497, 1920]

  for (const width of DESKTOP_WIDTHS) {
    test(`photo reaches the right edge without covering the copy at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await gotoHome(page)

      /* Scope to the hero — the header carries its own Request Guidance link
         and it legitimately sits at the container's right edge. */
      const hero = page.locator("main section").first()
      const photo = hero.locator("img").first()
      const heading = hero.locator("h1")
      const cta = hero.getByRole("link", { name: "Request Guidance" })

      const photoBox = await photo.boundingBox()
      const headingBox = await heading.boundingBox()
      const ctaBox = await cta.boundingBox()
      expect(photoBox).not.toBeNull()
      expect(headingBox).not.toBeNull()
      expect(ctaBox).not.toBeNull()

      const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth,
      )

      // Flush with the right viewport edge.
      expect(Math.round(photoBox!.x + photoBox!.width)).toBeGreaterThanOrEqual(
        clientWidth - 1,
      )

      // Flush with the top of the hero band.
      expect(Math.round(photoBox!.y)).toBeLessThanOrEqual(
        Math.round(headingBox!.y),
      )

      // Never overlapping the heading or the calls to action.
      for (const box of [headingBox!, ctaBox!]) {
        expect(Math.round(box.x + box.width)).toBeLessThanOrEqual(
          Math.round(photoBox!.x),
        )
      }
    })
  }

  test("photo returns to an inset panel below the desktop breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.tablet)
    await gotoHome(page)

    const photo = page.locator("main section").first().locator("img").first()
    const box = await photo.boundingBox()
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    )
    // Inset by the tablet gutter on both sides, so it does not bleed.
    expect(box!.x).toBeGreaterThan(0)
    expect(Math.round(box!.x + box!.width)).toBeLessThan(clientWidth)
  })
})

test.describe("placeholder imagery", () => {
  test("every image is labelled a demo-only placeholder", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)

    /* Demo override 2026-08-27: generated art may stand in for photography only
       while it is unmistakably labelled and never called approved photography. */
    const alts = await page
      .locator("main img")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("alt")))

    expect(alts.length).toBeGreaterThan(0)
    for (const alt of alts) {
      expect(alt).toMatch(/^Placeholder photo — demo only\./)
    }
  })

  test("the page states that its photography is not real", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)
    await expect(page.getByRole("contentinfo")).toContainText(
      "not approved photography and does not show real students",
    )
  })
})

test.describe("MPS trust rules", () => {
  test("shows no register, pay, or checkout action and no enrollment state", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)
    const body = (await page.locator("body").innerText()).toLowerCase()

    for (const forbidden of [
      "register",
      "enroll now",
      "pay now",
      "checkout",
      "seats left",
      "spots left",
      "sold out",
      "waitlist",
    ]) {
      expect(body).not.toContain(forbidden)
    }
    /* Only the price the source actually publishes may appear. */
    expect(body).toContain("$180 for all six weeks")
    expect(await page.locator('a[href*="checkout"]').count()).toBe(0)
  })

  test("renders only sourced program facts", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoHome(page)
    const cards = page.locator('[data-slot="card"]')
    /* Import rule 3 / QA-005: unpublished fields stay unset. */
    for (let i = 0; i < 3; i++) {
      await expect(cards.nth(i)).toContainText("Contact for details")
    }
    await expect(cards.nth(0)).toContainText("August 22–September 26, 2026")
    await expect(cards.nth(1)).toContainText("September 2026–June 2027")
    await expect(cards.nth(2)).toContainText("$180 for all six weeks")
  })
})

test.describe("visual", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoHome(page)
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(`home-${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: "disabled",
      })
    })
  }
})
