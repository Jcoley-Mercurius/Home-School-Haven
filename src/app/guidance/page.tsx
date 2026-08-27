import type { Metadata } from "next"
import { Mail, MapPin, Phone } from "lucide-react"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { GuidanceForm } from "@/components/guidance/guidance-form"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { contact } from "@/content/foundation-content"

/**
 * Request Guidance (MPS-REQ-009, MPS-REQ-010; MPS-WFL-001 and MPS-WFL-004).
 *
 * The approved flow is built in full: request type, adult contact details,
 * optional program, message, server-side validation, and every outcome state.
 *
 * Owner decision 2026-08-27: build the form now and connect the destination
 * when one exists. Today there is nowhere authorized for a request to go —
 * Supabase is not installed, Resend is not configured, no recipient address is
 * published, and logging contact details is prohibited by
 * `mts/SECURITY-ARCHITECTURE.md`. The page therefore says so before anyone
 * types, and a submission returns the truthful "not sent" state rather than a
 * confirmation nothing stands behind (MPS-ACC-014). See
 * `src/lib/guidance/recorder.ts` for the single place that changes when the
 * destination is approved.
 *
 * No child or student information is collected here (AGENTS.md §11).
 */
export const metadata: Metadata = {
  title: "Request Guidance — Home School Haven of SWFL",
  description:
    "Ask Home School Haven of SWFL for help choosing the right program for your child.",
}

export default function GuidancePage() {
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="hsh-container hsh-container-reading flex flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-12)]">
          <Breadcrumbs
            trail={[
              { label: "Home", href: "/" },
              { label: "Request guidance" },
            ]}
          />
          <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
            Request guidance
          </p>
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Not sure where to begin?
          </h1>
          <p className="hsh-body-lg text-[var(--hsh-text-secondary)]">
            Tell us what you are looking for and we will help you find the right
            fit for your child. There is no obligation, and sending a request is
            not an enrollment.
          </p>

          {/* Stated before the form, not after a failed submission. */}
          <div className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              Online requests are not open yet
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              This is a private review environment. The form below works and is
              checked, but Home School Haven has not connected a destination for
              it yet, so nothing you send is recorded or seen by anyone. To
              reach us today, please call{" "}
              <a
                href={telHref}
                data-inline-link="true"
                className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
              >
                {contact.phone}
              </a>
              .
            </p>
          </div>

          <GuidanceForm />
        </section>

        <section
          aria-labelledby="contact-heading"
          className="hsh-container hsh-container-reading flex flex-col gap-[var(--hsh-space-4)] pb-[var(--hsh-space-16)]"
        >
          <h2
            id="contact-heading"
            className="hsh-h3 text-[var(--hsh-text-primary)]"
          >
            Reach us directly
          </h2>
          <ul className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-6)]">
            <li className="hsh-body flex items-center gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
              <Phone
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--hsh-forest-500)]"
                strokeWidth={1.75}
              />
              <a
                href={telHref}
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
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
