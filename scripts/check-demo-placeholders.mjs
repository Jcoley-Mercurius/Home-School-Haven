#!/usr/bin/env node
/**
 * Release gate — demo placeholder imagery must never reach production.
 *
 * `public/placeholder/` holds generated art direction cropped from MDS-REF-006.
 * It depicts children who are not real students and is not approved photography
 * (AGENTS.md §7, DESIGN-SYSTEM.md §5, DO-DONT.md). README and footer warnings
 * are advisory; this gate is the enforcement.
 *
 * Runs automatically before every build via the `prebuild` script.
 *
 * The Foundation Demo Preview needs to build *with* the placeholders while
 * Samantha reviews layout, so there is exactly one exception, and it is opt-in:
 *
 *   VERCEL_ENV=production, with or without the flag  -> BUILD FAILS
 *   VERCEL_ENV=preview  + HSH_ALLOW_DEMO_PLACEHOLDERS=true -> allowed, announced
 *   VERCEL_ENV=preview  without the flag             -> BUILD FAILS
 *   any other / missing VERCEL_ENV on Vercel         -> BUILD FAILS
 *   not running on Vercel (local build)              -> allowed, announced
 *
 * The production check runs first and has no escape: the flag can never
 * override it. The flag must be the exact string `true` — `TRUE`, `1`, and
 * `yes` do not count, so a fat-fingered Vercel value fails closed rather than
 * silently shipping demo art.
 *
 * `HSH_RELEASE_TARGET=production` also fails, anywhere, matching
 * `releaseTarget()` in src/lib/env.ts; an unexpected value there fails too.
 * `demo` is recognised (the Foundation Demo Preview marks itself that way so
 * public pages read at request time) but grants nothing on its own.
 *
 * To ship for real: replace the files per public/placeholder/README.md, then
 * delete public/placeholder/ and the `image` entries that point into it.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const ASSET_DIR = join(ROOT, "public", "placeholder")
const SOURCE_DIRS = [join(ROOT, "src")]
const REFERENCE = "/placeholder/"

/** Files that document the placeholders rather than being placeholders. */
const IGNORED_ASSETS = new Set(["README.md"])

/** The only value of the demo flag that means "yes". */
const ALLOW_FLAG = "HSH_ALLOW_DEMO_PLACEHOLDERS"

function listDemoAssets() {
  try {
    return readdirSync(ASSET_DIR).filter((name) => !IGNORED_ASSETS.has(name))
  } catch (error) {
    if (error.code === "ENOENT") return []
    throw error
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx|js|jsx|mjs|css)$/.test(full)) yield full
  }
}

function listReferences() {
  const hits = []
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(dir)) {
      const lines = readFileSync(file, "utf8").split("\n")
      lines.forEach((line, index) => {
        // Ignore prose in comments; only flag real string references.
        if (line.includes(REFERENCE) && !line.trimStart().startsWith("*")) {
          hits.push(`${relative(ROOT, file)}:${index + 1}`)
        }
      })
    }
  }
  return hits
}

/** An unset variable and one set to the empty string mean the same thing here. */
function read(name) {
  const value = process.env[name]
  return value === undefined || value === "" ? null : value
}

/**
 * Decides whether this build may use demo placeholder imagery.
 *
 * @returns `{ allowed, reason }` — `reason` explains the decision either way.
 */
function decide() {
  const vercelEnv = read("VERCEL_ENV")
  const releaseTarget = read("HSH_RELEASE_TARGET")
  const flag = read(ALLOW_FLAG)
  const onVercel = vercelEnv !== null || read("VERCEL") !== null

  // Production first, and with no escape hatch. The flag is not consulted.
  if (vercelEnv === "production" || releaseTarget === "production") {
    return {
      allowed: false,
      reason:
        vercelEnv === "production"
          ? "VERCEL_ENV=production. The demo flag does not apply to production."
          : "HSH_RELEASE_TARGET=production. The demo flag does not apply to production.",
    }
  }

  /* An unrecognised explicit target is a typo, not a permission. `demo` is
     recognised for the temporary Foundation Demo Preview, which marks itself
     that way so public pages read at request time; it grants nothing here, and
     the production check above has already run regardless of its value. */
  if (
    releaseTarget !== null &&
    !["local", "preview", "demo"].includes(releaseTarget)
  ) {
    return {
      allowed: false,
      reason: `HSH_RELEASE_TARGET=${releaseTarget} is not a recognised target (local | preview | demo | production).`,
    }
  }

  if (!onVercel) {
    return { allowed: true, reason: "Local build — not a deployment." }
  }

  if (vercelEnv !== "preview") {
    return {
      allowed: false,
      reason:
        vercelEnv === null
          ? "Running on Vercel with no VERCEL_ENV. Only a preview deploy may use demo imagery."
          : `VERCEL_ENV=${vercelEnv} is not a preview deploy. Only a preview deploy may use demo imagery.`,
    }
  }

  if (flag !== "true") {
    return {
      allowed: false,
      reason:
        flag === null
          ? `VERCEL_ENV=preview but ${ALLOW_FLAG} is not set.`
          : `VERCEL_ENV=preview but ${ALLOW_FLAG}=${flag} — it must be exactly "true".`,
    }
  }

  return {
    allowed: true,
    reason: `VERCEL_ENV=preview with ${ALLOW_FLAG}=true — Foundation Demo Preview exception.`,
  }
}

const assets = listDemoAssets()
const references = listReferences()
const inUse = assets.length > 0 || references.length > 0

if (!inUse) {
  console.log("✓ No demo placeholder imagery present.")
  process.exit(0)
}

const { allowed, reason } = decide()

if (!allowed) {
  console.error(
    [
      "",
      "✗ BUILD BLOCKED — demo placeholder imagery cannot ship in this environment.",
      "",
      `  ${reason}`,
      "",
      "  These assets are generated art direction depicting children who are",
      "  not real students. They are not approved photography.",
      "",
      assets.length > 0 ? `  Assets (${assets.length}):` : "",
      ...assets.map((name) => `    public/placeholder/${name}`),
      references.length > 0 ? `  Referenced from (${references.length}):` : "",
      ...references.map((hit) => `    ${hit}`),
      "",
      "  The Foundation Demo Preview may build with this imagery only on a",
      `  Vercel Preview deployment with ${ALLOW_FLAG}=true.`,
      "  A production deploy is never exempt, flag or no flag.",
      "",
      "  To ship: follow public/placeholder/README.md to swap in released",
      "  photography, then remove public/placeholder/ entirely.",
      "",
      "  This gate is intentional. Do not bypass it to get a deploy out.",
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  )
  process.exit(1)
}

console.log(
  [
    "",
    "⚠ Demo build — using placeholder imagery.",
    `  ${reason}`,
    `  ${assets.length} asset(s) in public/placeholder/, ${references.length} reference(s) in src/.`,
    "",
    "  This imagery is GENERATED ART DIRECTION, not approved student",
    "  photography. The children shown are not real students. It is authorized",
    "  for private Foundation Review of layout only (owner decision 2026-08-27).",
    "  Production builds stay blocked while these files exist.",
    "",
  ].join("\n"),
)
