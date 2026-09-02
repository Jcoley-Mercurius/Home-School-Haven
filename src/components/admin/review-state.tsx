import {
  CircleCheck,
  CircleSlash,
  ClipboardList,
  FileText,
  Gavel,
  MessageSquare,
  Search,
  TriangleAlert,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"

import {
  REVIEW_RESULT_LABELS,
  REVIEW_RESULT_MEANINGS,
  REVIEW_STATE_LABELS,
  REVIEW_STATE_MEANINGS,
  type ReviewResult,
  type ReviewSignalState,
} from "@/lib/admin/review-transitions"

/**
 * The walkthrough state and the recorded result of one beta success signal
 * (MPS-REQ-022, MPS-ACC-032).
 *
 * TWO BADGES, BECAUSE THEY ARE TWO FACTS
 *
 * A signal can be `review_complete` and still `fail`. Collapsing "how far the
 * walkthrough got" into "whether it worked" is how a review surface starts
 * lying: it would let a finished walkthrough of a broken thing read as done.
 *
 * COLOUR IS NEVER THE MESSAGE
 *
 * Every value carries a word and an icon.
 *
 * `not_tested` uses `neutral`, never `pending` or anything warmer. It is the
 * absence of evidence, and it must not borrow the visual weight of a result.
 * `blocked` uses `limited` rather than a destructive tone, because nothing
 * failed — something prevented the check.
 *
 * MDS-GAP-E1: the approved component set has no `review_signal` state
 * vocabulary. Composed from the approved `badge` rather than invented as a new
 * convention, the same way `./inquiry-state.tsx` was, and flagged for MDS
 * confirmation.
 */
const STATE_TONE = {
  not_reviewed: "neutral",
  in_review: "info",
  feedback_recorded: "info",
  decision_pending: "pending",
  disposition_approved: "info",
  review_complete: "success",
} as const satisfies Record<
  ReviewSignalState,
  "neutral" | "success" | "info" | "open" | "limited" | "pending" | "waitlist"
>

const STATE_ICON = {
  not_reviewed: ClipboardList,
  in_review: Search,
  feedback_recorded: MessageSquare,
  decision_pending: FileText,
  disposition_approved: Gavel,
  review_complete: CircleCheck,
} as const satisfies Record<ReviewSignalState, typeof ClipboardList>

const RESULT_TONE = {
  pass: "success",
  fail: "waitlist",
  blocked: "limited",
  not_tested: "neutral",
} as const satisfies Record<
  ReviewResult,
  "neutral" | "success" | "info" | "open" | "limited" | "pending" | "waitlist"
>

const RESULT_ICON = {
  pass: CircleCheck,
  fail: TriangleAlert,
  blocked: CircleSlash,
  not_tested: ClipboardList,
} as const satisfies Record<ReviewResult, typeof CircleCheck>

/**
 * How far the walkthrough of this signal has got.
 * @param props.state - The signal's current state.
 * @returns The badge.
 */
function ReviewStateBadge({ state }: { state: ReviewSignalState }) {
  const Icon = STATE_ICON[state]

  return (
    <Badge tone={STATE_TONE[state]}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {REVIEW_STATE_LABELS[state]}
    </Badge>
  )
}

/**
 * What was recorded when this signal was walked.
 * @param props.result - The recorded result.
 * @returns The badge.
 */
function ReviewResultBadge({ result }: { result: ReviewResult }) {
  const Icon = RESULT_ICON[result]

  return (
    <Badge tone={RESULT_TONE[result]}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {REVIEW_RESULT_LABELS[result]}
    </Badge>
  )
}

/**
 * The sentence that says what a state means.
 * @param props.state - The signal's current state.
 * @returns The sentence.
 */
function ReviewStateMeaning({ state }: { state: ReviewSignalState }) {
  return (
    <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
      {REVIEW_STATE_MEANINGS[state]}
    </p>
  )
}

/**
 * The sentence that says what a result means.
 * @param props.result - The recorded result.
 * @returns The sentence.
 */
function ReviewResultMeaning({ result }: { result: ReviewResult }) {
  return (
    <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
      {REVIEW_RESULT_MEANINGS[result]}
    </p>
  )
}

export {
  ReviewStateBadge,
  ReviewResultBadge,
  ReviewStateMeaning,
  ReviewResultMeaning,
}
