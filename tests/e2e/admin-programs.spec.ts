import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Administrator program operations (ACT-004/006; MPS-REQ-008/013/016/020/021/
 * 023/024, MPS-RUL-005; MPS-ACC-008/009/026/027; MDS-REF-009).
 *
 * The database half of these boundaries is `supabase/tests/database/
 * 70_admin_program_enrollment_ops.test.sql`, which proves the same denials and
 * the same transition rules hold when no application code is involved. Both are
 * required; neither alone is the control.
 *
 * The signed-out cases run everywhere. The credentialed cases need the seeded
 * accounts and are skipped, loudly, when no Supabase project is configured — a
 * skipped test must never read as a passed one.
 *
 * WRITE TESTS AND THE SHARED FIXTURE
 *
 * Several cases below change real seeded rows. Each one restores what it
 * changed, in the same test, so the suite can run twice in a row. A test that
 * leaves a program published would silently change what every later test and
 * every visual baseline sees.
 *
 * To run the full matrix:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local   # fill in the local stack's URL and key
 *   npm run test:e2e
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)

const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ACCOUNTS = {
  admin: "sample.admin@example.com",
  parent: "sample.parent.one@example.com",
  educator: "sample.educator@example.com",
} as const

/** The seeded draft. Not published content — its name says so. */
const DRAFT_NAME = "Sample Unpublished Draft (test fixture)"

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

/**
 * Asserts a route's status without navigating to it.
 *
 * `page.goto()` on an expected 404 makes the browser log a failed-resource
 * console error, which the shared console guard correctly treats as a failure.
 * Denial is about the response, not about rendering an error page.
 */
async function expectStatus(page: Page, route: string, status: number) {
  const response = await page.request.get(route, { maxRedirects: 0 })
  expect(response.status(), `${route} should answer ${status}`).toBe(status)
}

/** Open the seeded draft's detail page from the list. */
async function openDraft(page: Page) {
  await page.goto("/admin/programs?status=draft")
  await page
    .getByRole("table")
    .getByRole("link", { name: `Review ${DRAFT_NAME}` })
    .click()
  await page.waitForURL(/\/admin\/programs\/[0-9a-f-]{36}$/)
}

test.describe("signed out", () => {
  test("both routes redirect to sign-in and keep the destination", async ({
    page,
  }) => {
    for (const route of ["/admin/programs", "/admin/programs/new"]) {
      await page.goto(route)
      await expect(page).toHaveURL(
        `/sign-in?redirectTo=${encodeURIComponent(route)}`,
      )
    }
  })
})

test.describe("denial matrix", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )

  test("a parent is refused every program operations route", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    /* 404, not 403: the response must not confirm that an administrator area
       exists at this path to someone who may not use it. */
    for (const route of ["/admin/programs", "/admin/programs/new"]) {
      await expectStatus(page, route, 404)
    }
  })

  test("an educator is refused, even for their assigned program", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    for (const route of ["/admin/programs", "/admin/programs/new"]) {
      await expectStatus(page, route, 404)
    }
  })

  test("a manipulated program id is not found, not an error", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    /* A well-formed id matching nothing and a malformed id must answer the
       same way, so neither confirms whether a record exists. */
    await expectStatus(
      page,
      "/admin/programs/00000000-0000-4000-8000-00000000dead",
      404,
    )
    await expectStatus(page, "/admin/programs/not-a-uuid", 404)
  })
})

test.describe("program list", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
  })

  test("shows every publication state, including drafts", async ({ page }) => {
    await page.goto("/admin/programs")
    /* Scoped to the table: the mobile record cards render the same rows, so an
       unscoped locator matches twice under strict mode (DEFECT-AO3). */
    await expect(
      page.getByRole("table").getByRole("rowheader", { name: DRAFT_NAME }),
    ).toBeVisible()
  })

  test("filters by publication status", async ({ page }) => {
    await page.goto("/admin/programs?status=draft")
    const table = page.getByRole("table")
    await expect(
      table.getByRole("rowheader", { name: DRAFT_NAME }),
    ).toBeVisible()
    await expect(table.getByRole("rowheader", { name: "Art Lab" })).toHaveCount(
      0,
    )
  })

  test("searches by program name", async ({ page }) => {
    await page.goto("/admin/programs?q=art")
    const table = page.getByRole("table")
    await expect(
      table.getByRole("rowheader", { name: "Art Lab" }),
    ).toBeVisible()
    await expect(
      table.getByRole("rowheader", { name: DRAFT_NAME }),
    ).toHaveCount(0)
  })

  test("a no-results filter offers a way out rather than a dead end", async ({
    page,
  }) => {
    await page.goto("/admin/programs?q=zzzznotaprogram")
    await expect(
      page.getByText("No programs match these filters"),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Clear filters" }),
    ).toBeVisible()
  })

  test("an unrecognised filter value shows everything instead of erroring", async ({
    page,
  }) => {
    /* `searchParams` is whatever someone typed into the address bar. It must
       degrade to the unnarrowed list, never to an error page. */
    await page.goto("/admin/programs?status=deleted&q=")
    await expect(
      page.getByRole("table").getByRole("rowheader", { name: "Art Lab" }),
    ).toBeVisible()
  })

  test("announces how many rows the filter left", async ({ page }) => {
    await page.goto("/admin/programs?status=draft")
    await expect(page.getByRole("status")).toContainText("Showing 1 of")
  })
})

