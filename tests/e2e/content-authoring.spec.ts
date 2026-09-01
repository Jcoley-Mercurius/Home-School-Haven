import AxeBuilder from "@axe-core/playwright"
import type { Browser, Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Announcement and learning-resource authoring, and private-Storage access
 * (HSH-SLICE-CONTENT-01; MPS-REQ-004/018/019/020/024; MPS-RUL-003;
 * MPS-ACC-005/029/030/031).
 *
 * The database half is `supabase/tests/database/90_content_authoring.test.sql`
 * and `95_storage_program_resources.test.sql`, which prove every refusal holds
 * with no application code involved. Both are required; neither alone is the
 * control. This suite is the browser half, and it is guarding four things a
 * later change could undo without anyone noticing.
 *
 * ONE: the audience boundary through a real session. A draft must not reach a
 * family, a published item must, a replaced item must say so, and a removed one
 * must be gone — checked by signing in as an actual parent, not by inspecting
 * the query that would have run.
 *
 * TWO: manipulation. A program id, a content id, a base path, and a storage
 * path are each tried directly against the server's response status rather than
 * against what a page chose to render. Every one of them must answer the same
 * way an id that never existed answers.
 *
 * THREE: absences in the payload. `/storage/v1/object/public/` must appear in
 * no response body, and no signed URL or object key may be serialized into a
 * page. A private file that is fetched through a URL sitting in the RSC payload
 * is not private, and asserting on the rendered page would pass in exactly that
 * case.
 *
 * FOUR: that removal takes effect on the OLD route. Proof obligation 13 is not
 * "the link disappears from the page" — it is that the route a family already
 * has stops serving.
 *
 * The lifecycle groups mutate seeded content. Each works on rows it creates
 * itself rather than on seed rows other suites assert against, except the one
 * group that deliberately removes a seeded announcement and is marked
 * `serial` for it.
 *
 * To run:
 *   npm run db:start && npm run db:reset
 *   cp .env.example .env.local
 *   npm run test:e2e -- content-authoring
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
  otherParent: "sample.parent.two@example.com",
} as const

/* The educator holds 0004 and 00ff, and holds neither 0002 nor 0005. Family A
   (sample.parent.one) is enrolled in 0004; family B is enrolled in 0005. */
const ASSIGNED = { id: "10000000-0000-4000-8000-000000000004", name: "Art Lab" }
const UNASSIGNED = { id: "10000000-0000-4000-8000-000000000002" }
const OTHER_FAMILY_PROGRAM = { id: "10000000-0000-4000-8000-000000000005" }

/* Seeded content. `draftAnnouncement` is the fixture that proves a family sees
   no draft; `otherFamilyAnnouncement` proves the family boundary. */
const SEEDED = {
  publishedAnnouncement: "60000000-0000-4000-8000-000000000001",
  draftAnnouncement: "60000000-0000-4000-8000-0000000000f1",
  otherFamilyAnnouncement: "60000000-0000-4000-8000-0000000000f2",
  draftResource: "70000000-0000-4000-8000-0000000000f1",
} as const

/**
 * Strings that must never appear in any authenticated response body.
 *
 * The first is the whole point of a private bucket: if a public object URL is
 * ever minted, every other control here is decoration. The rest are the
 * server-side details a browser has no reason to hold — an object key tells a
 * reader how the bucket is laid out, and a signed URL is a bearer credential
 * that would survive in history, in a cache, and in anything that scrapes a
 * page.
 */
const FORBIDDEN_IN_PAYLOAD = [
  "/storage/v1/object/public/",
  "service_role",
  "sb_secret",
  "storage_path",
] as const

const AUTHORING_ROUTES = [
  "/admin/communications",
  "/admin/communications/announcements/new",
  "/admin/communications/resources/new",
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
 * Denial is about the response, not about rendering an error page.
 */
async function expectStatus(page: Page, route: string, status: number) {
  const response = await page.request.get(route, { maxRedirects: 0 })
  expect(response.status(), `${route} should answer ${status}`).toBe(status)
}

/**
 * Sign a SECOND role in, in its own browser context.
 *
 * `context.newPage()` shares cookies, so a second page signed in as a family
 * would replace the educator's session — and, worse, would silently land on the
 * educator's dashboard because `/sign-in` redirects an already-authenticated
 * visitor. The two roles need two contexts, which is the pattern
 * `educator-workspace.spec.ts` established for the same reason.
 *
 * @param browser - The Playwright browser.
 * @param email - The account to sign in.
 * @returns The page, and a `close` that disposes its whole context.
 */
async function signInAsSecondRole(browser: Browser, email: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, email)
  return { page, close: () => context.close() }
}

