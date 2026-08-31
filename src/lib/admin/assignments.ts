/**
 * The two approved educator-assignment writes (MPS-REQ-017, MPS-REQ-024;
 * MPS-WFL-005, MPS-WFL-006).
 *
 * These are the only mutations this slice adds. Everything else it touches —
 * families, students, educator accounts, rosters — is read-only, because no
 * approved requirement authorizes an administrator to change it.
 *
 * WHY THE RPC AND NOT AN INSERT
 *
 * `20260831000000` revoked INSERT and DELETE on `public.educator_assignments`
 * from `authenticated`. An RLS policy could have said *who* may write, but not
 * that the target must actually hold the `educator` grant, that an archived
 * program is not assigned, or that a reason must be stated. All three are
 * requirements, so the write path is a SECURITY DEFINER function that applies
 * them as one statement. A caller composing their own PostgREST request meets
 * the same rules, because there is no other route.
 *
 * WHAT AN ASSIGNMENT GRANTS, AND WHAT IT CANNOT
 *
 * Assignment grants an educator read scope over one program: its record, its
 * enrollments, its announcements and resources, and — through the restricted
 * `educator_roster_students` view — the children with a CONFIRMED
 * enrollment on it. It grants nothing else. It confers no price control, no
 * availability control, no cancellation authority, no organization-wide
 * communication, no reach into an unassigned program, no administrator
 * authority, and no owner authority. None of those exist as capabilities for
 * an educator to be granted, which is the strongest form of that guarantee.
 *
 * REMOVAL TAKES EFFECT IMMEDIATELY
 *
 * Every policy that depends on assignment evaluates `educator_assignments`
 * per statement against `auth.uid()`. Nothing caches it in a session, a cookie,
 * or a JWT claim, so a removed assignment stops granting on the very next
 * authorized request and no sign-out is required. `80_admin_family_educator_
 * roster.test.sql` proves it by removing an assignment and re-reading inside
 * the same transaction.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { MutationResult } from "@/lib/admin/programs"

/**
 * Map a PostgREST error from either assignment function to an outcome.
 *
 * The SQLSTATEs are the ones the migration raises deliberately, so each has a
 * distinct recovery. The error is neither logged nor echoed: it concerns an
 * educator's access to a program roster, and a Supabase error object can carry
 * the query that produced it.
 *
 * @param code - The PostgREST error code.
 * @returns The failed mutation result.
 */
function assignmentFailure(code: string | undefined): MutationResult {
  switch (code) {
    /* Not an administrator. The UI never offers this, so reaching it means a
       forged request or an expired grant — both recover the same way. */
    case "42501":
      return { ok: false, reason: "forbidden" }
    case "P0002":
      return { ok: false, reason: "notFound" }
    /* Target is not an educator, or the program is archived. Both are
       admissibility refusals about the request itself. */
    case "23514":
      return { ok: false, reason: "invalidTransition" }
    /* Raised only by the migration's explicit note checks, whose messages are
       written to be read by an administrator. */
    case "22023":
      return { ok: false, reason: "rejected" }
    default:
      return { ok: false, reason: "failed" }
  }
}

/**
 * Assign an educator to a program (MPS-REQ-017).
 *
 * Idempotent by contract: a second submission of the same pair writes nothing,
 * fires no audit trigger, and returns `unchanged`. A repeat is not an error —
 * the administrator's intent is already true — so the surface reports it as
 * "already assigned" rather than as a failure. That is what makes a
 * double-click, a double-tap, and two open tabs safe.
 *
 * There is no concurrency token, deliberately (deviation D-FE1). Assignment is
 * set membership: there is no prior material state for a second administrator
 * to flatten, and both orderings of two concurrent submissions reach the same
 * membership. The function locks the program row so the second caller reads the
 * first one's result and reports `unchanged` truthfully, rather than raising a
 * staleness error about a conflict that does not exist.
 *
 * @param input - The educator, the program, and the administrator's reason.
 * @returns The outcome, including the idempotent `unchanged` case.
 */
async function assignEducator(input: {
  educatorUserId: string
  programId: string
  note: string
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_assign_educator", {
    educator_id: input.educatorUserId,
    target_program_id: input.programId,
    note: input.note,
  })

  if (error) return assignmentFailure(error.code)

  return { ok: true, outcome: data === "unchanged" ? "unchanged" : "updated" }
}

/**
 * Remove an educator's assignment to a program (MPS-REQ-017, MPS-WFL-006).
 *
 * Reassignment is this followed by an assignment, not a third operation.
 * `educator_assignments` has a composite primary key rather than a unique
 * program, so a program may carry several educators; an atomic "reassign"
 * would have to guess which existing assignment it replaced. Two attributable
 * events say what actually happened.
 *
 * A pair that was never assigned and a program that does not exist both return
 * `unchanged`, so a manipulated identifier learns nothing about what exists.
 *
 * @param input - The educator, the program, and the administrator's reason.
 * @returns The outcome, including the idempotent `unchanged` case.
 */
async function unassignEducator(input: {
  educatorUserId: string
  programId: string
  note: string
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_unassign_educator", {
    educator_id: input.educatorUserId,
    target_program_id: input.programId,
    note: input.note,
  })

  if (error) return assignmentFailure(error.code)

  return { ok: true, outcome: data === "unchanged" ? "unchanged" : "updated" }
}

export { assignEducator, unassignEducator }
