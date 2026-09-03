/**
 * Program reads (MPS-REQ-008, MPS-REQ-020; MTS-ARCHITECTURE-ADDENDUM "Supabase
 * should be the single source of truth").
 *
 * Returns the existing `Program` type, so no component contract changes when a
 * page moves from the staging module to the database.
 *
 * **These reads are anonymous by design.** They use the session-less client in
 * `@/lib/supabase/anonymous`, never the cookie-bound one, for three reasons:
 *
 *   1. A public page that calls `cookies()` cannot be statically rendered.
 *      Next.js fails it with `DYNAMIC_SERVER_USAGE` when it tries — which is
 *      exactly what program detail did before this was corrected.
 *   2. A public URL should render identically for every visitor. Reading
 *      through a session makes the response viewer-dependent, which is how a
 *      cached public page ends up serving one viewer's data to everyone.
 *   3. Anonymous means these queries run under the `anon` RLS policy, so a
 *      public surface can only ever show published programs. A draft cannot
 *      reach the catalog even if a caller asks for one.
 *
 * An educator's assigned-but-unpublished programs therefore do NOT appear on
 * public program pages. They appear in `/educator`, which reads with the
 * viewer's session. Public discovery means published programs (MPS-REQ-008).
 *
 * Three states, and the difference between the last two matters:
 *
 *  1. **Configured and reachable** — rows from `public.programs`, filtered to
 *     `publication_state = 'published'` by RLS, not by this code.
 *  2. **Not configured** — the committed staging catalog in
 *     `src/content/programs.ts`. Same approved published content, and the only
 *     way the Foundation preview renders before a Supabase project exists.
 *  3. **Configured but the query failed** — `null`, which the caller renders as
 *     the approved error state. It does NOT fall back to the staging catalog:
 *     showing a cached copy of a program list while the system of record is
 *     unreachable would present stale content as current truth, which is
 *     exactly what MPS-REQ-021 forbids.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createAnonymousClient } from "@/lib/supabase/anonymous"
import {
  featuredSlugs,
  programs as stagingPrograms,
  type Program,
} from "@/content/programs"
import { mapProgramRow } from "./map-program-row"
import { reportProgramQueryFailure } from "./query-diagnostics"

/** `null` means "the system of record could not be read" — never "no programs". */
export type ProgramReadResult = Program[] | null

/* One unbroken literal on purpose: supabase-js infers the row type from the
   literal type of this string, and a concatenation widens it to `string` and
   loses that inference. */
// prettier-ignore
const SELECT_COLUMNS = "slug,name,published_dates,published_schedule,published_duration,published_session_length,published_price,published_registration_options,summary,audience,format,location,educator,enrollment_window,availability,checkout_url,import_status,source,unverified_details,image_src,image_alt,image_width,image_height,image_is_placeholder,sort_order"

export async function listPublishedPrograms(): Promise<ProgramReadResult> {
  if (!isSupabaseConfigured()) return stagingPrograms

  const supabase = createAnonymousClient()
  const { data, error, status } = await supabase
    .from("programs")
    .select(SELECT_COLUMNS)
    .order("sort_order", { ascending: true })

  /* The error object can carry query detail; only its code is safe to surface,
     and nothing here logs a value. */
  if (error || !data) {
    /* TEMPORARY — see `./query-diagnostics`. Reports why the read failed in
       credential-free fields, then returns `null` exactly as before. Remove
       this call and that module once the Preview failure is classified. */
    reportProgramQueryFailure({
      operation: "listPublishedPrograms",
      error,
      status,
      dataWasNull: !data,
    })
    return null
  }

  return data.map(mapProgramRow)
}

export async function getPublishedProgram(
  slug: string,
): Promise<Program | null | undefined> {
  if (!isSupabaseConfigured()) {
    return stagingPrograms.find((program) => program.slug === slug)
  }

  const supabase = createAnonymousClient()
  const { data, error } = await supabase
    .from("programs")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle()

  if (error) return null
  /* `undefined` = no such published program (a 404). `null` = the system of
     record could not be read (an error state). They are not the same answer. */
  if (!data) return undefined

  return mapProgramRow(data)
}

/**
 * The three programs MDS-REF-006 features on the home page, in its order.
 * A featured slug that is no longer published is dropped rather than faked.
 */
export async function listFeaturedPrograms(): Promise<ProgramReadResult> {
  const all = await listPublishedPrograms()
  if (!all) return null
  return featuredSlugs
    .map((slug) => all.find((program) => program.slug === slug))
    .filter((program): program is Program => Boolean(program))
}

/**
 * Related programs for the detail page. There is no published category, format,
 * or audience to relate on (QA-005), so this stays the next programs in
 * inventory order rather than an invented affinity — the same rule the staging
 * module documents.
 */
export async function listRelatedPrograms(
  slug: string,
  count = 3,
): Promise<Program[]> {
  const all = await listPublishedPrograms()
  if (!all || all.length === 0) return []

  const index = all.findIndex((program) => program.slug === slug)
  if (index < 0) return []

  return Array.from({ length: count }, (_, offset) => {
    return all[(index + offset + 1) % all.length]
  }).filter((program) => program.slug !== slug)
}

/**
 * Published slugs for `generateStaticParams`.
 *
 * Separate from `listPublishedPrograms` because it runs at build time, where
 * there is no request and therefore no cookie-bound client. It reads
 * anonymously, so it can only ever enumerate paths a signed-out visitor could
 * reach. An unreachable database returns an empty list rather than failing the
 * build: `dynamicParams` stays on, so those pages are simply rendered on demand
 * instead of prerendered.
 */
export async function listPublishedProgramSlugs(): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return stagingPrograms.map((program) => program.slug)
  }

  const supabase = createAnonymousClient()
  const { data, error } = await supabase
    .from("programs")
    .select("slug")
    .order("sort_order", { ascending: true })

  if (error || !data) return []

  return data.map((row) => row.slug)
}
