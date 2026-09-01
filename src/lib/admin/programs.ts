/**
 * Authorized administrator program reads and writes (MPS-REQ-016, MPS-REQ-020,
 * MPS-RUL-005).
 *
 * WHERE THE BOUNDARY IS
 *
 * Reads use the cookie-bound client and carry no `.eq()` on an owner column:
 * `programs_select_admin` returns every publication state to an administrator,
 * `programs_select_published_*` returns only published rows to everyone else,
 * and `programs_select_assigned_educator` returns an educator's own. The same
 * function called by a parent therefore returns the public catalog, not a
 * refusal — which is the boundary working rather than a filter we could forget.
 * The page's `requireAdmin()` guard is the second, independent control.
 *
 * Writes do not touch the table at all. `authenticated` no longer holds INSERT,
 * UPDATE, or DELETE on `public.programs` (migration
 * `20260830090000_admin_program_enrollment_operations.sql`), so the three RPCs
 * below are the only write path in existence, and each performs its own
 * administrator check, transition rule, and staleness test inside one
 * statement. A forged PostgREST request has nothing to reach.
 *
 * There is no service-role client here. RLS is genuinely in force rather than
 * bypassed with a privileged key and re-checked in application code.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { AdminRead, PublicationState } from "@/lib/admin/repository"
import type { Enums } from "@/lib/supabase/types"

type Availability = Enums<"availability_state">

/**
 * A program as the operations surfaces show it.
 *
 * `updatedAt` is carried into every edit form as the concurrency token, so the
 * database can refuse a write made against a version of the row that has since
 * moved.
 */
type AdminProgram = {
  id: string
  slug: string
  name: string
  summary: string | null
  audience: string | null
  format: string | null
  location: string | null
  educator: string | null
  publishedDates: string | null
  publishedSchedule: string | null
  publishedDuration: string | null
  publishedSessionLength: string | null
  publishedPrice: string | null
  availability: Availability
  publicationState: PublicationState
  /** The published external checkout link, or `null` when none is set. */
  checkoutUrl: string | null
  /**
   * Established capacity, or `null` when Home School Haven has not set one
   * (MPS-RUL-002, MPS-FEA-012). `null` is rendered as words, never as a zero:
   * "not established" and "no places" are different claims, and the real
   * per-program numbers remain unconfirmed (checklist §1, GAP-ADMIN-004).
   */
  capacity: number | null
  /** Whether this program accepts waitlist placements (MPS-ACC-020). */
  waitlistEnabled: boolean
  educatorAssigned: boolean
  needsContentReview: boolean
  updatedAt: string
}

/* One unbroken string literal: PostgREST infers the row type from the literal,
   and a concatenation degrades every column to `GenericStringError`. */
// prettier-ignore
const SELECT_COLUMNS = "id,slug,name,summary,audience,format,location,educator,published_dates,published_schedule,published_duration,published_session_length,published_price,availability,publication_state,checkout_url,capacity,waitlist_enabled,import_status,updated_at"

type ProgramRow = {
  id: string
  slug: string
  name: string
  summary: string | null
  audience: string | null
  format: string | null
  location: string | null
  educator: string | null
  published_dates: string | null
  published_schedule: string | null
  published_duration: string | null
  published_session_length: string | null
  published_price: string | null
  availability: Availability
  publication_state: PublicationState
  checkout_url: string | null
  capacity: number | null
  waitlist_enabled: boolean
  import_status: string
  updated_at: string
}

/**
 * Shape one row for the operations surfaces.
 * @param row - The database row.
 * @param assignedProgramIds - Programs that have an educator assignment.
 * @returns The mapped program.
 */
function mapRow(
  row: ProgramRow,
  assignedProgramIds: Set<string>,
): AdminProgram {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    audience: row.audience,
    format: row.format,
    location: row.location,
    educator: row.educator,
    publishedDates: row.published_dates,
    publishedSchedule: row.published_schedule,
    publishedDuration: row.published_duration,
    publishedSessionLength: row.published_session_length,
    publishedPrice: row.published_price,
    availability: row.availability,
    publicationState: row.publication_state,
    checkoutUrl: row.checkout_url,
    capacity: row.capacity,
    waitlistEnabled: row.waitlist_enabled,
    educatorAssigned: assignedProgramIds.has(row.id),
    needsContentReview: row.import_status === "import-title-review-detail",
    updatedAt: row.updated_at,
  }
}

/**
 * Every program the viewer is authorized to see, in inventory order.
 *
 * Filtering happens in the caller, over this already-authorized list, rather
 * than in the query. The catalog is small, and a filter that never reaches a
 * query cannot narrow it in a way that accidentally widens what RLS returned.
 *
 * @returns The programs, or a state explaining why not.
 */
async function listAdminPrograms(): Promise<AdminRead<AdminProgram[]>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const [programRows, assignmentRows] = await Promise.all([
    supabase.from("programs").select(SELECT_COLUMNS).order("sort_order"),
    supabase.from("educator_assignments").select("program_id"),
  ])

  if (programRows.error || assignmentRows.error) return { status: "failed" }

  const assigned = new Set(
    (assignmentRows.data ?? []).map((row) => row.program_id),
  )

  return {
    status: "ready",
    data: (programRows.data ?? []).map((row) => mapRow(row, assigned)),
  }
}