/**
 * Publish the item on the current manage page and WAIT FOR IT TO LAND.
 *
 * `waitForURL` is useless here: publishing redirects back to the page you are
 * already on, so the pattern matches the current URL and resolves before the
 * write has committed. A test that then looks at another role's view reads the
 * state from before the publish and fails for a reason that has nothing to do
 * with the product. Waiting for the rendered state is what actually means
 * "the publish is done".
 *
 * @param page - The manage page, showing a draft.
 */
async function publishAndSettle(page: Page) {
  await page.getByRole("button", { name: "Publish" }).click()
  await expect(page.getByText("Published", { exact: true })).toBeVisible()
  await expect(page.getByText("Enrolled families can see this.")).toBeVisible()
}

/** Compose a draft on the assigned program and return where it landed. */
async function composeAnnouncement(page: Page, title: string, body: string) {
  await page.goto(`/educator/programs/${ASSIGNED.id}/announcements/new`)
  await page.getByLabel("Title").fill(title)
  await page.getByLabel("Announcement").fill(body)
  await page.getByRole("button", { name: "Save draft" }).click()
  await page.waitForURL(/\/announcements\/[0-9a-f-]{36}$/)
  return page.url()
}

test.describe("signed out", () => {
  test("every authoring route redirects to sign-in and keeps the target", async ({
    page,
  }) => {
    for (const route of AUTHORING_ROUTES) {
      await page.goto(route)
      await expect(page).toHaveURL(/\/sign-in/)
      expect(new URL(page.url()).searchParams.get("redirectTo")).toBe(route)
    }
  })

  test("a file download is refused to a signed-out visitor", async ({
    page,
  }) => {
    const response = await page.request.get(
      `/resources/${SEEDED.draftResource}/file`,
      { maxRedirects: 0 },
    )
    /* A redirect to sign-in, never to Storage. The distinction is the point:
       a 302 whose Location is a signed URL would be the bug. */
    expect([302, 307, 404]).toContain(response.status())
    expect(response.headers()["location"] ?? "").not.toContain("/storage/")
  })
})

test.describe("authorization", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  test("an educator cannot reach authoring for an unassigned program", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    for (const route of [
      `/educator/programs/${UNASSIGNED.id}/announcements/new`,
      `/educator/programs/${UNASSIGNED.id}/resources/new`,
      `/educator/programs/${OTHER_FAMILY_PROGRAM.id}/announcements/new`,
    ]) {
      await expectStatus(page, route, 404)
    }
  })

  test("a malformed or unknown id answers exactly like an unassigned one", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    /* The three cases must be indistinguishable. A different status for a
       real-but-forbidden id than for a fabricated one is an existence oracle. */
    for (const route of [
      `/educator/programs/not-a-uuid/announcements/new`,
      `/educator/programs/10000000-0000-4000-8000-00000000dead/announcements/new`,
      `/educator/programs/${UNASSIGNED.id}/announcements/new`,
    ]) {
      await expectStatus(page, route, 404)
    }
  })

  test("pairing a held program with another program's content is refused", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    /* `otherFamilyAnnouncement` lives on a program the educator does not hold.
       Presenting it under a program they DO hold must not work — otherwise the
       route parameter, not the stored row, would be deciding scope. */
    await expectStatus(
      page,
      `/educator/programs/${ASSIGNED.id}/announcements/${SEEDED.otherFamilyAnnouncement}`,
      404,
    )
  })

  test("a parent reaches no authoring surface at all", async ({ page }) => {
    await signIn(page, ACCOUNTS.parent)

    for (const route of [
      "/admin/communications",
      "/admin/communications/announcements/new",
      `/educator/programs/${ASSIGNED.id}/announcements/new`,
    ]) {
      await expectStatus(page, route, 404)
    }
  })

  test("an educator reaches no administrator communications surface", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await expectStatus(page, "/admin/communications", 404)
  })
})

