import type { Metadata } from "next"
import { Heart, Users } from "lucide-react"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { ContactRequest } from "@/components/contact/contact-request"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { contact } from "@/content/foundation-content"
import { contactHero, reassurancePanel } from "@/content/contact"

/**
 * Public Contact page (MPS-REQ-009, MPS-REQ-010, MPS-ACC-012, MPS-ACC-014;
 * DESIGN-SYSTEM.md §7 public shell, §8 responsive behavior).
 *
 * Composition follows `mds/references/proposed/public-contact-proposed.png`.
 * That image is *proposed*, not canonical MDS: it carries no MDS-REF ID, so the
 * authority for every visual decision here remains the design specification,
 * the `--hsh-*` tokens, and the approved references. Promoting the image is an
 * owner governance action that has not happened.
 *
 * **The thing to understand before changing this page.** This is the single
 * public inquiry surface (owner decision 2026-08-28, resolution A of
 * `prompts/public-contact-page.md` §1). `/guidance` redirects here, and the
 * form is the approved Request Guidance flow re-laid-out — one schema, one
 * server action, one recording boundary. Do not add a second form.
 *
 * Two parts of the reference are deliberately not built:
 * the decorative photograph and botanical illustration (no such asset exists
 * and DESIGN-SYSTEM.md §5 forbids generating one, D-C1) and the reference's own
 * footer composition (the implemented `SiteFooter` is already approved, D-C2).
 * The drawn consent checkbox is also absent: recorded consent remains
 * Samantha's decision (§12.3).
 *
 * The reference draws "Request received. We'll be in touch." as a resting
 * section. It is built as a submission state instead, and it is unreachable
 * until an authorized destination exists — `recordGuidanceRequest` returns
 * `unavailable`, and claiming success with no record behind it is what
 * MPS-ACC-014 forbids (D-C4).
 *
 * Statically rendered with no `revalidate` and no data read.
 */
export const metadata: Metadata = {
  title: "Contact — Home School Haven of SWFL",
  description:
    "Ask Home School Haven of SWFL about programs, plan a visit, or request a private conversation with our care team.",
}

const panelMarks = { people: Users, heart: Heart } as const

export default function ContactPage() {
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1 pb-[var(--hsh-space-16)]">
        <section className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-5)] pt-[var(--hsh-space-10)]">
          <Breadcrumbs
            trail={[{ label: "Home", href: "/" }, { label: "Contact" }]}
          />
          <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
            {contactHero.eyebrow}
          </p>
          <h1 className="hsh-display-lg max-w-[20ch] text-[var(--hsh-text-primary)]">
            {contactHero.heading}
          </h1>
          <p className="hsh-body-lg max-w-[46ch] text-[var(--hsh-text-secondary)]">
            {contactHero.summary}
          </p>

          {/* Stated before anything is typed, not after a failed submission. */}
          <div className="flex max-w-[70ch] flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]">
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
        </section>

        {/* Pathways and form. The reassurance panel is server-rendered here and
            handed to the client region as children. */}
        <ContactRequest>
          <div className="flex flex-col gap-[var(--hsh-space-6)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-8)]">
            <h3 className="hsh-h2 text-[var(--hsh-text-primary)]">
              {reassurancePanel.heading}
            </h3>
            <p className="hsh-body max-w-[44ch] text-[var(--hsh-text-secondary)]">
              {reassurancePanel.body}
            </p>
            <ul className="flex flex-col gap-[var(--hsh-space-5)]">
              {reassurancePanel.points.map((point) => {
                const Mark = panelMarks[point.glyph]
                return (
                  <li
                    key={point.text}
                    className="flex items-start gap-[var(--hsh-space-4)]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--hsh-surface-card)] text-[var(--hsh-forest-600)]"
                    >
                      <Mark className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="hsh-body text-[var(--hsh-text-secondary)]">
                      {point.text}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </ContactRequest>

        <section
          aria-labelledby="reach-us-heading"
          className="hsh-container hsh-container-public mt-[var(--hsh-space-10)] flex flex-col gap-[var(--hsh-space-4)]"
        >
          <h2
            id="reach-us-heading"
            className="hsh-h3 text-[var(--hsh-text-primary)]"
          >
            Reach us directly
          </h2>
          <div className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-6)]">
            <a
              href={telHref}
              className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              Call {contact.phone}
            </a>
            <p className="hsh-body text-[var(--hsh-text-secondary)]">
              {contact.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
            <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
              A published email address is not part of the approved content
              inventory yet, so none is shown here.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
