import { CircleHelp, ExternalLink, Lock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { contact, type Program } from "@/content/foundation-content"

/**
 * External checkout handoff (MPS-REQ-013, MPS-ACC-021, MDS-REF-004 §5
 * "Continue to Secure Checkout", DO-DONT.md "Trust states").
 *
 * The one rule this component exists to enforce: leaving for the external
 * checkout is a handoff, never payment success and never confirmed enrollment.
 * That sentence is visible before the action, not buried under it, and it is
 * shown in both states so the meaning never depends on which state is rendered.
 *
 * Nothing is appended to the checkout URL. No identifier, contact detail, or
 * enrollment reference may travel in that link (MTS INTEGRATION-MANIFEST
 * integration rules; SECURITY-ARCHITECTURE "keep private data out of URLs").
 *
 * `program.checkoutUrl` is `null` for every program today: the approved
 * artifacts authorize "the current program-specific pay.homeschoolhaven.org
 * links" but record no actual URL, and constructing a payment destination would
 * invent one. The unavailable state below is what that truthfully looks like.
 */
const HANDOFF_NOTICE =
  "Registration and payment are completed on Home School Haven's own checkout page, away from this site. Starting checkout does not confirm payment and does not confirm your child's place. Enrollment is confirmed only after Home School Haven verifies it with you."

/* Narrowed to the two fields this component reads, so it serves both the
   public program page and a family's own enrollment page without either having
   to construct a whole `Program` it does not have. */
type HandoffProgram = Pick<Program, "name" | "checkoutUrl">

/**
 * @param program - The program's name and published checkout link, if any.
 * @param headingId - Unique id for the heading. The family registration result
 *   renders one handoff per program, and two sections cannot share an id. The
 *   default keeps the program and enrollment pages unchanged.
 * @param heading - Heading text; defaults to "Registration".
 * @param headingLevel - Heading level for where the handoff sits in the outline.
 * @param afterRegistration - The handoff follows a recorded registration, where
 *   there is no guidance panel and the child is already registered, so the
 *   missing-link sentence must not promise either.
 */
function CheckoutHandoff({
  program,
  headingId = "registration-heading",
  heading = "Registration",
  headingLevel = "h2",
  afterRegistration = false,
}: {
  program: HandoffProgram
  headingId?: string
  heading?: string
  headingLevel?: "h2" | "h3" | "h4"
  afterRegistration?: boolean
}) {
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`
  const Heading = headingLevel

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <Heading id={headingId} className="hsh-h4 text-[var(--hsh-text-primary)]">
        {heading}
      </Heading>

      <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
        {HANDOFF_NOTICE}
      </p>

      {program.checkoutUrl ? (
        <>
          <Button
            variant="primary"
            size="md"
            className="w-full"
            render={
              <a
                href={program.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <Lock aria-hidden="true" strokeWidth={1.75} />
            Continue to Secure Checkout
            <span className="sr-only">
              {" "}
              for {program.name} — opens Home School Haven&apos;s external
              checkout page in a new tab
            </span>
            <ExternalLink aria-hidden="true" strokeWidth={1.75} />
          </Button>
          <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
            Payment stays pending verification until Home School Haven confirms
            it.
          </p>
        </>
      ) : (
        <>
          <Badge tone="neutral" className="self-start">
            <CircleHelp aria-hidden="true" strokeWidth={1.75} />
            Registration link not published
          </Badge>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Home School Haven has not published an online registration link for
            this program in this review environment, so there is nothing to
            start here yet.{" "}
            {afterRegistration
              ? "Call"
              : "Use the guidance panel below, or call"}{" "}
            <a
              href={telHref}
              data-inline-link="true"
              className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              {contact.phone}
            </a>
            {afterRegistration
              ? ", and Home School Haven will help you with the next step."
              : ", and we will register your child with you."}
          </p>
        </>
      )}
    </section>
  )
}

export { CheckoutHandoff, HANDOFF_NOTICE }
