import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Administrator family operations (ACT-004/006; MPS-REQ-004/005/017/020/021/
 * 023; MPS-RUL-003/006/007; MPS-ACC-003/004/005; MDS-REF-009).
 *
 * The database half is `supabase/tests/database/
 * 80_admin_family_educator_roster.test.sql`, which proves every denial holds
 * when no application code is involved.
 *
 * WHAT THIS SUITE IS REALLY GUARDING
 *
 * Two absences, both of which a future change could quietly undo.
 *
 * The first is authority. A family account and its student profiles belong to
 * the parent, and an administrator seeing them here acquires nothing. Several
 * tests below assert that no edit, delete, or add control exists — an absence
 * is exactly the kind of guarantee that erodes without a test watching it.
 *
 * The second is what is on the page at all. No email, no phone, no medical or
 * behavioral or accommodation field, no date of birth. Most of those have no
 * column to read, but "we did not build a column" stops being a guarantee the
 * moment someone adds one, so the surface is asserted rather than the schema.
 *
 * This file makes no writes, so it needs no re-seed and restores nothing.
 *
 * To run:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local
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

async function expectStatus(page: Page, route: string, status: number) {
  const response = await page.request.get(route, { maxRedirects: 0 })
  expect(response.status(), `${route} should answer ${status}`).toBe(status)
}

/**
 * Open one family's drawer from the desktop table.
 *
 * The View button carries a fully qualifying accessible name, so it identifies
 * one record on its own. Scope every locator (DEFECT-AO3).
 */
async function openDrawer(page: Page, familyName: string) {
  await page
    .getByRole("button", {
      name: `View the ${familyName} account`,
      exact: true,
    })
    .click()
  await expect(page.getByRole("dialog")).toBeVisible()
}

test.describe("signed out", () => {
  test("redirects to sign-in and keeps the destination", async ({ page }) => {
    await page.goto("/admin/families")
    await expect(page).toHaveURL(
      `/sign-in?redirectTo=${encodeURIComponent("/admin/families")}`,
    )
  })
})

test.describe("denial matrix", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )

  test("a parent is refused, including for their own family", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await expectStatus(page, "/admin/families", 404)
  })

  test("an educator is refused", async ({ page }) => {
    /* An educator's assignment grants a roster read in their own workspace. It
       never grants a family directory (MPS-REQ-004, MPS-REQ-018). */
    await signIn(page, ACCOUNTS.educator)
    await expectStatus(page, "/admin/families", 404)
  })
})

test.describe("what the directory shows", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/families")
  })

  test("lists every sample family with its guardian and counts", async ({
    page,
  }) => {
    const table = page.getByRole("table")
    await expect(table).toContainText("Sample Family A")
    await expect(table).toContainText("Sample Family B")
    await expect(table).toContainText("Sample Parent")
  })

  test("states plainly that families control their own records", async ({
    page,
  }) => {
    await expect(page.locator("main")).toContainText(
      "Families control their own records",
    )
    await expect(page.locator("main")).toContainText(
      "This directory is read-only",
    )
  })

  /* MPS-REQ-017 read-only boundary, asserted as an absence. */
  test("offers no control that changes a family or a student", async ({
    page,
  }) => {
    const main = page.locator("main")
    for (const name of [/^Edit/i, /^Delete/i, /^Remove/i, /^Add student/i]) {
      await expect(main.getByRole("button", { name })).toHaveCount(0)
    }
  })

  test("shows no contact detail anywhere on the page", async ({ page }) => {
    /* `auth.users` is never read and there is no service-role client in this
       path, so an email cannot appear. This asserts the consequence. */
    await expect(page.locator("main")).not.toContainText("@example.com")
  })
})

