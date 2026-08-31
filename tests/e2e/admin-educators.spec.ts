import { execFileSync } from "node:child_process"

import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Administrator educator operations, assignment, and the program roster
 * (ACT-004/006; MPS-REQ-017/018/020/021/023/024; MPS-WFL-005/006;
 * MPS-ACC-028; MDS-REF-009).
 *
 * The database half is `supabase/tests/database/
 * 80_admin_family_educator_roster.test.sql`, which proves the eligibility
 * rules, the idempotency, the audit attribution, and — the part no browser test
 * can reach — that a removed assignment revokes the roster read on the next
 * statement.
 *
 * WHAT THIS SUITE IS REALLY GUARDING
 *
 * That assigning an educator is presented as what it is: handing someone access
 * to a program's roster, including the names of children with a confirmed
 * place. Several tests assert that the surface says so in words, and that the
 * operations nobody has approved — invite, suspend, promote, delete — are
 * absent rather than disabled.
 *
 * And the roster's own trust contract: exactly one green tick, above exactly
 * one heading, meaning exactly one thing.
 *
 * WRITE TESTS AND THE SHARED FIXTURE
 *
 * The assignment group mutates the seeded assignment set. Unlike enrollment
 * state, assignment IS reversible — that is the whole point of the operation —
 * so the group restores what it changes. The re-seed around the file is belt
 * and braces for a failure that aborts mid-group and leaves an extra
 * assignment behind, which would change the counts `admin-overview` asserts.
 *
 * To run:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local
 *   npm run test:e2e
 */
test.describe.configure({ mode: "serial" })

const LOCAL_STACK = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("127.0.0.1"),
)

/** Rebuild the sanitized fixture. Local stack only. */
function reseed() {
  execFileSync("npm", ["run", "db:reset"], { stdio: "inherit" })
}

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

/** The program the sample educator is NOT seeded onto. */
const UNASSIGNED_PROGRAM = "Haven Days Enrichment"
/** The program they ARE seeded onto, which carries the confirmed roster. */
const ASSIGNED_PROGRAM = "Art Lab"

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

/** Open the sample educator's drawer. Scope every locator (DEFECT-AO3). */
async function openDrawer(page: Page) {
  await page
    .getByRole("button", {
      name: "Manage Sample Educator's program assignments",
      exact: true,
    })
    .click()
  await expect(page.getByRole("dialog")).toBeVisible()
}

test.describe("signed out", () => {
  test("redirects to sign-in and keeps the destination", async ({ page }) => {
    await page.goto("/admin/educators")
    await expect(page).toHaveURL(
      `/sign-in?redirectTo=${encodeURIComponent("/admin/educators")}`,
    )
  })
})

test.describe("denial matrix", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )

  test("a parent is refused", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    await expectStatus(page, "/admin/educators", 404)
  })

  /* MPS-REQ-017: an educator never administers educators, including
     themselves. The database refuses the write; this refuses the surface. */
  test("an educator is refused their own administration page", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await expectStatus(page, "/admin/educators", 404)
  })
})

test.describe("what the directory shows", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/educators")
  })

  test("lists the sample educator with their assignments", async ({ page }) => {
    const table = page.getByRole("table")
    await expect(table).toContainText("Sample Educator")
    await expect(table).toContainText(ASSIGNED_PROGRAM)
  })

  test("states what an assignment does and does not grant", async ({
    page,
  }) => {
    const main = page.locator("main")
    await expect(main).toContainText(
      "An assignment is program access, nothing more",
    )
    await expect(main).toContainText("no administrator authority")
    await expect(main).toContainText(
      "Samantha Dodson controls administrator access",
    )
  })

  /* The operations nobody has approved are absent, not disabled. A greyed-out
     control would suggest the capability exists and is merely withheld. */
  test("offers no invite, suspend, promote, or delete", async ({ page }) => {
    const main = page.locator("main")
    for (const name of [
      /invite/i,
      /suspend/i,
      /deactivate/i,
      /promote/i,
      /make admin/i,
      /delete/i,
    ]) {
      await expect(main.getByRole("button", { name })).toHaveCount(0)
    }
  })

  test("shows no educator email or credential", async ({ page }) => {
    await expect(page.locator("main")).not.toContainText("@example.com")
  })
})

