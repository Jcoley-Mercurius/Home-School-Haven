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
 * integration rules; SECURITY-ARCHITECTURE "keep private data out of URLs"),
 * and `rel="noreferrer"` keeps this page's own address, which can carry an
 * enrollment id, from travelling as the Referer.
 *
 * WHERE A LINK MAY APPEAR
 *
 * `placement="catalog"` is the public program page. It has no enrollment and
 * therefore no evaluation, so it never renders a checkout link: offering one
 * would let anyone pay for a program the MPS-REQ-012 evaluation has not
 * cleared. It says where checkout happens instead.
 *
 * `placement="eligible"` is rendered only by a caller that has already checked
 * `mayOfferCheckout(state)` — `started`, and nothing else. It renders the link
 * when the program has an approved destination and the truthful unavailable
 * state when it does not (`checkoutUrl` is `null`, as for Tutoring).
 *
 * Following the link records nothing. There is no click handler, no request,
 * and no return page: navigation is not a payment event, and coming back is
 * not one either (MPS-REQ-013; TECHNOLOGY-BLUEPRINT flow step 4).
 *
 * STEP UP is not mentioned. The approved GoDaddy checkout has no coupon field
 * (verified 2026-09-19), so telling a family to enter one there would be
 * untrue; the owner chose to show no coupon line until that is settled
 * (prompts/external-checkout-payment-truth.md §5, GAP-015).
 */
const HANDOFF_NOTICE =
  "Registration and payment are completed on Home School Haven's own checkout page, away from this site. Starting checkout does not confirm payment and does not confirm your child's place. Enrollment is confirmed only after Home School Haven verifies it with you."

/* Narrowed to the two fields this component reads, so it serves both the
   public program page and a family's own enrollment page without either having
   to construct a whole `Program` it does not have. */
type HandoffProgram = Pick<Program, "name" | "checkoutUrl">

/**
 * @param program - The program's name and approved checkout link, if any.
 * @param placement - `catalog` (public page, never a link) or `eligible` (the
 *   caller has checked `mayOfferCheckout`).
 * @param studentName - The child this checkout is for. Two children can share
 *   one program, and their two links must not share one accessible name.
 * @param headingId - Unique id for the heading. The family registration result
 *   renders one handoff per program, and two sections cannot share an id.
 * @param heading - Heading text. Defaults to "Registration" in the catalog and
 *   "Checkout for {program}" once eligible.
 * @param headingLevel - Heading level for where the handoff sits in the outline.
 */
function CheckoutHandoff({
  program,
  placement,
  studentName,
  headingId = "registration-heading",
  heading,
  headingLevel = "h2",
}: {
  program: HandoffProgram
  placement: "catalog" | "eligible"
  studentName?: string
  headingId?: string
  heading?: string
  headingLevel?: "h2" | "h3" | "h4"
}) {
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`
  const Heading = headingLevel
  const headingText =
    heading ??
    (placement === "catalog" ? "Registration" : `Checkout for ${program.name}`)
  const forWhom = studentName
    ? `${program.name} (${studentName})`
    : program.name

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <Heading id={headingId} className="hsh-h4 text-[var(--hsh-text-primary)]">
        {headingText}
      </Heading>

      <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
        {HANDOFF_NOTICE}
      </p>

      {program.checkoutUrl && placement === "catalog" ? (
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          Checkout for {program.name} opens from your registration, after Home
          School Haven has checked the program, its places, and your
          family&rsquo;s details. There is no payment step on this page.
        </p>
      ) : program.checkoutUrl ? (
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
              for {forWhom} — opens Home School Haven&apos;s GoDaddy checkout
              page in a new tab
            </span>
            <ExternalLink aria-hidden="true" strokeWidth={1.75} />
          </Button>
          <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
            Opens Home School Haven&rsquo;s secure GoDaddy checkout in a new
            tab. Coming back to this site does not mark anything paid. Payment
            stays pending verification until Home School Haven confirms it.
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
            {/* Eligible means a registration is already recorded and there is
                no guidance panel beside it, so this must promise neither. */}
            {placement === "eligible"
              ? "Call"
              : "Use the guidance panel below, or call"}{" "}
            <a
              href={telHref}
              data-inline-link="true"
              className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              {contact.phone}
            </a>
            {placement === "eligible"
              ? ", and Home School Haven will help you with the next step."
              : ", and we will register your child with you."}
          </p>
        </>
      )}
    </section>
  )
}

export { CheckoutHandoff, HANDOFF_NOTICE }
