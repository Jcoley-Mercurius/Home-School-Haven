import { execFileSync } from "node:child_process"

import AxeBuilder from "@axe-core/playwright"
import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Family registration (Slice 3, prompts/family-registration-ui.md; MDS
 * DESIGN-SYSTEM §9.1; DEC-026 to DEC-033).
 *
 * The database half is `supabase/tests/database/160_…`, `170_…`, and `180_…`,
 * which prove the atomic, idempotent, sample-only contract with no page
 * involved. This file proves what a parent meets: eight steps, one submission,
 * errors that land on their field, blocked outcomes that name the child and
 * program, a lost answer that retries without recording twice, and a success
 * screen that never calls anything paid or enrolled.
 *
 * FIXTURE
 *
 * Every test here writes registrations for Sample Family A. `restoreFixture`
 * deletes exactly what registration created for that family (its submissions,
 * the enrollments they made, and any child profile they created) and puts the
 * attendance rules and document versions back, before each test and after the
 * file. Nothing else in the seed is touched. It runs only against the local
 * stack (the same guard as admin-reports.spec.ts).
 *
 * Sample data only: "Sample …" names, 555-01xx numbers, placeholder health text.
 */
test.describe.configure({ mode: "serial" })

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
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
  parentNoFamily: "sample.parent.three@example.com",
  educator: "sample.educator@example.com",
} as const

const FAMILY_A = "30000000-0000-4000-8000-00000000000a"
const CROCHET = "10000000-0000-4000-8000-00000000000e"
const WAIVER_V0 = "d0000000-0000-4000-8000-000000000001"
const WAIVER_V1 = "d0000000-0000-4000-8000-0000000000f1"

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  // The first desktop width, where the review rail moves beside the form.
  laptop: { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
} as const

/* A submission evaluates every selection on a locked program row. Under a full
   sweep on one machine it can take longer than the default 5 s. */
const SUBMIT_TIMEOUT = 20_000

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

function psql(...statements: string[]) {
  execFileSync(
    "psql",
    [
      LOCAL_DB,
      "-v",
      "ON_ERROR_STOP=1",
      ...statements.flatMap((s) => ["-c", s]),
    ],
    { stdio: "pipe" },
  )
}

function query(sql: string): string {
  return execFileSync("psql", [LOCAL_DB, "-Atc", sql], {
    encoding: "utf8",
  }).trim()
}

function restoreFixture() {
  psql(
    `create temp table created as
       select rc.student_id from public.registration_children rc
       join public.registration_submissions r on r.id = rc.registration_id
       where r.family_id = '${FAMILY_A}' and rc.created_student;
     delete from public.enrollments where id in (
       select rs.enrollment_id from public.registration_selections rs
       join public.registration_submissions r on r.id = rs.registration_id
       where r.family_id = '${FAMILY_A}');
     delete from public.registration_submissions where family_id = '${FAMILY_A}';
     delete from public.students where id in (select student_id from created);`,
    // The document guard freezes retired versions, so the restore bypasses
    // triggers for this one local statement set.
    `set session_replication_role = replica;
     delete from public.registration_document_versions where id = '${WAIVER_V1}';
     update public.registration_document_versions set status = 'draft'
       where id = '${WAIVER_V0}';
     set session_replication_role = origin;`,
    `insert into public.program_attendance_rules (program_id, selection_mode)
       values ('${CROCHET}', 'fixed') on conflict do nothing;
     insert into public.program_attendance_days (program_id, day)
       values ('${CROCHET}', 'monday') on conflict do nothing;`,
  )
}

/**
 * The shared console guard, minus exactly one line: the browser's own report of
 * the connection reset that the lost-answer test injects. Any other console
 * error or page error still fails the test.
 */
