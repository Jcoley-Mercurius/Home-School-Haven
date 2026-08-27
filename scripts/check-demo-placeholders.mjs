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
 *   production target + demo assets present or referenced -> BUILD FAILS
 *   demo target       + demo assets                       -> allowed, announced
 *
 * The production target is detected from, in order:
 *   HSH_RELEASE_TARGET=production   (explicit, works anywhere)
 *   VERCEL_ENV=production           (set by Vercel on production deploys)
 *
 * To ship for real: replace the files per public/placeholder/README.md, then
 * delete public/placeholder/ and the `image` entries that point into it.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname
const ASSET_DIR = join(ROOT, "public", "placeholder")
const SOURCE_DIRS = [join(ROOT, "src")]
const REFERENCE = "/placeholder/"

/** Files that document the placeholders rather than being placeholders. */
const IGNORED_ASSETS = new Set(["README.md"])

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

const isProduction =
  process.env.HSH_RELEASE_TARGET === "production" ||
  process.env.VERCEL_ENV === "production"

const assets = listDemoAssets()
const references = listReferences()
const inUse = assets.length > 0 || references.length > 0

if (!inUse) {
  console.log("✓ No demo placeholder imagery present.")
  process.exit(0)
}

if (isProduction) {
  console.error(
    [
      "",
      "✗ BUILD BLOCKED — demo placeholder imagery cannot ship to production.",
      "",
      "  These assets are generated art direction depicting children who are",
      "  not real students. They are not approved photography.",
      "",
      assets.length > 0 ? `  Assets (${assets.length}):` : "",
      ...assets.map((name) => `    public/placeholder/${name}`),
      references.length > 0 ? `  Referenced from (${references.length}):` : "",
      ...references.map((hit) => `    ${hit}`),
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
    `  ${assets.length} asset(s) in public/placeholder/, ${references.length} reference(s) in src/.`,
    "  Not approved photography. Production builds are blocked while these exist.",
    "",
  ].join("\n"),
)
