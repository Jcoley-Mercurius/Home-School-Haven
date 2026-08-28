import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Public Contact page and the inquiry flow it hosts (MPS-REQ-009, MPS-REQ-010;
 * MPS-ACC-011, 012, 014; DESIGN-SYSTEM.md §6 assistance-request rules).
 *
 * This replaces `guidance.spec.ts`: `/contact` is the single public inquiry
 * surface and `/guidance` redirects to it (owner decision 2026-08-28).
 *
 * The central rule under test is unchanged: the flow never claims a request was
 * received unless a record was actually created. No destination is configured,
 * so every submission must return the truthful "not sent" state, keep the
 * sender's typing, and offer the published phone path.
 */

/* MDS DESIGN-SYSTEM.md §8: mobile 0–639, tablet 640–1023, desktop 1024–1439, wide 1440+. */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

const PATHWAYS = [
  "Request Guidance",
  "Plan a Visit",
  "General Question",
  "Private Assistance",
] as const

async function gotoContact(page: Page) {
  await page.goto("/contact")
  await page.waitForLoadState("networkidle")
}

async function fill(page: Page) {
  await page.getByLabel("Parent or guardian name").fill("Sample Parent")
  await page.getByLabel("Email", { exact: true }).fill("parent@example.com")
  await page
    .getByLabel("Message", { exact: true })
    .fill("Looking for a good fit for the fall term.")
}

test.describe("accessibility", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoContact(page)
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("interaction targets meet the 44 px minimum", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await gotoContact(page)

    const targets = page.locator(
      "button:visible, a:visible, input:visible, select:visible",
    )
    const boxes = await targets.evaluateAll((nodes) =>
      nodes
        .filter((n) => !n.className.includes("sr-only"))
        /* MDS §8's 44 px rule governs controls. A link inside a sentence is
           not a control and is exempt under WCAG 2.2 SC 2.5.8; inflating one
           breaks the line rhythm of the paragraph it sits in. */
        .filter((n) => !n.hasAttribute("data-inline-link"))
        .map((n) => {
          const r = n.getBoundingClientRect()
          return { text: n.textContent?.trim().slice(0, 40), h: r.height }
        }),
    )
    expect(boxes.filter((b) => b.h > 0 && b.h < 44)).toEqual([])
  })

  test("every field has a visible label, not a placeholder alone", async ({
    page,
  }) => {
    await gotoContact(page)
    for (const label of [
      "Parent or guardian name",
      "Email",
      "Phone (optional)",
      "What can we help with?",
      "Message",
    ]) {
      /* A placeholder disappears the moment a visitor types. The visible label
         stays (DESIGN-SYSTEM.md §10). */
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
  })
})

test.describe("structure", () => {
  test("exposes one h1 and the approved headings", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoContact(page)

    await expect(page.locator("h1")).toHaveCount(1)
    await expect(page.locator("h1")).toHaveText(
      "How can we support your family?",
    )
    for (const name of PATHWAYS) {
      await expect(
        page.getByRole("heading", { level: 3, name, exact: true }),
      ).toBeVisible()
    }
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible()
  })

  test("matches its ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoContact(page)
    await expect(page.getByRole("main")).toMatchAriaSnapshot({
      name: "contact-main.aria.yml",
    })
  })

  test("skip link is the first tab stop and moves focus to main", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await gotoContact(page)

    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to main content" })
    await expect(skip).toBeFocused()
    await skip.press("Enter")
    await expect(page).toHaveURL(/#main$/)
  })
})

