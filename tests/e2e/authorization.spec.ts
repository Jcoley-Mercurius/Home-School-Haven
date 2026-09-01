import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Route authorization (MPS-REQ-004, MPS-REQ-018; AGENTS.md §12 "A visible role
 * in the browser is not authorization").
 *
 * This is the browser half of the boundary. The database half is the pgTAP
 * suite in `supabase/tests/database/`, which proves the same denials hold even
 * if a page forgets its guard. Both are required: neither alone is the control.
 *
 * The signed-out cases run everywhere. The cross-role cases need seeded
 * accounts and are skipped, loudly, when no Supabase project is configured —
 * a skipped test must never read as a passed one.
 *
 * To run the full matrix:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local   # fill in the local stack's URL and key
 *   npm run test:e2e
 */
const PROTECTED = [
  "/family",
  "/family/household",
  "/family/schedule",
  "/family/announcements",
  "/family/resources",
  "/family/setup",
  "/family/students/new",
  "/educator",
  "/educator/programs",
  "/educator/schedule",
  "/educator/rosters",
  "/educator/announcements",
  "/educator/resources",
  "/admin",
  "/admin/communications",
  "/admin/communications/announcements/new",
  "/admin/communications/resources/new",
  "/account",
] as const

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)

const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ACCOUNTS = {
  parent: "sample.parent.one@example.com",
  educator: "sample.educator@example.com",
  admin: "sample.admin@example.com",
} as const

/**
 * Asserts a route's HTTP status without navigating the page to it.
 *
 * `page.goto()` on an expected 404 makes the browser log a failed-resource
 * console error, which the shared console guard in `fixtures.ts` correctly
 * treats as a failure. Denial is about the response, not about rendering the
 * error page, so these checks use the request context instead — it shares the
 * browser's cookies, so the session under test is still the one being denied.
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

test.describe("signed out", () => {
  for (const route of PROTECTED) {
    test(`${route} redirects to sign-in`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/sign-in/)
      // The intended destination survives the round trip so the visitor is not
      // dumped on a generic landing page after signing in.
      expect(new URL(page.url()).searchParams.get("redirectTo")).toBe(route)
    })
  }

  test("an off-site redirectTo is refused on every auth surface", async ({
    page,
  }) => {
    // An open redirect on an authentication page is a phishing primitive, and
    // the recovery flow added two more places that carry a destination. The
    // rule itself is unit-tested in `tests/auth-return-to.test.mts`; this
    // pins that each surface actually applies it.
    const hostile = [
      "https://example.com/steal",
      "//example.com/steal",
      "/\\example.com/steal",
    ]

    for (const surface of ["/sign-in", "/forgot-password"]) {
      for (const target of hostile) {
        await page.goto(`${surface}?redirectTo=${encodeURIComponent(target)}`)
        expect(
          await page.locator('input[name="redirectTo"]').inputValue(),
          `${surface} must refuse ${target}`,
        ).toBe("/account")
      }
    }
  })
})

test.describe("cross-role denial", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable. " +
      "See the header of this file to run the full matrix.",
  )

  test("a parent reaches the family area and nothing else", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await expect(page).toHaveURL(/\/family$/)
    /* `/family` is the dashboard now, so the heading is the destination name
       and the family's own name sits in the line beneath it. Both are still
       checked, and the ownership check is the one that matters: parent A is
       shown family A and never family B. */
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Family Overview",
    )
    await expect(
      page.getByText("Sample Family A", { exact: false }).first(),
    ).toBeVisible()
    await expect(page.getByText("Sample Family B")).toHaveCount(0)

    // A 404 rather than a 403: a wrong-role visitor is not told that an
    // educator or administrator area exists at that path.
    for (const route of ["/educator", "/admin"]) {
      await expectStatus(page, route, 404)
    }
  })

  test("an educator sees assigned programs and no admin area", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await expect(page).toHaveURL(/\/educator$/)
    await expect(page.getByText("Art Lab").first()).toBeVisible()
    // Assigned to two of nine programs; the rest must not appear.
    await expect(page.getByText("Harvest Explorers")).toHaveCount(0)

    // Every family route, not only its root: an educator must not reach the
    // setup or student surfaces either.
    for (const route of [
      "/family",
      "/family/household",
      "/family/schedule",
      "/family/announcements",
      "/family/resources",
      "/family/setup",
      "/family/students/new",
      "/admin",
      "/admin/programs",
      "/admin/enrollments",
      "/admin/families",
      "/admin/educators",
    ]) {
      await expectStatus(page, route, 404)
    }
  })

  test("a parent reaches no educator destination", async ({ page }) => {
    /* The educator area gained six destinations; a parent must be refused
       every one of them, not only the root. A 404 rather than a 403, so the
       response never confirms that an educator area exists at that path. */
    await signIn(page, ACCOUNTS.parent)

    for (const route of [
      "/educator",
      "/educator/programs",
      "/educator/schedule",
      "/educator/rosters",
      "/educator/announcements",
      "/educator/resources",
      "/educator/programs/10000000-0000-4000-8000-000000000004",
    ]) {
      await expectStatus(page, route, 404)
    }
  })

  test("an administrator sees drafts that no one else does", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    await expect(page).toHaveURL(/\/admin$/)
    /* Scoped to the table since the operations overview renders each program
       row twice — desktop table and mobile record card — with CSS choosing
       which is displayed. The assertion is unchanged: an administrator, and
       only an administrator, sees the unpublished draft. */
    await expect(
      page
        .getByRole("table")
        .getByText("Sample Unpublished Draft (test fixture)"),
    ).toBeVisible()
  })

  test("an administrator area is refused after the role grant is gone", async ({
    page,
    context,
  }) => {
    /* The role is read from `public.user_roles` on every request and is never
       cached in a cookie or a token claim, so removing the grant must deny the
       very next request rather than the next sign-in.

       Revoking a grant needs database access this suite does not have, so the
       equivalent is asserted from the other direction: a session that is no
       longer accepted is refused immediately, without a stale authorization
       decision surviving in the browser. The grant-deletion case itself is
       covered in `supabase/tests/database/60_rls_admin_overview.test.sql`,
       where an account with no row in `user_roles` reads nothing. */
    await signIn(page, ACCOUNTS.admin)
    await expectStatus(page, "/admin", 200)

    await context.clearCookies()
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test("a draft program is not publicly reachable by URL", async ({ page }) => {
    // Not linked anywhere, but guessing the slug must not work either.
    await expectStatus(page, "/programs/sample-unpublished-draft", 404)
  })

  test("signing out re-protects every route", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    await page.getByRole("button", { name: "Sign Out" }).click()
    await page.waitForURL("**/")

    for (const route of PROTECTED) {
      await page.goto(route)
      await expect(page).toHaveURL(/\/sign-in/)
    }
  })
})
