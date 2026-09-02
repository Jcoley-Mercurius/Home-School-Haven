import {
  CircleSlash,
  Clock,
  Handshake,
  Inbox,
  MessageCircleQuestion,
  Search,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"

import {
  INQUIRY_STATE_LABELS,
  INQUIRY_STATE_MEANINGS,
  type InquiryState,
} from "@/lib/admin/inquiry-transitions"

/**
 * The review state of one inquiry (MPS-REQ-010, MPS-WFL-004, MPS-REQ-021).
 *
 * COLOUR IS NEVER THE MESSAGE
 *
 * Every state carries a word AND an icon, because the MDS requires status
 * meaning that does not depend on colour.
 *
 * NO STATE HERE IS AN OUTCOME
 *
 * `approved_path_provided` uses `info`, not `success`. `success` is the tone
 * this system reserves for something that completed, and an administrator
 * handing a family a registration path has completed nothing on the family's
 * behalf — MPS-RUL-004 is explicit that the beta records status and decides no
 * financial outcome. Spelling it in the same colour as a confirmed enrollment
 * would say otherwise at a glance, which is exactly how a state gets misread.
 *
 * Likewise `not_available` is `neutral`, not a destructive or warning tone: no
 * family was declined, and nothing went wrong.
 *
 * MDS-GAP-P1: the approved `enrollment_state` component lists its own state
 * vocabulary, which is not the inquiry review vocabulary. This is composed from
 * the approved `badge` component rather than invented as a new convention, and
 * is flagged for MDS confirmation.
 */
const STATE_TONE = {
  submitted: "pending",
  under_review: "info",
  awaiting_family: "limited",
  approved_path_provided: "info",
  not_available: "neutral",
  closed: "neutral",
} as const satisfies Record<
  InquiryState,
  "neutral" | "success" | "info" | "open" | "limited" | "pending" | "waitlist"
>

const STATE_ICON = {
  submitted: Inbox,
  under_review: Search,
  awaiting_family: Clock,
  approved_path_provided: Handshake,
  not_available: CircleSlash,
  closed: MessageCircleQuestion,
} as const satisfies Record<InquiryState, typeof Inbox>

/**
 * A labelled, icon-bearing badge for an inquiry's review state.
 * @param props.state - The inquiry's current state.
 * @returns The badge.
 */
function InquiryStateBadge({ state }: { state: InquiryState }) {
  const Icon = STATE_ICON[state]

  return (
    <Badge tone={STATE_TONE[state]}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {INQUIRY_STATE_LABELS[state]}
    </Badge>
  )
}

/**
 * The sentence that says what a state means for the administrator on duty.
 * @param props.state - The inquiry's current state.
 * @returns The sentence.
 */
function InquiryStateMeaning({ state }: { state: InquiryState }) {
  return (
    <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
      {INQUIRY_STATE_MEANINGS[state]}
    </p>
  )
}

export { InquiryStateBadge, InquiryStateMeaning }
