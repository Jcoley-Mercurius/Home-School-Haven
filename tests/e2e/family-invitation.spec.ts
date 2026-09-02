import type { Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { createClient } from "@supabase/supabase-js"

import { expect, test } from "./fixtures"

/**
 * Invite-only family provisioning (MPS-REQ-011, MPS-ACC-015/016/017;
 * MDS `patterns.authentication`, `page_shells.admin_operations`).
 *
 * APPROVED PRODUCT DECISION, 2026-09-02: only an authorized administrator may
 * invite a family, there is no public self-service signup, and an invitation
 * grants the `parent` role and nothing else.
 *
 * The suite is in two halves, for the reason set out at the top of
 * `password-recovery.spec.ts`.
 *
 * **Everything that does not send an email** runs everywhere: the absence of a
 * public signup route, the gating of `/invitation/accept`, and accessibility.
 *
 * **Everything that sends an email** runs only against a local Supabase stack,
 * detected by Mailpit answering on 54324, and only when a secret key is
 * present. Provisioning against a hosted project would create real accounts and
 * send real mail through a sender limited to two messages an hour.
 *
 * The skip is loud. A skipped test must never read as a passed one.
 *
 * To run the round trip:
 *   npm run db:start
 *   # .env.local: local stack URL, publishable key, and SUPABASE_SECRET_KEY
 *   npx playwright test tests/e2e/family-invitation.spec.ts
 */
const MAILPIT = "http://127.0.0.1:54324"
const SAMPLE_PASSWORD = "SampleFoundationReview2026"
const ADMIN = "sample.admin@example.com"
const PARENT = "sample.parent.one@example.com"
const EDUCATOR = "sample.educator@example.com"

/** A password that satisfies the approved rules and is used only here. */
const INVITED_PASSWORD = "InvitedFoundation2026"

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
const SECRET_CONFIGURED = Boolean(
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** A fresh address per run, so a re-run is not a duplicate-invite test. */
function newInviteeAddress(): string {
  return `sample.invitee.${Date.now()}@example.com`
}

async function localStackIsUp(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get(`${MAILPIT}/api/v1/messages`, {
      timeout: 2_000,
    })
    return response.ok()
  } catch {
    return false
  }
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(SAMPLE_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/sign-in"))
}

/** The most recent invitation link Mailpit holds for an address. */
async function latestInviteLink(
  page: Page,
  address: string,
): Promise<string | null> {
  let messages: { ID: string }[] = []
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const list = await page.request.get(`${MAILPIT}/api/v1/search`, {
      params: { query: `to:${address}` },
    })
    messages = ((await list.json()) as { messages: { ID: string }[] }).messages
    if (messages?.length) break
    await page.waitForTimeout(500)
  }
  if (!messages?.length) return null

  const body = await page.request.get(
    `${MAILPIT}/api/v1/message/${messages[0].ID}`,
  )
  const { HTML, Text } = (await body.json()) as { HTML: string; Text: string }

  /* The email must not carry child, assistance, or enrollment detail. Asserted
     here rather than in a separate test because this is the only place the
     delivered message itself is available. */
  const delivered = `${HTML} ${Text}`.toLowerCase()
  for (const forbidden of ["student", "child", "enrollment", "assistance"]) {
    expect(
      delivered,
      `invitation email must not mention ${forbidden}`,
    ).not.toContain(forbidden)
  }

  const match = HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)
  if (!match) return null
  const href = match[1].replace(/&amp;/g, "&")

  /* Path + query only: the emailed link is absolute and built from Supabase's
     `site_url` (the `next dev` port), while this harness serves the production
     build on 3100. */
  const url = new URL(href)
  return `${url.pathname}${url.search}`
}

/**
 * A service-role client, used ONLY to set up and inspect states the application
 * deliberately refuses to create — a half-completed acceptance, an account
 * deleted behind the application's back. Never used to perform the behaviour
 * under test.
 */
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    (process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY) as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** The id of the account provisioned for an address, or null. */
async function findUserIdByEmail(
  admin: ReturnType<typeof adminClient>,
  address: string,
): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return data?.users.find((user) => user.email === address)?.id ?? null
}

/** Invite an address and complete the acceptance, leaving the parent signed in. */
async function inviteAndAccept(page: Page, address: string) {
  await signIn(page, ADMIN)
  await page.goto("/admin/families")
  await page.getByLabel("Parent or guardian email").fill(address)
  await page.getByRole("button", { name: "Send invitation" }).click()
  await expect(page.getByText("Invitation sent", { exact: true })).toBeVisible()

  const link = await latestInviteLink(page, address)
  expect(link).not.toBeNull()

  await page.context().clearCookies()
  await page.goto(link as string)
  await page.getByLabel("Password", { exact: true }).fill(INVITED_PASSWORD)
  await page.getByLabel("Confirm password").fill(INVITED_PASSWORD)
  await page.getByRole("button", { name: "Set password and continue" }).click()
  await page.waitForURL(/\/family\/setup/)
}