const injectedFailureTest = test.extend({
  // Overrides the auto fixture of the same name; it stays automatic.
  consoleGuard: async ({ page }, runTest) => {
    const problems: string[] = []
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("net::ERR_CONNECTION_RESET")
      ) {
        problems.push(`console.error: ${message.text()}`)
      }
    })
    page.on("pageerror", (error) =>
      problems.push(`pageerror: ${error.message}`),
    )
    await runTest()
    expect(problems, "page logged errors").toEqual([])
  },
})

test.skip(!SUPABASE_CONFIGURED, "Needs the local Supabase stack.")

test.beforeEach(() => {
  if (LOCAL) restoreFixture()
})
test.afterAll(() => {
  if (LOCAL) restoreFixture()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Opens the registration and waits until React owns the form. */
async function openRegistration(page: Page, path = "/family/registration") {
  await page.goto(path)
  await page.locator("main form[data-ready=true]").waitFor()
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

const cont = (page: Page) =>
  page.getByRole("button", { name: "Continue" }).click()

const stepHeading = (page: Page) => page.locator("#reg-step-heading")

async function fillContacts(page: Page) {
  await page.getByLabel("Phone number").fill("555-0100")
  await cont(page)
  await page.getByLabel("Full name").fill("Sample Emergency Contact")
  await page.getByLabel("Relationship to your child").fill("Aunt")
  await page.getByLabel("Phone number").fill("555-0101")
  await cont(page)
  await page.getByLabel("Full name").fill("Sample Pickup Person")
  await page.getByLabel("Relationship to your child").fill("Grandparent")
  await cont(page)
  await expect(stepHeading(page)).toHaveText("Children")
}

const card = (page: Page, index: number) =>
  page.locator('[data-slot="child-card"]').nth(index)

async function answerHealth(scope: Locator, allergies: "Yes" | "No" = "No") {
  await scope
    .getByRole("radiogroup", { name: "Does this child have any allergies?" })
    .getByRole("radio", { name: allergies })
    .click()
  if (allergies === "Yes") {
    await scope
      .getByLabel(/Describe the allergies/)
      .fill("Sample allergy placeholder")
  }
  await scope
    .getByRole("radiogroup", {
      name: "Does this child have any medical needs?",
    })
    .getByRole("radio", { name: "No" })
    .click()
  await scope
    .getByRole("radiogroup", {
      name: "Does this child need any accommodations?",
    })
    .getByRole("radio", { name: "No" })
    .click()
}

/** Step 4: the existing A2 profile, then a new child with an allergy. */
async function addTwoChildren(page: Page) {
  await page.getByRole("button", { name: "Add a child" }).click()
  await card(page, 0).getByRole("radio", { name: "Sample Student A2" }).click()
  await answerHealth(card(page, 0))
  await page.getByRole("button", { name: "Add another child" }).click()
  await card(page, 1)
    .getByRole("radio", { name: "A child who is not listed here" })
    .click()
  await card(page, 1)
    .getByLabel("Preferred name")
    .fill("Sample Registration Child")
  await answerHealth(card(page, 1), "Yes")
  await cont(page)
  await expect(stepHeading(page)).toHaveText("Programs and attendance")
}

/** Step 7: accept the three documents, answer media, sign. */
async function completeDocuments(page: Page) {
  await expect(stepHeading(page)).toHaveText("Documents and permissions")
  await page
    .getByRole("checkbox", { name: /I acknowledge the Parent Handbook/ })
    .click()
  const noMedia = page.getByRole("radio", {
    name: "No, I do not give permission.",
  })
  for (let i = 0; i < (await noMedia.count()); i++) await noMedia.nth(i).click()
  await page.getByLabel(/Liability Waiver.*sign/).fill("Sample Parent One")
  await page.getByLabel(/Code of Conduct.*sign/).fill("Sample Parent One")
  await page
    .getByRole("checkbox", { name: /parent or legal guardian of each child/ })
    .click()
  await cont(page)
  await expect(stepHeading(page)).toHaveText("Review and submit")
}

/** Steps 1–7 with A2 in Sewing and a new child in Haven Days (2) + Gardening. */
async function reachReview(page: Page) {
  await openRegistration(page)
  await fillContacts(page)
  await addTwoChildren(page)
  await card(page, 0).getByRole("checkbox", { name: "Sewing" }).click()
  const second = card(page, 1)
  await second.getByRole("checkbox", { name: "Haven Days" }).click()
  await second.getByRole("radio", { name: "2 days a week" }).click()
  await second.getByRole("checkbox", { name: "Tuesday" }).click()
  await second.getByRole("checkbox", { name: "Thursday" }).click()
  await second.getByRole("checkbox", { name: "Gardening" }).click()
  await cont(page)
  await expect(stepHeading(page)).toHaveText("Checkout")
  await cont(page)
  await completeDocuments(page)
}

const submissions = () =>
  Number(
    query(
      `select count(*) from public.registration_submissions where family_id = '${FAMILY_A}'`,
    ),
  )

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

test.describe("access", () => {
  test("a signed-out visitor is sent to sign-in and back", async ({ page }) => {
    await page.goto("/family/registration")
    await expect(page).toHaveURL(
      /\/sign-in\?redirectTo=%2Ffamily%2Fregistration/,
    )
  })

  test("an educator gets a 404", async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
    await expectStatus(page, "/family/registration", 404)
  })

  test("a parent with no family is sent to setup", async ({ page }) => {
    await signIn(page, ACCOUNTS.parentNoFamily)
    await page.goto("/family/registration")
    await expect(page).toHaveURL(/\/family\/setup/)
  })

  test("the dashboard and enroll page lead here", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    await page.goto("/family")
    await page.getByRole("link", { name: "Register for Programs" }).click()
    await expect(page).toHaveURL(/\/family\/registration$/)
    await page.goto("/family/enroll/gardening")
    await page
      .getByRole("link", { name: "Use the family registration form" })
      .click()
    await expect(page).toHaveURL(/\/family\/registration\?program=gardening$/)
    await page.locator("main form[data-ready=true]").waitFor()
    await page.getByLabel("Phone number").fill("555-0100")
    await cont(page)
    await page.getByLabel("Full name").fill("Sample Emergency Contact")
    await page.getByLabel("Relationship to your child").fill("Aunt")
    await page.getByLabel("Phone number").fill("555-0101")
    await cont(page)
    await page.getByLabel("Full name").fill("Sample Pickup Person")
    await page.getByLabel("Relationship to your child").fill("Grandparent")
    await cont(page)
    await page.getByRole("button", { name: "Add a child" }).click()
    await card(page, 0)
      .getByRole("radio", { name: "Sample Student A2" })
      .click()
    await answerHealth(card(page, 0))
    await cont(page)
    // The public slug preselected Gardening for the first child.
    await expect(
      card(page, 0).getByRole("checkbox", { name: "Gardening" }),
    ).toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// The full submission
// ---------------------------------------------------------------------------

test.describe("submission", () => {
  test("two children submit atomically and show authoritative states", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await signIn(page, ACCOUNTS.parent)
    await reachReview(page)

    // Review groups, each with its own Edit action.
    for (const group of [
      "parent or guardian",
      "emergency contacts",
      "approved pickup",
      "children",
      "programs and attendance",
      "checkout",
      "documents and permissions",
    ]) {
      await expect(
        page.getByRole("button", { name: `Edit ${group}` }),
      ).toBeVisible()
    }
    await expect(page.locator("main")).toContainText(
      "Haven Days — 2 days a week: Tuesday and Thursday",
    )
    await expect(page.locator("main")).toContainText("Sewing — meets Wednesday")

    const bodies: string[] = []
    page.on("request", (request) => {
      if (request.method() === "POST") bodies.push(request.postData() ?? "")
    })
    await page.getByRole("button", { name: "Submit registration" }).click()
    await expect(
      page.getByRole("heading", { name: "Registration received" }),
    ).toBeVisible({ timeout: SUBMIT_TIMEOUT })
    await expect(
      page.getByRole("heading", { name: "Registration received" }),
    ).toBeFocused()

    // No STEP UP key or wording anywhere (DEC-033).
    expect(bodies.join("\n")).not.toMatch(/step_?up/i)
    await expect(page.locator("body")).not.toContainText(/STEP UP/i)

    // One submission, three selections, no STEP UP rows.
    expect(submissions()).toBe(1)
    expect(
      query("select count(*) from public.registration_step_up_requests"),
    ).toBe("0")
    expect(
      query(
        `select count(*) from public.registration_selections rs join public.registration_submissions r on r.id = rs.registration_id where r.family_id = '${FAMILY_A}'`,
      ),
    ).toBe("3")

    // States come from the database. Gardening is instant (started), so it
    // alone carries the checkout handoff; no link is published, so none shows.
    const main = page.locator("main")
    await expect(
      main.locator('[data-slot="enrollment-state"][data-state="confirmed"]'),
    ).toHaveCount(0)
    await expect(main.locator('[data-slot="enrollment-state"]')).toHaveCount(3)
    await expect(main).toContainText("Awaiting checkout")
    await expect(main).toContainText("Pending review")
    await expect(
      page.getByRole("heading", { name: "Checkout for Gardening" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /Checkout for (Sewing|Haven Days)/ }),
    ).toHaveCount(0)
    await expect(main).toContainText(
      "Starting checkout does not confirm payment",
    )
    await expect(main).toContainText("Registration link not published")

    // Nothing sensitive in the URL.
    expect(page.url()).toMatch(/\/family\/registration$/)
  })

  injectedFailureTest(
    "a lost answer retries with the same key and records once",
    async ({ page }) => {
      await signIn(page, ACCOUNTS.parent)
      await reachReview(page)

      // The first POST reaches the server and commits, but its answer is lost.
      let dropped = false
      await page.route("**/family/registration", async (route) => {
        if (route.request().method() === "POST" && !dropped) {
          dropped = true
          await route.fetch()
          await route.abort("connectionreset")
          return
        }
        await route.continue()
      })

      await page.getByRole("button", { name: "Submit registration" }).click()
      await expect(
        page.getByText("We could not confirm your registration"),
      ).toBeVisible()
      await expect(page.locator("main")).not.toContainText(
        "Nothing was recorded",
      )
      expect(submissions()).toBe(1)

      await page.getByRole("button", { name: "Try again" }).click()
      await expect(page.locator("main")).toContainText(
        "This registration had already been recorded. It was not recorded twice.",
      )
      expect(submissions()).toBe(1)
    },
  )

  test("a double click records one registration", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    await reachReview(page)
    await page.getByRole("button", { name: "Submit registration" }).dblclick()
    await expect(
      page.getByRole("heading", { name: "Registration received" }),
    ).toBeVisible({ timeout: SUBMIT_TIMEOUT })
    expect(submissions()).toBe(1)
  })

  test("a server refusal names the child and program and keeps every value", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await openRegistration(page)
    await fillContacts(page)
    await page.getByRole("button", { name: "Add a child" }).click()
    await card(page, 0)
      .getByRole("radio", { name: "Sample Student A2" })
      .click()
    await answerHealth(card(page, 0))
    await cont(page)
    await card(page, 0).getByRole("checkbox", { name: "Sewing" }).click()
    await cont(page)
    await cont(page)
    await completeDocuments(page)

    // The database loses Sewing's attendance rule between review and submit.
    psql(
      `delete from public.program_attendance_rules where program_id = '10000000-0000-4000-8000-000000000005';`,
    )
    try {
      await page.getByRole("button", { name: "Submit registration" }).click()
      const summary = page.locator("main").getByRole("alert").filter({
        hasText: "This registration was not submitted. Nothing was recorded.",
      })
      await expect(summary).toBeVisible()
      await expect(page.locator("#reg-error-summary-heading")).toBeFocused()
      await expect(summary).toContainText(
        "Sample Student A2, Sewing: attendance days are not set up",
      )
      expect(submissions()).toBe(0)

      // The link returns to the selection, which is unchanged.
      await summary.getByRole("link").click()
      await expect(stepHeading(page)).toHaveText("Programs and attendance")
      await expect(
        card(page, 0).getByRole("checkbox", { name: "Sewing" }),
      ).toBeChecked()
      // The form still holds every earlier value.
      await page.getByRole("button", { name: /1\. Parent or guardian/ }).click()
      await expect(page.getByLabel("Phone number")).toHaveValue("555-0100")
    } finally {
      psql(
        `insert into public.program_attendance_rules (program_id, selection_mode)
           values ('10000000-0000-4000-8000-000000000005', 'fixed') on conflict do nothing;
         insert into public.program_attendance_days (program_id, day)
           values ('10000000-0000-4000-8000-000000000005', 'wednesday') on conflict do nothing;`,
      )
    }
  })

  test("a changed document version asks for fresh acceptance", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await signIn(page, ACCOUNTS.parent)
    await reachReview(page)

    // A new waiver draft is presented after the family accepted the old one.
    psql(
      `update public.registration_document_versions set status = 'retired' where id = '${WAIVER_V0}';
       insert into public.registration_document_versions (id, document_kind, version_label, title, status)
         values ('${WAIVER_V1}', 'liability_waiver', 'sample-draft-v1', 'Sample liability waiver — draft v1, not approved', 'draft');`,
    )

    await page.getByRole("button", { name: "Submit registration" }).click()
    const summary = page.locator("main").getByRole("alert").filter({
      hasText: "This registration was not submitted",
    })
    await expect(summary).toContainText(
      "Liability Waiver: a new version, sample-draft-v1, is now presented.",
    )
    expect(submissions()).toBe(0)

    await summary.getByRole("link").click()
    await expect(stepHeading(page)).toHaveText("Documents and permissions")
    const waiver = page.getByLabel(
      /Liability Waiver \(version sample-draft-v1\)/,
    )
    await expect(waiver).toBeFocused()
    await expect(waiver).toHaveValue("")
    await expect(
      page.locator(
        '[data-slot="consent-state"][data-state="renewal_required"]',
      ),
    ).toHaveCount(1)
    // The Code of Conduct signature was not touched.
    await expect(page.getByLabel(/Code of Conduct.*sign/)).toHaveValue(
      "Sample Parent One",
    )

    await waiver.fill("Sample Parent One")
    await cont(page)
    await page.getByRole("button", { name: "Submit registration" }).click()
    await expect(
      page.getByRole("heading", { name: "Registration received" }),
    ).toBeVisible({ timeout: SUBMIT_TIMEOUT })
    expect(
      query(
        `select count(*) from public.registration_document_acceptances where document_version_id = '${WAIVER_V1}'`,
      ),
    ).toBe("1")
  })
})

// ---------------------------------------------------------------------------
// Behavior and accessibility
// ---------------------------------------------------------------------------

test.describe("form behavior", () => {
  test("step 1 is completable by keyboard, with an error summary that links to its field", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await openRegistration(page)

    await page.getByLabel("Phone number").focus()
    await page.keyboard.press("Enter") // submits the step form = Continue
    await expect(page.locator("#reg-error-summary-heading")).toBeFocused()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Your details: enter a phone number.",
    )
    const phone = page.getByLabel("Phone number")
    await expect(phone).toHaveAttribute("aria-invalid", "true")
    await expect(phone).toHaveAttribute("aria-describedby", /-error/)

    await page.keyboard.press("Tab")
    await expect(
      page.getByRole("link", { name: /enter a phone number/ }),
    ).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(phone).toBeFocused()
    await page.keyboard.type("555-0100")
    await page.keyboard.press("Enter")
    await expect(stepHeading(page)).toHaveText("Emergency contacts")
    await expect(stepHeading(page)).toBeFocused()
  })

  test("contacts add and remove with named controls", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    await openRegistration(page)
    await page.getByLabel("Phone number").fill("555-0100")
    await cont(page)
    await page
      .getByRole("button", { name: "Add another emergency contact" })
      .click()
    await expect(
      page.getByRole("heading", { name: "Emergency contact 2" }),
    ).toBeVisible()
    await expect(page.locator("[aria-live=polite]")).toHaveText(
      "Emergency contact 2 added.",
    )
    await page
      .getByRole("button", { name: "Remove emergency contact 2" })
      .click()
    await expect(
      page.getByRole("heading", { name: "Emergency contact 2" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Add another emergency contact" }),
    ).toBeFocused()
    // The only entry cannot be removed: at least one is required.
    await expect(
      page.getByRole("button", { name: /Remove emergency contact/ }),
    ).toHaveCount(0)
  })

  test("health details appear only after Yes and are kept but not sent after No", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await openRegistration(page)
    await fillContacts(page)
    await page.getByRole("button", { name: "Add a child" }).click()
    const c = card(page, 0)
    const allergies = c.getByRole("radiogroup", {
      name: "Does this child have any allergies?",
    })
    // Neither answer is preselected.
    await expect(
      allergies.getByRole("radio", { name: "Yes" }),
    ).not.toBeChecked()
    await expect(allergies.getByRole("radio", { name: "No" })).not.toBeChecked()
    const details = c.getByLabel(/Describe the allergies/)
    await expect(details).toBeHidden()
    await allergies.getByRole("radio", { name: "Yes" }).click()
    await expect(details).toBeVisible()
    await expect(page.locator("[aria-live=polite]")).toHaveText(
      "Allergy details field added below.",
    )
    await details.fill("Sample allergy placeholder")
    await allergies.getByRole("radio", { name: "No" }).click()
    await expect(details).toBeHidden()
    await allergies.getByRole("radio", { name: "Yes" }).click()
    await expect(details).toHaveValue("Sample allergy placeholder")
  })

  test("child cards collapse, count errors, and reopen from the summary", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(VIEWPORTS.mobile)
    await signIn(page, ACCOUNTS.parent)
    await openRegistration(page)
    await fillContacts(page)
    await page.getByRole("button", { name: "Add a child" }).click()
    await card(page, 0)
      .getByRole("radio", { name: "Sample Student A2" })
      .click()
    await answerHealth(card(page, 0))
    await page.getByRole("button", { name: "Add another child" }).click()
    await card(page, 1)
      .getByRole("radio", { name: "A child who is not listed here" })
      .click()
    // Leave the new child's name and health blank, then collapse the card.
    const toggle = card(page, 1).getByRole("button", {
      name: "Collapse New child",
    })
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(toggle).toHaveAttribute("aria-controls", /panel/)
    await toggle.click()
    await cont(page)
    await expect(card(page, 1)).toContainText("4 items need attention")

    await page
      .getByRole("link", {
        name: "Child 2: enter the name your child goes by.",
      })
      .click()
    await expect(
      card(page, 1).getByRole("button", { name: "Collapse New child" }),
    ).toHaveAttribute("aria-expanded", "true")
    await expect(card(page, 1).getByLabel("Preferred name")).toBeFocused()

    // Removing a child with entries asks first.
    await card(page, 1)
      .getByLabel("Preferred name")
      .fill("Sample Removable Child")
    await card(page, 1)
      .getByRole("button", { name: "Remove Sample Removable Child" })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Remove Sample Removable Child?",
    })
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole("button", { name: "Keep this child" })
      .first()
      .click()
    await expect(card(page, 1)).toBeVisible()
    await card(page, 1)
      .getByRole("button", { name: "Remove Sample Removable Child" })
      .click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove Sample Removable Child" })
      .click()
    await expect(page.locator('[data-slot="child-card"]')).toHaveCount(1)
    await expect(
      page.getByRole("button", { name: "Add another child" }),
    ).toBeFocused()
  })

  test("attendance follows each program's rule", async ({ page }) => {
    test.setTimeout(90_000)
    await signIn(page, ACCOUNTS.parent)
    await openRegistration(page)
    await fillContacts(page)
    await page.getByRole("button", { name: "Add a child" }).click()
    await card(page, 0)
      .getByRole("radio", { name: "Sample Student A2" })
      .click()
    await answerHealth(card(page, 0))
    await cont(page)
    const c = card(page, 0)

    // Fixed: read-only text, no control.
    await c.getByRole("checkbox", { name: "Ready Set Prep" }).click()
    await expect(c).toContainText(
      "Meets Tuesday and Thursday. There are no days to choose.",
    )
    await expect(
      c.getByRole("group", { name: /Which days for Ready Set Prep/ }),
    ).toHaveCount(0)

    // Haven Days: plan first, then exactly that many days.
    await c.getByRole("checkbox", { name: "Haven Days" }).click()
    await expect(
      c.getByRole("group", { name: /Which days for Haven Days/ }),
    ).toHaveCount(0)
    await c.getByRole("radio", { name: "3 days a week" }).click()
    await c
      .getByRole("group", { name: /Which days for Haven Days/ })
      .getByRole("checkbox", { name: "Tuesday" })
      .click()
    await cont(page)
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Sample Student A2, Haven Days: choose exactly 3 days.",
    )

    // Tutoring: only its configured days, and at least one.
    await c.getByRole("checkbox", { name: "Tutoring" }).click()
    const tutoringDays = c.getByRole("group", {
      name: /Which days for Tutoring/,
    })
    await expect(tutoringDays.getByRole("checkbox")).toHaveCount(3)
    await expect(
      tutoringDays.getByRole("checkbox", { name: "Monday" }),
    ).toHaveCount(0)
    await cont(page)
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Sample Student A2, Tutoring: choose at least one day.",
    )

    // A program with no rule is visibly blocked.
    psql(
      `delete from public.program_attendance_rules where program_id = '${CROCHET}';`,
    )
    await openRegistration(page)
    await fillContacts(page)
    await page.getByRole("button", { name: "Add a child" }).click()
    await card(page, 0)
      .getByRole("radio", { name: "Sample Student A2" })
      .click()
    await answerHealth(card(page, 0))
    await cont(page)
    await expect(
      card(page, 0).getByRole("checkbox", { name: "Crochet" }),
    ).toBeDisabled()
    await expect(card(page, 0)).toContainText(
      "Attendance days are not set up for this program yet",
    )
  })

  test("the page is accessible at every step and on success", async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await signIn(page, ACCOUNTS.parent)
    await openRegistration(page)
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .analyze()
      expect(results.violations, label).toEqual([])
    }
    await scan("step 1")
    await cont(page)
    await scan("step 1 with errors")
    await page.getByLabel("Phone number").fill("555-0100")
    await cont(page)
    await scan("step 2")
    await page.getByLabel("Full name").fill("Sample Emergency Contact")
    await page.getByLabel("Relationship to your child").fill("Aunt")
    await page.getByLabel("Phone number").fill("555-0101")
    await cont(page)
    await scan("step 3")
    await page.getByLabel("Full name").fill("Sample Pickup Person")
    await page.getByLabel("Relationship to your child").fill("Grandparent")
    await cont(page)
    await scan("step 4 empty")
    await addTwoChildren(page)
    await scan("step 5")
    await card(page, 0).getByRole("checkbox", { name: "Sewing" }).click()
    const second = card(page, 1)
    await second.getByRole("checkbox", { name: "Tutoring" }).click()
    await second.getByRole("checkbox", { name: "Wednesday" }).click()
    await scan("step 5 with attendance")
    await cont(page)
    await scan("step 6")
    await cont(page)
    await scan("step 7")
    await completeDocuments(page)
    await scan("step 8")
    await page.getByRole("button", { name: "Submit registration" }).click()
    await expect(
      page.getByRole("heading", { name: "Registration received" }),
    ).toBeVisible({ timeout: SUBMIT_TIMEOUT })
    await scan("success")
  })

  test("submitting is announced, busy, and still under reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await signIn(page, ACCOUNTS.parent)
    await reachReview(page)
    // Hold the action so the in-flight state can be observed.
    await page.route("**/family/registration", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((r) => setTimeout(r, 1500))
      }
      await route.continue()
    })
    await page.getByRole("button", { name: "Submit registration" }).click()
    const busy = page.getByRole("button", { name: "Submitting registration…" })
    await expect(busy).toHaveAttribute("aria-busy", "true")
    await expect(busy).toBeDisabled()
    await expect(page.locator("[aria-live=polite]")).toHaveText(
      "Submitting registration…",
    )
    const spin = await busy
      .locator("span[aria-hidden=true]")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName)
    expect(spin).toBe("none")
    await expect(
      page.getByRole("heading", { name: "Registration received" }),
    ).toBeVisible({ timeout: SUBMIT_TIMEOUT })
  })

  test("the step structure is stable", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)
    await openRegistration(page)
    await expect(page.locator("main form")).toMatchAriaSnapshot({
      name: "registration-step-1.aria.yml",
    })
    await fillContacts(page)
    await page.getByRole("button", { name: "Add a child" }).click()
    await expect(card(page, 0)).toMatchAriaSnapshot({
      name: "registration-child-card.aria.yml",
    })
  })
})