/**
 * One program by id.
 *
 * The id comes from the route, which means it comes from the browser. That is
 * safe because nothing here trusts it: RLS decides whether the row is
 * returnable at all, so a well-formed id belonging to a program this viewer may
 * not see returns `notFound` — the same answer as an id that never existed. The
 * caller must not distinguish them either.
 *
 * @param programId - The program's UUID.
 * @returns The program, `notFound`, or a state explaining why not.
 */
async function getAdminProgram(
  programId: string,
): Promise<AdminRead<AdminProgram> | { status: "notFound" }> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const [programRow, assignmentRows] = await Promise.all([
    supabase
      .from("programs")
      .select(SELECT_COLUMNS)
      .eq("id", programId)
      .maybeSingle(),
    supabase.from("educator_assignments").select("program_id"),
  ])

  if (programRow.error || assignmentRows.error) return { status: "failed" }
  if (!programRow.data) return { status: "notFound" }

  const assigned = new Set(
    (assignmentRows.data ?? []).map((row) => row.program_id),
  )

  return { status: "ready", data: mapRow(programRow.data, assigned) }
}

/**
 * Why a write did not happen, in terms the UI can act on.
 *
 * `forbidden` and `notFound` are deliberately different values internally and
 * deliberately rendered the same way to the viewer: an administrator sees a
 * neutral "no longer available", so the response never confirms that a record
 * exists to someone who may not see it.
 */
type MutationResult =
  | { ok: true; outcome: "updated" | "unchanged" }
  | { ok: true; outcome: "created"; id: string }
  | {
      ok: false
      reason:
        | "forbidden"
        | "notFound"
        | "stale"
        | "invalidTransition"
        | "rejected"
        | "duplicate"
        | "failed"
      /** Safe to show. Never echoes a submitted value or a database detail. */
      message?: string
    }

/**
 * Map a PostgREST error to a mutation outcome.
 *
 * The SQLSTATEs are the ones the migration raises deliberately, so each has a
 * distinct recovery. Nothing here logs the error: a program name is not private
 * but a database error object can carry query text, and the habit of not
 * logging it is what keeps the enrollment version of this function safe.
 *
 * @param code - The PostgREST error code.
 * @param message - The database message, used only for the codes whose message
 *   is written for a person to read.
 * @returns The failed mutation result.
 */
function mapError(
  code: string | undefined,
  message: string | undefined,
): MutationResult {
  switch (code) {
    case "42501":
      return { ok: false, reason: "forbidden" }
    case "P0002":
      return { ok: false, reason: "notFound" }
    case "40001":
      return { ok: false, reason: "stale" }
    case "23514":
      return { ok: false, reason: "invalidTransition", message }
    case "23505":
      return { ok: false, reason: "duplicate", message }
    /* 22023 is raised only by the explicit `raise exception` calls in the
       migration, whose messages are written to be read by an administrator. */
    case "22023":
      return { ok: false, reason: "rejected", message }
    default:
      return { ok: false, reason: "failed" }
  }
}

/** A new program draft (MPS-WFL-005 step 1). Every published fact stays unset. */
async function createProgramDraft(input: {
  name: string
  slug: string
  summary: string | null
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_create_program_draft", {
    program_name: input.name,
    program_slug: input.slug,
    ...(input.summary ? { program_summary: input.summary } : {}),
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "created", id: data as string }
}

/** Program facts, availability, and the checkout link, as one audited change. */
async function updateProgramFacts(input: {
  programId: string
  expectedUpdatedAt: string
  name: string
  summary: string | null
  audience: string | null
  format: string | null
  location: string | null
  educator: string | null
  dates: string | null
  schedule: string | null
  duration: string | null
  sessionLength: string | null
  price: string | null
  availability: Availability
  checkoutUrl: string | null
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  /* `null` travels as `""`. A PostgreSQL function argument carries no
     nullability, so the generated types call every one of these `string`; the
     function converts an empty argument back to NULL with
     `nullif(btrim(coalesce(...)), '')`. The round trip is lossless because
     `""` is not a value this product ever stores — an unpublished fact is NULL,
     which is what "Contact for details" renders from. */
  const orEmpty = (value: string | null) => value ?? ""

  const { error } = await supabase.rpc("admin_update_program_facts", {
    target_id: input.programId,
    expected_updated_at: input.expectedUpdatedAt,
    program_name: input.name,
    program_summary: orEmpty(input.summary),
    program_audience: orEmpty(input.audience),
    program_format: orEmpty(input.format),
    program_location: orEmpty(input.location),
    program_educator: orEmpty(input.educator),
    program_dates: orEmpty(input.dates),
    program_schedule: orEmpty(input.schedule),
    program_duration: orEmpty(input.duration),
    program_session_length: orEmpty(input.sessionLength),
    program_price: orEmpty(input.price),
    program_availability: input.availability,
    program_checkout_url: orEmpty(input.checkoutUrl),
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "updated" }
}

/** Publish, unpublish, archive, or restore (MPS-REQ-016, MPS-RUL-005). */
async function setProgramPublication(input: {
  programId: string
  publicationState: PublicationState
  expectedUpdatedAt: string
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_set_program_publication", {
    target_id: input.programId,
    next_state: input.publicationState,
    expected_updated_at: input.expectedUpdatedAt,
  })

  if (error) return mapError(error.code, error.message)
  return {
    ok: true,
    outcome: data === "unchanged" ? "unchanged" : "updated",
  }
}

export {
  createProgramDraft,
  getAdminProgram,
  listAdminPrograms,
  setProgramPublication,
  updateProgramFacts,
}
export type { AdminProgram, Availability, MutationResult }
