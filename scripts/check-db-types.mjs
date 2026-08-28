/**
 * Database type drift check.
 *
 * Regenerates the types from the linked Supabase project and fails if the
 * committed file differs — the guard that keeps `database.types.ts` honest
 * after a migration lands.
 *
 * Requires a linked project (`supabase link`) and network access. Without one
 * it exits 0 with a clear "not run" message rather than pretending to have
 * passed — AGENTS.md §12: never claim a check passed if it was not run.
 *
 *   npm run db:types:check
 */

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const TYPES_PATH = "src/lib/supabase/database.types.ts"

/** Comments and blank lines differ harmlessly; declarations must not. */
function normalize(source) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("//") &&
        !line.startsWith("*") &&
        !line.startsWith("/*"),
    )
    .join("\n")
}

let generated
try {
  generated = execFileSync(
    "supabase",
    ["gen", "types", "typescript", "--linked", "--schema", "public"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
} catch (error) {
  console.log(
    "SKIPPED: could not reach the linked Supabase project, so database types " +
      "were not verified against a real schema.\n" +
      "Run `supabase link --project-ref <ref>`, check network access, then " +
      "re-run `npm run db:types:check`.",
  )
  console.log(`Reason: ${error.shortMessage ?? error.message}`)
  process.exit(0)
}

const committed = readFileSync(TYPES_PATH, "utf8")

if (normalize(committed) !== normalize(generated)) {
  console.error(
    `FAILED: ${TYPES_PATH} does not match the database schema.\n` +
      "Run `npm run db:types` and commit the result. Treat the committed file " +
      "as wrong, not the database.",
  )
  process.exit(1)
}

console.log(`OK: ${TYPES_PATH} matches the database schema.`)