// ---------------------------------------------------------------------------
// Visual evidence
// ---------------------------------------------------------------------------

test.describe("visual", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`registration states at ${name}`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(viewport)
      await signIn(page, ACCOUNTS.parent)
      await openRegistration(page)
      const shot = (state: string) =>
        expect(page).toHaveScreenshot(`registration-${state}-${name}.png`, {
          fullPage: true,
        })

      await shot("step-1")
      await cont(page)
      await shot("error")
      await page.getByLabel("Phone number").fill("555-0100")
      await cont(page)
      await page.getByLabel("Full name").fill("Sample Emergency Contact")
      await page.getByLabel("Relationship to your child").fill("Aunt")
      await page.getByLabel("Phone number").fill("555-0101")
      await cont(page)
      await page.getByLabel("Full name").fill("Sample Pickup Person")
      await page.getByLabel("Relationship to your child").fill("Grandparent")
      await cont(page)
      await shot("children-empty")
      await addTwoChildren(page)
      await card(page, 0).getByRole("checkbox", { name: "Sewing" }).click()
      const second = card(page, 1)
      if (name === "desktop" || name === "laptop") {
        await second.getByRole("checkbox", { name: "Haven Days" }).click()
      } else {
        await second.getByRole("button", { name: /Expand/ }).click()
        await second.getByRole("checkbox", { name: "Haven Days" }).click()
      }
      await second.getByRole("radio", { name: "2 days a week" }).click()
      await second.getByRole("checkbox", { name: "Tuesday" }).click()
      await second.getByRole("checkbox", { name: "Thursday" }).click()
      await shot("programs")
      await cont(page)
      await cont(page)
      await shot("documents")
      await completeDocuments(page)
      await shot("review")
      await page.getByRole("button", { name: "Submit registration" }).click()
      await expect(
        page.getByRole("heading", { name: "Registration received" }),
      ).toBeVisible({ timeout: SUBMIT_TIMEOUT })
      await shot("success")

      // No horizontal overflow at this width.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
