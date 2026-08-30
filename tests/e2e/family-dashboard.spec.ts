import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Family dashboard (MPS-REQ-015, MPS-WFL-007; MPS-ACC-005/022/024/025/030/031;
 * MDS-REF-007).
 *
 * The database half of these boundaries is `supabase/tests/database/
 * 50_rls_family_dashboard.test.sql`, which proves the same denials hold even if
 * a page forgets its guard. Both are required: neither alone is the control.
 *
 * The signed-out cases run everywhere. The credentialed cases need the seeded
 * accounts and are skipped, loudly, when no Supabase project is configured —
 * a skipped test must never read as a passed one.
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

const PROTECTED = [
  "/family",
  "/family/schedule",
  "/family/announcements",
  "/family/resources",
  "/family/household",
] as const

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)

const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ACCOUNTS = {
  /** Family A: two students, three enrollments, one of them payment-pending. */
  parentWithFamily: "sample.parent.one@example.com",
  /** Family B: one student, one waitlisted enrollment. */
  parentOtherFamily: "sample.parent.two@example.com",
  /** Holds the parent role and no family. */
  parentNoFamily: "sample.parent.three@example.com",
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
    test(`${route} redirects to sign-in and preserves the destination`, async ({
      page,
    }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/sign-in/)
      expect(new URL(page.url()).searchParams.get("redirectTo")).toBe(route)
    })
  }
})

test.describe("family dashboard", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable. " +
      "See the header of this file to run the full matrix.",
  )

  test("a parent reaches their own overview", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Family Overview",
    )
    await expect(
      page.getByText("Sample Family A", { exact: false }).first(),
    ).toBeVisible()
    // The private-beta band from MDS-REF-007, stated on the page.
    await expect(page.getByText("Private beta · Sample data")).toBeVisible()
  })

  test("a parent with no family is sent to setup, not to an empty dashboard", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentNoFamily)
    await page.goto("/family")
    await expect(page).toHaveURL(/\/family\/setup$/)
  })

  test("an educator cannot reach any family route", async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
    for (const route of PROTECTED) {
      // A 404, not a 403: a wrong-role visitor is not told the route exists.
      const response = await page.request.get(route, { maxRedirects: 0 })
      expect(response.status(), `${route} should answer 404`).toBe(404)
    }
  })

  /* MPS-ACC-005 and the whole point of the release. Family A's dashboard must
     contain nothing of family B's — not a child, not a program, not a state. */
  test("one family's dashboard contains nothing of another family's", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family/schedule")

    await expect(page.getByText("Sample Student A1").first()).toBeVisible()
    await expect(page.getByText("Sample Student B1")).toHaveCount(0)
    // Sewing is family B's program, and its announcement and resource with it.
    await expect(page.getByText("Sewing")).toHaveCount(0)

    await page.goto("/family/announcements")
    await expect(
      page.getByText("Sample announcement for another family"),
    ).toHaveCount(0)

    await page.goto("/family/resources")
    await expect(
      page.getByText("Sample resource for another family"),
    ).toHaveCount(0)
  })

  test("unpublished content never reaches a family", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)

    await page.goto("/family/announcements")
    await expect(page.getByText("Sample unpublished announcement")).toHaveCount(
      0,
    )

    await page.goto("/family/resources")
    await expect(page.getByText("Sample unpublished resource")).toHaveCount(0)
  })
})

test.describe("enrollment trust states", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable.",
  )

  /* The single most important assertion in this file. MDS-REF-007 is named for
     this state, and the failure it guards against is a family reading "payment
     received" as "my child has a place". */
  test("payment pending says enrollment is not confirmed", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    await expect(
      page.getByText("Payment verification pending").first(),
    ).toBeVisible()
    await expect(
      page
        .getByText("Enrollment is not yet confirmed", { exact: false })
        .first(),
    ).toBeVisible()
  })

  test("the next step is the pending payment, not a cheerful nudge", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    const nextStep = page.getByRole("region", { name: "Your next step" })
    await expect(nextStep).toContainText("Payment verification pending")
  })

  test("only a confirmed enrollment is called enrolled", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family/schedule")

    /* The seed confirms exactly one of family A's three enrollments. If a
       second badge ever says "Enrolled", something started inferring
       confirmation from payment activity. */
    await expect(
      page.locator('[data-slot="enrollment-state"][data-state="confirmed"]'),
    ).toHaveCount(1)
    await expect(page.getByText("Enrolled", { exact: true })).toHaveCount(1)
  })

  test("a waitlist place is never called enrollment", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentOtherFamily)
    await page.goto("/family/schedule")

    await expect(page.getByText("Waitlisted").first()).toBeVisible()
    await expect(
      page
        .getByText("A waitlist place is not enrollment", { exact: false })
        .first(),
    ).toBeVisible()
  })

  test("every state carries an icon and a label, never colour alone", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family/schedule")

    const badges = page.locator('[data-slot="enrollment-state"]')
    const count = await badges.count()
    expect(count).toBeGreaterThan(0)

    for (let index = 0; index < count; index += 1) {
      const badge = badges.nth(index)
      await expect(badge.locator("svg")).toHaveCount(1)
      await expect(badge).not.toHaveText("")
    }
  })
})

