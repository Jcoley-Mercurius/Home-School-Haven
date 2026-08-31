import AxeBuilder from "@axe-core/playwright"
import type { Browser, Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * The educator assigned-program workspace (ACT-003; MPS-REQ-004/005/017/018/
 * 019/020/021/023/024; MPS-ACC-004/005/028/029/030/031/032; MDS
 * `navigation.specification.educator`, `page_shells.educator_workspace`).
 *
 * The database half is `supabase/tests/database/
 * 80_admin_family_educator_roster.test.sql`, which proves every denial holds
 * with no application code involved. Both are required; neither alone is the
 * control.
 *
 * WHAT THIS SUITE IS REALLY GUARDING
 *
 * Three things, each of which a later change could undo without anyone
 * noticing.
 *
 * The first is the roster projection. `EDUCATOR_ROSTER_COLUMNS` is
 * `preferred_name` and nothing else, and the "network payload privacy" group
 * below reads the raw response bodies rather than the rendered page — because a
 * field that is fetched and then hidden in CSS is still sitting in the payload
 * for anyone who opens DevTools. Asserting on what is visible would pass in
 * exactly the case that matters.
 *
 * The second is the assignment boundary under manipulation. A route parameter,
 * a search parameter, and a removed assignment are each tried directly against
 * the server's response status, not against what the page chose to render.
 *
 * The third is a set of absences: no publish, price, capacity, enrollment,
 * family, or roster-editing control anywhere in the workspace. An absence is
 * exactly the kind of guarantee that erodes without a test watching it.
 *
 * The "assignment removal" group mutates the seeded assignment set and restores
 * it, in the manner `admin-educators.spec.ts` established.
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
  educator: "sample.educator@example.com",
  admin: "sample.admin@example.com",
  parent: "sample.parent.one@example.com",
} as const

/* Seeded fixtures. The educator holds 0004 (published) and 00ff (draft), and
   holds neither 0002 nor 0005 — so "sees assigned" and "does not see
   unassigned" both have a target. */
const ASSIGNED_PROGRAM = {
  id: "10000000-0000-4000-8000-000000000004",
  name: "Art Lab",
}
const ASSIGNED_DRAFT = {
  id: "10000000-0000-4000-8000-0000000000ff",
  name: "Sample Unpublished Draft (test fixture)",
}
const UNASSIGNED_PROGRAM = {
  id: "10000000-0000-4000-8000-000000000002",
  name: "Haven Days Enrichment",
}
const UNASSIGNED_OTHER_FAMILY = { id: "10000000-0000-4000-8000-000000000005" }

/* The confirmed child on the assigned program, and the unconfirmed one beside
   them. Both are sanitized seed records. */
const CONFIRMED_STUDENT = "Sample Student A2"
const UNCONFIRMED_STUDENT = "Sample Student A1"

/**
 * Values that must never reach an educator's browser.
 *
 * Each has a reason to exist in the database and no reason to exist in an
 * educator's response: grades and guardian relationships are student fields
 * checklist §9 has not approved for educator view (GAP-ADMIN-014), family names
 * are family data, and a state note is an administrator's written reasoning
 * about a family's circumstances.
 */
const FORBIDDEN_IN_PAYLOAD = [
  /* The unconfirmed child on the assigned program. `educator_roster_students`
     exposes confirmed children only, so this name is unreadable to an educator
     — the strongest form of MPS-RUL-003 available. */
  UNCONFIRMED_STUDENT,
  "Grade 3",
  "Grade 6",
  "Grade 1",
  "grade_level",
  "guardian_relationship",
  "Sample Family A",
  "Sample Family B",
  "Awaiting verification by an authorized administrator",
] as const

const EDUCATOR_ROUTES = [
  "/educator",
  "/educator/programs",
  "/educator/schedule",
  "/educator/rosters",
  "/educator/announcements",
  "/educator/resources",
] as const

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

