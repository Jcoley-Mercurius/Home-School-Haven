import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "./fixtures"

import type { Page } from "@playwright/test"

/**
 * Schedule, capacity, waitlist, and attendance through the browser
 * (HSH-SLICE-ADM-04; MPS-REQ-012/015/016/017/020/024, MPS-RUL-002/004/005,
 * MPS-ACC-020/025/026/027/031, MPS-FEA-011/012).
 *
 * WHAT THIS FILE IS FOR, AND WHAT IT IS NOT
 *
 * The pgTAP suite in `supabase/tests/database/100_*.test.sql` proves what the
 * database does when asked directly, which is the control. This proves the
 * things only a browser can: that a change an administrator makes on one screen
 * actually reaches the family, educator, and public screens; that the words
 * this product refuses to say are absent from the rendered page; and that a
 * role reaching a route by hand is refused by the response rather than by a
 * hidden button.
 *
 * These need seeded accounts and are skipped, loudly, when no Supabase project
 * is configured — a skipped test must never read as a passed one.
 *
 * To run:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local   # fill in the local stack's URL and key
 *   npx playwright test tests/e2e/schedule-capacity.spec.ts
 */
const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)

const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ACCOUNTS = {
  parent: "sample.parent.one@example.com",
  educator: "sample.educator@example.com",
  admin: "sample.admin@example.com",
} as const

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
} as const

/** Art Lab — the program the sample educator holds and family A is enrolled in. */
const ART_LAB = "10000000-0000-4000-8000-000000000004"

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

