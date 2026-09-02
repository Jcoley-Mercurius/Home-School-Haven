import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * The family-side conversion journey (MPS-REQ-012, MPS-REQ-013, MPS-WFL-003;
 * MPS-ACC-002, 018, 019, 020, 021, 022, 023).
 *
 * The database half is `supabase/tests/database/
 * 110_family_conversion_journey.test.sql`, which proves the same refusals hold
 * with no page involved. Both are required: neither alone is the control. What
 * this file adds is the half a parent actually meets — that a blocked
 * registration NAMES its blocker, and that no payment control is rendered on
 * any path but one.
 *
 * The credentialed cases need the seeded accounts and are skipped, loudly, when
 * no Supabase project is configured. A skipped test must never read as a passed
 * one.
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
  /** Family A: two students. */
  parentWithFamily: "sample.parent.one@example.com",
  parentNoFamily: "sample.parent.three@example.com",
  educator: "sample.educator@example.com",
} as const

/** Seeded conversion fixtures — see the block at the end of supabase/seed.sql. */
const PROGRAMS = {
  /** administrator_approval, no capacity. MPS-ACC-019. */
  approval: "ready-set-prep-and-learn",
  /** instant, no capacity. MPS-ACC-021. */
  instant: "gardening",
  /** instant, one place taken, waitlist ON. MPS-ACC-020. */
  waitlist: "history-explorers",
  /** instant, one place taken, waitlist OFF. */
  full: "etiquette-series",
} as const

/** The second child, who holds no seeded enrollment in any fixture program. */
const FREE_STUDENT = "Sample Student A2"

/**
 * Asserts a route's HTTP status without navigating the page to it.
 *
 * `page.goto()` on an expected 404 makes the browser log a failed-resource
 * console error, which the shared console guard correctly treats as a failure.
 * Denial is about the response, not about rendering the error page. The request
 * context shares the browser's cookies, so the session under test is still the
 * one being denied. Same helper, same reasoning, as authorization.spec.ts.
 */
async function expectStatus(page: Page, route: string, status: number) {
  const response = await page.request.get(route, { maxRedirects: 0 })
  expect(response.status(), `${route} should answer ${status}`).toBe(status)
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

async function register(page: Page, slug: string, student: string) {
  await page.goto(`/family/enroll/${slug}`)
  await page
    .getByLabel("Which student are you registering?")
    .selectOption({ label: student })
  await page
    .getByRole("checkbox", { name: /parent or legal guardian/i })
    .check()
  await page.getByRole("button", { name: "Request Registration" }).click()
}

/** No payment control may exist anywhere on the page. Not disabled — absent. */
/**
 * Put the dashboard in a given child's context.
 *
 * The dashboard is per-student (MDS-REF-007's "Viewing: …" control), so a
 * registration for the second child is not on the first child's overview. That
 * is the selector working, not a missing row.
 */
async function viewStudent(page: Page, student: string) {
  await page.goto("/family")
  await page.getByRole("combobox", { name: "Viewing student" }).click()
  await page.getByRole("option", { name: student }).click()
  await page.waitForURL(/student=/)
}

async function expectNoPaymentPath(page: Page) {
  await expect(
    page.getByRole("link", { name: /Continue to Secure Checkout/i }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: /Continue to Secure Checkout/i }),
  ).toHaveCount(0)
}

test.describe("public program page", () => {
  test("offers the registration path before the checkout panel", async ({
    page,
  }) => {
    await page.goto(`/programs/${PROGRAMS.instant}`)
    const register = page.getByRole("link", { name: "Register a Student" })
    await expect(register).toBeVisible()
    await expect(register).toHaveAttribute(
      "href",
      `/family/enroll/${PROGRAMS.instant}`,
    )
  })

  test("still says checkout is a handoff, not payment", async ({ page }) => {
    await page.goto(`/programs/${PROGRAMS.instant}`)
    await expect(
      page.getByText(/Starting checkout does not confirm payment/i).first(),
    ).toBeVisible()
  })
})