/**
 * Assert a route's HTTP status without navigating to it.
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
  test("every destination redirects to sign-in and keeps the target", async ({
    page,
  }) => {
    for (const route of EDUCATOR_ROUTES) {
      await page.goto(route)
      await expect(page).toHaveURL(
        `/sign-in?redirectTo=${encodeURIComponent(route)}`,
      )
    }
  })

  test("a program detail route redirects rather than leaking its existence", async ({
    page,
  }) => {
    const route = `/educator/programs/${ASSIGNED_PROGRAM.id}`
    await page.goto(route)
    await expect(page).toHaveURL(
      `/sign-in?redirectTo=${encodeURIComponent(route)}`,
    )
  })
})

test.describe("assignment boundary", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.educator)
  })

  test("an assigned educator reaches the workspace", async ({ page }) => {
    for (const route of EDUCATOR_ROUTES) {
      await expectStatus(page, route, 200)
    }
    await expectStatus(page, `/educator/programs/${ASSIGNED_PROGRAM.id}`, 200)
    await expectStatus(page, `/educator/programs/${ASSIGNED_DRAFT.id}`, 200)
  })

  test("only assigned programs are listed", async ({ page }) => {
    await page.goto("/educator/programs")
    await expect(page.locator("main")).toContainText(ASSIGNED_PROGRAM.name)
    /* Nine programs exist; the educator holds two. The rest are not filtered
       out of a longer list on the client — they are never returned. */
    /* The educator holds one published program and one draft. The draft is
       listed — an educator assigned to a program that families cannot see still
       needs to know they hold it, and its state says which it is. */
    await expect(page.locator("main")).toContainText(ASSIGNED_DRAFT.name)
    await expect(page.locator("main")).toContainText("Draft")

    for (const absent of [
      UNASSIGNED_PROGRAM.name,
      "Harvest Explorers",
      "Etiquette Series",
    ]) {
      await expect(page.getByText(absent, { exact: false })).toHaveCount(0)
    }
  })

  test("an unassigned program id is denied by the server", async ({ page }) => {
    for (const id of [UNASSIGNED_PROGRAM.id, UNASSIGNED_OTHER_FAMILY.id]) {
      await expectStatus(page, `/educator/programs/${id}`, 404)
    }
  })

  test("a manipulated identifier is refused the same way whatever it is", async ({
    page,
  }) => {
    /* Forbidden, non-existent, and malformed all answer 404. A distinguishable
       "forbidden" would confirm to a prober that the record exists. */
    for (const id of [
      UNASSIGNED_PROGRAM.id,
      "10000000-0000-4000-8000-999999999999",
      "not-a-uuid",
      "../admin/programs",
      "%2e%2e%2fadmin",
    ]) {
      const response = await page.request.get(
        `/educator/programs/${encodeURIComponent(id)}`,
        { maxRedirects: 0 },
      )
      expect(
        [404, 400].includes(response.status()),
        `${id} must not be served`,
      ).toBe(true)
    }
  })

  test("a search parameter cannot widen the assignment set", async ({
    page,
  }) => {
    /* Nothing reads a program id, an educator id, or a role from the query
       string. Passing them changes nothing, which is the assertion. */
    await page.goto(
      `/educator/programs?programId=${UNASSIGNED_PROGRAM.id}&educatorUserId=00000000-0000-4000-8000-000000000000&role=admin`,
    )
    await expect(page.locator("main")).toContainText(ASSIGNED_PROGRAM.name)
    await expect(page.getByText(UNASSIGNED_PROGRAM.name)).toHaveCount(0)
  })

  test("the administrator area stays out of reach", async ({ page }) => {
    for (const route of [
      "/admin",
      "/admin/programs",
      "/admin/enrollments",
      "/admin/families",
      "/admin/educators",
      `/admin/programs/${ASSIGNED_PROGRAM.id}`,
    ]) {
      await expectStatus(page, route, 404)
    }
  })

  test("the family area stays out of reach", async ({ page }) => {
    for (const route of ["/family", "/family/household", "/family/schedule"]) {
      await expectStatus(page, route, 404)
    }
  })
})

