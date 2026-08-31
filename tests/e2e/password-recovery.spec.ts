import type { Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "./fixtures"

/**
 * Password recovery (MPS-REQ-011 recovery half, MPS-ACC-016, MPS-ACC-017,
 * MPS-REQ-021; MDS `patterns.authentication`).
 *
 * The suite is in two halves, and the split is deliberate.
 *
 * **Everything that does not send an email** runs everywhere: the shell, the
 * gating on `/reset-password`, the expired-link state, the open-redirect
 * refusals, accessibility, and the viewports. These are the checks that must
 * hold before any credential exists.
 *
 * **Everything that sends an email** runs only against a local Supabase stack,
 * detected by Mailpit answering on 54324. Two reasons, both real:
 *
 *  1. Reading the link back requires a mail catcher. There is no other way to
 *     complete the round trip without a mailbox.
 *  2. `.env.local` may point at a *hosted* project, where submitting this form
 *     sends a genuine email to a genuine address through a sender limited to
 *     two per hour (`[auth.rate_limit] email_sent`). A test suite must not do
 *     that, and must not burn the limit an owner may be relying on.
 *
 * The skip is loud. A skipped test must never read as a passed one.
 *
 * To run the full round trip:
 *   npm run db:start && npm run db:reset
 *   # point .env.local at the local stack's URL and publishable key
 *   npm run test:e2e
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

const MAILPIT = "http://127.0.0.1:54324"
const SAMPLE_PARENT = "sample.parent.one@example.com"
const OLD_PASSWORD = "SampleFoundationReview2026"
const NEW_PASSWORD = "RenewedFoundation2026"
/*
 * A DISTINCT password per round trip, because Supabase refuses to set a
 * password to the one already in force ("New password should be different from
 * the old password"). Three tests below each complete a real reset in order, so
 * reusing one value made the second and third silently stay on
 * /reset-password with a validation error rather than reaching /family.
 *
 * This suite runs after every suite that signs in with the seeded password
 * (alphabetically it follows admin-*, authorization, and family-*), so leaving
 * the account on a changed password harms nothing; `npm run db:reset` restores
 * it.
 */
const FIRST_RESET_PASSWORD = "FirstRecoveryRound2026"
const REUSED_LINK_PASSWORD = "UsedLinkRecovery2026"

/** True only when a local Supabase stack, with its mail catcher, is running. */
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

/**
 * Empty the catcher so the next link read back is unambiguously the new one.
 *
 * Mailpit's search does not promise newest-first, and several tests below each
 * request their own link. Reading "a" message returned an ALREADY-USED link
 * from an earlier test, which Supabase correctly refused -- the tests failed at
 * /link-expired while the code under test was behaving exactly right.
 */
async function clearMailbox(page: Page): Promise<void> {
  await page.request.delete(`${MAILPIT}/api/v1/messages`)
}

/** The most recent recovery link Mailpit holds for an address. */
async function latestRecoveryLink(
  page: Page,
  address: string,
): Promise<string | null> {
  /* Poll: the mail is delivered asynchronously, so an immediate read can find
     an empty mailbox that is about to receive the message. */
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
  const { HTML } = (await body.json()) as { HTML: string }
  const match = HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)
  if (!match) return null
  /* Mailpit stores the HTML with entities intact. */
  const href = match[1].replace(/&amp;/g, "&")

  /* Path + query only, so `page.goto` resolves it against Playwright's
     baseURL. The emailed link is absolute and built from Supabase's `site_url`
     (127.0.0.1:3000, the `next dev` port), while this harness serves the
     production build on 3100 -- following the link verbatim just hit
     ERR_CONNECTION_REFUSED. What these tests verify is the token round trip,
     not which port the mail happens to name. */
  const url = new URL(href)
  return `${url.pathname}${url.search}`
}

