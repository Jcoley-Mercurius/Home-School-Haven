import Link from "next/link"
import { Phone } from "lucide-react"

import { AvailabilityBadge } from "@/components/program/availability-badge"
import { CheckoutHandoff } from "@/components/program/checkout-handoff"
import { Button } from "@/components/ui/button"
import {
  contact,
  guidanceHref,
  type Program,
} from "@/content/foundation-content"
import { cn } from "@/lib/utils"

/**
 * Program detail action rail (DESIGN-SYSTEM.md §7 "sticky status/action rail",
 * §8 "detail action rail becomes an inline priority panel below 1024 px";
 * MDS-REF-005 §2 program actions and §5 responsive transformations).
 *
 * Sticky beside the content on desktop and wide; below 1024 px it renders in
 * normal flow, placed above the long-form content so availability and the
 * checkout trust language are never demoted to the bottom of a phone page
 * (DO-DONT.md: "Do not hide important actions or states merely to simplify
 * mobile layouts").
 *
 * MDS-REF-005 shows a "View availability" primary action. There is no
 * availability to open: no program publishes capacity or a registration window,
 * so the explicit unknown-availability state stands in its place rather than a
 * control that would lead nowhere.
 */
function ProgramActionRail({
  program,
  className,
}: {
  program: Program
  className?: string
}) {
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  return (
    <aside
      aria-labelledby="program-actions-heading"
      className={cn(
        "flex flex-col gap-[var(--hsh-space-5)] lg:sticky lg:top-[96px]",
        className,
      )}
    >
      <h2 id="program-actions-heading" className="sr-only">
        Availability and next steps
      </h2>

      <div className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]">
        <h3 className="hsh-label text-[var(--hsh-text-primary)]">
          Availability
        </h3>
        <AvailabilityBadge state={program.availability} withDescription />
      </div>

      <CheckoutHandoff program={program} />

      <div className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-5)]">
        <h3 className="hsh-label text-[var(--hsh-text-primary)]">
          Need help choosing?
        </h3>
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          Tell us about your child and we will help you find the right fit — or
          call and talk it through.
        </p>
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          render={<Link href={guidanceHref} />}
        >
          Request Guidance
        </Button>
        <Button
          variant="quiet"
          size="md"
          className="w-full"
          render={<a href={telHref} />}
        >
          <Phone aria-hidden="true" strokeWidth={1.75} />
          {contact.phone}
        </Button>
      </div>
    </aside>
  )
}

export { ProgramActionRail }