test.describe("student selection", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable.",
  )

  test("a parent can change which of their own children is in view", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    // Family A's second child holds the approval-pending enrollment.
    await page.getByRole("combobox", { name: "Viewing student" }).click()
    await page.getByRole("option", { name: "Sample Student A2" }).click()

    await page.waitForURL(/student=/)
    await expect(
      page.getByRole("region", { name: "My Enrollments" }),
    ).toContainText("Sample Student A2")
    await expect(
      page.getByRole("region", { name: "My Enrollments" }),
    ).not.toContainText("Sample Student A1")
  })

  /* The selector is not an authorization input. An id belonging to another
     family must behave exactly like an id that never existed: no error, no
     disclosure, no other family's data. */
  for (const [name, value] of [
    ["another family's student", "40000000-0000-4000-8000-000000000003"],
    ["a non-existent id", "00000000-0000-4000-8000-000000000000"],
    ["a value that is not a uuid", "not-a-uuid"],
  ] as const) {
    test(`${name} falls back without disclosing anything`, async ({ page }) => {
      await signIn(page, ACCOUNTS.parentWithFamily)
      const response = await page.goto(`/family?student=${value}`)

      expect(response?.status()).toBe(200)
      await expect(page.getByText("Sample Student B1")).toHaveCount(0)
      await expect(
        page.getByRole("region", { name: "My Enrollments" }),
      ).toContainText("Sample Student A1")
    })
  }

  test("the selector is keyboard operable with visible focus", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    const trigger = page.getByRole("combobox", { name: "Viewing student" })
    await trigger.focus()
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveCSS("outline-style", /solid|auto/)

    await page.keyboard.press("Enter")
    await expect(
      page.getByRole("option", { name: "Sample Student A2" }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
  })
})

test.describe("shell, accessibility, and responsive behaviour", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — seeded accounts are unavailable.",
  )

  test("every approved family destination is present and reachable", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    const nav = page.getByRole("navigation", { name: "Family" })
    for (const label of [
      "Overview",
      "Programs",
      "Schedule",
      "Announcements",
      "Resources",
      "Family",
      "Account",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible()
    }

    // No broken destination: every one answers, none 404s.
    for (const href of [
      "/family",
      "/programs",
      "/family/schedule",
      "/family/announcements",
      "/family/resources",
      "/family/household",
      "/account",
    ]) {
      const response = await page.request.get(href, { maxRedirects: 0 })
      expect([200, 307, 308], `${href} should not 404`).toContain(
        response.status(),
      )
    }
  })

  test("the mobile bottom navigation carries at most five destinations", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    const bar = page.getByRole("navigation", { name: "Family sections" })
    await expect(bar).toBeVisible()

    /* MDS caps the primary bar at five. The two that moved are still present
       in the More group rather than hidden, so nothing is unreachable. */
    const primary = bar.locator("ul").first().getByRole("link")
    expect(await primary.count()).toBeLessThanOrEqual(5)

    await expect(bar.getByRole("link", { name: "Announcements" })).toBeVisible()
    await expect(bar.getByRole("link", { name: "Resources" })).toBeVisible()
  })

  test("mobile navigation targets meet the 44 px minimum", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")

    const links = page
      .getByRole("navigation", { name: "Family sections" })
      .getByRole("link")
    const count = await links.count()

    for (let index = 0; index < count; index += 1) {
      const box = await links.nth(index).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })

  test("the current destination is marked, not merely coloured", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family/schedule")

    const nav = page.getByRole("navigation", { name: "Family" })
    await expect(nav.getByRole("link", { name: "Schedule" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(
      nav.getByRole("link", { name: "Overview" }),
    ).not.toHaveAttribute("aria-current", "page")
  })

  for (const route of PROTECTED) {
    test(`${route} has no axe violations`, async ({ page }) => {
      await signIn(page, ACCOUNTS.parentWithFamily)
      await page.goto(route)
      await page.waitForLoadState("networkidle")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("the overview structure matches its ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.parentWithFamily)
    await page.goto("/family")
    await page.waitForLoadState("networkidle")
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "family-dashboard-main.aria.yml",
    })
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await signIn(page, ACCOUNTS.parentWithFamily)
      await page.goto("/family")
      await page.waitForLoadState("networkidle")
      await expect(page).toHaveScreenshot(`family-dashboard-${name}.png`, {
        fullPage: true,
      })
    })
  }
})
