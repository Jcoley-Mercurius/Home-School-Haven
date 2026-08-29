import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Parent-controlled family setup (MPS-WFL-002; MPS-REQ-011, MPS-REQ-001,
 * MPS-REQ-004; MPS-ACC-015/016/017/005/032).
 *
 * The signed-out cases run everywhere. The credentialed cases need the seeded
 * accounts and are skipped, loudly, when no Supabase project is configured —
 * a skipped test must never read as a passed one.
 *
 * The database half of these boundaries is `supabase/tests/database/
 * 25_family_setup.test.sql`, which proves the same denials hold even if a page
 * forgets its guard. Both are required.
 *
 * To run the full matrix:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local   # fill in the local stack's URL and key
 *   npm run test:e2e
 *
 * RE-SEED BETWEEN RUNS. One test here completes family setup for
 * `sample.parent.four@example.com`, and setup is deliberately one-way: there is
 * no "delete my family" path, because family deletion is retention policy and
 * MPS GAP-005 has not settled it. So the account starts the next run already
 * having a family, and that test fails until the fixture is restored. Seeding
 * puts it back:
 *
 *   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
 *
 * against a local stack, `npm run db:reset` does the same thing.
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

const PROTECTED = ["/family/setup", "/family/students/new"] as const

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)

const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ACCOUNTS = {
  /** Has a family and two demo students. */
  parentWithFamily: "sample.parent.one@example.com",
  /**
   * Holds the parent role and NO family: the family_incomplete state.
   * Used only by tests that must leave it that way.
   */
  parentNoFamily: "sample.parent.three@example.com",
  /**
   * A second family-less parent, for the one test that actually completes
   * setup. Completing setup consumes the fixture, so sharing one account made
   * every other family-less test depend on running first.
   */
  parentCompletingSetup: "sample.parent.four@example.com",
  educator: "sample.educator@example.com",
} as const

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

test.describe("signed out", () => {
  for (const route of PROTECTED) {
    test(`${route} redirects to sign-in`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/sign-in/)
      expect(new URL(page.url()).searchParams.get("redirectTo")).toBe(route)
    })
  }
})

test.describe("family setup", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable. " +
      "See the header of this file to run the full matrix.",
  )

  test("a parent with no family is offered setup and completes it", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentCompletingSetup)
    await page.goto("/family")

    // MPS-WFL-002 `family_incomplete`: a truthful empty state, not a blank page.
    await expect(
      page.getByRole("heading", { name: "Let’s set up your family" }),
    ).toBeVisible()

    await page.getByRole("link", { name: "Set Up My Family" }).click()
    await expect(page).toHaveURL(/\/family\/setup$/)

    await page.getByLabel("Family name").fill("Sample Family Four")
    await page.getByRole("button", { name: "Create My Family" }).click()

    await page.waitForURL("**/family")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Sample Family Four",
    )
  })

  test("returning to setup after completing it does not offer a second family", async ({
    page,
  }) => {
    // MPS-ACC-017: setup is resumable, and resuming a finished setup is not a
    // way to make a second family. A bookmarked URL lands on /family instead.
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family/setup")
    await expect(page).toHaveURL(/\/family$/)
  })

  test("an empty family name is refused and announced", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentNoFamily)
    await page.goto("/family/setup")

    // Submitted empty: validation is the server's answer, not a native bubble.
    await page.getByRole("button", { name: "Create My Family" }).click()

    await expect(page).toHaveURL(/\/family\/setup$/)
    await expect(page.getByText("Enter a name for your family.")).toBeVisible()
    // Announced, not only coloured (DO-DONT "states never rely on color alone").
    await expect(
      page.getByText("Your family was not created", { exact: false }).first(),
    ).toBeVisible()
  })

  test("an educator cannot reach family setup", async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
    for (const route of PROTECTED) {
      // A 404, not a 403: a wrong-role visitor is not told the route exists.
      const response = await page.request.get(route, { maxRedirects: 0 })
      expect(response.status(), `${route} should answer 404`).toBe(404)
    }
  })

  test("setup is keyboard operable with visible focus", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentNoFamily)
    await page.goto("/family/setup")

    const name = page.getByLabel("Family name")
    await name.focus()
    await expect(name).toBeFocused()
    await expect(name).toHaveCSS("outline-style", /solid|auto/)

    await page.keyboard.press("Tab")
    await expect(
      page.getByRole("button", { name: "Create My Family" }),
    ).toBeFocused()
  })

  test("has no axe violations", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentNoFamily)
    await page.goto("/family/setup")
    await page.waitForLoadState("networkidle")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await signIn(page, ACCOUNTS.parentNoFamily)
      await page.goto("/family/setup")
      await page.waitForLoadState("networkidle")
      await expect(page).toHaveScreenshot(`family-setup-${name}.png`, {
        fullPage: true,
      })
    })
  }
})

