import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "./fixtures"

/**
 * Request Guidance flow (MPS-REQ-009, MPS-REQ-010; MPS-ACC-011, 012, 014;
 * DESIGN-SYSTEM.md §6 assistance-request rules).
 *
 * The central rule under test: the flow never claims a request was received
 * unless a record was actually created. No destination is configured yet, so
 * every submission must return the truthful "not sent" state, keep the
 * sender's typing, and offer the published phone path.
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
} as const

async function fill(page: import("@playwright/test").Page) {
  await page.getByLabel("Your name").fill("Sample Parent")
  await page.getByLabel("Email", { exact: true }).fill("parent@example.com")
  await page
    .getByLabel("How can we help?")
    .fill("Looking for a good fit for the fall term.")
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`has no axe violations at ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto("/guidance")
    await page.waitForLoadState("networkidle")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
    expect(results.violations).toEqual([])
  })
}

test("offers the approved request types and no direct-registration action", async ({
  page,
}) => {
  await page.goto("/guidance")
  await expect(
    page.getByRole("radio", { name: "General guidance choosing a program" }),
  ).toBeVisible()
  await expect(
    page.getByRole("radio", { name: "A visit to Home School Haven" }),
  ).toBeVisible()
  await expect(
    page.getByRole("radio", { name: "Help with the cost of a class" }),
  ).toBeVisible()

  const body = (await page.locator("body").innerText()).toLowerCase()
  expect(body).not.toContain("pay now")
  expect(await page.locator('a[href*="pay.homeschoolhaven"]').count()).toBe(0)
})

test("says up front that requests are not recorded yet", async ({ page }) => {
  await page.goto("/guidance")
  await expect(
    page.getByRole("heading", { name: "Online requests are not open yet" }),
  ).toBeVisible()
})

test("promises no outcome for a cost-assistance request", async ({ page }) => {
  await page.goto("/guidance")
  /* MPS-RUL-004: the beta records status but decides no financial outcome. */
  await expect(
    page.getByText("does not decide any discount", { exact: false }),
  ).toBeVisible()
})

test("server-side validation blocks an empty submission and explains why", async ({
  page,
}) => {
  await page.goto("/guidance")
  await page.getByRole("button", { name: "Send request" }).click()

  await expect(page.getByText("Enter your name.")).toBeVisible()
  await expect(
    page.getByText("Enter an email address we can reply to."),
  ).toBeVisible()
  await expect(
    page.getByText("Tell us a little about what you are looking for."),
  ).toBeVisible()
  await expect(
    page.getByText("Check the highlighted fields below and try again."),
  ).toBeVisible()
})

test("rejects a malformed email at the server boundary", async ({ page }) => {
  await page.goto("/guidance")
  await fill(page)
  await page.getByLabel("Email", { exact: true }).fill("not-an-address")
  await page.getByRole("button", { name: "Send request" }).click()
  await expect(
    page.getByText("Enter a valid email address", { exact: false }),
  ).toBeVisible()
})

test("a valid submission is never claimed as received, and keeps what was typed", async ({
  page,
}) => {
  await page.goto("/guidance")
  await fill(page)
  await page.getByRole("button", { name: "Send request" }).click()

  const blocked = page.locator('[data-slot="submission-blocked"]')
  await expect(blocked).toBeVisible()
  await expect(blocked).toContainText("Your request was not sent")
  await expect(blocked).toContainText("nothing was recorded")
  await expect(
    blocked.getByRole("link", { name: /239-347-9356/ }),
  ).toBeVisible()

  /* MPS-ACC-014: success is never claimed. */
  const body = (await page.locator("body").innerText()).toLowerCase()
  expect(body).not.toContain("request received")
  expect(body).not.toContain("will be in touch")

  /* MDS-QA scenario 8: entered data survives the failure. */
  await expect(page.getByLabel("Your name")).toHaveValue("Sample Parent")
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "parent@example.com",
  )
  await expect(page.getByLabel("How can we help?")).toHaveValue(
    "Looking for a good fit for the fall term.",
  )
})

test("the outcome is announced to assistive technology", async ({ page }) => {
  await page.goto("/guidance")
  await fill(page)
  await page.getByRole("button", { name: "Send request" }).click()
  await expect(page.getByRole("status")).toContainText(
    "Your request was not sent",
  )
})

test("visual baseline", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop)
  await page.goto("/guidance")
  await page.waitForLoadState("networkidle")
  await expect(page).toHaveScreenshot("guidance-desktop.png", {
    fullPage: true,
    animations: "disabled",
  })
})