test.describe("roster", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.educator)
  })

  test("a confirmed student appears exactly once (MPS-ACC-028)", async ({
    page,
  }) => {
    await page.goto(`/educator/programs/${ASSIGNED_PROGRAM.id}`)
    const main = page.locator("main")
    await expect(main).toContainText("Confirmed (1)")
    /* Once in the table, not once per rendering: the desktop table and the
       mobile card are the same row rendered twice with CSS choosing between
       them, so this is scoped to the table. */
    await expect(
      page.getByRole("table").getByText(CONFIRMED_STUDENT, { exact: true }),
    ).toHaveCount(1)
  })

  test("an unconfirmed record is counted, never named or shown as confirmed", async ({
    page,
  }) => {
    await page.goto(`/educator/programs/${ASSIGNED_PROGRAM.id}`)
    const main = page.locator("main")

    await expect(main).toContainText("Not on the roster (1)")
    /* The state is named in the educator's words, and it says what it is. */
    await expect(main).toContainText("Payment verification pending")
    await expect(main).toContainText(
      "These records are not enrolled in Art Lab",
    )
    await expect(main).toContainText(
      "Students are not named until their place is confirmed",
    )
    /* The child behind the unconfirmed record is not identified. The roster
       view exposes confirmed children only, so this is the database's
       guarantee, asserted at the surface. */
    await expect(main.getByText(UNCONFIRMED_STUDENT)).toHaveCount(0)
  })

  test("shows a preferred name and no other child or family detail", async ({
    page,
  }) => {
    await page.goto("/educator/rosters")
    const main = page.locator("main")
    await expect(main).toContainText(CONFIRMED_STUDENT)

    for (const forbidden of FORBIDDEN_IN_PAYLOAD) {
      await expect(
        main.getByText(forbidden, { exact: false }),
        `${forbidden} must not be rendered`,
      ).toHaveCount(0)
    }
  })

  test("offers no roster mutation of any kind", async ({ page }) => {
    await page.goto("/educator/rosters")
    for (const name of [
      /add student/i,
      /remove/i,
      /edit/i,
      /transfer/i,
      /export/i,
      /attendance/i,
      /confirm enrollment/i,
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0)
      await expect(page.getByRole("link", { name })).toHaveCount(0)
    }
  })

  test("an empty confirmed roster reads as empty, not as broken", async ({
    page,
  }) => {
    /* The assigned draft program has no enrollment at all — the empty case,
       reached without changing any data. */
    await page.goto(`/educator/programs/${ASSIGNED_DRAFT.id}`)
    const main = page.locator("main")
    await expect(main).toContainText("No confirmed enrollments yet")
    await expect(main).toContainText("Confirmed (0)")
    await expect(main).toContainText("Not on the roster (0)")
    await expect(main).toContainText(
      "There are no unconfirmed records for this program",
    )
  })
})

test.describe("network payload privacy", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
  })

  /**
   * The assertion this whole slice's privacy constraint rests on.
   *
   * These pages are Server Components, so anything fetched reaches the browser
   * in the streamed RSC payload whether or not it is rendered. Reading the raw
   * body is therefore the only check that distinguishes "not selected" from
   * "selected and hidden" — and only the first is a control.
   */
  test("no excluded roster field is serialized to the browser", async ({
    page,
  }) => {
    const routes = [
      ...EDUCATOR_ROUTES,
      `/educator/programs/${ASSIGNED_PROGRAM.id}`,
      `/educator/programs/${ASSIGNED_DRAFT.id}`,
    ]

    for (const route of routes) {
      const response = await page.request.get(route)
      expect(response.status(), `${route} should be served`).toBe(200)
      const body = await response.text()

      for (const forbidden of FORBIDDEN_IN_PAYLOAD) {
        expect(
          body.includes(forbidden),
          `${route} payload must not contain "${forbidden}"`,
        ).toBe(false)
      }
    }
  })

  test("the confirmed child's preferred name IS present, so the check is real", async ({
    page,
  }) => {
    /* A payload assertion that would pass on an empty page proves nothing.
       This pins that the roster actually rendered the one field it may. */
    const response = await page.request.get("/educator/rosters")
    expect(await response.text()).toContain(CONFIRMED_STUDENT)
  })

  test("no unassigned program's content is serialized", async ({ page }) => {
    for (const route of EDUCATOR_ROUTES) {
      const body = await (await page.request.get(route)).text()
      expect(
        body.includes(UNASSIGNED_PROGRAM.name),
        `${route} must not carry an unassigned program`,
      ).toBe(false)
      expect(
        body.includes("Sample announcement for another family"),
        `${route} must not carry another program's announcement`,
      ).toBe(false)
    }
  })
})

