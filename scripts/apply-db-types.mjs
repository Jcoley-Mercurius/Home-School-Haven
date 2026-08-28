/**
 * Installs freshly generated database types, preserving the do-not-edit header.
 *
 * `supabase gen types` writes bare output. Run by `npm run db:types` after the
 * CLI has written `database.types.ts.tmp`.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs"

const TARGET = "src/lib/supabase/database.types.ts"
const TMP = `${TARGET}.tmp`

const HEADER = `/**
 * Generated database types — DO NOT EDIT BY HAND.
 *
 * Regenerate after every migration:
 *
 *     npm run db:types          # writes this file from the linked project
 *     npm run db:types:check    # fails if this file has drifted
 *
 * \`db:types:check\` runs against the linked Supabase project and is the guard
 * that keeps this file honest. Treat any drift it reports as this file being
 * stale, not the database.
 *
 * Hand-maintained helpers over these types live in \`./types.ts\`, so this file
 * can be overwritten wholesale without losing anything.
 */

`

const generated = readFileSync(TMP, "utf8")
if (!generated.includes("export type Database")) {
  throw new Error(
    `${TMP} does not look like generated types — refusing to install it.`,
  )
}

writeFileSync(TARGET, HEADER + generated)
unlinkSync(TMP)
console.log(`OK: wrote ${TARGET}`)