test.describe("/forgot-password", () => {
  test("has no axe violations", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.waitForLoadState("networkidle")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("is reachable from sign-in and carries the destination with it", async ({
    page,
  }) => {
    // A parent heading for /family who forgot their password must still land on
    // /family at the end of the detour.
    await page.goto("/sign-in?redirectTo=%2Ffamily")
    await page.getByRole("link", { name: "Forgot your password?" }).click()
    await expect(page).toHaveURL(/\/forgot-password/)
    expect(new URL(page.url()).searchParams.get("redirectTo")).toBe("/family")
    await expect(page.locator('input[name="redirectTo"]')).toHaveValue(
      "/family",
    )
  })

  test("has one h1 and validates on the server", async ({ page }) => {
    await page.goto("/forgot-password")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Forgot your password",
    )

    await page.getByRole("button", { name: "Email a reset link" }).click()
    await expect(
      page.getByText("Enter the email address for your account."),
    ).toBeVisible()
  })

  test("is keyboard operable with visible focus and a 44px target", async ({
    page,
  }) => {
    await page.goto("/forgot-password")

    const email = page.getByLabel("Email")
    await email.focus()
    await expect(email).toBeFocused()
    await expect(email).toHaveCSS("outline-style", /solid|auto/)

    await page.keyboard.press("Tab")
    const submit = page.getByRole("button", { name: "Email a reset link" })
    await expect(submit).toBeFocused()
    expect((await submit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test("refuses an off-site destination", async ({ page }) => {
    // An open redirect on a recovery surface would put our domain in front of
    // someone else's password form.
    for (const hostile of [
      "https://example.com/steal",
      "//example.com/steal",
      "/\\example.com/steal",
    ]) {
      await page.goto(
        `/forgot-password?redirectTo=${encodeURIComponent(hostile)}`,
      )
      await expect(page.locator('input[name="redirectTo"]')).toHaveValue(
        "/account",
      )
    }
  })
})

test.describe("/reset-password gating", () => {
  test("is unreachable without a verified recovery link", async ({ page }) => {
    // No marker cookie: this is someone typing the URL, not someone arriving
    // from an emailed link.
    await page.goto("/reset-password")
    await expect(page).toHaveURL(/\/link-expired/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "That link has expired",
    )
  })

  test("a tampered token does not establish a session", async ({ page }) => {
    await page.goto(
      "/auth/confirm?token_hash=not-a-real-token&type=recovery&next=%2Ffamily",
    )
    await expect(page).toHaveURL(/\/link-expired/)

    // And nothing was signed in as a side effect.
    await page.goto("/family")
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test("a link type outside the allow-list is refused", async ({ page }) => {
    // `magiclink` would be a password-free sign-in this release does not offer.
    await page.goto("/auth/confirm?token_hash=whatever&type=magiclink")
    await expect(page).toHaveURL(/\/link-expired/)
  })

  test("an off-site `next` cannot be smuggled through the callback", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/auth/confirm?token_hash=x&type=recovery&next=https%3A%2F%2Fexample.com%2Fsteal",
      { maxRedirects: 0 },
    )
    const location = response.headers()["location"] ?? ""
    expect(location).not.toContain("example.com")
  })
})

test.describe("/link-expired", () => {
  test("has no axe violations and offers a way forward", async ({ page }) => {
    await page.goto("/link-expired?reason=expired")
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])

    // An expired link is a detour, not a dead end (MPS-REQ-021).
    await expect(
      page.getByRole("link", { name: "Send me a new link" }),
    ).toBeVisible()
    await expect(
      page.getByText("your existing password still works", { exact: false }),
    ).toBeVisible()
  })

  test("does not say which failure it was", async ({ page }) => {
    // Expired, already used, and tampered with are one outcome to the person
    // holding the link. Distinguishing them tells a prober which guess was
    // closest.
    await page.goto("/link-expired?reason=expired")
    const body = await page.locator("body").innerText()
    expect(body).not.toMatch(/already been used and/i)
    expect(body).not.toMatch(/invalid token|signature|tampered/i)
  })
})

test.describe("recovery round trip", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !(await localStackIsUp(page)),
      "No local Supabase stack detected on 54324. These tests send real " +
        "recovery emails and read them back from Mailpit; running them " +
        "against a hosted project would email a real address and burn a " +
        "2-per-hour send limit. See the header of this file.",
    )
  })

  test("a parent recovers a password and lands where they were going", async ({
    page,
  }) => {
    await page.goto("/sign-in?redirectTo=%2Ffamily")
    /* Before anything is typed: an await between filling the field
       and submitting let a re-render clear the input. */
    await clearMailbox(page)
    await page.getByRole("link", { name: "Forgot your password?" }).click()
    await page.getByLabel("Email").fill(SAMPLE_PARENT)
    await page.getByRole("button", { name: "Email a reset link" }).click()
    /* By role: the confirmation is rendered twice on purpose -- once as the
       visible heading and once in an sr-only live region so it is announced --
       and an unscoped text locator matches both under strict mode. */
    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible()

    const link = await latestRecoveryLink(page, SAMPLE_PARENT)
    expect(link, "a recovery email should have arrived").not.toBeNull()

    await page.goto(link!)
    await expect(page).toHaveURL(/\/reset-password/)
    // The token must not survive into the address bar of a rendered page.
    expect(page.url()).not.toContain("token_hash")

    await page
      .getByLabel("New password", { exact: true })
      .fill(FIRST_RESET_PASSWORD)
    await page.getByLabel("Confirm new password").fill(FIRST_RESET_PASSWORD)
    await page.getByRole("button", { name: "Save new password" }).click()

    // Server-derived role routing, not a form field.
    await expect(page).toHaveURL(/\/family$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Family Overview",
    )
  })

  test("the new password works and the old one does not", async ({ page }) => {
    // Ordering note: this depends on the reset above, so it re-runs the reset
    // rather than assuming a shared session.
    await page.goto("/forgot-password")
    /* Before anything is typed: an await between filling the field
       and submitting let a re-render clear the input. */
    await clearMailbox(page)
    await page.getByLabel("Email").fill(SAMPLE_PARENT)
    await page.getByRole("button", { name: "Email a reset link" }).click()
    const link = await latestRecoveryLink(page, SAMPLE_PARENT)
    await page.goto(link!)
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD)
    await page.getByLabel("Confirm new password").fill(NEW_PASSWORD)
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page).toHaveURL(/\/family$/)

    await page.getByRole("button", { name: "Sign Out" }).click()
    await page.waitForURL("**/")

    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(SAMPLE_PARENT)
    await page.getByLabel("Password").fill(OLD_PASSWORD)
    await page.getByRole("button", { name: "Sign In" }).click()
    /* `exact`: the refusal is rendered twice on purpose -- once in an sr-only
       live region so it is announced, and once as visible body copy that adds a
       "Please check both and try again." A substring matches both and trips
       strict mode. This asserts the announced form. */
    await expect(
      page.getByText("That email and password did not match an account.", {
        exact: true,
      }),
    ).toBeVisible()

    await page.getByLabel("Password").fill(NEW_PASSWORD)
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page).toHaveURL(/\/family$/)
  })

  test("a used link cannot be used again", async ({ page }) => {
    await page.goto("/forgot-password")
    /* Before anything is typed: an await between filling the field
       and submitting let a re-render clear the input. */
    await clearMailbox(page)
    await page.getByLabel("Email").fill(SAMPLE_PARENT)
    await page.getByRole("button", { name: "Email a reset link" }).click()
    const link = await latestRecoveryLink(page, SAMPLE_PARENT)

    await page.goto(link!)
    await expect(page).toHaveURL(/\/reset-password/)
    await page
      .getByLabel("New password", { exact: true })
      .fill(REUSED_LINK_PASSWORD)
    await page.getByLabel("Confirm new password").fill(REUSED_LINK_PASSWORD)
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page).toHaveURL(/\/family$/)

    await page.goto(link!)
    await expect(page).toHaveURL(/\/link-expired/)
  })

  test("an unknown address gets the identical confirmation", async ({
    page,
  }) => {
    // MPS-ACC-016: a recovery path is offered without confirming whether an
    // account exists. The two panels must be indistinguishable, so they are
    // compared as text rather than eyeballed.
    await page.goto("/forgot-password")
    await page.getByLabel("Email").fill(SAMPLE_PARENT)
    await page.getByRole("button", { name: "Email a reset link" }).click()
    const known = await page.locator('[data-slot="recovery-sent"]').innerText()

    await page.goto("/forgot-password")
    await page.getByLabel("Email").fill("nobody@example.invalid")
    await page.getByRole("button", { name: "Email a reset link" }).click()
    const unknown = await page
      .locator('[data-slot="recovery-sent"]')
      .innerText()

    expect(unknown).toBe(known)
  })

  test("password rules are enforced and never echoed back", async ({
    page,
  }) => {
    await page.goto("/forgot-password")
    /* Before anything is typed: an await between filling the field
       and submitting let a re-render clear the input. */
    await clearMailbox(page)
    await page.getByLabel("Email").fill(SAMPLE_PARENT)
    await page.getByRole("button", { name: "Email a reset link" }).click()
    const link = await latestRecoveryLink(page, SAMPLE_PARENT)
    await page.goto(link!)

    // Mirrors `supabase/config.toml`: 12 characters, mixed case, a digit.
    await page.getByLabel("New password", { exact: true }).fill("short1A")
    await page.getByLabel("Confirm new password").fill("short1A")
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page.getByText("Use at least 12 characters.")).toBeVisible()
    await expect(page.locator("body")).not.toContainText("short1A")

    await page.getByLabel("New password", { exact: true }).fill("alllowercase1")
    await page.getByLabel("Confirm new password").fill("alllowercase1")
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(
      page.getByText("Include at least one uppercase letter."),
    ).toBeVisible()

    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD)
    await page.getByLabel("Confirm new password").fill("DifferentValue2026")
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page.getByText("Both passwords must match.")).toBeVisible()
  })
})

