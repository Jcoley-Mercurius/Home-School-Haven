import { execFileSync } from "node:child_process"

import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Administrator enrollment operations (ACT-004/006; MPS-REQ-014/017/020/021/
 * 023/024, MPS-RUL-004; MPS-ACC-022; MDS-REF-009).
 *
 * The database half is `supabase/tests/database/
 * 70_admin_program_enrollment_ops.test.sql`, which proves the transition rules
 * and every denial hold when no application code is involved.
 *
 * WHAT THIS SUITE IS REALLY GUARDING
 *
 * The trust contract. An enrollment surface is the easiest place in this
 * product to start lying: to imply that payment activity is payment, that a
 * pending payment is a place in a class, or that a control exists for a
 * financial decision nobody has approved. Several tests below assert the
 * *absence* of language and controls, which is unusual and deliberate.
 *
 * WRITE TESTS AND THE SHARED FIXTURE
 *
 * The state-change cases mutate seeded rows and are ordered so the suite ends
 * where it began. `test.describe.serial` is used for that group so a failure
 * does not leave the fixture half-changed for the next test.
 *
 * To run the full matrix:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local
 *   npm run test:e2e
 */
/*
 * Serial, and the mutating group runs LAST.
 *
 * Every test in this file shares one database. The state-change group below
 * deliberately does NOT restore what it changes -- `canceled` is terminal, so
 * there is no approved transition back to the seeded state -- which means any
 * test that runs after it, or beside it under a second worker, sees different
 * data than the seed provides. That is what made the visual baselines and the
 * ARIA snapshot fail: they were racing the state changes rather than
 * disagreeing with the design.
 *
 * Serial mode confines the file to one worker and fixes the order; putting the
 * mutations last means the snapshots read the pristine seed.
 */
test.describe.configure({ mode: "serial" })

/*
 * Re-seed around this file, because its state changes cannot be undone.
 *
 * The group at the bottom moves a seeded enrollment through the approved
 * transitions and cannot put it back: `approval_pending` is not a state an
 * administrator may set (that is the rule this slice enforces), so there is no
 * approved route home. Every other suite here restores what it changes; this
 * one structurally cannot.
 *
 * Left alone that has two consequences, and both were observed: running this
 * file twice fails the second time, and `admin-overview.spec.ts` -- which
 * reports enrollment counts and runs straight after it alphabetically -- read
 * "Not confirmed 1" where its baseline says "Pending review 1" and failed on a
 * change this file had made.
 *
 * So the fixture is rebuilt before and after. `db:reset` verifies the seed
 * landed rather than trusting an exit code (scripts/db-reset.mjs), and only
 * ever touches the local stack -- which is why this is skipped outright unless
 * the tests are pointed at it.
 */
const LOCAL_STACK = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("127.0.0.1"),
)

/** Rebuild the sanitized fixture. Local stack only. */
function reseed() {
  execFileSync("npm", ["run", "db:reset"], { stdio: "inherit" })
}

test.beforeAll(async () => {
  test.setTimeout(300_000)
  if (LOCAL_STACK) reseed()
})

test.afterAll(async () => {
  test.setTimeout(300_000)
  if (LOCAL_STACK) reseed()
})

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

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

async function expectStatus(page: Page, route: string, status: number) {
  const response = await page.request.get(route, { maxRedirects: 0 })
  expect(response.status(), `${route} should answer ${status}`).toBe(status)
}

/**
 * Open one enrollment's drawer from the desktop table.
 *
 * Addressed by student AND program, because a student may hold more than one
 * enrollment -- Sample Student A1 holds two, and matching on the name alone
 * resolved to both rows and failed on strict mode. The Review button already
 * carries a fully qualifying accessible name ("Review <student>'s enrollment in
 * <program>"), so it identifies one record on its own. Scope every locator
 * (DEFECT-AO3).
 */
