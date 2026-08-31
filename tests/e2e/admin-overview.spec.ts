import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Administrator operations overview (ACT-004/006; MPS-REQ-004/016/017/020/021/
 * 023/024, MPS-RUL-004/005; MPS-ACC-004/005/022/026/031; MDS-REF-009).
 *
 * The database half of these boundaries is `supabase/tests/database/
 * 60_rls_admin_overview.test.sql`, which proves the same denials hold even if
 * this page forgets its guard. Both are required: neither alone is the control.
 *
 * The signed-out cases run everywhere. The credentialed cases need the seeded
 * accounts and are skipped, loudly, when no Supabase project is configured —
 * a skipped test must never read as a passed one.
 *
 * Every fixture reachable from this page is sanitized: sample families on the
 * reserved `example.com` domain, `Sample …` names, and program rows that are
 * real published website content. Nothing captured here is a real child,
 * family, or payment.
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
 * Denial is about the response, not about rendering an error page, so these
 * checks use the request context — which shares the browser's cookies, so the
 * session under test is still the one being denied.
 */
async function expectStatus(page: Page, route: string, status: number) {
  const response = await page.request.get(route, { maxRedirects: 0 })
  expect(response.status(), `${route} should answer ${status}`).toBe(status)
}

test.describe("signed out", () => {
  test("/admin redirects to sign-in and keeps the destination", async ({
    page,
  }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/sign-in/)
    expect(new URL(page.url()).searchParams.get("redirectTo")).toBe("/admin")
  })
})

/**
 * Wait until the streamed sections have actually rendered.
 *
 * The overview suspends its reads, so a screenshot or an ARIA snapshot taken
 * straight after `reload()` can catch the skeleton: captures came back 1280x1230
 * -- a short page with none of the content and none of the operations table's
 * horizontal overflow -- and were compared against a settled baseline. Nothing
 * was wrong with the page; the picture was taken too early.
 *
 * "Recent activity" is the last region on the page, so its presence means the
 * sections above it have resolved.
 * @param page - The page under test.
 * @returns Resolves once the overview has settled.
 */
