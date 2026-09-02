import { execFileSync } from "node:child_process"

import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Foundation beta review (ACT-006/004; MPS-REQ-022/023/024; MPS-WFL-008;
 * MPS-ACC-032; SIG-BETA-001 through 008).
 *
 * The database half is `supabase/tests/database/130_beta_review_evidence.test.sql`,
 * which proves the privacy boundary and the approval guard hold when no
 * application code is involved. This suite proves the surface above them tells
 * the truth.
 *
 * WHAT THIS SUITE IS REALLY GUARDING
 *
 * Two promises, both asserted partly as the ABSENCE of things.
 *
 * That the summary never overstates readiness. It is the artifact someone will
 * point at when deciding whether the beta can be shown, so "0 of 8
 * demonstrated" on an untouched review is the single most important string on
 * the page.
 *
 * That nothing here claims to have changed approved scope (MPS-REQ-022,
 * MPS-WFL-008 recovery). There is no control that accepts an item into a
 * release, and the page says in words that updating the MPS is a separate
 * human step.
 *
 * FIXTURE
 *
 * The eight signals ship in the migration, not the seed, so they exist in
 * every environment. This suite's writes are scoped to those rows and are
 * restored around the file with psql — `db:reset` is unreliable on this
 * machine (see `admin-inquiries.spec.ts`), and a full reset is far wider than
 * these mutations warrant.
 */
test.describe.configure({ mode: "serial" })

const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
)

const CAN_RESTORE_FIXTURE = (() => {
  if (!SUPABASE_CONFIGURED || !process.env.NEXT_PUBLIC_SUPABASE_URL) return false
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
 * Put the eight signals back to `not_reviewed` / `not_tested` and drop every
 * feedback item and its history.
 *
 * The statements themselves are never touched: they are approved MPS text and
 * belong to the migration (MPS-RUL-010).
 */
function restoreReviewFixture() {
  execFileSync(
    "psql",
    [
      LOCAL_DB,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "delete from public.audit_events where entity_type in ('review_signal','review_feedback');",
      "-c",
      "delete from public.review_feedback;",
      "-c",
      `update public.review_signals
          set state = 'not_reviewed', result = 'not_tested',
              environment = null, build_identifier = null, method = null,
              actor = null, evidence = null, state_changed_at = now();`,
    ],
    { stdio: "inherit" },
  )
}

test.beforeAll(async () => {
  test.setTimeout(300_000)
  if (CAN_RESTORE_FIXTURE) restoreReviewFixture()
})

test.afterAll(async () => {
  test.setTimeout(300_000)
  if (CAN_RESTORE_FIXTURE) restoreReviewFixture()
})

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

const ROUTE = "/admin/reports"

const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ACCOUNTS = {
  admin: "sample.admin@example.com",
  parent: "sample.parent.one@example.com",
  educator: "sample.educator@example.com",
} as const

/** The note this suite records. Its words are the thing that must not leak. */
const SECRET_NOTE =
  "The educator workspace felt cramped and I would rework it."

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

/** The card for one signal, addressed by its approved identifier. */
function signalCard(page: Page, id: string) {
  return page.getByRole("listitem").filter({ hasText: id })
}

test.describe("signed out", () => {
  test("redirects to sign-in and keeps the destination", async ({ page }) => {
    await page.goto(ROUTE)
    await expect(page).toHaveURL(
      `/sign-in?redirectTo=${encodeURIComponent(ROUTE)}`,
    )
  })
})

test.describe("privacy boundary", () => {
  test.skip(!SUPABASE_CONFIGURED, "Needs a Supabase project.")

  test("an educator is refused, and told nothing about it", async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
    const response = await page.request.get(ROUTE, { maxRedirects: 0 })
    /* 404, not 403: a 403 would confirm the surface exists. */
    expect(response.status()).toBe(404)
  })

  test("a parent is refused", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    const response = await page.request.get(ROUTE, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
  })
})

test.describe("the review", () => {
  test.skip(!SUPABASE_CONFIGURED, "Needs a Supabase project.")
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
  })

  test("lists all eight approved signals with their statements", async ({
    page,
  }) => {
    for (let n = 1; n <= 8; n += 1) {
      await expect(
        page.getByText(`SIG-BETA-00${n}`, { exact: true }),
      ).toBeVisible()
    }
    /* Quoted verbatim from the MPS, not paraphrased on screen (MPS-RUL-010). */
    await expect(
      page.getByRole("heading", {
        name: "A prospective family can understand Home School Haven and identify an appropriate program.",
      }),
    ).toBeVisible()
  })

  test("reports nothing demonstrated on an untouched review", async ({
    page,
  }) => {
    /* MPS-ACC-032, and the most important string on the page. A review nobody
       has walked must not read as progress. */
    await expect(
      page.getByRole("status").filter({ hasText: "of 8 signals demonstrated" }),
    ).toContainText("0 of 8 signals demonstrated")
    await expect(
      page.getByText("Only a recorded pass counts"),
    ).toBeVisible()
  })

  test("says that recording a decision changes no approved scope", async ({
    page,
  }) => {
    /* MPS-REQ-022 "without silently changing scope", stated to the person
       using the surface rather than left in a migration comment. */
    const banner = page.getByText(
      "Classifying feedback and approving its disposition record",
    )
    await expect(banner).toBeVisible()
    await expect(banner).toContainText("add nothing to any release")
    await expect(banner).toContainText("separate step")
  })

  test("offers no control that accepts an item into a release", async ({
    page,
  }) => {
    for (const forbidden of [
      "Accept",
      "Add to release",
      "Add to scope",
      "Approve for launch",
      "Update MPS",
      "Schedule",
    ]) {
      await expect(page.getByRole("button", { name: forbidden })).toHaveCount(0)
    }
  })
})