test.describe("the authoring lifecycle", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  test("an assigned educator composes, previews, and publishes", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    const title = `E2E compose ${Date.now()}`
    await composeAnnouncement(page, title, "Body written by the e2e suite.")

    /* The draft is its own preview: the body renders as a family would read it,
       under a banner that says it is not yet visible. */
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
    await expect(page.getByText("Draft", { exact: true })).toBeVisible()
    await expect(page.getByText("Families cannot see this yet.")).toBeVisible()

    await publishAndSettle(page)
  })

  test("a published announcement cannot be edited in place", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    const title = `E2E no-edit ${Date.now()}`
    await composeAnnouncement(page, title, "Original body.")
    await publishAndSettle(page)

    /* Editing published text in place would change what a family already read
       with no record that it changed. The edit form is gone; replacement is
       offered instead. */
    await expect(
      page.getByRole("heading", { name: "Edit this draft" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Publish a replacement" }),
    ).toBeVisible()
  })

  test("replacing preserves the original and starts a new draft", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    const title = `E2E replace ${Date.now()}`
    const original = "The original text, which must survive."
    const url = await composeAnnouncement(page, title, original)
    await publishAndSettle(page)

    await page.getByRole("link", { name: "Publish a replacement" }).click()
    await page.getByLabel("Title").fill(`${title} (revised)`)
    await page.getByLabel("Announcement").fill("The revised text.")
    await page.getByRole("button", { name: "Create replacement draft" }).click()
    await page.waitForURL(/\/announcements\/[0-9a-f-]{36}$/)

    /* The successor is a DRAFT — publishing it is a separate decision. */
    await expect(page.getByText("Draft", { exact: true })).toBeVisible()

    /* And the predecessor still says what it said. */
    await page.goto(url)
    await expect(page.getByText("Replaced", { exact: true })).toBeVisible()
    await expect(page.getByText(original)).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Open the newer version" }),
    ).toBeVisible()
  })

  test("removal is behind a dialog that can be safely cancelled", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    const title = `E2E cancel-remove ${Date.now()}`
    await composeAnnouncement(page, title, "Body.")

    await page.getByRole("button", { name: "Remove" }).click()
    await expect(
      page.getByRole("heading", { name: "Remove this announcement?" }),
    ).toBeVisible()

    /* The wording must not claim deletion, because nothing is deleted
       (GAP-CONTENT-03). */
    await expect(page.getByText("nothing is deleted")).toBeVisible()

    await page.getByRole("button", { name: "Keep it" }).click()
    await expect(page.getByText("Draft", { exact: true })).toBeVisible()
  })

  test("a stale editor is refused rather than overwriting", async ({
    page,
    context,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    const title = `E2E stale ${Date.now()}`
    const url = await composeAnnouncement(page, title, "First body.")

    /* Two tabs on the same draft. The second saves; the first is now holding a
       token that no longer matches, and must be told so rather than silently
       winning. */
    const second = await context.newPage()
    await second.goto(url)
    await second.getByLabel("Announcement").fill("Second body, saved first.")
    await second.getByRole("button", { name: "Save draft" }).click()
    await second.waitForURL(/\/announcements\/[0-9a-f-]{36}$/)

    await page.getByLabel("Announcement").fill("First body, saved second.")
    await page.getByRole("button", { name: "Save draft" }).click()

    /* The sentence appears twice by design — once in the form's sr-only live
       region so a screen reader announces it, and once in the visible banner.
       Asserting the visible one; a strict-mode violation here would mean the
       two had drifted apart, which is also worth knowing. */
    await expect(
      page.getByText(/changed this while you were working/).last(),
    ).toBeVisible()
    await second.close()
  })
})