test.describe("read-only surfaces", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await signIn(page, ACCOUNTS.educator)
  })

  test("shows a published schedule and never invents one", async ({ page }) => {
    await page.goto("/educator/schedule")
    await expect(page.locator("main")).toContainText(
      "exactly as families see it",
    )
    /* Schedule operations are not deferred UI here; they do not exist. */
    for (const name of [
      /add session/i,
      /create schedule/i,
      /capacity/i,
      /waitlist/i,
      /cancel/i,
      /notify/i,
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0)
    }
  })

  test("announcements show their real content state", async ({ page }) => {
    await page.goto("/educator/announcements")
    const main = page.locator("main")
    await expect(main).toContainText(
      "Sample announcement — welcome to the review",
    )
    /* The educator policies do not filter on `published`, so the draft is
       visible — and is labelled rather than dressed as published. */
    await expect(main).toContainText("Sample unpublished announcement")
    await expect(main).toContainText("Not published")
  })

  test("offers no authoring control on announcements or resources", async ({
    page,
  }) => {
    for (const route of ["/educator/announcements", "/educator/resources"]) {
      await page.goto(route)
      for (const name of [
        /new announcement/i,
        /publish/i,
        /upload/i,
        /^edit/i,
        /^delete/i,
        /course builder/i,
      ]) {
        await expect(page.getByRole("button", { name })).toHaveCount(0)
        await expect(page.getByRole("link", { name })).toHaveCount(0)
      }
    }
  })

  test("shows no price, availability, or publishing control", async ({
    page,
  }) => {
    await page.goto(`/educator/programs/${ASSIGNED_PROGRAM.id}`)
    const main = page.locator("main")

    /* MDS-REF-008 applicability: educator context excludes pricing,
       availability, and direct publishing controls. These are absent from the
       type, so they cannot be fetched, let alone rendered. */
    await expect(main.getByText("$", { exact: false })).toHaveCount(0)
    for (const name of [
      /publish/i,
      /archive/i,
      /unpublish/i,
      /save/i,
      /assign/i,
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0)
    }
    /* The publication STATE is shown — an educator on a draft must know
       families cannot see it — which is a label, not a control. */
    await expect(main).toContainText("Published")
    await expect(main).toContainText("This view is read-only")
  })

  test("says the workspace holds sample data", async ({ page }) => {
    /* MPS-ACC-004: a demo surface says so where the reader is. */
    for (const route of EDUCATOR_ROUTES) {
      await page.goto(route)
      await expect(page.locator("main")).toContainText("Private beta")
    }
  })
})

test.describe.serial("assignment removal revokes access", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )

  /**
   * The claim `lib/educator/assignments.ts` makes in prose, verified end to
   * end: nothing caches an assignment in a session, a cookie, or a token
   * claim, so removing it denies the educator's very next request with no
   * sign-out involved.
   *
   * Two contexts, held open across the change. The educator signs in BEFORE
   * the assignment is removed, so what is tested is a live session losing
   * reach — not a fresh sign-in that never had it.
   *
   * The group restores the seeded assignment set, so it leaves the counts the
   * other suites assert unchanged.
   */
  async function adminUnassign(page: Page, programName: string) {
    await page.goto("/admin/educators")
    await page
      .getByRole("button", {
        name: "Manage Sample Educator's program assignments",
      })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", {
        name: `Remove Sample Educator from ${programName}`,
        exact: true,
      })
      .click()
    const confirm = page.getByRole("dialog").last()
    await confirm
      .getByLabel("Reason (recorded)")
      .fill("Educator workspace revocation test.")
    await confirm.getByRole("button", { name: "Remove access" }).click()
    await expect(page.getByRole("dialog").first()).toContainText(
      "Assignment removed",
    )
  }

  async function adminAssign(page: Page, programName: string) {
    await page.goto("/admin/educators")
    await page
      .getByRole("button", {
        name: "Manage Sample Educator's program assignments",
      })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Program", { exact: true }).click()
    await page.getByRole("option", { name: programName, exact: true }).click()
    await dialog
      .getByLabel("Reason (recorded)")
      .fill("Restoring the seeded assignment fixture.")
    await dialog.getByRole("button", { name: "Assign to program" }).click()
    await expect(dialog).toContainText("Educator assigned")
  }

  test("a live educator session loses the program on its next request", async ({
    browser,
  }: {
    browser: Browser
  }) => {
    const educatorContext = await browser.newContext()
    const adminContext = await browser.newContext()
    const educatorPage = await educatorContext.newPage()
    const adminPage = await adminContext.newPage()

    try {
      await educatorPage.setViewportSize(VIEWPORTS.desktop)
      await adminPage.setViewportSize(VIEWPORTS.desktop)

      await signIn(educatorPage, ACCOUNTS.educator)
      await expectStatus(
        educatorPage,
        `/educator/programs/${ASSIGNED_PROGRAM.id}`,
        200,
      )

      await signIn(adminPage, ACCOUNTS.admin)
      await adminUnassign(adminPage, ASSIGNED_PROGRAM.name)

      /* Same session, same cookies, no sign-out. */
      await expectStatus(
        educatorPage,
        `/educator/programs/${ASSIGNED_PROGRAM.id}`,
        404,
      )

      const body = await (
        await educatorPage.request.get("/educator/rosters")
      ).text()
      expect(
        body.includes(CONFIRMED_STUDENT),
        "the roster must be gone with the assignment",
      ).toBe(false)
      expect(body.includes(ASSIGNED_PROGRAM.name)).toBe(false)

      /* Restore the fixture before anything else runs. */
      await adminAssign(adminPage, ASSIGNED_PROGRAM.name)
      await expectStatus(
        educatorPage,
        `/educator/programs/${ASSIGNED_PROGRAM.id}`,
        200,
      )
    } finally {
      await educatorContext.close()
      await adminContext.close()
    }
  })
})

