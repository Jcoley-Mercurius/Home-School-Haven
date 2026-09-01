/**
 * The authorized schedule, capacity, and attendance writes (MPS-REQ-016,
 * MPS-REQ-024, MPS-RUL-002, MPS-RUL-005, MPS-FEA-011, MPS-FEA-012).
 *
 * WHERE THE BOUNDARY IS
 *
 * Not here. `public.program_sessions` and `public.session_attendance` hold no
 * INSERT, UPDATE, or DELETE privilege for any client role, so the RPCs below
 * are the only write path in existence. Each performs its own authorization
 * check, transition rule, and staleness test inside the transaction that
 * writes, so a forged PostgREST request has nothing to reach and this module
 * has nothing to enforce.
 *
 * What this module does is turn a database refusal into a `reason` the calling
 * action can render as a sentence someone can act on. The same `mapError`
 * vocabulary `src/lib/admin/programs.ts` established, extended by one outcome:
 * `updatedOverCapacity`, which is not a failure at all.
 *
 * There is no service-role client here. RLS is genuinely in force rather than
 * bypassed with a privileged key and re-checked in application code.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { SessionStateTarget } from "@/lib/schedule/sessions"

/** The outcome of one authorized write. */
type ScheduleMutationResult =
  | {
      ok: true
      outcome:
        | "created"
        | "updated"
        | "rescheduled"
        | "unchanged"
        | "recorded"
        | "cleared"
        /**
         * The capacity was saved AND confirmed places now exceed it. Not a
         * failure: nothing was refused and nothing was decided. The surface
         * says the condition out loud rather than leaving it to be discovered
         * (GAP-ADMIN-012).
         */
        | "updatedOverCapacity"
      id?: string
    }
  | {
      ok: false
      reason:
        | "forbidden"
        | "notFound"
        | "stale"
        | "invalidTransition"
        | "rejected"
        | "failed"
      /** Safe to display. Set only for the codes whose message is written for
          a person to read. */
      message?: string
    }

/**
 * Map a PostgREST error onto a refusal this product knows how to explain.
 *
 * The default is deliberately `failed` with no message: an unexpected database
 * error's text can carry a column name, a constraint name, or a fragment of the
 * row, none of which belongs on a screen.
 *
 * @param code - The PostgREST error code.
 * @param message - The database message, used only for the codes whose message
 *   is written for a person to read.
 * @returns The failed mutation result.
 */
function mapError(
  code: string | undefined,
  message: string | undefined,
): ScheduleMutationResult {
  switch (code) {
    case "42501":
      return { ok: false, reason: "forbidden" }
    case "P0002":
      return { ok: false, reason: "notFound" }
    case "40001":
      return { ok: false, reason: "stale" }
    case "23514":
      return { ok: false, reason: "invalidTransition", message }
    case "22023":
      return { ok: false, reason: "rejected", message }
    default:
      return { ok: false, reason: "failed" }
  }
}

/** Author one session on a program (MPS-WFL-005 step 2). */
async function createProgramSession(input: {
  programId: string
  title: string
  startsAt: string
  endsAt: string
  location: string | null
}): Promise<ScheduleMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_create_program_session", {
    target_program: input.programId,
    session_title: input.title,
    session_starts_at: input.startsAt,
    session_ends_at: input.endsAt,
    /* `""` round-trips to NULL through the function's
       `nullif(btrim(coalesce(...)), '')`, the same convention
       `admin_update_program_facts` uses. */
    session_location: input.location ?? "",
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "created", id: data as string }
}

/**
 * Edit or move one session.
 *
 * Editing and rescheduling are the same call, because separating them would let
 * a session's time change without the record saying it moved. The database
 * decides which happened and says so in its return value: a changed time yields
 * `rescheduled` and requires a note; a corrected title yields `updated` and
 * does not.
 */