test.describe("approved content", () => {
  test("renders the owner-approved copy verbatim", async ({ page }) => {
    await gotoContact(page)
    const body = await page.getByRole("main").innerText()

    for (const line of [
      "Choose the path that best fits your question; Home School Haven will respond personally.",
      "Ask about programs, enrollment, or how we can support your family.",
      "Learn more about our community with a personal tour or information session.",
      "Have a general inquiry? We're happy to help and point you in the right direction.",
      "Request a confidential conversation with our care team.",
      "We're here for you.",
      "Every message is read by a real person who cares.",
    ]) {
      expect(body).toContain(line)
    }
  })

  test("says up front that requests are not recorded yet", async ({ page }) => {
    await gotoContact(page)
    await expect(
      page.getByRole("heading", { name: "Online requests are not open yet" }),
    ).toBeVisible()
  })

  test("offers the approved request types and no direct-registration action", async ({
    page,
  }) => {
    await gotoContact(page)
    const options = await page
      .getByLabel("What can we help with?")
      .locator("option")
      .allInnerTexts()
    expect(options).toEqual([
      "Guidance choosing a program",
      "A visit to Home School Haven",
      "A general question",
      "Help with the cost of a class",
    ])

    const body = (await page.locator("body").innerText()).toLowerCase()
    expect(body).not.toContain("pay now")
    expect(await page.locator('a[href*="pay.homeschoolhaven"]').count()).toBe(0)
  })

  test("promises no outcome for a cost-assistance request", async ({
    page,
  }) => {
    await gotoContact(page)
    /* MPS-RUL-004: the beta records status but decides no financial outcome. */
    await expect(
      page.getByText("does not decide any discount", { exact: false }),
    ).toBeVisible()
  })

  test("collects no child information and asks for none", async ({ page }) => {
    await gotoContact(page)
    /* MPS-RUL-006, AGENTS.md §11. */
    const names = await page
      .locator("input, select, textarea")
      .evaluateAll((nodes) =>
        nodes
          .map((n) => n.getAttribute("name") ?? "")
          /* React's own server-action fields ($ACTION_*) are not ours. */
          .filter((name) => name && !name.startsWith("$")),
      )
    expect(names.sort()).toEqual([
      "email",
      "message",
      "name",
      "phone",
      "programSlug",
      "type",
    ])
    await expect(
      page.getByText("Do not include sensitive child information", {
        exact: false,
      }),
    ).toBeVisible()
  })

  test("does not ask for consent that has not been approved", async ({
    page,
  }) => {
    await gotoContact(page)
    /* Owner decision 2026-08-28 (§12.3): the reference's consent checkbox is
       not built until Samantha's consent decisions are recorded. */
    expect(await page.locator('input[type="checkbox"]').count()).toBe(0)
  })
})

test.describe("pathway selection", () => {
  test("a pathway sets the request type in place and exposes its state", async ({
    page,
  }) => {
    await gotoContact(page)
    const visit = page.getByRole("button", { name: "Choose — Plan a Visit" })
    await expect(visit).toHaveAttribute("aria-pressed", "false")
    await visit.click()

    await expect(page.getByLabel("What can we help with?")).toHaveValue("visit")
    /* The pressed state is readable without colour: the word changes too. */
    await expect(
      page.getByRole("button", { name: "Selected — Plan a Visit" }),
    ).toHaveAttribute("aria-pressed", "true")
  })

  test("selecting a pathway moves focus to the form and announces it", async ({
    page,
  }) => {
    await gotoContact(page)
    await page
      .getByRole("button", { name: "Choose — Private Assistance" })
      .click()

    await expect(page.getByLabel("What can we help with?")).toBeFocused()
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Private Assistance selected" }),
    ).toHaveCount(1)
  })

  test("no pathway navigates anywhere", async ({ page }) => {
    await gotoContact(page)
    /* No category or request route exists; the review contains no broken
       links (owner decision 2026-08-27). */
    const cards = page.locator('[data-slot="card"]')
    expect(await cards.locator("a").count()).toBe(0)

    await page
      .getByRole("button", { name: "Choose — General Question" })
      .click()
    await expect(page).toHaveURL(/\/contact$/)
  })

  test("the pathways are operable from the keyboard", async ({ page }) => {
    await gotoContact(page)
    const choose = page.getByRole("button", {
      name: "Choose — General Question",
    })
    await choose.focus()
    await expect(choose).toBeFocused()
    await choose.press("Enter")
    await expect(page.getByLabel("What can we help with?")).toHaveValue(
      "question",
    )
  })
})

