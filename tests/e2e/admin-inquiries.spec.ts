import { execFileSync } from "node:child_process"

import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Administrator inquiry triage (ACT-004/006; MPS-REQ-009/010/021/023/024;
 * MPS-WFL-001/004; MPS-RUL-003, MPS-RUL-004; MPS-ACC-012/013/014).
 *
 * The database half is `supabase/tests/database/120_inquiry_capture.test.sql`,
 * which proves the privacy boundary and the transition rules hold when no
 * application code is involved. This suite proves the surface above them tells
 * the truth.
 *
 * WHAT THIS SUITE IS REALLY GUARDING
 *
 * Two promises. That a family's private request about the cost of a class
 * never reaches an educator (MPS-ACC-013) — asserted here as a route refusal
 * AND as the absence of the words anywhere in an educator's workspace. And
 * that no control on this surface claims to have decided a financial outcome
 * (MPS-RUL-004) — asserted as the absence of language, which is unusual and
 * deliberate.
 *
 * WRITE TESTS AND THE SHARED FIXTURE
 *
 * The triage group mutates seeded rows and cannot put them back through the
 * product: MPS-WFL-004 has no route from `under_review` to `submitted`, which
 * is precisely the rule this slice enforces. So the fixture is restored around
 * this file, and the mutating group runs last under serial mode, for the reason
 * recorded at length in `admin-enrollments.spec.ts`.
 *
 * The restore is SCOPED to inquiries rather than being a whole-database
 * `db:reset`. This suite touches nothing else — no program, no enrollment, no
 * family — and a full reset would be both slower and a larger blast radius
 * than the mutations warrant. `supabase/seed.sql` is idempotent (`on conflict
 * do nothing` throughout), so deleting the four sample inquiries and re-running
 * it restores exactly what this file changed and leaves every other suite's
 * fixture untouched.
 *
 * To run:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local
 *   npx playwright test admin-inquiries
 */
test.describe.configure({ mode: "serial" })

const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
)

const CAN_RESTORE_FIXTURE = (() => {
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
 * Restore the sanitized inquiry fixture. Local stack only.
 *
 * The audit rows go with them: they are keyed to the inquiry, and leaving a
 * previous run's history behind would let a state-change assertion pass on a
 * row this run never touched (MPS-REQ-024 history is real data, not scaffolding).
 */
function restoreInquiryFixture() {
  execFileSync(
    "psql",
    [
      LOCAL_DB,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "delete from public.audit_events where entity_type = 'inquiry';",
      "-c",
      "delete from public.inquiries where reference like 'HSH-SAMPLE%';",
    ],
    { stdio: "inherit" },
  )
  execFileSync(
    "psql",
    [
      LOCAL_DB,
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "hsh_seed_environment=local",
      "-f",
      "supabase/seed.sql",
    ],
    { stdio: "inherit" },
  )
}

test.beforeAll(async () => {
  test.setTimeout(300_000)
  if (CAN_RESTORE_FIXTURE) restoreInquiryFixture()
})

test.afterAll(async () => {
  test.setTimeout(300_000)
  if (CAN_RESTORE_FIXTURE) restoreInquiryFixture()
})

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

const ROUTE = "/admin/communications/inquiries"

const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ACCOUNTS = {
  admin: "sample.admin@example.com",
  parent: "sample.parent.one@example.com",
  educator: "sample.educator@example.com",
} as const

/** The seeded assistance request. Its words are the thing that must not leak. */
const ASSISTANCE_MESSAGE = /A family would describe their situation here/

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

/** Open one inquiry's drawer from the desktop table. Scope every locator. */
async function openDrawer(page: Page, name: RegExp | string) {
  await page
    .getByRole("table")
    .getByRole("row", { name })
    .getByRole("button", { name: "Open" })
    .first()
    .click()
  await expect(page.getByRole("dialog")).toBeVisible()
}

test.describe("signed out", () => {
  test("redirects to sign-in and keeps the destination", async ({ page }) => {
    await page.goto(ROUTE)
    await expect(page).toHaveURL(
      `/sign-in?redirectTo=${encodeURIComponent(ROUTE)}`,
    )
  })
})

test.describe("privacy boundary (MPS-ACC-013)", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )

  test("an educator is refused the queue, and told nothing about it", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    const response = await page.request.get(ROUTE, { maxRedirects: 0 })
    /* 404, not 403: a 403 would confirm this surface exists and that the
       educator is merely the wrong role for it. */
    expect(response.status()).toBe(404)
  })

  test("a parent is refused the queue", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    const response = await page.request.get(ROUTE, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
  })

  test("no assistance request appears anywhere in the educator workspace", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    /* The route refusal above proves the door is shut. This proves nothing
       came through a side entrance — a roster note, an announcement list, a
       history feed. The words themselves are the test. */
    for (const route of ["/educator", "/account"]) {
      await page.goto(route)
      await expect(page.locator("body")).not.toContainText(ASSISTANCE_MESSAGE)
      await expect(page.locator("body")).not.toContainText("HSH-SAMPLE1")
      await expect(page.locator("body")).not.toContainText(
        "sample.one@example.com",
      )
    }
  })
})

