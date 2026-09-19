import { execFileSync } from "node:child_process"

import AxeBuilder from "@axe-core/playwright"
import type { Page, Request } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * External checkout activation and payment truth (Slice 4,
 * prompts/external-checkout-payment-truth.md; MPS-REQ-012/013/014/021,
 * MPS-ACC-018 to 023; MDS `payment_handoff`; DO-DONT "Trust states").
 *
 * The database half is `supabase/tests/database/190_external_checkout.test.sql`
 * (stored mappings, allowlist, role denials, audit). This file proves what each
 * person meets:
 *
 *   * the public program page never renders a checkout link;
 *   * a `started` registration renders exactly the approved destination, in a
 *     new tab, named for its program and child, with nothing appended;
 *   * following it, coming back, or arriving with invented query parameters
 *     changes nothing in the database;
 *   * every other state renders no checkout at all;
 *   * a program with no approved link says so truthfully;
 *   * STEP UP appears nowhere.
 *
 * FIXTURE
 *
 * One `started` enrollment for Sample Student A2 in Gardening, inserted with a
 * fixed id before each test and deleted after the file. Any existing A2 +
 * Gardening row (family-enroll.spec.ts creates one) is removed first; that spec
 * handles both its first-run and duplicate paths. Gardening's checkout link is
 * put back after the one test that clears it. Local stack only.
 *
 * GoDaddy is never contacted: every request to poynt.godaddy.com is answered
 * by a stub, so the suite neither depends on nor sends traffic to the live
 * checkout.
 */
test.describe.configure({ mode: "serial" })

const LOCAL = (() => {
  try {
    return (
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin ===
      "http://127.0.0.1:54321"
    )
  } catch {
    return false
  }
})()
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ACCOUNTS = {
  parent: "sample.parent.one@example.com",
  educator: "sample.educator@example.com",
  admin: "sample.admin@example.com",
} as const

const FAMILY_A = "30000000-0000-4000-8000-00000000000a"
const STUDENT_A2 = "40000000-0000-4000-8000-000000000002"
const GARDENING = "10000000-0000-4000-8000-000000000006"
const ENROLLMENT = "5c000000-0000-4000-8000-000000000001"
const GARDENING_CHECKOUT =
  "https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/cd911575-37c3-4e2e-ad66-1b2"

const PUBLISHED_SLUGS = [
  "haven-days-enrichment",
  "ready-set-prep",
  "ready-set-learn",
  "ready-set-sensory",
  "sewing",
  "crochet",
  "gardening",
  "tutoring",
  "monthly-clubs",
] as const

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
} as const

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

function psql(sql: string) {
  execFileSync("psql", [LOCAL_DB, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    stdio: "pipe",
  })
}

function query(sql: string): string {
  return execFileSync("psql", [LOCAL_DB, "-Atc", sql], {
    encoding: "utf8",
  }).trim()
}

function setState(state: string) {
  psql(
    `update public.enrollments set state = '${state}' where id = '${ENROLLMENT}'`,
  )
}

/**
 * Everything a checkout navigation could conceivably write, in one string.
 * Equal before and after means nothing was written.
 */
function fingerprint(): string {
  return query(`select concat_ws('|',
    (select string_agg(id || ':' || state || ':' || updated_at, ',' order by id)
       from public.enrollments where family_id = '${FAMILY_A}'),
    (select count(*) from public.audit_events),
    (select count(*) from public.registration_step_up_requests),
    (select count(*) from public.registration_submissions),
    (select count(*) from public.inquiries))`)
}

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

/** Answers every GoDaddy request locally. The live checkout is never touched. */
async function stubGoDaddy(page: Page) {
  const reached: string[] = []
  await page.context().route("https://poynt.godaddy.com/**", async (route) => {
    reached.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Checkout stub</title><p>Stub</p>",
    })
  })
  return reached
}

const checkoutLink = (page: Page) =>
  page.getByRole("link", { name: /Continue to Secure Checkout/ })

test.skip(!LOCAL, "Needs the local seeded Supabase stack (psql fixture).")

test.beforeEach(() => {
  psql(
    `delete from public.enrollments
       where student_id = '${STUDENT_A2}' and program_id = '${GARDENING}';
     insert into public.enrollments (id, family_id, student_id, program_id, state)
       values ('${ENROLLMENT}', '${FAMILY_A}', '${STUDENT_A2}', '${GARDENING}', 'started');`,
  )
})

test.afterAll(() => {
  if (!LOCAL) return
  psql(`delete from public.enrollments where id = '${ENROLLMENT}'`)
  psql(
    `update public.programs set checkout_url = '${GARDENING_CHECKOUT}'
       where id = '${GARDENING}' and checkout_url is null`,
  )
})

// ---------------------------------------------------------------------------
// Public discovery
// ---------------------------------------------------------------------------

