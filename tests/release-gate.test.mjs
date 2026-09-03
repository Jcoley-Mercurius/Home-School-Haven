/**
 * Verifies the demo-placeholder release gate, which is the enforcement that
 * generated-child imagery cannot reach production (owner decision 2026-08-27).
 *
 * The Foundation Demo Preview exception is narrow and opt-in: a Vercel *preview*
 * deploy carrying HSH_ALLOW_DEMO_PLACEHOLDERS=true, and nothing else. These
 * tests pin the whole matrix, including that the flag cannot buy a production
 * build and that an unexpected value fails closed.
 *
 * Run with: node --test tests/release-gate.test.mjs
 */
import { spawnSync } from "node:child_process"
import assert from "node:assert/strict"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SCRIPT = fileURLToPath(
  new URL("../scripts/check-demo-placeholders.mjs", import.meta.url),
)

/** Runs the gate with a cleared environment plus `env`. */
function run(env) {
  return spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL: "",
      VERCEL_ENV: "",
      HSH_RELEASE_TARGET: "",
      HSH_ALLOW_DEMO_PLACEHOLDERS: "",
      ...env,
    },
  })
}

test("production plus the demo flag still fails", () => {
  const result = run({
    VERCEL_ENV: "production",
    HSH_ALLOW_DEMO_PLACEHOLDERS: "true",
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /BUILD BLOCKED/)
  assert.match(result.stderr, /does not apply to production/)
})

test("production without the demo flag fails", () => {
  const result = run({ VERCEL_ENV: "production" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /BUILD BLOCKED/)
})

test("preview without the demo flag fails", () => {
  const result = run({ VERCEL_ENV: "preview" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /BUILD BLOCKED/)
  assert.match(result.stderr, /HSH_ALLOW_DEMO_PLACEHOLDERS is not set/)
})

test("preview with the demo flag passes and warns what the imagery is", () => {
  const result = run({
    VERCEL_ENV: "preview",
    HSH_ALLOW_DEMO_PLACEHOLDERS: "true",
  })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Demo build/)
  assert.match(result.stdout, /GENERATED ART DIRECTION/)
  assert.match(result.stdout, /not approved student\s+photography/)
})

test("HSH_RELEASE_TARGET=production fails even with the demo flag", () => {
  const result = run({
    HSH_RELEASE_TARGET: "production",
    HSH_ALLOW_DEMO_PLACEHOLDERS: "true",
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /BUILD BLOCKED/)
})

test('the demo flag must be exactly "true"', () => {
  for (const value of ["TRUE", "1", "yes", "false"]) {
    const result = run({
      VERCEL_ENV: "preview",
      HSH_ALLOW_DEMO_PLACEHOLDERS: value,
    })
    assert.equal(result.status, 1, `expected ${value} to be rejected`)
    assert.match(result.stderr, /must be exactly "true"/)
  }
})

test("an unexpected VERCEL_ENV fails even with the demo flag", () => {
  for (const value of ["development", "staging", "Production"]) {
    const result = run({
      VERCEL_ENV: value,
      HSH_ALLOW_DEMO_PLACEHOLDERS: "true",
    })
    assert.equal(result.status, 1, `expected ${value} to be rejected`)
    assert.match(result.stderr, /BUILD BLOCKED/)
  }
})

test("a Vercel build with no VERCEL_ENV fails", () => {
  const result = run({ VERCEL: "1", HSH_ALLOW_DEMO_PLACEHOLDERS: "true" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no VERCEL_ENV/)
})

test("an unrecognised HSH_RELEASE_TARGET fails", () => {
  const result = run({ HSH_RELEASE_TARGET: "prod" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /not a recognised target/)
})

test("a local build is allowed and says what it is using", () => {
  const result = run({})
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Demo build/)
  assert.match(result.stdout, /Local build/)
})