test.describe("the educator drawer", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/educators")
  })

  test("lists current assignments with their publication state", async ({
    page,
  }) => {
    await openDrawer(page)
    const dialog = page.getByRole("dialog")

    await expect(dialog).toContainText("Assigned programs")
    await expect(dialog).toContainText(ASSIGNED_PROGRAM)
  })

  /* The sentence that makes the consequence legible before the button is
     pressed. Assigning hands someone children's names. */
  test("says an assignment exposes confirmed children's names", async ({
    page,
  }) => {
    await openDrawer(page)
    await expect(page.getByRole("dialog")).toContainText(
      "preferred names of children with a confirmed enrollment",
    )
  })

  test("does not offer a program the educator already holds", async ({
    page,
  }) => {
    await openDrawer(page)
    await page
      .getByRole("dialog")
      .getByLabel("Program", { exact: true })
      .click()

    const options = page.getByRole("option")
    await expect(options.filter({ hasText: ASSIGNED_PROGRAM })).toHaveCount(0)
    await expect(options.filter({ hasText: UNASSIGNED_PROGRAM })).toHaveCount(1)
  })

  test("closes on Escape and returns focus to the row control", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", {
      name: "Manage Sample Educator's program assignments",
      exact: true,
    })
    await trigger.click()
    await expect(page.getByRole("dialog")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

test.describe("the program roster", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/programs")
    await page
      .getByRole("link", { name: `Review ${ASSIGNED_PROGRAM}`, exact: true })
      .click()
  })

  /* MPS-ACC-028. Art Lab carries one confirmed enrollment and one
     payment_pending one, so this asserts both halves at once: the confirmed
     child is on the roster exactly once, and the other child is not. */
  test("lists the confirmed student exactly once", async ({ page }) => {
    const roster = page.getByRole("region", { name: "Roster" })
    await expect(roster).toContainText("Confirmed (1)")
    /* `rowheader`, not `cell`: each roster row's student name is a
       `<th scope="row">`, which is what makes the family and date cells beside
       it announce whose they are. */
    await expect(
      roster.getByRole("rowheader", { name: "Sample Student A2" }),
    ).toHaveCount(1)
  })

  test("keeps the payment-pending student off the roster", async ({ page }) => {
    const roster = page.getByRole("region", { name: "Roster" })

    await expect(roster).toContainText("Not on the roster (1)")
    await expect(roster).toContainText("Sample Student A1")
    /* The words that stop a reader inferring a place from the absence of a
       green tick (DO-DONT "Trust states"). */
    await expect(roster).toContainText("These students are not enrolled")
  })

  test("offers no add, remove, transfer, or export", async ({ page }) => {
    const roster = page.getByRole("region", { name: "Roster" })
    for (const name of [
      /add student/i,
      /remove student/i,
      /transfer/i,
      /export/i,
      /download/i,
      /print/i,
    ]) {
      await expect(roster.getByRole("button", { name })).toHaveCount(0)
    }
  })

  test("shows no unapproved child field", async ({ page }) => {
    const roster = page.getByRole("region", { name: "Roster" })
    for (const forbidden of ["Date of birth", "Allergies", "Medical"]) {
      await expect(roster).not.toContainText(forbidden)
    }
  })

  test("has no axe violations", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })
})

test.describe("responsive and accessibility", () => {
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
      await page.goto("/admin/educators")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("the table becomes labeled record cards on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/admin/educators")
    await expect(page.getByRole("table")).toBeHidden()

    for (const label of ["Account", "Assigned programs"]) {
      await expect(page.locator("main")).toContainText(label)
    }
  })

  test("is reachable from the administrator navigation", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin")
    await page.getByRole("link", { name: "Educators", exact: true }).click()
    await expect(page).toHaveURL("/admin/educators")
  })
})

test.describe("visual baselines", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/admin/educators")
      await expect(page.locator("main")).toBeVisible()
      await expect(page.getByRole("status")).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-educators-${name}.png`, {
        fullPage: true,
      })
    })
  }

  test("matches the ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin/educators")
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "admin-educators-main.aria.yml",
    })
  })
})

test.describe.serial("approved assignment changes", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/educators")
  })

  async function assign(page: Page, program: string, note: string) {
    await openDrawer(page)
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Program", { exact: true }).click()
    await page.getByRole("option", { name: program, exact: true }).click()
    await dialog.getByLabel("Reason (recorded)").fill(note)
    await dialog.getByRole("button", { name: "Assign to program" }).click()
  }

  test("refuses an assignment with no stated reason", async ({ page }) => {
    await assign(page, UNASSIGNED_PROGRAM, "")
    await expect(page.getByRole("dialog")).toContainText(
      "Say why this assignment is changing",
    )
  })

  test("assigns an educator and announces the result", async ({ page }) => {
    await assign(
      page,
      UNASSIGNED_PROGRAM,
      "Assigning for the review walkthrough.",
    )

    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Educator assigned")
    await expect(dialog).toContainText(UNASSIGNED_PROGRAM)
  })

  /* MPS-REQ-024: the change is attributable, and the overview is the surface
     that shows it. */
  test("records the assignment in recent activity", async ({ page }) => {
    await page.goto("/admin")
    /* The overview renders `describeActivity`'s plain-language phrasing, not
       the enum labels, so this asserts the words an administrator actually
       reads. */
    await expect(page.locator("main")).toContainText(
      "Educator assignment added",
    )
  })

  /* Idempotency, at the surface. A repeat is a reassurance, not a failure. */
  test("reports a duplicate assignment as already assigned", async ({
    page,
  }) => {
    await openDrawer(page)
    const dialog = page.getByRole("dialog")

    /* The program is no longer offered, because it is already held — which is
       itself the duplicate guard. The database's `unchanged` path is asserted
       in pgTAP, where a duplicate can actually be submitted. */
    await dialog.getByLabel("Program", { exact: true }).click()
    await expect(
      page.getByRole("option", { name: UNASSIGNED_PROGRAM, exact: true }),
    ).toHaveCount(0)
  })

  test("removes the assignment and restores the fixture", async ({ page }) => {
    await openDrawer(page)
    const dialog = page.getByRole("dialog")

    await dialog
      .getByRole("button", {
        name: `Remove Sample Educator from ${UNASSIGNED_PROGRAM}`,
        exact: true,
      })
      .click()

    const confirm = page.getByRole("dialog").last()
    /* The consequence, in words, before the button is pressed. */
    await expect(confirm).toContainText("on their next request")
    await expect(confirm).toContainText("do not need to sign out")

    await confirm.getByLabel("Reason (recorded)").fill("Walkthrough finished.")
    await confirm.getByRole("button", { name: "Remove access" }).click()

    await expect(page.getByRole("dialog").first()).toContainText(
      "Assignment removed",
    )
  })
})