test.describe("public program pages", () => {
  test("never render a checkout link, even where one is approved", async ({
    page,
  }) => {
    for (const slug of PUBLISHED_SLUGS) {
      await page.goto(`/programs/${slug}`)
      await expect(page.locator("main")).toBeVisible()
      await expect(
        page.locator(
          'a[href*="poynt.godaddy.com"], a[href*="pay.homeschoolhaven"]',
        ),
        slug,
      ).toHaveCount(0)
      await expect(checkoutLink(page), slug).toHaveCount(0)
    }
  })

  test("say checkout opens from a registration, and never mention STEP UP", async ({
    page,
  }) => {
    await page.goto("/programs/gardening")
    const registration = page.getByRole("region", { name: "Registration" })
    await expect(registration).toContainText(
      "Starting checkout does not confirm payment and does not confirm your child's place.",
    )
    await expect(registration).toContainText(
      "Checkout for Gardening opens from your registration",
    )
    await expect(registration).toContainText(
      "There is no payment step on this page.",
    )
    await expect(page.locator("body")).not.toContainText(/STEP UP|coupon/i)
  })

  test("Tutoring, which has no approved checkout, keeps the unavailable state", async ({
    page,
  }) => {
    await page.goto("/programs/tutoring")
    const registration = page.getByRole("region", { name: "Registration" })
    await expect(
      registration.getByText("Registration link not published"),
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// The eligible family path
// ---------------------------------------------------------------------------

test.describe("a started registration", () => {
  test("offers exactly the approved destination, in a new tab, named for its program and child", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await page.goto(`/family/enrollments/${ENROLLMENT}`)

    await expect(page.getByText("Awaiting checkout")).toBeVisible()
    const region = page.getByRole("region", { name: "Checkout for Gardening" })
    await expect(region).toBeVisible()

    const link = checkoutLink(page)
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAccessibleName(
      "Continue to Secure Checkout for Gardening (Sample Student A2) — opens Home School Haven's GoDaddy checkout page in a new tab",
    )
    /* Exactly the stored destination: nothing appended, nothing rewritten. */
    await expect(link).toHaveAttribute("href", GARDENING_CHECKOUT)
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", "noopener noreferrer")

    // Before the action: not payment, not a place, and where it opens.
    await expect(region).toContainText(
      "Starting checkout does not confirm payment and does not confirm your child's place.",
    )
    await expect(region).toContainText(
      "Opens Home School Haven’s secure GoDaddy checkout in a new tab.",
    )
    await expect(region).toContainText(
      "Payment stays pending verification until Home School Haven confirms it.",
    )

    // STEP UP: no control, no code, no wording (owner decision, GAP-015).
    await expect(page.locator("body")).not.toContainText(/STEP UP|coupon/i)
    await expect(page.locator("main input")).toHaveCount(0)

    // Nothing private in this page's own address either.
    expect(new URL(page.url()).search).toBe("")
  })

  test("following checkout, returning, and reloading write nothing", async ({
    page,
  }) => {
    const reached = await stubGoDaddy(page)
    await signIn(page, ACCOUNTS.parent)
    await page.goto(`/family/enrollments/${ENROLLMENT}`)

    const appRequests: Request[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).host === "127.0.0.1:3100") {
        appRequests.push(request)
      }
    })
    const before = fingerprint()

    const [popup] = await Promise.all([
      page.context().waitForEvent("page"),
      checkoutLink(page).click(),
    ])
    await popup.waitForLoadState()
    /* The new tab opened the destination exactly, with no appended data, and
       without this page's address as a referrer. */
    expect(popup.url()).toBe(GARDENING_CHECKOUT)
    expect(reached).toEqual([GARDENING_CHECKOUT])
    expect(await popup.evaluate(() => document.referrer)).toBe("")
    await popup.close()

    // The click itself sent nothing to the application.
    expect(appRequests.filter((r) => r.method() !== "GET")).toEqual([])

    // Coming back — a reload, and a return carrying invented claims.
    await page.reload()
    await page.goto(
      `/family/enrollments/${ENROLLMENT}?status=paid&outcome=confirmed`,
    )
    await expect(page.getByText("Awaiting checkout")).toBeVisible()
    await expect(page.getByText("Enrolled", { exact: true })).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText(
      /payment (received|complete)|you are enrolled/i,
    )

    expect(fingerprint()).toBe(before)
    expect(
      query(`select state from public.enrollments where id = '${ENROLLMENT}'`),
    ).toBe("started")
    expect(
      query("select count(*) from public.registration_step_up_requests"),
    ).toBe("0")
  })

  test("there is no checkout-return page to mark anything paid", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    for (const route of [
      "/family/checkout/return",
      "/checkout/return",
      "/checkout/success",
    ]) {
      await expectStatus(page, route, 404)
    }
  })

  for (const state of [
    "approval_pending",
    "waitlisted",
    "blocked",
    "canceled",
    "confirmed",
    "payment_pending",
    "payment_failed",
  ] as const) {
    test(`${state} renders no checkout at all`, async ({ page }) => {
      setState(state)
      await signIn(page, ACCOUNTS.parent)
      await page.goto(`/family/enrollments/${ENROLLMENT}`)
      await expect(
        page.locator('[data-slot="enrollment-state"]').first(),
      ).toBeVisible()
      await expect(checkoutLink(page)).toHaveCount(0)
      await expect(
        page.getByRole("heading", { name: "Checkout for Gardening" }),
      ).toHaveCount(0)
      await expect(page.locator('a[href*="poynt.godaddy.com"]')).toHaveCount(0)
    })
  }

  test("a program with no approved link shows the truthful unavailable state", async ({
    page,
  }) => {
    psql(
      `update public.programs set checkout_url = null where id = '${GARDENING}'`,
    )
    try {
      await signIn(page, ACCOUNTS.parent)
      await page.goto(`/family/enrollments/${ENROLLMENT}`)
      const region = page.getByRole("region", {
        name: "Checkout for Gardening",
      })
      await expect(
        region.getByText("Registration link not published"),
      ).toBeVisible()
      await expect(checkoutLink(page)).toHaveCount(0)
      await expect(
        region.getByRole("link", { name: "239-347-9356" }),
      ).toHaveAttribute("href", "tel:2393479356")
      // The registration is kept.
      await expect(page.getByText("Awaiting checkout")).toBeVisible()
    } finally {
      psql(
        `update public.programs set checkout_url = '${GARDENING_CHECKOUT}'
           where id = '${GARDENING}'`,
      )
    }
  })

  test("the dashboard shows the registration awaiting checkout, without claiming it was opened", async ({
    page,
  }) => {
    /* The next action is family-wide, and the seeded payment_pending record
       outranks `started` there, so the started wording itself is pinned in
       tests/family-dashboard.test.mts. What this proves is the page. */
    await signIn(page, ACCOUNTS.parent)
    await page.goto("/family")
    await page.getByRole("combobox", { name: "Viewing student" }).click()
    await page.getByRole("option", { name: "Sample Student A2" }).click()
    await page.waitForURL(/student=/)
    await expect(page.getByText("Awaiting checkout").first()).toBeVisible()
    await expect(page.locator("main")).not.toContainText("Checkout was started")
    /* The dashboard itself offers no checkout; that belongs to the
       registration's own page. */
    await expect(checkoutLink(page)).toHaveCount(0)
  })

  test("the handoff is reachable and visibly focused from the keyboard", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await page.goto(`/family/enrollments/${ENROLLMENT}`)
    const link = checkoutLink(page)
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press("Tab")
      if (await link.evaluate((el) => el === document.activeElement)) break
    }
    await expect(link).toBeFocused()
    const outline = await link.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        style: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
      }
    })
    expect(outline.style).not.toBe("none")
    expect(outline.width).toBeGreaterThan(0)
    const box = await link.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`is accessible and fits at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await signIn(page, ACCOUNTS.parent)
      await page.goto(`/family/enrollments/${ENROLLMENT}`)
      await expect(checkoutLink(page)).toBeVisible()

      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .analyze()
      expect(results.violations).toEqual([])

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)

      await expect(page.locator("main")).toHaveScreenshot(
        `enrollment-checkout-${name}.png`,
        { animations: "disabled" },
      )
    })
  }

  test("the handoff region's structure is pinned", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    await page.goto(`/family/enrollments/${ENROLLMENT}`)
    await expect(
      page.getByRole("region", { name: "Checkout for Gardening" }),
    ).toMatchAriaSnapshot({ name: "enrollment-checkout-handoff.aria.yml" })
  })
})

// ---------------------------------------------------------------------------
// Other roles
// ---------------------------------------------------------------------------

test.describe("other roles", () => {
  test("anonymous visitors are sent to sign-in, not to a checkout", async ({
    page,
  }) => {
    await page.goto(`/family/enrollments/${ENROLLMENT}`)
    await expect(page).toHaveURL(/\/sign-in\?redirectTo=/)
    await expect(page.locator('a[href*="poynt.godaddy.com"]')).toHaveCount(0)
  })

  test("an educator never reaches a family's checkout", async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
    await expectStatus(page, `/family/enrollments/${ENROLLMENT}`, 404)
    await page.goto("/educator")
    await expect(page.locator('a[href*="poynt.godaddy.com"]')).toHaveCount(0)
  })

  test("an administrator sees which programs have no checkout link", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/programs?q=tutor")
    await expect(
      page.getByText("No checkout link published").first(),
    ).toBeVisible()
    await page.goto("/admin/programs?q=gardening")
    await expect(page.getByText("External checkout").first()).toBeVisible()
  })
})