test.describe("demo student profiles", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable.",
  )

  test("a parent sees only their own family's students", async ({ page }) => {
    // MPS-REQ-004 / MPS-ACC-005. The seed gives family A two students and
    // family B one; RLS is what keeps B's out of this page.
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    /* Count rows, not text matches. Each row prints the name twice -- as the
       row label and inside its "Remove <name>" button -- so a text locator
       reports two hits for one child and a strict-mode violation for
       toBeVisible. The row is what "a student appears once" actually means. */
    const rows = page.getByRole("listitem")
    await expect(rows.filter({ hasText: "Sample Student A1" })).toHaveCount(1)
    await expect(rows.filter({ hasText: "Sample Student A2" })).toHaveCount(1)
    await expect(rows.filter({ hasText: "Sample Student B1" })).toHaveCount(0)
  })

  test("the demo boundary is stated on the page", async ({ page }) => {
    // Deviation D-FF1: a demo surface says so where a parent can read it, not
    // only in a commit message.
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")
    await expect(
      page.getByText("sample records for this review", { exact: false }),
    ).toBeVisible()
  })

  test("a profile is refused without the guardian affirmation", async ({
    page,
  }) => {
    // MPS-RUL-008: authority is affirmed before a profile is created.
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family/students/new")

    await page.getByLabel("Preferred name").fill("Sample Student A3")
    await page.getByRole("button", { name: "Add Student" }).click()

    await expect(page).toHaveURL(/\/family\/students\/new$/)
    await expect(
      page.getByText(/Confirm that you are this student/),
    ).toBeVisible()
  })

  test("submitting the same student twice creates one profile", async ({
    page,
  }) => {
    // The idempotency guarantee, exercised the way a parent would trip it:
    // submit, go back, submit the identical form again.
    await signIn(page, ACCOUNTS.parentWithFamily)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.goto("/family/students/new")
      await page.getByLabel("Preferred name").fill("Sample Student A4")
      /* Base UI renders a visible span[role=checkbox] alongside an
         aria-hidden input that carries the value to the form, and both are
         associated with the label. getByLabel therefore matches two elements;
         the role is what a user (and a screen reader) actually operates. */
      await page
        .getByRole("checkbox", { name: /parent or legal guardian/ })
        .check()
      await page.getByRole("button", { name: "Add Student" }).click()
      await page.waitForURL("**/family")
    }

    /* One row, after two identical submissions. This is the assertion the
       whole idempotency design exists to satisfy (MPS-ACC-016 applied to
       profiles): the second submit returned the existing id and inserted
       nothing. Counting rows rather than text matches -- see above. */
    await expect(
      page.getByRole("listitem").filter({ hasText: "Sample Student A4" }),
    ).toHaveCount(1)

    // Leave the seeded fixture as it was found, so this suite can run twice.
    await page.getByRole("button", { name: "Remove Sample Student A4" }).click()
    await page.waitForURL("**/family")
    await expect(
      page.getByRole("listitem").filter({ hasText: "Sample Student A4" }),
    ).toHaveCount(0)
  })

  test("the student form has no axe violations", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family/students/new")
    await page.waitForLoadState("networkidle")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`the family area matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await signIn(page, ACCOUNTS.parentWithFamily)
      await page.goto("/family")
      await page.waitForLoadState("networkidle")
      await expect(page).toHaveScreenshot(`family-ready-${name}.png`, {
        fullPage: true,
      })
    })
  }
})
