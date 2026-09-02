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

      {/* MPS-REQ-012: registration begins with an eligibility evaluation, so
          the family path comes BEFORE the checkout panel and is the primary
          action of the two. This link is unconditional and the page stays
          static: `/family/enroll/[slug]` guards itself, and a signed-out
          visitor is sent to sign-in and returned here. Reading the session on
          this public page to decide the label would make every program page
          dynamic to change one word. */}
      <div className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]">
        <h3 className="hsh-label text-[var(--hsh-text-primary)]">
          Register a student
        </h3>
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          Sign in to your family account to choose a student. Home School Haven
          checks the program, its places, and your family&rsquo;s details before
          any payment step.
        </p>
        <Button
          variant="primary"
          size="md"
          className="w-full"
          render={<Link href={`/family/enroll/${program.slug}`} />}
        >
          Register a Student
        </Button>
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