test.describe("public provisioning stays closed", () => {
  for (const route of ["/sign-up", "/register", "/signup"]) {
    test(`${route} does not exist`, async ({ page }) => {
      const response = await page.request.get(route, { maxRedirects: 0 })
      expect(response.status()).toBe(404)
    })
  }

  test("/invitation/accept is unreachable without an invitation session", async ({
    page,
  }) => {
    await page.goto("/invitation/accept")
    /* The shared expired-link state, which offers a route forward and
       discloses nothing about whether an invitation exists. */
    await expect(page).toHaveURL(/\/link-expired/)
  })
})

test.describe("administrator invitation surface", () => {
  test.skip(
    !SUPABASE_CONFIGURED,
    "No Supabase project configured — cross-role checks cannot run.",
  )

  test("a parent cannot reach the family operations page", async ({ page }) => {
    await signIn(page, PARENT)
    const response = await page.request.get("/admin/families", {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(404)
  })

  test("an educator cannot reach the family operations page", async ({
    page,
  }) => {
    await signIn(page, EDUCATOR)
    const response = await page.request.get("/admin/families", {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(404)
  })

  test("an administrator sees the invitation form, and it has no axe violations", async ({
    page,
  }) => {
    await signIn(page, ADMIN)
    await page.goto("/admin/families")
    await expect(
      page.getByRole("heading", { name: "Invitations" }),
    ).toBeVisible()
    await expect(page.getByLabel("Parent or guardian email")).toBeVisible()

    /* There is no role selector: an invitation grants `parent` and only
       `parent`, so a control offering anything else must not exist. */
    await expect(page.getByLabel(/role/i)).toHaveCount(0)

    await page.waitForLoadState("networkidle")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("the invitation section survives the mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, ADMIN)
    await page.goto("/admin/families")
    await expect(
      page.getByRole("heading", { name: "Invitations" }),
    ).toBeVisible()

    /* No horizontal overflow at the narrowest approved breakpoint. */
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflows).toBe(false)
  })
})

test.describe("the invitation round trip", () => {
  test.skip(
    !SUPABASE_CONFIGURED || !SECRET_CONFIGURED,
    "Needs a local Supabase project and SUPABASE_SECRET_KEY — invitation sending is not configured.",
  )

  test("an administrator invites a family, and the parent sets a password and reaches family setup", async ({
    page,
  }) => {
    test.skip(
      !(await localStackIsUp(page)),
      "No local Supabase stack (Mailpit on 54324) — refusing to provision accounts against a hosted project.",
    )

    const address = newInviteeAddress()

    await signIn(page, ADMIN)
    await page.goto("/admin/families")
    await page.getByLabel("Parent or guardian email").fill(address)
    await page.getByRole("button", { name: "Send invitation" }).click()

    await expect(
      page.getByText("Invitation sent", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("Waiting to be accepted").first()).toBeVisible()

    const link = await latestInviteLink(page, address)
    expect(link, "an invitation email reached the mailbox").not.toBeNull()

    /* A second submission of the same address resends rather than creating a
       second invitation (AGENTS.md §11 idempotency). */
    await page.getByLabel("Parent or guardian email").fill(address)
    await page.getByRole("button", { name: "Send invitation" }).click()
    await expect(
      page.getByText("A new invitation was sent", { exact: true }),
    ).toBeVisible()

    /* The first link was replaced, so it must no longer work. */
    await page.context().clearCookies()
    await page.goto(link as string)
    await expect(page).toHaveURL(/\/link-expired/)

    const newLink = await latestInviteLink(page, address)
    expect(newLink).not.toBeNull()

    await page.context().clearCookies()
    await page.goto(newLink as string)
    await expect(page).toHaveURL(/\/invitation\/accept/)
    await expect(
      page.getByRole("heading", { name: "Set your password" }),
    ).toBeVisible()

    await page.getByLabel("Password", { exact: true }).fill(INVITED_PASSWORD)
    await page.getByLabel("Confirm password").fill(INVITED_PASSWORD)
    await page
      .getByRole("button", { name: "Set password and continue" })
      .click()

    /* Family setup, not the dashboard: an invitation provisions the account and
       grants the role; the parent names their own family. */
    await page.waitForURL(/\/family\/setup/)

    /* The invitation is single use — the acceptance screen no longer offers a
       password form to the same session. */
    await page.goto("/invitation/accept")
    await expect(page).toHaveURL(/\/family/)

    /* And the administrator sees it as accepted. */
    await page.context().clearCookies()
    await signIn(page, ADMIN)
    await page.goto("/admin/families")
    await expect(page.getByText(address).first()).toBeVisible()
    await expect(page.getByText("Accepted").first()).toBeVisible()
  })

  test("an accepted invitation offers neither Resend nor Withdraw", async ({
    page,
  }) => {
    test.skip(
      !(await localStackIsUp(page)),
      "No local Supabase stack (Mailpit on 54324) — refusing to provision accounts against a hosted project.",
    )

    const address = newInviteeAddress()
    await inviteAndAccept(page, address)

    await page.context().clearCookies()
    await signIn(page, ADMIN)
    await page.goto("/admin/families")

    const row = page.locator("tr", { hasText: address })
    await expect(row.getByText("Accepted")).toBeVisible()
    /* The account exists and belongs to a family now. Withdrawing deletes the
       provisioned account, so it must not be offered — and Resend must not be
       either: that account recovers a password, it does not get re-invited. */
    await expect(row.getByRole("button", { name: "Withdraw" })).toHaveCount(0)
    await expect(row.getByRole("button", { name: "Resend" })).toHaveCount(0)
  })

  /*
   * WHY THERE IS NO "pending invitation over an established account" TEST HERE
   *
   * That state is the one `accountIsEstablished()` in
   * `src/lib/admin/invitations.ts` exists for, and it can no longer be
   * constructed. Acceptance grants the role in the same statement that marks
   * the invitation accepted, and
   * `20260902174500_family_invitation_terminal_state_guard.sql` refuses to push
   * an accepted invitation back to pending. Fabricating it would need
   * service-role writes to `user_roles`, which hold no grant for any role on
   * the local stack by design.
   *
   * So the guarantee is proved where it is reachable: the pgTAP suite proves
   * the database refuses the state transition, the test above proves the
   * controls are not offered on an accepted invitation, and
   * `tests/invitation-state.test.mts` proves the rules that decide it. The
   * application check remains as defence in depth for a state the database now
   * prevents.
   */

  test("an interrupted resend recovers instead of stranding the family", async ({
    page,
  }) => {
    test.skip(
      !(await localStackIsUp(page)),
      "No local Supabase stack (Mailpit on 54324) — refusing to provision accounts against a hosted project.",
    )

    /* The partial failure this is about: `resendInvitation` deletes the old
       account first, so an interruption between that delete and a successful
       send leaves a pending invitation whose link no longer exists. Deleting
       the account behind the application's back reproduces exactly that state.
       The invitation must survive, remain actionable, and a resend must produce
       a link that works. */
    const address = newInviteeAddress()
    await signIn(page, ADMIN)
    await page.goto("/admin/families")
    await page.getByLabel("Parent or guardian email").fill(address)
    await page.getByRole("button", { name: "Send invitation" }).click()
    await expect(
      page.getByText("Invitation sent", { exact: true }),
    ).toBeVisible()

    const admin = adminClient()
    /* Found through the Auth Admin API rather than by reading
       `family_invitations`: no client role holds a grant on that table beyond
       `authenticated`, and this setup step must not need one. */
    const userId = await findUserIdByEmail(admin, address)
    expect(userId, "the invitation provisioned an account").toBeTruthy()
    await admin.auth.admin.deleteUser(userId as string)

    await page.reload()
    const row = page.locator("tr", { hasText: address })
    /* The row is still there — history is not lost with the account. */
    await expect(row).toBeVisible()

    await row.getByRole("button", { name: "Resend" }).click()
    /* Twice in the DOM by design: the visible sentence and the screen-reader
       announcement beside it. `.first()` picks one; the other is the same
       message. */
    await expect(
      row.getByText(/previous link no longer works/).first(),
    ).toBeVisible()

    /* And the reissued link completes the round trip. */
    const link = await latestInviteLink(page, address)
    expect(link).not.toBeNull()
    await page.context().clearCookies()
    await page.goto(link as string)
    await expect(page).toHaveURL(/\/invitation\/accept/)
    await expect(
      page.getByRole("heading", { name: "Set your password" }),
    ).toBeVisible()
  })

  test("a withdrawn invitation stops working", async ({ page }) => {
    test.skip(
      !(await localStackIsUp(page)),
      "No local Supabase stack (Mailpit on 54324) — refusing to provision accounts against a hosted project.",
    )

    const address = newInviteeAddress()

    await signIn(page, ADMIN)
    await page.goto("/admin/families")
    await page.getByLabel("Parent or guardian email").fill(address)
    await page.getByRole("button", { name: "Send invitation" }).click()
    await expect(
      page.getByText("Invitation sent", { exact: true }),
    ).toBeVisible()

    const link = await latestInviteLink(page, address)
    expect(link).not.toBeNull()

    const row = page.locator("tr", { hasText: address })
    await row.getByRole("button", { name: "Withdraw" }).click()
    await expect(row.getByText("Revoked")).toBeVisible()

    /* Revoking deletes the provisioned account, so the emailed link dies with
       it rather than merely being marked. */
    await page.context().clearCookies()
    await page.goto(link as string)
    await expect(page).toHaveURL(/\/link-expired/)
  })
})
