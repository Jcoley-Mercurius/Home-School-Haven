/**
 * The approved beta-review transition table and vocabulary, as pure data.
 *
 * THIS FILE IS NOT THE CONTROL.
 *
 * `supabase/migrations/20260905000000_beta_review_evidence.sql` is.
 * `private.review_transition_allowed` decides every real write. What lives
 * here decides only which controls are worth rendering.
 *
 * The two must agree. A divergence is a defect in whichever was changed alone
 * — and that is not hypothetical: the first cut of
 * `./inquiry-transitions.ts` shipped a table that contradicted its own header
 * comment, and a review caught the copy while leaving the SQL permitting what
 * the copy refused. `tests/review-transitions.test.mts` pins this file and
 * `supabase/tests/database/130_beta_review_evidence.test.sql` pins the SQL.
 *
 * No Supabase import and no `server-only` here: a rule inside a `server-only`
 * module is a rule the Node test runner cannot reach (the lesson recorded in
 * `./transitions.ts`).
 */

import type { Enums } from "@/lib/supabase/types"

export type ReviewSignalState = Enums<"review_signal_state">
export type ReviewResult = Enums<"review_result">
export type ReviewDisposition = Enums<"review_disposition">

/**
 * MPS-WFL-008, read as a graph.
 *
 * Two shapes are decisions rather than omissions:
 *
 *   `in_review → review_complete` exists with no feedback in between. A
 *   signal can be demonstrated with nothing to say about it, and requiring a
 *   feedback item to close a clean walkthrough would manufacture feedback
 *   Samantha never gave.
 *
 *   `review_complete → in_review` exists. Unlike a family's inquiry, a review
 *   is not a record of someone's request, so reopening a signal the owner
 *   wants to revisit hides nothing and loses nothing — and every reopen is one
 *   audit row.
 */
export const REVIEW_TRANSITIONS: Record<
  ReviewSignalState,
  readonly ReviewSignalState[]
> = {
  not_reviewed: ["in_review"],
  in_review: ["feedback_recorded", "review_complete"],
  feedback_recorded: ["decision_pending", "in_review"],
  decision_pending: ["disposition_approved", "feedback_recorded"],
  disposition_approved: ["review_complete", "in_review"],
  review_complete: ["in_review"],
}

export const REVIEW_STATE_LABELS: Record<ReviewSignalState, string> = {
  not_reviewed: "Not reviewed",
  in_review: "In review",
  feedback_recorded: "Feedback recorded",
  decision_pending: "Decision pending",
  disposition_approved: "Disposition approved",
  review_complete: "Review complete",
}

export const REVIEW_STATE_MEANINGS: Record<ReviewSignalState, string> = {
  not_reviewed: "Nobody has walked this signal yet.",
  in_review: "Being walked now.",
  feedback_recorded:
    "Something was said about it and is waiting to be classified.",
  decision_pending: "Classified, and waiting for a disposition to be approved.",
  disposition_approved:
    "The disposition is approved and attributed. Carrying it into the MPS is a separate, human step.",
  review_complete:
    "Finished. It can be reopened if Samantha wants another look.",
}

/**
 * The four results `mps/ACCEPTANCE-CRITERIA.md` §"Required evidence" requires.
 *
 * `not_tested` is not a soft pass and must never read as one. A summary that
 * counts anything but `pass` toward "demonstrated" is the failure mode this
 * whole surface exists to prevent.
 */
export const REVIEW_RESULT_LABELS: Record<ReviewResult, string> = {
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
  not_tested: "Not tested",
}

export const REVIEW_RESULT_MEANINGS: Record<ReviewResult, string> = {
  pass: "Demonstrated in the recorded build.",
  fail: "Walked, and it did not work.",
  blocked:
    "Could not be walked. This is not a failure of the signal — something prevented the check.",
  not_tested: "Not walked yet. This counts as no evidence at all.",
}

/**
 * MPS-WFL-008's alternate paths.
 *
 * There is deliberately no "accepted into this release" disposition, and the
 * wording below is careful for the same reason: MPS-WFL-008's recovery says
 * "unresolved items remain explicit gaps; they do not silently enter launch
 * scope". A change that should be built is a launch requirement to be approved
 * through the MPS, not a checkbox here.
 */
export const REVIEW_DISPOSITION_LABELS: Record<ReviewDisposition, string> = {
  must_fix_beta_defect: "Must-fix beta defect",
  launch_requirement: "Launch requirement",
  next_idea: "Next idea",
  later_idea: "Later idea",
  rejected_change: "Rejected change",
}

export const REVIEW_DISPOSITION_MEANINGS: Record<ReviewDisposition, string> = {
  must_fix_beta_defect:
    "Broken in the Foundation Release and has to be fixed before the review can be relied on.",
  launch_requirement:
    "Needed before complete-platform launch. Recording it here does not add it to any release — that is an MPS decision.",
  next_idea: "Worth doing soon, but not required for launch.",
  later_idea: "Worth keeping, with no timing attached.",
  rejected_change:
    "Considered and declined. Kept so the decision is not relitigated from memory.",
}

/**
 * Whether an administrator may move a signal from one state to another.
 * @param from - The signal's current state.
 * @param to - The state being proposed.
 * @returns True when MPS-WFL-008 permits the move.
 */
export function reviewTransitionAllowed(
  from: ReviewSignalState,
  to: ReviewSignalState,
): boolean {
  return REVIEW_TRANSITIONS[from].includes(to)
}

/**
 * The states a signal may move to right now.
 * @param from - The signal's current state.
 * @returns The permitted targets, in the approved display order.
 */
export function nextReviewStates(
  from: ReviewSignalState,
): readonly ReviewSignalState[] {
  return REVIEW_TRANSITIONS[from]
}

/**
 * How many signals are genuinely demonstrated (MPS-ACC-032).
 *
 * `pass` only. Not `blocked`, not `not_tested`, and obviously not `fail`. This
 * function is the single place that decides what "demonstrated" means, so
 * there is exactly one thing to test and no second opinion anywhere in the UI.
 * @param results - Every signal's recorded result.
 * @returns The count that may honestly be called demonstrated.
 */
export function demonstratedCount(results: readonly ReviewResult[]): number {
  return results.filter((result) => result === "pass").length
}
