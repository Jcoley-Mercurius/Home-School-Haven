/**
 * Verifies the demo-placeholder release gate, which is the enforcement that
 * generated-child imagery cannot reach production (owner decision 2026-08-27).
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

function run(env) {
  return spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, VERCEL_ENV: "", HSH_RELEASE_TARGET: "", ...env },
  })
}

test("blocks a production build while demo placeholders are in use", () => {
  const result = run({ HSH_RELEASE_TARGET: "production" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /BUILD BLOCKED/)
})

test("blocks a Vercel production deploy the same way", () => {
  const result = run({ VERCEL_ENV: "production" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /BUILD BLOCKED/)
})

test("allows a Vercel preview deploy and says what it is using", () => {
  const result = run({ VERCEL_ENV: "preview" })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Demo build/)
})

test("allows a local build and says what it is using", () => {
  const result = run({})
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Demo build/)
})