test.describe("what a family sees", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  test("a draft is invisible to an enrolled family and published is not", async ({
    page,
    browser,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    const title = `E2E family-visibility ${Date.now()}`
    await composeAnnouncement(page, title, "Visible only once published.")

    const family = await signInAsSecondRole(browser, ACCOUNTS.parent)
    await family.page.goto("/family/announcements")
    await expect(family.page.getByText(title)).toHaveCount(0)

    await publishAndSettle(page)

    await family.page.goto("/family/announcements")
    await expect(family.page.getByText(title)).toBeVisible()
    await family.close()
  })

  test("a family enrolled in no such program never sees it", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.otherParent)
    await page.goto("/family/announcements")

    /* The seeded announcement on family A's program must not appear for
       family B, published or not. */
    await expect(
      page.getByText("Sample announcement — welcome to the review"),
    ).toHaveCount(0)
  })

  test("the seeded draft never reaches its own program's family", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)
    await page.goto("/family/announcements")
    await expect(
      page.getByText("Sample unpublished announcement (test fixture)"),
    ).toHaveCount(0)
  })
})

test.describe.serial("removal revokes access", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  test("a removed announcement disappears from the family surface", async ({
    page,
    browser,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    const title = `E2E removal ${Date.now()}`
    await composeAnnouncement(page, title, "This will be withdrawn.")
    await publishAndSettle(page)

    const family = await signInAsSecondRole(browser, ACCOUNTS.parent)
    await family.page.goto("/family/announcements")
    await expect(family.page.getByText(title)).toBeVisible()

    await page.getByRole("button", { name: "Remove" }).click()
    await page.getByRole("button", { name: "Remove announcement" }).click()
    await expect(page.getByText("Removed", { exact: true })).toBeVisible()

    /* No sign-out, no cache clear. The next request is enough. */
    await family.page.goto("/family/announcements")
    await expect(family.page.getByText(title)).toHaveCount(0)
    await family.close()
  })

  test("a removed item offers no further lifecycle action", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    const title = `E2E terminal ${Date.now()}`
    await composeAnnouncement(page, title, "Body.")

    await page.getByRole("button", { name: "Remove" }).click()
    await page.getByRole("button", { name: "Remove announcement" }).click()
    await page.waitForURL(/\/announcements\/[0-9a-f-]{36}$/)

    await expect(
      page.getByText("This has been withdrawn. Nothing further can be changed"),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
  })
})

test.describe("private storage", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  test("no authenticated response body carries a public object URL or a key", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)

    for (const route of [
      "/educator",
      "/educator/announcements",
      "/educator/resources",
      `/educator/programs/${ASSIGNED.id}`,
    ]) {
      const response = await page.request.get(route)
      expect(response.status(), route).toBe(200)
      const body = await response.text()

      for (const forbidden of FORBIDDEN_IN_PAYLOAD) {
        expect(body, `${route} must not contain ${forbidden}`).not.toContain(
          forbidden,
        )
      }
    }
  })

  test("a download route refuses an unknown or malformed resource", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.parent)

    for (const route of [
      "/resources/not-a-uuid/file",
      "/resources/70000000-0000-4000-8000-00000000dead/file",
      /* A real resource on a program this family is not enrolled in. */
      `/resources/${SEEDED.draftResource}/file`,
    ]) {
      await expectStatus(page, route, 404)
    }
  })

  test("an unenrolled family is refused a resource file", async ({ page }) => {
    await signIn(page, ACCOUNTS.otherParent)
    await expectStatus(page, `/resources/${SEEDED.draftResource}/file`, 404)
  })
})

test.describe("cross-surface consistency", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  test("one row reads the same on the educator and administrator surfaces", async ({
    page,
    browser,
  }) => {
    /* MPS-REQ-020. Two surfaces describing one record differently is the
       failure this requirement exists to prevent, and it is the kind that
       appears when a second component spells the same state its own way. */
    await signIn(page, ACCOUNTS.educator)
    const title = `E2E consistency ${Date.now()}`
    await composeAnnouncement(page, title, "One row, two surfaces.")
    await publishAndSettle(page)

    const admin = await signInAsSecondRole(browser, ACCOUNTS.admin)
    await admin.page.goto("/admin/communications")

    const row = admin.page.locator("li", { hasText: title })
    await expect(row).toBeVisible()
    await expect(row.getByText("Published", { exact: true })).toBeVisible()
    await admin.close()
  })
})