async function updateProgramSession(input: {
  sessionId: string
  expectedUpdatedAt: string
  title: string
  startsAt: string
  endsAt: string
  location: string | null
  changeNote: string | null
}): Promise<ScheduleMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_update_program_session", {
    target_id: input.sessionId,
    expected_updated_at: input.expectedUpdatedAt,
    session_title: input.title,
    session_starts_at: input.startsAt,
    session_ends_at: input.endsAt,
    session_location: input.location ?? "",
    session_change_note: input.changeNote ?? "",
  })

  if (error) return mapError(error.code, error.message)
  if (data === "rescheduled") return { ok: true, outcome: "rescheduled" }
  if (data === "unchanged") return { ok: true, outcome: "unchanged" }
  return { ok: true, outcome: "updated" }
}

/**
 * Cancel or complete one session (MPS-WFL-005 alternate paths).
 *
 * Touches no enrollment. Cancelling a session decides no refund, credit,
 * transfer, or enrollment outcome (MPS-RUL-004) — the database function does
 * not name the `enrollments` table, so it cannot.
 */
async function setSessionState(input: {
  sessionId: string
  state: SessionStateTarget
  note: string
  expectedUpdatedAt: string
}): Promise<ScheduleMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_set_session_state", {
    target_id: input.sessionId,
    next_state: input.state,
    note: input.note,
    expected_updated_at: input.expectedUpdatedAt,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: data === "unchanged" ? "unchanged" : "updated" }
}

/**
 * Set one program's capacity and waitlist setting (MPS-RUL-002, MPS-FEA-012).
 *
 * `null` capacity means "not established" and is what clears it back. Creates
 * and removes no enrollment; an `updatedOverCapacity` outcome reports that
 * confirmed places now exceed the number rather than deciding who loses one.
 */
async function setProgramCapacity(input: {
  programId: string
  expectedUpdatedAt: string
  capacity: number | null
  waitlistEnabled: boolean
}): Promise<ScheduleMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_set_program_capacity", {
    target_id: input.programId,
    expected_updated_at: input.expectedUpdatedAt,
    /* A PostgreSQL function argument carries no nullability, so the generated
       types call this `number` while the function's own signature is
       `integer` and accepts NULL — which is how capacity is cleared back to
       "not established". The same round trip `admin_update_program_facts`
       makes for text with `""`, made explicit here because an integer has no
       empty value to stand in for it. */
    next_capacity: input.capacity as number,
    next_waitlist_enabled: input.waitlistEnabled,
  })

  if (error) return mapError(error.code, error.message)
  if (data === "updated_over_capacity") {
    return { ok: true, outcome: "updatedOverCapacity" }
  }
  return { ok: true, outcome: data === "unchanged" ? "unchanged" : "updated" }
}

/**
 * Record one enrollment as present at one session (MPS-FEA-011).
 *
 * `enrollmentId` reaches this function from a form and is safe there: it points
 * at a registration rather than at a child, and the database decides whether
 * this caller may touch that session at all, whether the enrollment belongs to
 * the session's own program, and whether it is confirmed.
 */
async function recordAttendance(input: {
  sessionId: string
  enrollmentId: string
}): Promise<ScheduleMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("record_session_attendance", {
    target_session: input.sessionId,
    target_enrollment: input.enrollmentId,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: data === "unchanged" ? "unchanged" : "recorded" }
}

/**
 * Clear one attendance record made in error.
 *
 * Restores "not recorded". It does not assert absence, because MPS approves no
 * vocabulary in which absence could be asserted (GAP-ADMIN-010).
 */
async function clearAttendance(input: {
  sessionId: string
  enrollmentId: string
}): Promise<ScheduleMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("clear_session_attendance", {
    target_session: input.sessionId,
    target_enrollment: input.enrollmentId,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: data === "unchanged" ? "unchanged" : "cleared" }
}

export {
  clearAttendance,
  createProgramSession,
  recordAttendance,
  setProgramCapacity,
  setSessionState,
  updateProgramSession,
}
export type { ScheduleMutationResult }