test.describe("the family drawer", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/families")
  })

  test("shows guardians, students, and enrollments", async ({ page }) => {
    await openDrawer(page, "Sample Family A")
    const dialog = page.getByRole("dialog")

    await expect(dialog).toContainText("Primary guardian")
    await expect(dialog).toContainText("Sample Student A1")
    await expect(dialog).toContainText("Sample Student A2")
    await expect(dialog).toContainText("Enrollments")
  })

  /* MPS-ACC-003's mechanism, reporting the truth that GAP-005 leaves. The demo
     placeholder must never be printed as though it were an accepted policy. */
  test("reports that no approved consent record exists", async ({ page }) => {
    await openDrawer(page, "Sample Family A")
    const dialog = page.getByRole("dialog")

    await expect(dialog).toContainText("No approved consent record")
    await expect(dialog).not.toContainText("demo-unapproved-v0")
  })

  test("shows no unapproved child field", async ({ page }) => {
    await openDrawer(page, "Sample Family A")
    const dialog = page.getByRole("dialog")

    for (const forbidden of [
      "Date of birth",
      "Legal name",
      "Allergies",
      "Medical",
      "Emergency contact",
    ]) {
      await expect(dialog).not.toContainText(forbidden)
    }
  })

  test("has only a close control", async ({ page }) => {
    await openDrawer(page, "Sample Family A")
    const dialog = page.getByRole("dialog")

    for (const name of [/^Edit/i, /^Delete/i, /^Remove/i, /^Save/i]) {
      await expect(dialog.getByRole("button", { name })).toHaveCount(0)
    }
  })

  test("closes on Escape and returns focus to the row control", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", {
      name: "View the Sample Family A account",
      exact: true,
    })
    await trigger.click()
    await expect(page.getByRole("dialog")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

test.describe("search", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/families")
  })

  test("narrows the list without touching the URL", async ({ page }) => {
    const before = page.url()
    await page.getByLabel("Search families").fill("Family A")

    await expect(page.getByRole("table")).toContainText("Sample Family A")
    await expect(page.getByRole("table")).not.toContainText("Sample Family B")

    /* The rule this whole component exists for: a family name must not reach
       the address bar, browser history, or a referrer header. */
    expect(page.url()).toBe(before)
    expect(page.url()).not.toContain("Family")
  })

  /* The total is not asserted: other suites create families through the real
     parent setup flow, so how many exist depends on what ran before. What must
     hold is that the announcement reports the narrowed count, and that it
     changes when the search does. */
  test("announces the result count", async ({ page }) => {
    const status = page.getByRole("status")
    await expect(status).toContainText(/^Showing all \d+ families\.$/)

    await page.getByLabel("Search families").fill("Family A")
    await expect(status).toContainText(/^Showing 1 of \d+ families\.$/)
  })

  test("shows a no-results state and recovers when cleared", async ({
    page,
  }) => {
    await page.getByLabel("Search families").fill("zzzz")
    await expect(page.locator("main")).toContainText(
      "No families match that search",
    )

    await page.getByRole("button", { name: "Clear the search" }).click()
    await expect(page.getByRole("table")).toContainText("Sample Family A")
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
      await page.goto("/admin/families")
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("the open drawer has no axe violations", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin/families")
    await openDrawer(page, "Sample Family A")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the table becomes labeled record cards on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/admin/families")
    await expect(page.getByRole("table")).toBeHidden()

    /* Every label survives the transformation. Dropping "Students" or
       "Confirmed enrollments" to save width would hide operational meaning,
       which the MDS forbids. */
    for (const label of [
      "Primary guardian",
      "Students",
      "Confirmed enrollments",
    ]) {
      await expect(page.locator("main")).toContainText(label)
    }
  })

  test("is reachable from the administrator navigation", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin")
    await page.getByRole("link", { name: "Families", exact: true }).click()
    await expect(page).toHaveURL("/admin/families")
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
      await page.goto("/admin/families")
      await expect(page.locator("main")).toBeVisible()
      await expect(page.getByRole("status")).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-families-${name}.png`, {
        fullPage: true,
      })
    })
  }

  test("matches the ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin/families")
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "admin-families-main.aria.yml",
    })
  })
})
