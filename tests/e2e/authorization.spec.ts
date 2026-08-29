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
const PROTECTED = ["/family", "/educator", "/admin", "/account"] as const

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

  test("an off-site redirectTo is refused", async ({ page }) => {
    // An open redirect on a sign-in page is a phishing primitive.
    await page.goto("/sign-in?redirectTo=https://example.com/steal")
    const value = await page.locator('input[name="redirectTo"]').inputValue()
    expect(value).toBe("/account")

    await page.goto("/sign-in?redirectTo=//example.com/steal")
    expect(await page.locator('input[name="redirectTo"]').inputValue()).toBe(
      "/account",
    )

    // Backslash-encoded paths must also be rejected.
    await page.goto("/sign-in?redirectTo=/\\evil.example")
    expect(await page.locator('input[name="redirectTo"]').inputValue()).toBe(
      "/account",
    )
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your family",
    )
    // Their own family only — the sample seed has two.
    await expect(page.getByText("Sample Family A")).toBeVisible()
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
    await expect(page.getByText("Art Lab")).toBeVisible()
    // Assigned to two of nine programs; the rest must not appear.
    await expect(page.getByText("Harvest Explorers")).toHaveCount(0)

    for (const route of ["/family", "/admin"]) {
      await expectStatus(page, route, 404)
    }
  })

  test("an administrator sees drafts that no one else does", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByText("Sample Unpublished Draft (test fixture)"),
    ).toBeVisible()
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
