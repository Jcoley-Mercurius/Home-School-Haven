import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "./fixtures"

/**
 * Sign-in surface (MDS `patterns.authentication`; MTS "Identity").
 *
 * These run without a Supabase project: they pin the shell, accessibility, and
 * the unconfigured state, all of which must be right before credentials exist.
 * The credentialed flows live in `authorization.spec.ts`.
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

test.describe("/sign-in", () => {
  test("has no axe violations", async ({ page }) => {
    await page.goto("/sign-in")
    await page.waitForLoadState("networkidle")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test("has one h1 and states that accounts are provisioned", async ({
    page,
  }) => {
    await page.goto("/sign-in")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Sign in to your account",
    )
    // A parent must not go looking for a student login that does not exist
    // (ACT-002, MPS OOS-BETA-001).
    await expect(
      page.getByText("students do not have their own logins", {
        exact: false,
      }),
    ).toBeVisible()
  })

  test("is fully keyboard operable with visible focus", async ({ page }) => {
    await page.goto("/sign-in")

    const email = page.getByLabel("Email")
    await email.focus()
    await expect(email).toBeFocused()
    // Visible focus is required at WCAG 2.2 AA.
    await expect(email).toHaveCSS("outline-style", /solid|auto/)

    await page.keyboard.press("Tab")
    await expect(page.getByLabel("Password")).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "Sign In" })).toBeFocused()
  })

  test("meets the 44px minimum target size on the submit action", async ({
    page,
  }) => {
    await page.goto("/sign-in")
    const box = await page
      .getByRole("button", { name: "Sign In" })
      .boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test("validates on the server and never echoes the password back", async ({
    page,
  }) => {
    await page.goto("/sign-in")
    await page.getByRole("button", { name: "Sign In" }).click()

    await expect(
      page.getByText("Enter the email address for your account."),
    ).toBeVisible()
    await expect(page.getByText("Enter your password.")).toBeVisible()

    // A submitted password must never come back in the HTML.
    await page.getByLabel("Email").fill("someone@example.com")
    await page.getByLabel("Password").fill("hunter2-should-not-echo")
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page.locator("body")).not.toContainText(
      "hunter2-should-not-echo",
    )
    await expect(page.getByLabel("Password")).toHaveValue("")
  })

  test("says nothing was sent when no project is configured", async ({
    page,
  }) => {
    test.skip(
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      "A Supabase project is configured; the unavailable state cannot occur.",
    )

    await page.goto("/sign-in")
    await page.getByLabel("Email").fill("someone@example.com")
    await page.getByLabel("Password").fill("a-password-value")
    await page.getByRole("button", { name: "Sign In" }).click()

    await expect(page.getByText("You were not signed in")).toBeVisible()
    await expect(
      page.getByText("Nothing you typed was sent anywhere.", { exact: false }),
    ).toBeVisible()
  })
})

/**
 * ⚠️ NEW BASELINES AWAITING OWNER REVIEW — not a comparison against an approved
 * reference.
 *
 * `mds/references/REFERENCE-INDEX.md` carries canonical images for the
 * homepage, family dashboard, educator workspace, and administrator operations,
 * but none for the authentication screen. The screen is built from the written
 * MDS specification (`page_shells.authentication`, `patterns.authentication`),
 * which outranks visual inference — but nothing here proves it matches an
 * approved design, because no approved design image exists yet.
 *
 * These snapshots pin the screen against unintended drift. They do not
 * constitute MDS approval. Recorded as an MDS reference gap.
 */
test.describe("visual (unapproved baseline)", () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`sign-in matches the ${name} baseline`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/sign-in")
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(`sign-in-${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: "disabled",
      })
    })
  }

  test("the account panel is the approved 440px maximum", async ({ page }) => {
    // MDS page_shells.authentication: "Centered 440px account panel".
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto("/sign-in")
    const panel = page.locator("main > div")
    const box = await panel.boundingBox()
    expect(box?.width ?? 0).toBeLessThanOrEqual(440)
  })

  test("the panel keeps a 16px gutter at mobile", async ({ page }) => {
    // MDS responsive_behavior: "Full-width panel with 16px gutter".
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto("/sign-in")
    const box = await page.locator("main > div").boundingBox()
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(16)
  })
})