test.describe.serial("the approved walkthrough (MPS-WFL-008)", () => {
  test.skip(
    !CAN_RESTORE_FIXTURE,
    "Needs the restorable local Supabase stack.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
  })

  test("records evidence and moves a signal into review", async ({ page }) => {
    const card = signalCard(page, "SIG-BETA-005")
    await card.getByRole("button", { name: /Record evidence or feedback/ }).click()

    await card.getByLabel("Result").selectOption("pass")
    await card.getByLabel("Build identifier").fill("build-e2e")
    await card.getByLabel("Environment").fill("local")
    await card.getByLabel("Method").fill("Manual walkthrough")
    await card.getByLabel("Evidence").fill("Walked the educator workspace.")
    await card.getByLabel("Move this signal (optional)").selectOption("in_review")
    await card.getByRole("button", { name: "Record evidence" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Recorded" })).toContainText(
      "no approved requirement changed",
    )
    await expect(signalCard(page, "SIG-BETA-005")).toContainText("build-e2e")
  })

  test("the summary counts the pass, and only the pass", async ({ page }) => {
    await expect(
      page.getByRole("status").filter({ hasText: "of 8 signals demonstrated" }),
    ).toContainText("1 of 8 signals demonstrated")
  })

  test("records feedback, which starts unclassified", async ({ page }) => {
    const card = signalCard(page, "SIG-BETA-005")
    await card.getByRole("button", { name: /Record evidence or feedback/ }).click()
    await card.getByLabel("What was said about this signal").fill(SECRET_NOTE)
    await card.getByRole("button", { name: "Record feedback" }).click()

    const updated = signalCard(page, "SIG-BETA-005")
    await expect(updated).toContainText(SECRET_NOTE)
    await expect(updated).toContainText("Not classified")
    /* Approval is not offered until it is classified — the MPS-REQ-022
       control, visible as the absence of a button. */
    await expect(
      updated.getByRole("button", { name: "Approve this disposition" }),
    ).toHaveCount(0)
  })

  test("classifying then approving is two distinct acts", async ({ page }) => {
    const card = signalCard(page, "SIG-BETA-005")
    await card.getByLabel("Classify this").selectOption("launch_requirement")
    await card.getByRole("button", { name: "Save classification" }).click()

    const classified = signalCard(page, "SIG-BETA-005")
    await expect(classified).toContainText("Launch requirement")
    await expect(classified).toContainText("not yet approved")
    /* The wording that keeps a launch requirement from reading as a commitment
       to build it in this release. */
    await expect(classified).toContainText("does not add it to any release")

    await classified
      .getByRole("button", { name: "Approve this disposition" })
      .click()

    const approved = signalCard(page, "SIG-BETA-005")
    await expect(approved).toContainText("approved")
    await expect(approved).toContainText("Disposition approved")
  })

  test("an educator still cannot see any of it", async ({ page }) => {
    /* The route refusal is covered above. This proves the recorded note did
       not reach the educator workspace by some other path — a history feed, a
       roster note. The owner's words themselves are the test. */
    /* The describe's beforeEach is already signed in as the administrator, and
       `/sign-in` redirects an authenticated viewer away. Drop that session
       before taking the educator's. */
    await page.context().clearCookies()
    await signIn(page, ACCOUNTS.educator)
    for (const route of ["/educator", "/account"]) {
      await page.goto(route)
      await expect(page.locator("body")).not.toContainText(SECRET_NOTE)
      await expect(page.locator("body")).not.toContainText("SIG-BETA")
    }
  })
})

test.describe("accessibility and responsive behaviour", () => {
  test.skip(!SUPABASE_CONFIGURED, "Needs a Supabase project.")
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

  test("the evidence panel has no axe violations when open", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
    await signalCard(page, "SIG-BETA-001")
      .getByRole("button", { name: /Record evidence or feedback/ })
      .click()
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the evidence panel is keyboard operable and announces its state", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
    const toggle = signalCard(page, "SIG-BETA-001").getByRole("button", {
      name: /Record evidence or feedback/,
    })
    await toggle.focus()
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await page.keyboard.press("Enter")
    await expect(
      signalCard(page, "SIG-BETA-001").getByRole("button", { name: "Hide" }),
    ).toHaveAttribute("aria-expanded", "true")
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
      await expect(page).toHaveScreenshot(`admin-reports-${name}.png`, {
        fullPage: true,
      })
    })
  }

  test("matches the ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(ROUTE)
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "admin-reports-main.aria.yml",
    })
  })

  test("Reports is reachable from the administrator navigation", async ({
    page,
  }) => {
    /* MDS `navigation.specification.admin` names Reports; this is the slice
       that filled it. */
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/admin")
    await page
      .getByRole("navigation", { name: "Administration" })
      .getByRole("link", { name: "Reports" })
      .click()
    await expect(page).toHaveURL(ROUTE)
  })
})