test.describe("signed out", () => {
  test("the registration route asks for sign-in and returns here", async ({
    page,
  }) => {
    await page.goto(`/family/enroll/${PROGRAMS.instant}`)
    await expect(page).toHaveURL(/\/sign-in\?redirectTo=/)
    await expect(page).toHaveURL(
      new RegExp(encodeURIComponent(`/family/enroll/${PROGRAMS.instant}`)),
    )
  })
})

test.describe("registration", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs the seeded Supabase stack — see the header.",
  )

  test("an educator cannot reach the family registration route", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await expectStatus(page, `/family/enroll/${PROGRAMS.instant}`, 404)
  })

  test("a parent with no family is sent to setup first", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentNoFamily)
    await page.goto(`/family/enroll/${PROGRAMS.instant}`)
    await expect(page).toHaveURL(/\/family\/setup/)
  })

  test("no payment control appears on the registration form itself", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto(`/family/enroll/${PROGRAMS.instant}`)
    await expectNoPaymentPath(page)
    /* The meaning of the action is stated before the action, in every case. */
    await expect(
      page.getByText(/does not confirm your child's place/i).first(),
    ).toBeVisible()
  })

  test("MPS-ACC-002/018: no guardian affirmation blocks and names the blocker", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto(`/family/enroll/${PROGRAMS.approval}`)
    await page
      .getByLabel("Which student are you registering?")
      .selectOption({ label: FREE_STUDENT })
    await page.getByRole("button", { name: "Request Registration" }).click()

    await expect(
      page.getByText(/Confirm that you are this student's parent or guardian/i),
    ).toBeVisible()
    /* Still on the form, nothing recorded, nowhere near a payment path. */
    await expect(page).toHaveURL(
      new RegExp(`/family/enroll/${PROGRAMS.approval}`),
    )
    await expectNoPaymentPath(page)
  })

  test("MPS-ACC-019: an approval-required program becomes pending review", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.approval, FREE_STUDENT)

    await page.waitForURL(/\/family\/enrollments\//)
    await expect(page.getByText("Pending review")).toBeVisible()
    /* The STATE's own sentence, not the submission banner. A second run of this
       suite reaches the same registration through the duplicate path, and the
       state is what the page asserts either way. */
    await expect(
      page.getByText(/is reviewing it\. Enrollment is not confirmed yet/i),
    ).toBeVisible()
    await expectNoPaymentPath(page)
  })

  test("MPS-ACC-023: registering the same student twice creates nothing new", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.approval, FREE_STUDENT)
    await page.waitForURL(/\/family\/enrollments\//)
    const first = page.url().split("?")[0]

    await register(page, PROGRAMS.approval, FREE_STUDENT)
    await page.waitForURL(/\/family\/enrollments\//)
    expect(page.url().split("?")[0]).toBe(first)
    await expect(
      page.getByText(/Nothing was added and nothing was charged/i),
    ).toBeVisible()

    /* One row, one entry on this child's overview. */
    await viewStudent(page, FREE_STUDENT)
    await expect(
      page.getByRole("link", { name: /Ready Set Prep & Learn/ }),
    ).toHaveCount(1)
  })

  test("MPS-ACC-020: a full waitlist-enabled program waitlists and takes no payment", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.waitlist, FREE_STUDENT)

    await page.waitForURL(/\/family\/enrollments\//)
    await expect(page.getByText("Waitlisted")).toBeVisible()
    await expect(
      page.getByText(/A waitlist place is not enrollment/i).first(),
    ).toBeVisible()
    await expectNoPaymentPath(page)
  })

  test("a full program without a waitlist refuses and invents none", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.full, FREE_STUDENT)

    /* The heading appears in the alert and in its announcement region; both
       are correct, so the assertion takes the first rather than forbidding one. */
    await expect(page.getByText("This program is full").first()).toBeVisible()
    await expect(
      page.getByText(/does not keep a waitlist/i).first(),
    ).toBeVisible()
    await expect(
      page.getByText(/no payment was started/i).first(),
    ).toBeVisible()
    /* Blocked outcomes never leave the form: nothing was recorded to link to. */
    await expect(page).toHaveURL(new RegExp(`/family/enroll/${PROGRAMS.full}`))
    await expectNoPaymentPath(page)
  })

  test("MPS-ACC-021: an eligible instant registration reaches the handoff, unconfirmed", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.instant, FREE_STUDENT)

    await page.waitForURL(/\/family\/enrollments\//)
    await expect(page.getByText("Awaiting checkout")).toBeVisible()
    await expect(
      page.getByText(
        /Payment is not confirmed and enrollment is not confirmed/i,
      ),
    ).toBeVisible()

    /* The handoff panel is present. Its checkout link is not, because no
       program publishes one — and the page says so rather than inventing a
       destination (F-1). */
    await expect(
      page.getByRole("heading", { name: "Registration", exact: true }).first(),
    ).toBeVisible()
    await expect(
      page.getByText(/Registration link not published/i),
    ).toBeVisible()
    /* Nothing on this page claims enrollment. */
    await expect(page.getByText("Enrolled", { exact: true })).toHaveCount(0)
  })

  test("MPS-ACC-022: the dashboard and the registration page agree", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.waitlist, FREE_STUDENT)
    await page.waitForURL(/\/family\/enrollments\//)

    await viewStudent(page, FREE_STUDENT)
    await expect(page.getByText("Waitlisted").first()).toBeVisible()
    await page
      .getByRole("link", { name: "View this registration" })
      .first()
      .click()
    await expect(page).toHaveURL(/\/family\/enrollments\//)
  })

  test("another family's registration is not found", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    /* Family B's seeded waitlisted enrollment. */
    await expectStatus(
      page,
      "/family/enrollments/50000000-0000-4000-8000-000000000004",
      404,
    )
  })

  test("an outcome supplied in the URL cannot change the stored state", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.approval, FREE_STUDENT)
    await page.waitForURL(/\/family\/enrollments\//)
    const id = page.url().split("?")[0]

    await page.goto(`${id}?outcome=started`)
    /* The banner follows the query string; the STATE does not, and the state is
       what the page asserts. No payment path appears. */
    await expect(page.getByText("Pending review")).toBeVisible()
    await expectNoPaymentPath(page)
  })
})