async function openDrawer(
  page: Page,
  studentName: string,
  programName: string,
) {
  await page
    .getByRole("button", {
      name: `Review ${studentName}'s enrollment in ${programName}`,
      exact: true,
    })
    .click()
  await expect(page.getByRole("dialog")).toBeVisible()
}

test.describe("signed out", () => {
  test("redirects to sign-in and keeps the destination", async ({ page }) => {
    await page.goto("/admin/enrollments")
    await expect(page).toHaveURL(
      `/sign-in?redirectTo=${encodeURIComponent("/admin/enrollments")}`,
    )
  })
})

test.describe("denial matrix", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )

  test("a parent is refused, including for their own enrollments", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await expectStatus(page, "/admin/enrollments", 404)
  })

  test("an educator is refused, including for their own roster", async ({
    page,
  }) => {
    /* An educator's assignment grants them roster reads in their own
       workspace. It never grants an operations surface (MPS-REQ-018). */
    await signIn(page, ACCOUNTS.educator)
    await expectStatus(page, "/admin/enrollments", 404)
  })
})

test.describe("the trust contract", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/enrollments")
  })

  test("never presents payment activity as confirmed payment", async ({
    page,
  }) => {
    const main = page.locator("main")
    await expect(main).toContainText(
      "Payment is never confirmed on this platform",
    )
    for (const forbidden of [
      /payment (confirmed|received|successful|complete)/i,
      /paid in full/i,
      /mark as paid/i,
      /verify payment/i,
      /record payment/i,
    ]) {
      await expect(main).not.toHaveText(forbidden)
    }
  })

  test("offers no financial control of any kind", async ({ page }) => {
    /* MPS GAP-010 and MPS-RUL-004: the beta records status and decides no
       financial outcome. Absence is the assertion. */
    const main = page.locator("main")
    for (const forbidden of [
      /scholarship/i,
      /discount/i,
      /issue a refund/i,
      /refund this/i,
      /transfer to another/i,
      /issue credit/i,
    ]) {
      await expect(main).not.toHaveText(forbidden)
    }
  })

  test("uses the same enrollment vocabulary the family sees", async ({
    page,
  }) => {
    /* MPS-ACC-022: one consistent authoritative state across both views. Both
       render from `ENROLLMENT_STATE`, so this asserts the join is real. */
    const table = page.getByRole("table")
    await expect(
      table.getByText("Payment verification pending").first(),
    ).toBeVisible()
    await expect(table.getByText("Enrolled").first()).toBeVisible()
  })

  test("states non-confirmation in words, not by absence of a tick", async ({
    page,
  }) => {
    await openDrawer(page, "Sample Student A1", "Art Lab")
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("not yet confirmed")
    await expect(dialog).toContainText("cannot verify a payment")
  })

  test("offers no way to create or delete an enrollment", async ({ page }) => {
    /* Creating one needs a parent's authority affirmation an administrator
       cannot give (MPS-RUL-008); deleting one is checklist §11, unanswered. */
    const main = page.locator("main")
    await expect(
      main.getByRole("button", { name: /new enrollment|add enrollment/i }),
    ).toHaveCount(0)
    await expect(main.getByRole("button", { name: /delete/i })).toHaveCount(0)
  })

  test("puts no student name or record id in the URL", async ({ page }) => {
    await page.goto("/admin/enrollments?state=confirmed")
    await openDrawer(page, "Sample Student A1", "Haven Days Enrichment")
    /* The drawer opens from data the list already carries. Nothing about a
       child reaches the address bar, the history, or a referrer header. */
    expect(page.url()).not.toMatch(/Sample|Student|[0-9a-f]{8}-[0-9a-f]{4}/i)
  })
})