test.describe("the queue", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
  })

  test("lists every seeded inquiry with its pathway and state", async ({
    page,
  }) => {
    const table = page.getByRole("table")
    await expect(table.getByRole("row")).toHaveCount(5) // header + four samples
    await expect(table).toContainText("Cost assistance")
    await expect(table).toContainText("Guidance")
    await expect(table).toContainText("Visit")
    await expect(table).toContainText("General question")
    await expect(table).toContainText("Submitted")
    await expect(table).toContainText("Under review")
  })

  test("does not render what a family wrote until the drawer is opened", async ({
    page,
  }) => {
    /* MPS-RUL-003. The queue is the screen most likely to be shared or
       screenshotted, and an assistance request's words do not belong on it. */
    await expect(page.getByRole("table")).not.toContainText(ASSISTANCE_MESSAGE)
    await expect(page.getByRole("table")).not.toContainText(
      "sample.one@example.com",
    )

    await openDrawer(page, /Cost assistance/)
    await expect(page.getByRole("dialog")).toContainText(ASSISTANCE_MESSAGE)
  })

  test("keeps no inquiry identifier in the address bar", async ({ page }) => {
    await openDrawer(page, /Cost assistance/)
    expect(page.url()).toContain(ROUTE)
    expect(page.url()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  test("marks the cost-assistance request as private in words", async ({
    page,
  }) => {
    await openDrawer(page, /Cost assistance/)
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("private request about cost")
    await expect(dialog).toContainText("not visible to educators")
  })

  test("promises no outcome and no message to the family", async ({ page }) => {
    /* MPS-RUL-004 and GAP-PUBLIC-001, asserted as absence. A control reading
       "Approve assistance" or "Send reply" would claim something this release
       neither decides nor does. */
    await openDrawer(page, /Cost assistance/)
    const dialog = page.getByRole("dialog")

    for (const forbidden of [
      "Approve assistance",
      "Grant",
      "Award",
      "Discount",
      "Scholarship",
      "Decline",
      "Send reply",
      "Email the family",
    ]) {
      await expect(
        dialog.getByRole("button", { name: forbidden }),
      ).toHaveCount(0)
    }

    await expect(dialog).toContainText("record a status, not a decision")
    await expect(dialog).toContainText("Replying to the family is still yours")
  })

  test("offers only the transitions MPS-WFL-004 approves", async ({ page }) => {
    await openDrawer(page, /Cost assistance/) // state: submitted
    const dialog = page.getByRole("dialog")

    await expect(
      dialog.getByRole("button", { name: "Mark under review" }),
    ).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Mark closed" }),
    ).toBeVisible()
    /* NEITHER conclusion is reachable before a review (MPS-WFL-004's main path
       puts "Administrator reviews" first). Closing stays available, because
       closing disposes of a request that needed no answer rather than
       concluding anything about it. */
    await expect(
      dialog.getByRole("button", { name: "Mark path provided" }),
    ).toHaveCount(0)
    await expect(
      dialog.getByRole("button", { name: "Mark not available" }),
    ).toHaveCount(0)
  })

  test("treats a closed inquiry as final", async ({ page }) => {
    await openDrawer(page, /General question/) // state: closed
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("is a final state")
    await expect(dialog.getByRole("button", { name: /^Mark / })).toHaveCount(0)
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
      await page.goto(ROUTE)
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("the open drawer has no axe violations", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
    await openDrawer(page, /Cost assistance/)
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the table becomes labeled record cards on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(ROUTE)
    await expect(page.getByRole("table")).toBeHidden()
    for (const label of ["From", "Arrived", "Owner", "State"]) {
      await expect(page.locator("dt", { hasText: label }).first()).toBeVisible()
    }
  })

  test("the drawer traps focus and returns it on Escape", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)

    const trigger = page
      .getByRole("table")
      .getByRole("row", { name: /Cost assistance/ })
      .getByRole("button", { name: "Open" })
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
    await page.goto(ROUTE)
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
      await page.goto(ROUTE)
      await expect(page.locator("main")).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-inquiries-${name}.png`, {
        fullPage: true,
      })
    })
  }

  test("matches the ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "admin-inquiries-main.aria.yml",
    })
  })
})

test.describe.serial("approved triage (MPS-WFL-004)", () => {
  test.skip(
    !CAN_RESTORE_FIXTURE,
    "Needs the restorable local Supabase stack and sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
  })

  test("an administrator takes an unassigned inquiry", async ({ page }) => {
    await openDrawer(page, /Cost assistance/)
    await page.getByRole("button", { name: "Take this inquiry" }).click()

    /* `role="status"`, not `alert`: the drawer's outcome is announced politely,
       the same way the enrollment drawer announces one. Scoped to the dialog,
       because the page behind it carries its own `role="status"` count. */
    const outcome = page.getByRole("dialog").getByRole("status")
    await expect(outcome).toContainText("Inquiry updated")
    /* The confirmation says what did NOT happen, because "updated" on a
       family's request is exactly where someone would assume a reply went out
       (GAP-PUBLIC-001). */
    await expect(outcome).toContainText("Nothing was sent to the family")
  })

  test("the queue shows the new owner", async ({ page }) => {
    await expect(
      page.getByRole("table").getByRole("row", { name: /Cost assistance/ }),
    ).toContainText("You")
  })

  test("a review moves the inquiry and records nothing financial", async ({
    page,
  }) => {
    await openDrawer(page, /Cost assistance/)
    await page.getByRole("button", { name: "Mark under review" }).click()
    await expect(
      page.getByRole("dialog").getByRole("status"),
    ).toContainText("Inquiry updated")

    await page.goto(ROUTE)
    await openDrawer(page, /Cost assistance/)
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Under review")
    /* Now, and only now, a path may be recorded — and the words say what it is
       and is not. */
    await expect(
      dialog.getByRole("button", { name: "Mark path provided" }),
    ).toBeVisible()
    await expect(dialog).toContainText("not a decision")
  })
})
