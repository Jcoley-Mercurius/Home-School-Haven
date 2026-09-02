/**
 * The approved inquiry transition table, as pure data.
 *
 * THIS FILE IS NOT THE CONTROL.
 *
 * `supabase/migrations/20260904000000_inquiry_capture_foundation.sql` is.
 * `private.inquiry_transition_allowed` decides every real write, and it decides
 * it for a caller composing their own request just as much as for this
 * application. What lives here decides only which buttons are worth rendering,
 * so an administrator is not offered an action that will be refused.
 *
 * The two must agree, and a divergence would be a defect in whichever was
 * changed alone. `tests/inquiry-transitions.test.mts` pins this copy; the pgTAP
 * suite pins the SQL one; both are transcribed from MPS-WFL-004.
 *
 * No Supabase import and no `server-only` here, for the reason recorded in
 * `./transitions.ts`: a rule inside a `server-only` module is a rule the Node
 * test runner cannot reach.
 */

import type { Enums } from "@/lib/supabase/types"

export type InquiryState = Enums<"inquiry_state">
export type InquiryType = Enums<"inquiry_type">

/**
 * MPS-WFL-004, read as a graph.
 *
 * Two shapes in here are decisions rather than omissions:
 *
 *   `not_available` and `approved_path_provided` are unreachable from
 *   `submitted`. Both are conclusions, and MPS-WFL-004's main path puts
 *   "Administrator reviews" before "determine next step". An administrator who
 *   has genuinely decided at a glance passes through `under_review`, which
 *   costs one click and leaves the review in the history.
 *
 *   `closed` is terminal. MPS-WFL-004 names no reopen path, and a request that
 *   resumes after being closed is a new request with its own submitted time —
 *   not an old record quietly brought back to life.
 */
export const INQUIRY_TRANSITIONS: Record<InquiryState, readonly InquiryState[]> = {
  submitted: ["under_review", "not_available", "closed"],
  under_review: [
    "awaiting_family",
    "approved_path_provided",
    "not_available",
    "closed",
  ],
  awaiting_family: [
    "under_review",
    "approved_path_provided",
    "not_available",
    "closed",
  ],
  approved_path_provided: ["closed"],
  not_available: ["closed"],
  closed: [],
}

/**
 * The approved label for each state.
 *
 * MPS-RUL-004 is the whole reason these are worded carefully.
 * `approved_path_provided` says a path was *given*, not that assistance was
 * *granted*; `not_available` says assistance is not available, not that the
 * family was *declined*. The beta records status and decides nothing, and the
 * words an administrator reads should not suggest otherwise.
 */
export const INQUIRY_STATE_LABELS: Record<InquiryState, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  awaiting_family: "Awaiting family",
  approved_path_provided: "Path provided",
  not_available: "Not available",
  closed: "Closed",
}

/**
 * What each state means, in the administrator's own terms. Shown alongside the
 * label so the state's meaning never rests on its color alone (MDS
 * accessibility; status meaning must not depend on color).
 */
export const INQUIRY_STATE_MEANINGS: Record<InquiryState, string> = {
  submitted: "Received and waiting for an administrator to pick it up.",
  under_review: "An administrator is looking into it.",
  awaiting_family: "The family has been asked for more information.",
  approved_path_provided:
    "The family was given a registration or payment path. This records that a path was offered — it is not a discount, an award, or an eligibility decision.",
  not_available: "No path was available for this request.",
  closed: "Finished. A later request from this family is a new inquiry.",
}

/** The approved label for each public pathway (MPS-REQ-009). */
export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  guidance: "Guidance",
  question: "General question",
  visit: "Visit",
  assistance: "Cost assistance",
}

/**
 * `assistance` is the MPS-WFL-004 discounted-class request. Every inquiry is
 * already administrator-only at the database, so this does not gate access —
 * it marks the rows whose contents an administrator should be deliberate about
 * reading aloud, forwarding, or leaving on a shared screen (MPS-RUL-003).
 */
export function isSensitiveInquiry(type: InquiryType): boolean {
  return type === "assistance"
}

/**
 * Whether an administrator may move an inquiry from one state to another.
 * @param from - The inquiry's current state.
 * @param to - The state being proposed.
 * @returns True when MPS-WFL-004 permits the move.
 */
export function inquiryTransitionAllowed(
  from: InquiryState,
  to: InquiryState,
): boolean {
  return INQUIRY_TRANSITIONS[from].includes(to)
}

/**
 * The states an administrator may move this inquiry to right now.
 * @param from - The inquiry's current state.
 * @returns The permitted targets, in the approved display order.
 */
export function nextInquiryStates(from: InquiryState): readonly InquiryState[] {
  return INQUIRY_TRANSITIONS[from]
}