/**
 * ⚠️ NEW BASELINES AWAITING OWNER REVIEW — not a comparison against an approved
 * reference.
 *
 * `mds/references/REFERENCE-INDEX.md` carries no canonical image for any
 * authentication screen, so these three inherit the gap already recorded for
 * sign-in. They are built from the written MDS specification, which outranks
 * visual inference (AGENTS.md §7). These snapshots pin them against unintended
 * drift; they do not constitute MDS approval.
 */
test.describe("visual (unapproved baseline)", () => {
  const PAGES = {
    "forgot-password": "/forgot-password",
    "link-expired": "/link-expired?reason=expired",
  } as const

  for (const [name, path] of Object.entries(PAGES)) {
    for (const [viewport, size] of Object.entries(VIEWPORTS)) {
      test(`${name} matches the ${viewport} baseline`, async ({ page }) => {
        await page.setViewportSize(size)
        await page.goto(path)
        await page.evaluate(() => document.fonts.ready)
        await expect(page).toHaveScreenshot(`${name}-${viewport}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
          animations: "disabled",
        })
      })
    }

    test(`${name} keeps the 440px panel and 16px mobile gutter`, async ({
      page,
    }) => {
      // MDS page_shells.authentication: "Centered 440px account panel";
      // responsive_behavior: "Full-width panel with 16px gutter".
      await page.setViewportSize(VIEWPORTS.desktop)
      await page.goto(path)
      const desktop = await page.locator("main > div").boundingBox()
      expect(desktop?.width ?? 0).toBeLessThanOrEqual(440)

      await page.setViewportSize(VIEWPORTS.mobile)
      await page.goto(path)
      const mobile = await page.locator("main > div").boundingBox()
      expect(mobile?.x ?? 0).toBeGreaterThanOrEqual(16)
    })
  }
})