test.describe("submission", () => {
  test("server-side validation blocks an empty submission and explains why", async ({
    page,
  }) => {
    await gotoContact(page)
    await page.getByRole("button", { name: "Send Request" }).click()

    await expect(page.getByText("Enter your name.")).toBeVisible()
    await expect(
      page.getByText("Enter an email address we can reply to."),
    ).toBeVisible()
    await expect(
      page.getByText("Tell us a little about what you are looking for."),
    ).toBeVisible()
    await expect(
      page.getByText("Check the highlighted fields below and try again."),
    ).toBeVisible()
  })

  test("rejects a malformed email at the server boundary", async ({ page }) => {
    await gotoContact(page)
    await fill(page)
    await page.getByLabel("Email", { exact: true }).fill("not-an-address")
    await page.getByRole("button", { name: "Send Request" }).click()
    await expect(
      page.getByText("Enter a valid email address", { exact: false }),
    ).toBeVisible()
  })

  test("a valid submission is never claimed as received, and keeps what was typed", async ({
    page,
  }) => {
    await gotoContact(page)
    await fill(page)
    await page.getByRole("button", { name: "Send Request" }).click()

    const blocked = page.locator('[data-slot="submission-blocked"]')
    await expect(blocked).toBeVisible()
    await expect(blocked).toContainText("Your request was not sent")
    await expect(blocked).toContainText("nothing was recorded")
    await expect(
      blocked.getByRole("link", { name: /239-347-9356/ }),
    ).toBeVisible()

    /* MPS-ACC-014: success is never claimed. The reference draws the
       "Request received" panel as scenery; it is a state, and it is
       unreachable until a destination exists (D-C4). */
    expect(
      await page.locator('[data-slot="submission-received"]').count(),
    ).toBe(0)
    const body = (await page.locator("body").innerText()).toLowerCase()
    expect(body).not.toContain("request received")
    expect(body).not.toContain("we'll be in touch")

    /* MDS-QA scenario 8: entered data survives the failure. */
    await expect(page.getByLabel("Parent or guardian name")).toHaveValue(
      "Sample Parent",
    )
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "parent@example.com",
    )
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
      "Looking for a good fit for the fall term.",
    )
  })

  test("the outcome is announced to assistive technology", async ({ page }) => {
    await gotoContact(page)
    await fill(page)
    await page.getByRole("button", { name: "Send Request" }).click()
    await expect(
      page.getByRole("status").filter({ hasText: "Your request was not sent" }),
    ).toHaveCount(1)
  })

  test("the message counter tracks the server limit", async ({ page }) => {
    await gotoContact(page)
    await expect(page.getByText("0 / 2000")).toBeVisible()
    await page.getByLabel("Message", { exact: true }).fill("Hello")
    await expect(page.getByText("5 / 2000")).toBeVisible()
  })

  test("no submitted value reaches the URL", async ({ page }) => {
    await gotoContact(page)
    await fill(page)
    await page.getByRole("button", { name: "Send Request" }).click()
    await expect(page.locator('[data-slot="submission-blocked"]')).toBeVisible()
    /* AGENTS.md §11: contact details never land in a query string, a referrer
       header, or a screenshot of the URL bar. */
    expect(new URL(page.url()).search).toBe("")
  })
})

test.describe("responsive transformation", () => {
  test("pathway grid is 4 / 2 / 1 columns across the breakpoints", async ({
    page,
  }) => {
    await gotoContact(page)
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
      await gotoContact(page)
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
      await gotoContact(page)
      await expect(page).toHaveScreenshot(`contact-${name}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      })
    }
  })
})

test.describe("navigation", () => {
  test("Contact is a live destination in the header and footer", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/")
    const headerLink = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Contact" })
    await expect(headerLink).toHaveAttribute("href", "/contact")
    await headerLink.click()
    await expect(page).toHaveURL(/\/contact$/)

    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Contact" }),
    ).toHaveAttribute("href", "/contact")
  })

  test("the Request Guidance action reaches the one inquiry surface", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/")
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Request Guidance" })
      .click()
    await expect(page).toHaveURL(/\/contact$/)
  })

  test("/guidance redirects rather than 404ing", async ({ page }) => {
    /* `/guidance` was the Request Guidance destination throughout the earlier
       review, so links already shared must still land on the form. */
    await page.goto("/guidance")
    await expect(page).toHaveURL(/\/contact$/)
    await expect(page.locator("h1")).toHaveText(
      "How can we support your family?",
    )
  })
})
