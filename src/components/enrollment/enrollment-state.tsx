import {
  CircleCheck,
  CircleHelp,
  CircleSlash,
  Clock,
  ExternalLink,
  Hourglass,
  TriangleAlert,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { EnrollmentState } from "@/lib/enrollment/repository"
import { cn } from "@/lib/utils"

/**
 * The single place where a stored enrollment state becomes something a person
 * reads — a family on the dashboard and an administrator in operations (MDS
 * `components.enrollment_state`, DO-DONT "Trust states").
 *
 * It moved out of `components/family/` in the program-and-enrollment-operations
 * slice for one reason: MPS-ACC-022 requires that "family and admin views show
 * one consistent enrollment and payment state". The cheapest way to guarantee
 * that is for both views to render from this one table, so a change to a label
 * or a sentence cannot reach one audience and not the other. The mapping below
 * is unchanged by that move.
 *
 * TWO APPROVED VOCABULARIES, RESOLVED BY AUTHORITY
 *
 * MPS-WFL-003 owns the state — eight of them, and `public.enrollment_state` is
 * that list verbatim. MDS owns how each one is presented — ten variants, a
 * different list. Neither was made to win; the mapping below is the join, and
 * it is the trust contract of this release:
 *
 *   started          -> awaiting_external_payment
 *   approval_pending -> pending_review
 *   payment_pending  -> payment_pending_verification
 *   waitlisted       -> waitlist
 *   confirmed        -> enrolled
 *   payment_failed   -> not_confirmed
 *   canceled         -> cancelled
 *   blocked          -> not_confirmed
 *
 * Three rules hold it honest:
 *
 *   1. `confirmed` is the only state that renders success styling or the word
 *      "Enrolled". Confirmed enrollment comes from an authoritative enrollment
 *      outcome and from nothing else.
 *   2. `payment_pending` states non-confirmation in its own sentence. Leaving
 *      the reader to infer it from the absence of a green tick is exactly the
 *      inference DO-DONT forbids.
 *   3. Every entry carries an icon and an explicit label, so no state depends
 *      on colour to be understood.
 */
const ENROLLMENT_STATE = {
  started: {
    icon: ExternalLink,
    tone: "pending",
    label: "Awaiting checkout",
    /* True both before and after the parent follows the handoff link. The
       product cannot see whether they did — a click is navigation, not a
       verifiable payment event — so the sentence must not claim either
       (MPS-REQ-013, DO-DONT "Trust states"). */
    sentence:
      "This registration is recorded and waiting on Home School Haven's own checkout page. Payment is not confirmed and enrollment is not confirmed.",
  },
  approval_pending: {
    icon: Hourglass,
    tone: "pending",
    label: "Pending review",
    sentence:
      "Home School Haven has your request and is reviewing it. Enrollment is not confirmed yet.",
  },
  payment_pending: {
    icon: Clock,
    tone: "pending",
    label: "Payment verification pending",
    sentence:
      "Home School Haven is verifying your payment. Enrollment is not yet confirmed.",
  },
  waitlisted: {
    icon: Users,
    tone: "waitlist",
    label: "Waitlisted",
    sentence:
      "You are on the waitlist for this program. A waitlist place is not enrollment.",
  },
  confirmed: {
    icon: CircleCheck,
    tone: "success",
    label: "Enrolled",
    sentence: "Home School Haven has confirmed this enrollment.",
  },
  payment_failed: {
    icon: TriangleAlert,
    tone: "neutral",
    label: "Not confirmed",
    sentence:
      "Payment did not complete, so enrollment is not confirmed. Home School Haven can help.",
  },
  canceled: {
    icon: CircleSlash,
    tone: "neutral",
    label: "Cancelled",
    sentence: "This registration was cancelled.",
  },
  blocked: {
    icon: CircleHelp,
    tone: "neutral",
    label: "Not confirmed",
    sentence:
      "Home School Haven needs to look at this registration before it can go ahead. It is not confirmed.",
  },
} as const satisfies Record<
  EnrollmentState,
  {
    icon: typeof CircleHelp
    tone: "pending" | "waitlist" | "success" | "neutral"
    label: string
    sentence: string
  }
>

/**
 * Enrollment state badge, optionally with its explanatory sentence.
 * @param state - The stored enrollment state.
 * @param withSentence - Render the sentence beneath the badge.
 * @param className - Additional CSS classes.
 * @returns Enrollment state component.
 */
function EnrollmentStateBadge({
  state,
  withSentence = false,
  className,
}: {
  state: EnrollmentState
  withSentence?: boolean
  className?: string
}) {
  const { icon: Icon, tone, label, sentence } = ENROLLMENT_STATE[state]

  return (
    <div
      data-slot="enrollment-state"
      data-state={state}
      className={cn("flex flex-col gap-[var(--hsh-space-2)]", className)}
    >
      <Badge tone={tone} className="self-start">
        <Icon aria-hidden="true" strokeWidth={1.75} />
        {label}
      </Badge>
      {withSentence ? (
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          {sentence}
        </p>
      ) : null}
    </div>
  )
}

export { EnrollmentStateBadge, ENROLLMENT_STATE }