test.describe("filters and states", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
  })

  test("filters by enrollment state", async ({ page }) => {
    await page.goto("/admin/enrollments?state=confirmed")
    const table = page.getByRole("table")
    await expect(table.getByText("Enrolled").first()).toBeVisible()
    await expect(table.getByText("Waitlisted")).toHaveCount(0)
  })

  test("a no-results filter offers a way out", async ({ page }) => {
    await page.goto("/admin/enrollments?state=payment_failed")
    await expect(
      page.getByText("No enrollments match these filters"),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Clear filters" }),
    ).toBeVisible()
  })

  test("an unrecognised state shows everything instead of erroring", async ({
    page,
  }) => {
    await page.goto("/admin/enrollments?state=paid")
    await expect(page.getByRole("table")).toBeVisible()
  })

  test("offers no filter for a state the product does not model", async ({
    page,
  }) => {
    await page.goto("/admin/enrollments")
    /* By its accessible name: the page carries other forms, including the
       header's sign-out, and a bare `locator("form")` matched all of them. */
    const filters = page.getByRole("form", { name: "Filter enrollments" })
    await expect(filters).not.toHaveText(/refunded|paid|scholarship/i)
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
      await page.goto("/admin/enrollments")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("the open drawer has no axe violations", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin/enrollments")
    await openDrawer(page, "Sample Student A1", "Art Lab")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the table becomes labeled record cards on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/admin/enrollments")
    await expect(page.getByRole("table")).toBeHidden()
    for (const label of ["Family", "Program", "State"]) {
      await expect(page.locator("dt", { hasText: label }).first()).toBeVisible()
    }
  })

  test("the drawer traps focus and returns it on Escape", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin/enrollments")

    const trigger = page
      .getByRole("table")
      .getByRole("row", { name: /Sample Student A1/ })
      .getByRole("button", { name: "Review" })
      .first()
    await trigger.focus()
    await page.keyboard.press("Enter")

    await expect(page.getByRole("dialog")).toBeVisible()
    const focusedInside = await page.evaluate(() => {
      const popup = document.querySelector('[data-slot="dialog-popup"]')
      return popup?.contains(document.activeElement) ?? false
    })
    expect(focusedInside).toBe(true)

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test("the page never scrolls horizontally on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/admin/enrollments")
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/admin/enrollments")
      await expect(page.locator("main")).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-enrollments-${name}.png`, {
        fullPage: true,
      })
    })
  }

  test("matches the ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin/enrollments")
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "admin-enrollments-main.aria.yml",
    })
  })
})

test.describe.serial("approved state changes", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/enrollments")
  })

  test("offers only the approved decisions for the current state", async ({
    page,
  }) => {
    /* Sample Student A2's enrollment is `approval_pending`: all four targets
       are reachable from it. */
    await openDrawer(page, "Sample Student A2", "Harvest Explorers")
    const dialog = page.getByRole("dialog")
    for (const action of [
      "Confirm enrollment",
      "Place on waitlist",
      "Hold for review",
      "Cancel enrollment",
    ]) {
      await expect(dialog.getByRole("button", { name: action })).toBeVisible()
    }
  })

  test("a change requires a recorded reason", async ({ page }) => {
    await openDrawer(page, "Sample Student A2", "Harvest Explorers")
    await page.getByRole("button", { name: "Hold for review" }).click()

    const confirm = page.getByRole("dialog").last()
    await expect(confirm).toContainText("Hold this enrollment for review?")
    /* Submitting with an empty note is refused on the server; MPS-REQ-024's
       history is only useful if it says why. */
    await confirm.getByRole("button", { name: "Hold for review" }).click()
    await expect(
      page.getByText(/Say why this enrollment is changing/),
    ).toBeVisible()
  })

  test("holding, then confirming, is recorded and reaches the family", async ({
    page,
    context,
  }) => {
    await openDrawer(page, "Sample Student A2", "Harvest Explorers")
    await page.getByRole("button", { name: "Hold for review" }).click()

    const confirm = page.getByRole("dialog").last()
    await confirm.getByLabel("Reason (recorded)").fill("Sample test reason.")
    await confirm.getByRole("button", { name: "Hold for review" }).click()
    await expect(page.getByText("Enrollment updated")).toBeVisible()

    /* MPS-ACC-022: the family's own view must agree, immediately. */
    const family = await context.browser()!.newContext()
    const familyPage = await family.newPage()
    await signIn(familyPage, ACCOUNTS.parent)
    await familyPage.goto("/family")
    /* The dashboard shows one child at a time, and the enrollment just changed
       belongs to the second one, so switch to them through the same selector a
       parent would use. Reading only the default view asserted nothing about
       the record under test. */
    await familyPage.getByRole("combobox", { name: "Viewing student" }).click()
    await familyPage.getByRole("option", { name: "Sample Student A2" }).click()
    /* The selector submits a GET form; without waiting for that navigation the
       assertion below reads the previous child's dashboard. Same sequence as
       family-dashboard.spec.ts. */
    await familyPage.waitForURL(/student=/)
    await expect(familyPage.locator("main")).toContainText(
      "Home School Haven needs to look at this registration",
    )
    await family.close()

    /* MPS-REQ-024: the change is attributable, and appears in history. */
    await page.goto("/admin")
    await expect(page.locator("main")).toContainText(
      /* The label `activity.ts` actually renders for
         `enrollment:state_changed`, and the one tests/admin-attention.test.mts
         already pins. */
      "Enrollment state changed",
    )

    // Restore the fixture: back to approval_pending is not an approved
    // transition, so this test leaves the record `blocked` and the next one
    // moves it on. Ordered by `describe.serial` for exactly that reason.
  })

  test("a repeated decision is a no-op, not a second change", async ({
    page,
  }) => {
    /* The record is `blocked` from the previous test. Holding it again must
       write nothing and record nothing — what makes a double-click safe. */
    await openDrawer(page, "Sample Student A2", "Harvest Explorers")
    const dialog = page.getByRole("dialog")
    /* `blocked` cannot transition to itself, so the button is not offered at
       all — the strongest possible form of the same guarantee. */
    await expect(
      dialog.getByRole("button", { name: "Hold for review" }),
    ).toHaveCount(0)
    await expect(
      dialog.getByRole("button", { name: "Confirm enrollment" }),
    ).toBeVisible()
  })

  test("a confirmation warns that it cannot be undone", async ({ page }) => {
    /* GAP-ADMIN-008: no approved correction path exists, so the warning has to
       come before the decision — after it there is nothing to offer. */
    await openDrawer(page, "Sample Student A2", "Harvest Explorers")
    await page.getByRole("button", { name: "Confirm enrollment" }).click()

    const confirm = page.getByRole("dialog").last()
    await expect(confirm).toContainText("cannot be reversed here")
    await expect(confirm).toContainText("does not verify a payment")
    /* `exact`: the cancellation dialog's dismiss control ("Cancel") and its
       submit ("Cancel this enrollment") both match the substring. */
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click()
  })

  test("cancelling states that it issues no refund, credit, or transfer", async ({
    page,
  }) => {
    await openDrawer(page, "Sample Student A2", "Harvest Explorers")
    await page.getByRole("button", { name: "Cancel enrollment" }).click()

    const confirm = page.getByRole("dialog").last()
    await expect(confirm).toContainText("no refund, credit, or transfer")
    await expect(confirm).toContainText("records a status only")
    /* `exact`: the cancellation dialog's dismiss control ("Cancel") and its
       submit ("Cancel this enrollment") both match the substring. */
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click()
  })

  test("a confirmed enrollment offers only cancellation", async ({ page }) => {
    /* Sample Student A1 holds the seeded `confirmed` enrollment. */
    await page.goto("/admin/enrollments?state=confirmed")
    await openDrawer(page, "Sample Student A1", "Haven Days Enrichment")
    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("button", { name: "Cancel enrollment" }),
    ).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Hold for review" }),
    ).toHaveCount(0)
    await expect(
      dialog.getByRole("button", { name: "Place on waitlist" }),
    ).toHaveCount(0)
  })
})
