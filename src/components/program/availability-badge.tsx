import { CircleHelp, CircleSlash, Clock, Sprout, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { AvailabilityState } from "@/content/programs"
import { cn } from "@/lib/utils"

/**
 * Availability state for a published program (DESIGN-SYSTEM.md §6).
 *
 * Every entry carries an icon, a label, and a sentence, so the state is legible
 * without colour and never abbreviated to a coloured dot.
 *
 * `unknown` is the state of every program in the Foundation Review: the source
 * publishes no capacity or registration window for any offering, and inventing
 * one is forbidden by import rule 3. It is deliberately worded so nobody can
 * read it as "seats are available".
 */
const AVAILABILITY = {
  open: {
    icon: Sprout,
    tone: "open",
    label: "Open",
    description: "Registration is open for this program.",
  },
  limited: {
    icon: Clock,
    tone: "limited",
    label: "Limited spaces",
    description: "Limited availability. Contact for details.",
  },
  waitlist: {
    icon: Users,
    tone: "waitlist",
    label: "Waitlist",
    description: "This program is full. Joining a waitlist is not enrollment.",
  },
  closed: {
    icon: CircleSlash,
    tone: "neutral",
    label: "Closed",
    description: "Registration is closed for this program.",
  },
  unknown: {
    icon: CircleHelp,
    tone: "neutral",
    label: "Availability not published",
    description:
      "Home School Haven has not published availability for this program. Contact for details.",
  },
} as const satisfies Record<
  AvailabilityState,
  {
    icon: typeof CircleHelp
    tone: "open" | "limited" | "waitlist" | "neutral"
    label: string
    description: string
  }
>

/**
 * Availability badge with its explanatory sentence.
 * @param state - Approved availability state
 * @param withDescription - Render the sentence beneath the badge
 * @param className - Additional CSS classes
 * @returns Availability state component
 */
function AvailabilityBadge({
  state,
  withDescription = false,
  className,
}: {
  state: AvailabilityState
  withDescription?: boolean
  className?: string
}) {
  const { icon: Icon, tone, label, description } = AVAILABILITY[state]

  return (
    <div
      data-slot="availability"
      data-state={state}
      className={cn("flex flex-col gap-[var(--hsh-space-2)]", className)}
    >
      <Badge tone={tone} className="self-start">
        <Icon aria-hidden="true" strokeWidth={1.75} />
        {label}
      </Badge>
      {withDescription ? (
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export { AvailabilityBadge, AVAILABILITY }