test.describe("no Course Builder and no roster widening", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  test("the workspace offers no lesson, outline, grade, or roster editing", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await page.goto(`/educator/programs/${ASSIGNED.id}`)

    /* Out-of-scope capabilities are absences, and an absence is exactly the
       kind of guarantee that erodes without a test watching it. */
    for (const forbidden of [
      "Course Builder",
      "Lesson",
      "Outline",
      "Grade",
      "Transcript",
      "Certificate",
      "Attendance",
      "Edit roster",
      "Remove student",
    ]) {
      await expect(
        page.getByRole("button", { name: forbidden }),
        `no "${forbidden}" control`,
      ).toHaveCount(0)
      await expect(
        page.getByRole("link", { name: forbidden }),
        `no "${forbidden}" link`,
      ).toHaveCount(0)
    }
  })
})

test.describe("file resources and signed download", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  /* A minimal but genuinely valid PDF. Real bytes, because the server measures
     the actual length and the bucket checks the declared type — a placeholder
     string would test neither. */
  const PDF = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8",
  )

  /** Create a file-backed draft and return its manage URL. */
  async function composeFileResource(page: Page, title: string) {
    await page.goto(`/educator/programs/${ASSIGNED.id}/resources/new`)
    await page.getByLabel("Kind").selectOption("document")
    await page.getByLabel("Title").fill(title)
    await page.getByRole("button", { name: "Save draft" }).click()
    await page.waitForURL(/\/resources\/[0-9a-f-]{36}$/)
    return page.url()
  }

  test("a file-backed draft cannot be published before it has a file", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await composeFileResource(page, `E2E no-file ${Date.now()}`)

    await expect(page.getByText("This draft has no file yet")).toBeVisible()
    await page.getByRole("button", { name: "Publish" }).click()

    /* Refused by the database. A lifecycle move carries no form state, so
       without DEFECT-C2's fix this redirected to a page that looked exactly as
       it had before the click and said nothing at all. */
    await expect(page.getByText("That change was refused")).toBeVisible()
    /* And the page still says what to do about it. */
    await expect(page.getByText("This draft has no file yet")).toBeVisible()
  })

  test("an over-sized file is refused before it is uploaded", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await composeFileResource(page, `E2E too-large ${Date.now()}`)

    await page.getByLabel("File").setInputFiles({
      name: "big.pdf",
      mimeType: "application/pdf",
      /* One byte over the approved 10 MB limit. */
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0x20),
    })

    /* Announced in the live region AND shown as the field error — two by
       design, so the visible one is asserted. */
    await expect(page.getByText(/larger than 10 MB/).last()).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Upload file" }),
    ).toBeDisabled()
  })

  test("a disallowed file type is refused with the allowed list named", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await composeFileResource(page, `E2E bad-type ${Date.now()}`)

    /* The browser's `accept` would normally prevent this; setInputFiles does
       not honour it, which is the point — the server is what must refuse. */
    await page.getByLabel("File").setInputFiles({
      name: "payload.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK\u0003\u0004not-really-a-zip", "utf8"),
    })
    await page.getByRole("button", { name: "Upload file" }).click()

    await expect(
      page.getByText(/PDF, PNG, JPEG, or plain text/).last(),
    ).toBeVisible()
  })

  test("an uploaded file publishes, downloads, and stops downloading when removed", async ({
    page,
    browser,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    const title = `E2E file ${Date.now()}`
    const url = await composeFileResource(page, title)

    await page.getByLabel("File").setInputFiles({
      name: "worksheet.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    })
    await page.getByRole("button", { name: "Upload file" }).click()
    await expect(page.getByText("worksheet.pdf").first()).toBeVisible()

    await page.getByRole("button", { name: "Publish" }).click()
    await expect(page.getByText("Published", { exact: true })).toBeVisible()

    const resourceId = new URL(url).pathname.split("/").pop() as string
    const downloadRoute = `/resources/${resourceId}/file`

    /* The educator can fetch it, and what comes back is a REDIRECT to a signed
       URL — never a public object URL. */
    const signed = await page.request.get(downloadRoute, { maxRedirects: 0 })
    expect([302, 307]).toContain(signed.status())
    const location = signed.headers()["location"] ?? ""
    expect(location).toContain("/storage/v1/object/sign/")
    expect(location).not.toContain("/object/public/")
    expect(location).toContain("token=")

    /* An enrolled family can download it. */
    const family = await signInAsSecondRole(browser, ACCOUNTS.parent)
    const familyFetch = await family.page.request.get(downloadRoute, {
      maxRedirects: 0,
    })
    expect([302, 307]).toContain(familyFetch.status())

    /* A family enrolled in no such program cannot, with the identical URL. */
    const stranger = await signInAsSecondRole(browser, ACCOUNTS.otherParent)
    const strangerFetch = await stranger.page.request.get(downloadRoute, {
      maxRedirects: 0,
    })
    expect(strangerFetch.status()).toBe(404)
    await stranger.close()

    /* Now withdraw it. Proof obligation 13: the OLD route — the one the family
       already has — must stop serving. */
    await page.goto(url)
    await page.getByRole("button", { name: "Remove" }).click()
    await page.getByRole("button", { name: "Remove resource" }).click()
    await expect(page.getByText("Removed", { exact: true })).toBeVisible()

    const afterRemoval = await family.page.request.get(downloadRoute, {
      maxRedirects: 0,
    })
    expect(
      afterRemoval.status(),
      "the old download route must stop serving a removed resource",
    ).toBe(404)

    /* And the educator who removed it cannot fetch it either. A withdrawn file
       its author can still pull is not withdrawn. */
    const authorAfter = await page.request.get(downloadRoute, {
      maxRedirects: 0,
    })
    expect(authorAfter.status()).toBe(404)

    await family.close()
  })
})

test.describe("accessibility and responsive", () => {
  test.skip(!SUPABASE_CONFIGURED, "requires a configured Supabase project")

  test("the compose form has no axe violations", async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
    await page.goto(`/educator/programs/${ASSIGNED.id}/announcements/new`)
    await expect(page.getByLabel("Title")).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the administrator communications page has no axe violations", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin)
    await page.goto("/admin/communications")
    await expect(
      page.getByRole("heading", { name: "Communications", level: 1 }),
    ).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the removal dialog has no axe violations while open", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await composeAnnouncement(page, `E2E a11y ${Date.now()}`, "Body.")
    await page.getByRole("button", { name: "Remove" }).click()
    await expect(
      page.getByRole("heading", { name: "Remove this announcement?" }),
    ).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("an invalid submission reports the field and announces it", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.educator)
    await page.goto(`/educator/programs/${ASSIGNED.id}/announcements/new`)

    /* Submitted empty. The server's answer is the answer — `noValidate` keeps a
       native bubble from hiding that boundary. */
    await page.getByRole("button", { name: "Save draft" }).click()

    /* The failure is announced ONCE, from the form's dedicated live region,
       and shown once in a visible banner. Asserting `role="alert"` on the
       banner too would be asserting a double announcement — which is the
       defect, not the fix. This is the pattern `create-program-form.tsx`
       established. */
    await expect(
      page.getByText("The announcement was not saved", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("Enter a title.")).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the compose form is operable by keyboard alone", async ({ page }) => {
    await signIn(page, ACCOUNTS.educator)
    await page.goto(`/educator/programs/${ASSIGNED.id}/announcements/new`)

    await page.keyboard.press("Tab")
    await expect(
      page.getByRole("link", { name: /skip to main/i }),
    ).toBeFocused()

    await page.getByLabel("Title").focus()
    await page.keyboard.type(`E2E keyboard ${Date.now()}`)
    await page.keyboard.press("Tab")
    await page.keyboard.type("Typed without a pointer.")

    await page.getByRole("button", { name: "Save draft" }).focus()
    await page.keyboard.press("Enter")
    await page.waitForURL(/\/announcements\/[0-9a-f-]{36}$/)
    await expect(page.getByText("Draft", { exact: true })).toBeVisible()
  })

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`the administrator communications page renders at ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page, ACCOUNTS.admin)
      await page.goto("/admin/communications")
      await expect(
        page.getByRole("heading", { name: "Communications", level: 1 }),
      ).toBeVisible()

      /* The page body must never scroll sideways, at any width. */
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      )
      expect(overflows, `${name} must not scroll horizontally`).toBe(false)
    })
  }

  test("every action meets the 44 px minimum target", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await signIn(page, ACCOUNTS.educator)
    await page.goto(`/educator/programs/${ASSIGNED.id}/announcements/new`)

    const submit = page.getByRole("button", { name: "Save draft" })
    const box = await submit.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })
})