test.describe("accessibility and responsive", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs the seeded Supabase stack — see the header.",
  )

  test("the registration form has no axe violations", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto(`/family/enroll/${PROGRAMS.instant}`)
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the registration page has no axe violations", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.instant, FREE_STUDENT)
    await page.waitForURL(/\/family\/enrollments\//)
    /* Arrive at the top of the page. A form submission can land here with the
       scroll preserved, which puts the portal nav behind the sticky site header
       — axe then reports the nav link as obscured. That is the approved sticky
       shell mid-scroll (DESIGN-SYSTEM §7), not a defect this page introduces,
       and it reproduces on any scrolled portal page. */
    await page.evaluate(() => window.scrollTo(0, 0))
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the whole flow is operable from the keyboard", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto(`/family/enroll/${PROGRAMS.instant}`)

    const select = page.getByLabel("Which student are you registering?")
    await select.focus()
    await select.selectOption({ label: FREE_STUDENT })
    await page.keyboard.press("Tab")
    await page.keyboard.press("Space")
    await expect(
      page.getByRole("checkbox", { name: /parent or legal guardian/i }),
    ).toBeChecked()
    await page.keyboard.press("Tab")
    await expect(
      page.getByRole("button", { name: "Request Registration" }),
    ).toBeFocused()
  })

  test("the blocked state is announced", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.full, FREE_STUDENT)
    /* DESIGN-SYSTEM §10: blocked, waitlist, and handoff changes are announced. */
    await expect(page.locator('[role="status"]').first()).toContainText(
      /This program is full/i,
    )
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`registration form matches the reference at ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page, ACCOUNTS.parentWithFamily)
      await page.goto(`/family/enroll/${PROGRAMS.instant}`)
      await expect(page).toHaveScreenshot(`enroll-form-${name}.png`, {
        fullPage: true,
      })
    })
  }

  test("the registration page structure is stable", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await register(page, PROGRAMS.approval, FREE_STUDENT)
    await page.waitForURL(/\/family\/enrollments\//)
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "family-enrollment-approval-pending.aria.yml",
    })
  })
})