async function settled(page: Page) {
  await expect(
    page.getByRole("region", { name: "Recent activity" }),
  ).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test.describe("administrator overview", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable. " +
      "See the header of this file to run the full matrix.",
  )

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.admin)
    await page.waitForURL(/\/admin$/)
  })

  test("renders the operations overview inside the administrator shell", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Operations Overview",
    )

    // The private-beta band is on the page, not only in a comment (MPS-ACC-004).
    await expect(page.getByText("Private beta · Sample data")).toBeVisible()

    // Two navigation landmarks with distinct names, per the shell contract.
    await expect(
      page.getByRole("navigation", { name: "Administration" }),
    ).toBeVisible()
  })

  test("shows the owner-authority framing", async ({ page }) => {
    // MPS-RUL-005 and ACT-006. Samantha is named as final owner and the
    // administrator's authority is described as delegated.
    const band = page.getByRole("complementary", {
      name: "Authority and environment",
    })
    await expect(band).toContainText("Samantha Dodson remains the final")
    await expect(band).toContainText("delegated operational authority")
    await expect(band).toContainText("not payment confirmation")
  })

  test("counts every program state, including the draft only an admin sees", async ({
    page,
  }) => {
    // The reach that distinguishes an administrator from a parent (MPS-ACC-026).
    const programs = page.getByRole("region", { name: "Programs" }).first()
    await expect(programs).toContainText("All programs")
    /* Scoped to the table: the same rows are rendered twice, once as the
       desktop table and once as the mobile record cards, and CSS decides which
       is displayed. Only one is in the accessibility tree at a time, but both
       are in the DOM, so an unscoped text locator matches twice. */
    await expect(
      page
        .getByRole("table")
        .getByText("Sample Unpublished Draft (test fixture)"),
    ).toBeVisible()
  })

  test("never presents payment activity as confirmed payment", async ({
    page,
  }) => {
    // The trust contract of the release (MPS-REQ-013, DO-DONT "Trust states").
    const attention = page.getByRole("region", { name: "Needs attention" })
    await expect(attention).toContainText("Payment verification pending")
    await expect(attention).toContainText("It is not confirmed payment")
  })

  test("uses the same enrollment vocabulary the family sees", async ({
    page,
  }) => {
    // MPS-ACC-022: one authoritative state, described the same way to both.
    const enrollments = page
      .getByRole("region", { name: "Enrollments" })
      .first()
    await expect(enrollments).toContainText("Payment verification pending")
    await expect(enrollments).toContainText("Enrolled")
    await expect(enrollments).toContainText("Waitlisted")
  })

  test("shows attributable history without naming a child or a family", async ({
    page,
  }) => {
    const activity = page.getByRole("region", { name: "Recent activity" })
    await expect(activity).toBeVisible()

    // audit_events deliberately stores no family, student, or price. If a name
    // ever reaches this card, that is a privacy regression, not a feature.
    await expect(activity).not.toContainText("Sample Student")
    await expect(activity).not.toContainText("Sample Family")
    await expect(activity).not.toContainText("@example.com")
  })

  test("exposes no child or family identity anywhere on the page", async ({
    page,
  }) => {
    // The overview reads aggregates only; the repository never selects a name.
    const body = await page.locator("body").innerText()
    expect(body).not.toContain("Sample Student")
    expect(body).not.toContain("Sample Family A")
    expect(body).not.toContain("Sample Family B")
    expect(body).not.toContain("sample.parent.one@example.com")
  })

  test("offers no control that would change a record", async ({ page }) => {
    // This slice is read-only by boundary. The only interactive controls are
    // navigation and sign-out; a Review, Approve, Confirm, or Publish button
    // here would be an unapproved mutation surface.
    for (const forbidden of [
      "Approve",
      "Confirm payment",
      "Publish",
      "New Program Draft",
      "Review Enrollments",
      "Manage Educators",
      "Import Website Content",
    ]) {
      await expect(
        page.getByRole("button", { name: forbidden }),
        `no "${forbidden}" control exists in this slice`,
      ).toHaveCount(0)
    }
  })

  test("has no axe violations", async ({ page }) => {
    await page.waitForLoadState("networkidle")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("is keyboard operable from the skip link into the content", async ({
    page,
  }) => {
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: /skip/i })
    await expect(skip).toBeFocused()

    // Tabbing onward must reach the navigation without a trap.
    await page.keyboard.press("Tab")
    await expect(page.locator(":focus-visible, :focus").first()).toBeVisible()
  })

  test("keeps the program table as a real table with header associations", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    const table = page.getByRole("table")
    await expect(table).toBeVisible()
    for (const column of [
      "Program",
      "Publication",
      "Educator",
      "Registration path",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: column }),
      ).toBeVisible()
    }
  })

  test("becomes labeled record cards on mobile, losing no column meaning", async ({
    page,
  }) => {
    // MDS responsive.rules.grid. A horizontally squeezed table would be the
    // unreadable compression components.table forbids.
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.reload()
    await expect(page.getByRole("table")).toBeHidden()

    /* Each field keeps its own visible label in the card, so no column meaning
       is lost. `<dt>` is what carries it — scoping to that distinguishes the
       card labels from the table's column headers, which are still in the DOM
       behind `display: none`. */
    const cardLabels = page.locator("dt")
    for (const label of ["Publication", "Educator", "Registration path"]) {
      await expect(cardLabels.filter({ hasText: label }).first()).toBeVisible()
    }
  })

  test("uses the mobile header and bottom navigation below 640px", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.reload()
    await expect(
      page.getByRole("navigation", { name: "Administration sections" }),
    ).toBeVisible()
  })

  test("caps operations content at the approved 1440px", async ({ page }) => {
    // MDS layout.max_content_width.operations_wide.
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload()
    const box = await page.locator("main").boundingBox()
    // The container adds one desktop gutter either side of the 1440px content.
    expect(box?.width ?? 0).toBeLessThanOrEqual(1440 + 64)
  })

  test("matches the structural ARIA snapshot", async ({ page }) => {
    await settled(page)
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "admin-overview-main.aria.yml",
    })
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`matches the ${name} visual baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.reload()
      await settled(page)
      await expect(page).toHaveScreenshot(`admin-overview-${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: "disabled",
      })
    })
  }
})

test.describe("administrator denial", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable.",
  )

  test("a parent is refused by direct URL and told nothing exists there", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    // A 404 rather than a 403: a wrong-role visitor is not told the
    // administrator area exists at that path.
    await expectStatus(page, "/admin", 404)
  })

  test("an educator is refused by direct URL", async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
    await expectStatus(page, "/admin", 404)
  })

  test("denial survives a refresh and a fresh request", async ({ page }) => {
    // Authorization is evaluated per request, not decided once at build time —
    // the reason `(portal)/layout.tsx` sets `dynamic = "force-dynamic"`.
    await signIn(page, ACCOUNTS.parent)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expectStatus(page, "/admin", 404)
    }
  })

  test("signing out re-protects the overview", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.getByRole("button", { name: "Sign Out" }).click()
    await page.waitForURL("**/")

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test("an expired session is redirected, not silently emptied", async ({
    page,
    context,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.waitForURL(/\/admin$/)

    // Clearing the auth cookies is what an expired, revoked, or signed-out-
    // elsewhere session looks like to the next request.
    await context.clearCookies()

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/sign-in/)
    expect(new URL(page.url()).searchParams.get("redirectTo")).toBe("/admin")
  })
})