test.describe("program detail and approved actions", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
  })

  test("a draft says it is not public and offers no public link", async ({
    page,
  }) => {
    await openDraft(page)
    await expect(
      page.getByText("This program is not in the public catalog"),
    ).toBeVisible()
  })

  test("offers only the approved publication transitions", async ({ page }) => {
    await openDraft(page)
    const actions = page.getByRole("region", { name: "Publication" })
    await expect(actions.getByRole("button", { name: "Publish" })).toBeVisible()
    await expect(actions.getByRole("button", { name: "Archive" })).toBeVisible()
    /* A draft is already unpublished, and there is no Delete anywhere: hard
       deletion is unapproved while retention policy is open. */
    await expect(
      actions.getByRole("button", { name: "Unpublish" }),
    ).toHaveCount(0)
    await expect(actions.getByRole("button", { name: /delete/i })).toHaveCount(
      0,
    )
  })

  test("publishing states its consequence and can be cancelled safely", async ({
    page,
  }) => {
    await openDraft(page)
    await page.getByRole("button", { name: "Publish" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText("visible in the public catalog")
    /* The confirm button names the consequence rather than saying "Confirm". */
    await expect(
      dialog.getByRole("button", { name: "Publish to the catalog" }),
    ).toBeVisible()

    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toHaveCount(0)

    /* Cancelling changed nothing: the draft is still a draft. */
    await expect(
      page.getByText("Not visible to families or visitors"),
    ).toBeVisible()
  })

  test("publishing, then unpublishing, reaches the public catalog and leaves it", async ({
    page,
    context,
  }) => {
    await openDraft(page)
    const detailUrl = page.url()

    await page.getByRole("button", { name: "Publish" }).click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Publish to the catalog" })
      .click()
    await expect(page.getByText("Publication updated")).toBeVisible()

    /* MPS-REQ-020: the same program state must be true on the public surface.
       A fresh anonymous context, so this is what a visitor actually sees. */
    const visitor = await context.browser()!.newContext()
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(
      new URL("/programs/sample-unpublished-draft", page.url()).toString(),
    )
    await expect(
      visitorPage.getByRole("heading", { name: DRAFT_NAME, level: 1 }),
    ).toBeVisible()

    // Restore the fixture.
    await page.goto(detailUrl)
    await page.getByRole("button", { name: "Unpublish" }).click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Unpublish this program" })
      .click()
    await expect(page.getByText("Publication updated")).toBeVisible()

    await visitorPage.goto(
      new URL("/programs/sample-unpublished-draft", page.url()).toString(),
    )
    await expect(
      visitorPage.getByRole("heading", { name: DRAFT_NAME, level: 1 }),
    ).toHaveCount(0)
    await visitor.close()
  })

  test("a checkout link to any other host is refused, with the value kept", async ({
    page,
  }) => {
    await openDraft(page)
    const field = page.getByLabel("External checkout link")
    await field.fill("https://evil.example.com/pay")
    await page.getByRole("button", { name: "Save program details" }).click()

    /* `exact` matters: the sr-only live-region announcement starts with the
       same words, and an unscoped locator matches both under strict mode. */
    await expect(
      page.getByText("Nothing was saved", { exact: true }),
    ).toBeVisible()
    /* The value survives the refusal: losing an administrator's typing is how
       a form makes someone give up and do it somewhere unaudited. */
    await expect(field).toHaveValue("https://evil.example.com/pay")
  })

  test("a checkout link carrying a query string is refused", async ({
    page,
  }) => {
    /* SECURITY-ARCHITECTURE: private data must not travel in a URL. Refusing
       it at storage means no later code has to remember to strip it. */
    await openDraft(page)
    await page
      .getByLabel("External checkout link")
      .fill("https://pay.homeschoolhaven.org/x?student=abc")
    await page.getByRole("button", { name: "Save program details" }).click()
    await expect(
      page.getByText("Nothing was saved", { exact: true }),
    ).toBeVisible()
  })

  test("offers no discount, refund, or payment control", async ({ page }) => {
    /* MPS GAP-010. A field here would be the first step toward storing an
       answer nobody has given.

       CAPACITY IS NO LONGER ON THIS LIST, AND THAT IS A DECISION.

       It was, under GAP-ADMIN-004, because no capacity capability existed and a
       field would have been one this product invented. HSH-SLICE-ADM-04 built
       the capability MPS-FEA-012 and MPS-RUL-002 approve, so a capacity control
       now belongs here. What GAP-ADMIN-004 still covers is the NUMBERS —
       checklist §1 is unanswered — and that is asserted separately below and in
       `schedule-capacity.spec.ts`: with no capacity set, the page states that
       none is established and shows no figure at all.

       Everything financial stays absent. Capacity is a count of places; it is
       not a price, a deposit, or a payment, and this test is what keeps the two
       from being confused as the surface grows.

       This asserts the absence of CONTROLS, not of words. The page's closing
       paragraph deliberately names scholarships, discounts, and refunds in
       order to say they are not managed here — saying so is the honest thing,
       and a test that forbade the words would forbid the explanation. */
    await openDraft(page)
    const main = page.locator("main")

    for (const label of [
      /discount/i,
      /scholarship/i,
      /refund/i,
      /credit/i,
      /amount/i,
      /deposit/i,
      /price per/i,
    ]) {
      await expect(main.getByLabel(label)).toHaveCount(0)
    }
    for (const action of [
      /verify payment/i,
      /mark as paid/i,
      /issue (a )?(refund|credit)/i,
      /apply (a )?discount/i,
    ]) {
      await expect(main.getByRole("button", { name: action })).toHaveCount(0)
    }

    /* The capacity control exists, and on an untouched draft it claims no
       number — GAP-ADMIN-004's surviving half. */
    /* By role, not by label alone: "Capacity and waitlist" is also the
       accessible name of the section that contains the field. */
    await expect(
      main.getByRole("textbox", { name: "Capacity", exact: true }),
    ).toHaveValue("")
    await expect(
      main.getByText("has not set a capacity for this program", {
        exact: false,
      }),
    ).toBeVisible()
  })

  test("a duplicate web address is refused with the values kept", async ({
    page,
  }) => {
    await page.goto("/admin/programs/new")
    await page.getByLabel("Program name").fill("Duplicate Attempt")
    await page.getByLabel("Web address").fill("art-lab")
    await page.getByRole("button", { name: "Create draft" }).click()

    await expect(
      page.getByText("already used by another program"),
    ).toBeVisible()
    await expect(page.getByLabel("Program name")).toHaveValue(
      "Duplicate Attempt",
    )
  })

  test("a malformed web address is refused before it reaches the database", async ({
    page,
  }) => {
    await page.goto("/admin/programs/new")
    await page.getByLabel("Program name").fill("Bad Slug")
    await page.getByLabel("Web address").fill("Not A Slug")
    await page.getByRole("button", { name: "Create draft" }).click()
    await expect(
      page.getByText("Use lowercase letters, numbers, and single hyphens"),
    ).toBeVisible()
  })
})

