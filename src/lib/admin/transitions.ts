/**
 * The approved administrative transition tables, as pure data.
 *
 * THIS FILE IS NOT THE CONTROL.
 *
 * `supabase/migrations/20260830090000_admin_program_enrollment_operations.sql`
 * is. `private.enrollment_transition_allowed` and
 * `private.program_publication_transition_allowed` decide every real write, and
 * they decide it for a caller composing their own request just as much as for
 * this application. What lives here decides only which buttons are worth
 * rendering, so an administrator is not offered an action that will be refused.
 *
 * The two must agree, and a divergence would be a defect in whichever was
 * changed alone. `tests/admin-transitions.test.mts` pins this copy; the pgTAP
 * suite pins the SQL one; the tables below are transcribed from the same §8 of
 * `prompts/admin-program-enrollment-operations.md` that the migration is.
 *
 * No Supabase import and no `server-only` here on purpose: the Node test runner
 * cannot resolve the `@/` alias inside a `server-only` module, so a rule that
 * lived in the repository would be a rule nothing could test (the
 * `describeActivity` lesson, `prompts/admin-operations-foundation.md`).
 */

import type { Enums } from "@/lib/supabase/types"

type EnrollmentState = Enums<"enrollment_state">
type PublicationState = Enums<"program_publication_state">

/**
 * The four enrollment states an administrator may set, and nothing else.
 *
 * `started`, `approval_pending`, and `payment_failed` are absent because they
 * are outcomes of the family journey and the payment path rather than decisions
 * anyone makes here. They are displayed; they are never set.
 */
const ADMIN_ENROLLMENT_TARGETS = [
  "confirmed",
  "waitlisted",
  "blocked",
  "canceled",
] as const satisfies readonly EnrollmentState[]

type AdminEnrollmentTarget = (typeof ADMIN_ENROLLMENT_TARGETS)[number]

/**
 * Which targets are reachable from each current state (MPS-REQ-017,
 * MPS-WFL-003, MPS-RUL-002, MPS-RUL-004).
 *
 * Two absences are decisions, not omissions:
 *
 *   `payment_failed` cannot go straight to `confirmed`. Confirming an
 *   enrollment whose payment is recorded as failed is a financial judgment and
 *   checklist §2 and §5 are unanswered. Going through `blocked` first is
 *   allowed and leaves two audit rows explaining the correction.
 *
 *   `confirmed` cannot go to `blocked`. That correction path was proposed and
 *   the owner declined it on 2026-08-29, so a confirmation made in error has no
 *   approved undo short of cancelling (GAP-ADMIN-008). The confirmation dialog
 *   says this before the administrator commits rather than after.
 *
 * `canceled` is terminal: reinstatement touches the unanswered checklist §5
 * (GAP-ADMIN-003).
 */
const ENROLLMENT_TRANSITIONS = {
  started: ["confirmed", "waitlisted", "blocked", "canceled"],
  approval_pending: ["confirmed", "waitlisted", "blocked", "canceled"],
  payment_pending: ["confirmed", "waitlisted", "blocked", "canceled"],
  waitlisted: ["confirmed", "blocked", "canceled"],
  blocked: ["confirmed", "waitlisted", "canceled"],
  payment_failed: ["waitlisted", "blocked", "canceled"],
  confirmed: ["canceled"],
  canceled: [],
} as const satisfies Record<EnrollmentState, readonly AdminEnrollmentTarget[]>

/**
 * The enrollment states an administrator may move this record to.
 * @param from - The record's current state.
 * @returns The approved targets, in the order they are offered.
 */
function allowedEnrollmentTargets(
  from: EnrollmentState,
): readonly AdminEnrollmentTarget[] {
  return ENROLLMENT_TRANSITIONS[from]
}

/**
 * Whether one enrollment transition is approved.
 * @param from - The record's current state.
 * @param to - The proposed state.
 * @returns True when the transition is approved.
 */
function isEnrollmentTransitionAllowed(
  from: EnrollmentState,
  to: EnrollmentState,
): boolean {
  return (
    allowedEnrollmentTargets(from) as readonly EnrollmentState[]
  ).includes(to)
}

/**
 * Program publication transitions (MPS-REQ-016; MPS-WFL-005 recovery "correct
 * errors through authorized edits", which is what makes the reverse directions
 * legal).
 *
 * There is no `canceled` or `completed` here. MPS-WFL-005 names both states and
 * also requires that affected families be notified of a cancellation; no
 * notification capability exists, and shipping the state without the notice
 * would be half of a workflow whose other half is the part families rely on
 * (GAP-ADMIN-005).
 *
 * There is no deletion anywhere. Retention and deletion are checklist §11 and
 * unanswered; archive is the approved alternative and is reversible.
 */
const PUBLICATION_TRANSITIONS = {
  draft: ["published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
} as const satisfies Record<PublicationState, readonly PublicationState[]>

/**
 * The publication states an administrator may move this program to.
 * @param from - The program's current publication state.
 * @returns The approved targets.
 */
function allowedPublicationTargets(
  from: PublicationState,
): readonly PublicationState[] {
  return PUBLICATION_TRANSITIONS[from]
}

/**
 * Whether one publication transition is approved.
 * @param from - The program's current publication state.
 * @param to - The proposed publication state.
 * @returns True when the transition is approved.
 */
function isPublicationTransitionAllowed(
  from: PublicationState,
  to: PublicationState,
): boolean {
  return allowedPublicationTargets(from).includes(to)
}

export {
  ADMIN_ENROLLMENT_TARGETS,
  allowedEnrollmentTargets,
  allowedPublicationTargets,
  isEnrollmentTransitionAllowed,
  isPublicationTransitionAllowed,
}
export type { AdminEnrollmentTarget, EnrollmentState, PublicationState }
