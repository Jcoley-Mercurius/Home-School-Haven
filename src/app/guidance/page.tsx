import type { Metadata } from "next"
import Link from "next/link"
import { Mail, MapPin, Phone } from "lucide-react"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { Button } from "@/components/ui/button"
import { contact, programsHref } from "@/content/foundation-content"

/**
 * Request Guidance — stub route.
 *
 * Destination for every Request Guidance action so those actions are real links
 * rather than dimmed controls (owner decision, 2026-08-27).
 *
 * Deliberately NOT a form. MPS-REQ-009's guidance/assistance request workflow is
 * unbuilt, and collecting family contact details needs Samantha's approved
 * child-data, consent, and retention policy first (AGENTS.md §10, §11). Until
 * then this page routes people to the already-published contact facts.
 */
export const metadata: Metadata = {
  title: "Request Guidance — Home School Haven of SWFL",
  description:
    "Reach Home School Haven of SWFL for help choosing the right program for your child.",
}

export default function GuidancePage() {
  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="hsh-container hsh-container-reading flex flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-16)]">
          <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
            Request guidance
          </p>
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Not sure where to begin?
          </h1>
          <p className="hsh-body-lg text-[var(--hsh-text-secondary)]">
            Tell us about your child and we will help you find the right fit.
            The online guidance request opens later in this review — until then,
            reach us directly and we will walk you through the options.
          </p>

          <ul className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-6)]">
            <li className="hsh-body flex items-center gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
              <Phone
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--hsh-forest-500)]"
                strokeWidth={1.75}
              />
              <a
                href={`tel:${contact.phone.replace(/-/g, "")}`}
                className="inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] hover:text-[var(--hsh-forest-700)]"
              >
                {contact.phone}
              </a>
            </li>
            <li className="hsh-body flex items-start gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
              <MapPin
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 text-[var(--hsh-forest-500)]"
                strokeWidth={1.75}
              />
              <span>
                {contact.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </li>
            <li className="hsh-body-sm flex items-start gap-[var(--hsh-space-3)] text-[var(--hsh-text-muted)]">
              <Mail
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 text-[var(--hsh-forest-500)]"
                strokeWidth={1.75}
              />
              <span>
                A published email address is not part of the approved content
                inventory yet, so none is shown here.
              </span>
            </li>
          </ul>

          <div>
            <Button
              variant="secondary"
              size="md"
              render={<Link href={programsHref} />}
            >
              Browse published programs
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
