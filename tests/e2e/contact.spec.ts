import { execFileSync } from "node:child_process"

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
const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
)

const CAN_CLEAN_UP_SUBMISSIONS = (() => {
  if (!SUPABASE_CONFIGURED || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    return false

  try {
    return (
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin ===
      "http://127.0.0.1:54321"
    )
  } catch {
    return false
  }
})()

const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

/**
 * Remove the inquiries this file submits.
 *
 * Since 2026-09-01 a submission on this page creates a real record, so this
 * suite now writes to the shared fixture. The rows it makes are its own — the
 * seeded samples all carry an `HSH-SAMPLE*` reference — and leaving them behind
 * would grow the administrator queue on every run and break
 * `admin-inquiries.spec.ts`, which counts what is waiting.
 */
function clearSubmittedInquiries() {
  execFileSync(
    "psql",
    [
      LOCAL_DB,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `delete from public.audit_events where entity_type = 'inquiry'
         and changed_fields ->> 'reference' not like 'HSH-SAMPLE%';`,
      "-c",
      "delete from public.inquiries where reference not like 'HSH-SAMPLE%';",
    ],
    { stdio: "inherit" },
  )
}

test.afterAll(async () => {
  if (CAN_CLEAN_UP_SUBMISSIONS) clearSubmittedInquiries()
})

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
      "Your request is recorded privately and seen only by Home School Haven administrators.",
    ]) {
      expect(body).toContain(line)
    }
  })

  test("says up front what happens to a request, before anything is typed", async ({
    page,
  }) => {
    /* This banner used to say the opposite -- that nothing was recorded or
       seen -- which was true only while no destination existed. It does now
       (`src/lib/contact/recorder.ts`), and a family told nobody would read
       their message writes a different message, so the page has to say the
       truthful thing BEFORE they type it (MPS-RUL-003, MPS-ACC-012). */
    await gotoContact(page)
    await expect(
      page.getByRole("heading", { name: "What happens to your request" }),
    ).toBeVisible()
    const banner = page.getByText("recorded privately and goes to Home School")
    await expect(banner).toBeVisible()
    await expect(banner).toContainText("never by an educator")
    await expect(banner).toContainText(
      "Nothing here decides anything about cost or enrollment",
    )
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

  test("a valid submission is recorded once and confirmed with a reference", async ({
    page,
  }) => {
    /* MPS-ACC-012. This test asserted the opposite until 2026-09-01, when a
       destination was built: the record now exists, so claiming receipt is the
       truthful outcome rather than the forbidden one. What MPS-ACC-014 forbids
       is claiming it WITHOUT a record, which the failure test below still
       covers. */
    test.skip(
      !CAN_CLEAN_UP_SUBMISSIONS,
      "Needs the local Supabase stack so the recorded request can be removed.",
    )

    await gotoContact(page)
    await fill(page)
    await page.getByRole("button", { name: "Send Request" }).click()

    const received = page.locator('[data-slot="submission-received"]')
    await expect(received).toBeVisible()
    await expect(received).toContainText("Request received")
    /* The reference is the family's half of the phone fallback. */
    await expect(received).toContainText(/HSH-[A-Z0-9]{6}/)

    /* No enrollment, no place, and no outcome is implied by a received
       request (MPS-RUL-004, DO-DONT "Trust states"). Scoped to the panel: the
       page around it legitimately uses words like "approved" in other senses,
       and it is the confirmation itself that must promise nothing. */
    await expect(received).toContainText("not an enrollment")
    const panel = (await received.innerText()).toLowerCase()
    for (const forbidden of [
      "approved",
      "eligible",
      "discount",
      "scholarship",
      "your place",
      "we'll be in touch shortly",
    ]) {
      expect(panel).not.toContain(forbidden)
    }

    /* Nothing was left blocked: a recorded request clears the failure panel. */
    expect(await page.locator('[data-slot="submission-blocked"]').count()).toBe(
      0,
    )
  })

  test("a repeated submission of the same request is recorded only once", async ({
    page,
  }) => {
    /* MPS-ACC-012 "created once". The idempotency key is derived from the
       content and the day (`src/app/contact/actions.ts`), so a resubmitted
       form reaches the same record and the family sees the same reference
       rather than filing a duplicate nobody asked for. */
    test.skip(
      !CAN_CLEAN_UP_SUBMISSIONS,
      "Needs the local Supabase stack so the recorded request can be removed.",
    )

    await gotoContact(page)
    await fill(page)
    await page.getByRole("button", { name: "Send Request" }).click()

    const received = page.locator('[data-slot="submission-received"]')
    await expect(received).toBeVisible()
    const first = await received.innerText()
    const reference = first.match(/HSH-[A-Z0-9]{6}/)?.[0]
    expect(reference).toBeTruthy()

    await gotoContact(page)
    await fill(page)
    await page.getByRole("button", { name: "Send Request" }).click()
    await expect(received).toBeVisible()
    await expect(received).toContainText(reference!)
  })

  test("the outcome is announced to assistive technology", async ({ page }) => {
    test.skip(
      !CAN_CLEAN_UP_SUBMISSIONS,
      "Needs the local Supabase stack so the recorded request can be removed.",
    )
    await gotoContact(page)
    await fill(page)
    await page.getByRole("button", { name: "Send Request" }).click()
    /* One announcement for the whole outcome, so a result is never missed
       after the button returns to rest (MPS-REQ-021). */
    await expect(
      page.getByRole("status").filter({ hasText: "Request received" }),
    ).toHaveCount(1)
  })

  test("the message counter tracks the server limit", async ({ page }) => {
    await gotoContact(page)
    await expect(page.getByText("0 / 2000")).toBeVisible()
    await page.getByLabel("Message", { exact: true }).fill("Hello")
    await expect(page.getByText("5 / 2000")).toBeVisible()
  })

  test("no submitted value reaches the URL", async ({ page }) => {
    test.skip(
      SUPABASE_CONFIGURED && !CAN_CLEAN_UP_SUBMISSIONS,
      "Skips projects where the recorded request cannot be removed safely.",
    )

    await gotoContact(page)
    await fill(page)
    await page.getByRole("button", { name: "Send Request" }).click()
    /* Whichever outcome the environment produces -- recorded with a project
       configured, blocked without one -- the URL must be clean either way, so
       this waits on the settled form rather than on one specific panel. */
    await expect(
      page.locator(
        '[data-slot="submission-received"], [data-slot="submission-blocked"]',
      ),
    ).toBeVisible()
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

  test("Request Guidance from a program carries that program into the form", async ({
    page,
  }) => {
    /* MPS-ACC-011. The program select has always existed for this path -- its
       own comment says so -- but nothing arrived carrying a program until now,
       so `inquiries.program_id` was populated only by the seed. */
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/programs/haven-days-enrichment")
    /* Scoped to `main`: the site header carries a "Request Guidance" link too,
       and that one is global chrome that stays generic on every page. It is
       the action rail beside this program that must carry the program. */
    await page
      .getByRole("main")
      .getByRole("link", { name: "Request Guidance" })
      .first()
      .click()

    await expect(page).toHaveURL(/\/contact\?program=haven-days-enrichment$/)
    await expect(
      page.getByLabel("Program you are asking about (optional)"),
    ).toHaveValue("haven-days-enrichment")
  })

  test("an unresolvable program in the URL degrades to the plain form", async ({
    page,
  }) => {
    /* A stale or hand-edited link must not pre-select something unpublished,
       and must not error: the page validates against the published catalog and
       falls back to the state it would have had with no parameter at all. */
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/contact?program=no-such-program")
    await expect(
      page.getByLabel("Program you are asking about (optional)"),
    ).toHaveValue("")
    await expect(
      page.getByRole("heading", { name: "What happens to your request" }),
    ).toBeVisible()
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
