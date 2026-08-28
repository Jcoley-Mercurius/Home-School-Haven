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

function CheckoutHandoff({ program }: { program: Program }) {
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  return (
    <section
      aria-labelledby="registration-heading"
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <h2
        id="registration-heading"
        className="hsh-h4 text-[var(--hsh-text-primary)]"
      >
        Registration
      </h2>

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
            start here yet. Use the guidance panel below, or call{" "}
            <a
              href={telHref}
              data-inline-link="true"
              className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              {contact.phone}
            </a>
            , and we will register your child with you.
          </p>
        </>
      )}
    </section>
  )
}

export { CheckoutHandoff, HANDOFF_NOTICE }