test.describe("schedule, capacity, waitlist, and attendance", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable. " +
      "See the header of this file to run this suite.",
  )

  test("an administrator sees the schedule and capacity on a program", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.goto(`/admin/programs/${ART_LAB}`)

    await expect(
      page.getByRole("heading", { name: "Schedule", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Capacity and waitlist" }),
    ).toBeVisible()

    /* The seeded sessions, including the two whose state is a decision. */
    await expect(
      page.getByText("Sample session — Art Lab meeting").first(),
    ).toBeVisible()
    await expect(page.getByText("Rescheduled").first()).toBeVisible()

    /* MPS-RUL-002: a capacity that was set is stated as a count of confirmed
       places, never as a claim about payment or about who holds a seat. */
    await expect(page.getByText(/of 12 places confirmed/)).toBeVisible()

    /* The waitlist heading says what the order is and is not (GAP-ADMIN-011). */
    await expect(
      page.getByText("in the order they were placed", { exact: false }),
    ).toBeVisible()
    await expect(
      page.getByText("not an order of promotion", { exact: false }),
    ).toBeVisible()
  })

  test("a program with no capacity set claims no number", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    /* Nature Explorers carries no seeded capacity. GAP-ADMIN-004: the numbers
       are unconfirmed, so "not established" is the honest state and it must
       render as words rather than as a zero, a dash, or an empty meter. */
    await page.goto("/admin/programs/10000000-0000-4000-8000-000000000002")

    await expect(
      page.getByText("has not set a capacity for this program", {
        exact: false,
      }),
    ).toBeVisible()
    await expect(page.getByText(/of 0 places confirmed/)).toHaveCount(0)
  })

  test("an administrator cancels a session and the family sees it", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.goto(`/admin/programs/${ART_LAB}`)

    /* The upcoming Art Lab session — the one seeded as `scheduled`. */
    const card = page
      .getByRole("listitem")
      .filter({ hasText: "Sample session — Art Lab meeting" })
      .filter({ hasText: "Upcoming" })
      .first()

    await card.getByRole("button", { name: "Cancel session" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    /* MPS-RUL-004: the dialog states the financial consequence that does NOT
       follow, before the click rather than after it. */
    await expect(
      dialog.getByText(
        "No refund, credit, transfer, or enrollment change is decided or issued here.",
        { exact: false },
      ),
    ).toBeVisible()

    /* A cancellation without a reason is refused: families read this note. */
    await dialog
      .getByLabel("Why is this session cancelled?")
      .fill("Sample record. Cancelled by an end-to-end test.")
    await dialog.getByRole("button", { name: "Cancel this session" }).click()

    await expect(dialog).toBeHidden()
    await expect(
      page.getByRole("status").filter({ hasText: "Session cancelled" }),
    ).toBeVisible()
    await expect(page.getByText("Cancelled").first()).toBeVisible()

    /* MPS-ACC-031: the same change, on the family's own screen.

       A SECOND CONTEXT, not a second sign-in on this one. `/sign-in` redirects
       an already-authenticated visitor away, so reusing this page would land on
       the admin dashboard and the parent's view would never be reached — the
       test would then pass or fail for reasons that have nothing to do with the
       cancellation. A separate context is a genuinely separate visitor. */
    const familyContext = await browser.newContext({ baseURL })
    const familyPage = await familyContext.newPage()

    try {
      await signIn(familyPage, ACCOUNTS.parent)
      await familyPage.goto("/family/schedule")

      await expect(familyPage.getByText("Cancelled").first()).toBeVisible()
      await expect(
        familyPage
          .getByText("Home School Haven has cancelled this session", {
            exact: false,
          })
          .first(),
      ).toBeVisible()
    } finally {
      await familyContext.close()
    }
  })

  test("a family reads a rescheduled session with the time it moved from", async ({
    page,
  }) => {
    /* MPS-ACC-025: the current state replaces the stale guidance "without
       erasing history", so the original time is still on the page. */
    await signIn(page, ACCOUNTS.parent)
    await page.goto("/family/schedule")

    await expect(page.getByText("Rescheduled").first()).toBeVisible()
    await expect(page.getByText("Previously").first()).toBeVisible()
  })

  test("an educator records attendance and never sees the word absent", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await page.goto(`/educator/programs/${ART_LAB}`)

    await expect(
      page.getByRole("heading", { name: "Attendance" }),
    ).toBeVisible()

    /* GAP-ADMIN-010: MPS defines no absence, so the product offers no control
       and no status that claims one. "Not recorded" is the whole vocabulary of
       the unmarked state.

       Asserted against controls and statuses rather than against the page text,
       because the page deliberately DOES use the word "absent" once — in the
       sentence explaining that not-recorded is not the same as absent. Banning
       the word outright would forbid the explanation that makes the limit
       clear. What must not exist is a button or a status label offering it. */
    await expect(page.getByText("Not recorded").first()).toBeVisible()
    for (const forbidden of [/absent/i, /excused/i, /tardy/i, /late/i]) {
      await expect(page.getByRole("button", { name: forbidden })).toHaveCount(0)
      await expect(page.getByRole("checkbox", { name: forbidden })).toHaveCount(
        0,
      )
      await expect(page.getByRole("radio", { name: forbidden })).toHaveCount(0)
      await expect(
        page.getByRole("status").filter({ hasText: forbidden }),
      ).toHaveCount(0)
    }

    const mark = page.getByRole("button", { name: /^Mark .* present$/ }).first()
    await mark.click()

    await expect(
      page.getByRole("button", { name: /Recorded present — undo/ }).first(),
    ).toBeVisible()
  })

  test("an educator is offered no way to change a schedule", async ({
    page,
  }) => {
    /* MPS-ACC-027 and MPS-RUL-005. The database refusal is proven in pgTAP;
       this proves the educator is not shown a control that would be refused. */
    await signIn(page, ACCOUNTS.educator)
    await page.goto(`/educator/programs/${ART_LAB}`)

    await expect(
      page.getByRole("button", { name: "Cancel session" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Edit or move" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Add this session" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Save capacity" }),
    ).toHaveCount(0)
  })

  test("a manipulated program id reaches no schedule", async ({ page }) => {
    /* A well-formed id for a program this educator does not hold answers 404 —
       the same response an id that never existed gets, so it never confirms
       whether the record exists. Sewing is a real program they are not
       assigned to. */
    await signIn(page, ACCOUNTS.educator)

    const response = await page.request.get(
      "/educator/programs/10000000-0000-4000-8000-000000000005",
      { maxRedirects: 0 },
    )
    expect(response.status()).toBe(404)
  })

  test("a visitor sees a published program's sessions and no draft's", async ({
    page,
  }) => {
    await page.goto("/calendar")

    /* The seeded Art Lab sessions carry a day and a year, which is the
       condition the calendar requires before plotting anything. */
    await expect(
      page.getByText("Sample session — Art Lab meeting").first(),
    ).toBeVisible()

    /* The draft fixture's session must reach nobody. */
    await expect(
      page.getByText("Sample session on an unpublished program", {
        exact: false,
      }),
    ).toHaveCount(0)
  })

  /* The accessibility and responsive smoke check for the surfaces this slice
     added. The full audit and the complete visual comparison are
     HSH-PHASE-QA-01; this is the gate that the new schedule, capacity, and
     attendance markup does not ship an obvious violation.

     Three viewports, because the approved responsive transformations are what
     turn a table into cards and move the action rail — a violation that only
     appears at one width is still a violation. */
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`the admin schedule has no axe violations at ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page, ACCOUNTS.admin)
      await page.goto("/admin/schedule")

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("the schedule and capacity forms have no axe violations", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.goto(`/admin/programs/${ART_LAB}`)

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the educator attendance surface has no axe violations", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await page.goto(`/educator/programs/${ART_LAB}`)

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("every session control is reachable and labelled by keyboard", async ({
    page,
  }) => {
    /* WCAG 2.2 AA: an administrator must be able to cancel a session without a
       mouse, and the dialog must take focus and return it. The note field's
       accessible name is the assertion that matters most — a native <textarea>
       is not a Base UI Field control, so its label has to be paired
       explicitly or it has no name at all. */
    await signIn(page, ACCOUNTS.admin)
    await page.goto(`/admin/programs/${ART_LAB}`)

    const cancel = page.getByRole("button", { name: "Cancel session" }).first()
    await cancel.focus()
    await expect(cancel).toBeFocused()
    await page.keyboard.press("Enter")

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    /* Found by its label, which only works if the label is associated. */
    const note = dialog.getByLabel("Why is this session cancelled?")
    await expect(note).toBeVisible()

    /* Escape closes it and nothing was written. */
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
  })

  test("the family schedule has no axe violations on mobile", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await signIn(page, ACCOUNTS.parent)
    await page.goto("/family/schedule")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })
})