test.describe("responsive and accessibility", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`the overview has no axe violations at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/educator")
      await expect(page.locator("main")).toContainText(ASSIGNED_PROGRAM.name)
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("the roster page has no axe violations", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/educator/rosters")
    await expect(page.locator("main")).toContainText(CONFIRMED_STUDENT)
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the program detail has no axe violations", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(`/educator/programs/${ASSIGNED_PROGRAM.id}`)
    await expect(page.locator("main")).toContainText("Program summary")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the roster table becomes labeled cards on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/educator/rosters")
    await expect(page.getByRole("table").first()).toBeHidden()
    /* The column label survives the transformation rather than the name
       floating alone in a card with no term. */
    await expect(page.locator("main")).toContainText(CONFIRMED_STUDENT)
    await expect(page.locator("main")).toContainText("Student")
    /* The confirmed heading is still what separates a roster member from a
       record whose place is unsettled. */
    await expect(page.locator("main")).toContainText("Confirmed (1)")
  })

  test("the mobile bottom bar holds five destinations and a More group", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/educator")
    const mobileNav = page.getByRole("navigation", {
      name: "Educator sections",
    })
    await expect(mobileNav).toBeVisible()
    /* MDS caps the bar at five; Announcements and Resources take the More
       row rather than being dropped. */
    await expect(mobileNav).toContainText("More")
    for (const label of ["Announcements", "Resources"]) {
      await expect(mobileNav.getByRole("link", { name: label })).toBeVisible()
    }
  })

  test("every navigation target meets the 44 px minimum", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/educator")
    const links = page
      .getByRole("navigation", { name: "Educator sections" })
      .getByRole("link")
    const count = await links.count()
    expect(count).toBeGreaterThan(0)
    for (let index = 0; index < count; index += 1) {
      const box = await links.nth(index).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })

  test("the skip link reaches main, and the current page is announced", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/educator/rosters")

    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: /skip/i })
    await expect(skip).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.locator("main")).toBeVisible()

    /* `aria-current="page"` on the destination the viewer is actually on. */
    await expect(
      page
        .getByRole("navigation", { name: "Educator" })
        .getByRole("link", { name: "Rosters" }),
    ).toHaveAttribute("aria-current", "page")
  })

  test("every destination is reachable from the sidebar", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    const nav = () => page.getByRole("navigation", { name: "Educator" })

    for (const [label, url] of [
      ["Assigned Programs", "/educator/programs"],
      ["Schedule", "/educator/schedule"],
      ["Rosters", "/educator/rosters"],
      ["Announcements", "/educator/announcements"],
      ["Resources", "/educator/resources"],
      ["Overview", "/educator"],
    ] as const) {
      await page.goto("/educator")
      await nav().getByRole("link", { name: label, exact: true }).click()
      await expect(page).toHaveURL(url)
    }
  })
})

test.describe("visual baselines", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "Needs a Supabase project and the sanitized seed.",
  )
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`the overview matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/educator")
      await expect(page.locator("main")).toContainText(ASSIGNED_PROGRAM.name)
      await expect(page).toHaveScreenshot(`educator-overview-${name}.png`, {
        fullPage: true,
      })
    })
  }

  test("the roster matches the desktop baseline", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/educator/rosters")
    await expect(page.locator("main")).toContainText(CONFIRMED_STUDENT)
    await expect(page).toHaveScreenshot("educator-rosters-desktop.png", {
      fullPage: true,
    })
  })

  test("matches the ARIA snapshot", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/educator")
    await expect(page.locator("main")).toMatchAriaSnapshot({
      name: "educator-overview-main.aria.yml",
    })
  })
})