test.describe("accessibility and responsive behaviour", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/admin/programs")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("the table becomes labeled record cards on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/admin/programs")

    /* Both renderings are in the DOM; CSS decides which is visible, and only
       one is in the accessibility tree at a time. */
    await expect(page.getByRole("table")).toBeHidden()
    /* Every field keeps a visible label — no column meaning is lost, it is
       re-laid out (DO-DONT: never compress until meaning is gone). */
    for (const label of [
      "Publication",
      "Availability",
      "Educator",
      "Registration path",
    ]) {
      await expect(page.locator("dt", { hasText: label }).first()).toBeVisible()
    }
  })

  test("the page never scrolls horizontally on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/admin/programs")
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("the confirmation dialog traps focus and returns it", async ({
    page,
  }) => {
    await openDraft(page)
    const trigger = page.getByRole("button", { name: "Publish" })
    await trigger.focus()
    await page.keyboard.press("Enter")

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    /* Focus moved into the dialog, so a keyboard user is not left behind it. */
    await expect(dialog).toContainText("Publish this program?")
    const focusedInside = await page.evaluate(() => {
      const popup = document.querySelector('[data-slot="dialog-popup"]')
      return popup?.contains(document.activeElement) ?? false
    })
    expect(focusedInside).toBe(true)

    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    /* Focus returns to what opened it, rather than to the top of the page. */
    await expect(trigger).toBeFocused()
  })

  test("every action target meets the 44 px minimum", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/admin/programs")
    const buttons = page.locator("main a[href^='/admin'], main button")
    const count = await buttons.count()
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index)
      if (!(await button.isVisible())) continue
      const box = await button.boundingBox()
      if (!box) continue
      expect(box.height, `target ${index} height`).toBeGreaterThanOrEqual(44)
    }
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/admin/programs")
      /* Wait on the announced count rather than on the table: the table is
         hidden at mobile by design, and `ul li` also matches the sidebar. */
      await expect(page.getByRole("status")).toContainText("Showing")
      await expect(page).toHaveScreenshot(`admin-programs-${name}.png`, {
        fullPage: true,
      })
    })
  }

  test("matches the ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin/programs")
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "admin-programs-main.aria.yml",
    })
  })
})
