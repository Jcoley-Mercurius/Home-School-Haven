import Image from "next/image"
import Link from "next/link"
import { ExternalLink, Heart, MapPin, Phone, Sprout } from "lucide-react"

import {
  accountNav,
  contact,
  guidanceHref,
  primaryNav,
} from "@/content/foundation-content"

/**
 * The published privacy policy. It lives on the current Home School Haven
 * website, not in this application — no `/privacy-policy` route exists in the
 * Foundation Release, and inventing policy copy is barred (AGENTS.md §6).
 * The URL is the one recorded as evidence in `mps/MPS-PROJECT-STATE.yaml`
 * (reviewed 2026-08-26), so it is a verified destination rather than a guess.
 * It leaves the application, and the link says so in text and with a mark.
 */
const privacyPolicyHref = "https://homeschoolhaven.org/privacy-policy"

/**
 * Footer brand line, drawn in `public-resources-proposed.png` and requested by
 * the owner on 2026-09-02 ("that is how I want the footer to look").
 *
 * This is image copy, not an import-inventory row — it replaces the inventory
 * "Positioning" summary that stood here before. That summary is still the
 * authority for `positioning.summary` and is unchanged in
 * `foundation-content.ts`; only this footer line differs. The substitution
 * follows the D-A9 precedent set on the About page, where the owner directed
 * that reference-image copy be kept verbatim. It is flagged for Samantha's
 * content sign-off rather than treated as settled.
 */
const brandLine =
  "A Christ-centered homeschool community in Cape Coral, supporting families to learn, create, and belong."

/** The reference splits the primary navigation across two columns. */
const exploreLabels = ["Programs", "Calendar", "About"]
const resourceLabels = ["Resources", "Contact"]

const navByLabel = new Map(primaryNav.map((item) => [item.label, item]))

/**
 * One footer navigation column.
 *
 * Unavailable destinations keep the `primaryNav` convention used in the header:
 * rendered, muted, `aria-disabled`, and announced as "coming soon" rather than
 * silently dropped or linked somewhere they do not go.
 */
function FooterNavColumn({
  heading,
  labels,
}: {
  heading: string
  labels: string[]
}) {
  return (
    <div className="flex flex-col gap-[var(--hsh-space-3)]">
      <h2 className="hsh-label tracking-wide text-[var(--hsh-text-primary)] uppercase">
        {heading}
      </h2>
      <ul className="flex flex-col gap-[var(--hsh-space-1)]">
        {labels.map((label) => {
          const item = navByLabel.get(label)
          if (!item) return null
          return (
            <li key={label}>
              {item.available ? (
                <Link
                  href={item.href}
                  className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] text-[var(--hsh-text-secondary)] hover:text-[var(--hsh-forest-700)]"
                >
                  {label}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center text-[var(--hsh-neutral-400)]"
                >
                  {label}
                  <span className="sr-only"> — coming soon</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Public footer, composed to `mds/references/proposed/public-resources-proposed.png`
 * at the owner's direction (2026-09-02).
 *
 * That file is a *proposed* reference with no MDS-REF ID, so it carries layout
 * intent only; every colour, type role, spacing step, and target size below
 * still comes from `DESIGN-SYSTEM.md` and the `--hsh-*` tokens. Promoting the
 * image into the canonical set remains an owner governance action.
 *
 * Two decorations in the image are not reproduced. The botanical spray at the
 * lower right is an illustration and no such asset exists — generating one is
 * barred by DESIGN-SYSTEM.md §5, the same call already recorded for the About
 * page in `prompts/public-about-page.md` §4 — so the quiet Lucide leaf mark
 * closes the wave instead. The wave itself is a plain stroked path, a
 * geometric rule rather than artwork, and is drawn inline.
 *
 * The photography sentence in the bottom bar is scoped, not blanket. Real
 * staff portraits shipped on 2026-09-02, so "photography on this site is
 * placeholder art" became false; five placeholder images remain live (the home
 * hero, which About reuses, the community panel, and three program cards), so
 * dropping the sentence entirely would leave generated art of children running
 * unlabelled. It goes when `public/placeholder/` goes, and not before.
 *
 * The image also shows no contact block, policy link, or review disclaimer.
 * Those are kept, below the wave, in the quietest band of the footer: the
 * phone and address are verified published facts (QA-003), the placeholder
 * photography disclaimer is what stops a reviewer reading demo art as real
 * photographs of children, and dropping either to match a layout would trade a
 * truthfulness guard for a composition. "Powered by Mercurius" sits with them,
 * at the owner's instruction to keep it.
 */
function SiteFooter() {
  return (
    <footer className="mt-[var(--hsh-space-20)] border-t border-[var(--hsh-border-default)] bg-[var(--hsh-surface-page)]">
      <div className="hsh-container hsh-container-public grid gap-[var(--hsh-space-8)] py-[var(--hsh-space-12)] sm:grid-cols-2 lg:grid-cols-[minmax(0,2.9fr)_repeat(3,minmax(0,1fr))_minmax(0,1.7fr)] lg:gap-[var(--hsh-space-8)]">
        {/* Brand. The supplied asset, never a generated or redrawn one
            (AGENTS.md §7). The link carries the accessible name, so the image
            itself is decorative and takes an empty alt. */}
        <div className="flex flex-col gap-[var(--hsh-space-4)] sm:col-span-2 sm:flex-row sm:items-start sm:gap-[var(--hsh-space-5)] lg:col-span-1">
          <Link
            href="/"
            aria-label="Home School Haven of SWFL — home"
            className="inline-flex min-h-[var(--hsh-touch-target)] w-fit shrink-0 items-center rounded-[var(--hsh-radius-small)]"
          >
            <Image
              src="/brand/home-school-haven-logo.png"
              alt=""
              width={994}
              height={479}
              className="h-auto w-[132px]"
            />
          </Link>
          <p className="hsh-body max-w-[34ch] text-[var(--hsh-text-secondary)]">
            {brandLine}
          </p>
        </div>

        <FooterNavColumn heading="Explore" labels={exploreLabels} />
        <FooterNavColumn heading="Resources" labels={resourceLabels} />

        <div className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-label tracking-wide text-[var(--hsh-text-primary)] uppercase">
            Account
          </h2>
          <ul className="flex flex-col gap-[var(--hsh-space-1)]">
            <li>
              <Link
                href={accountNav.href}
                className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] text-[var(--hsh-text-secondary)] hover:text-[var(--hsh-forest-700)]"
              >
                {accountNav.label}
              </Link>
            </li>
            <li>
              <Link
                href={guidanceHref}
                className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] text-[var(--hsh-text-secondary)] hover:text-[var(--hsh-forest-700)]"
              >
                Request Guidance
              </Link>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-label tracking-wide text-[var(--hsh-text-primary)] uppercase">
            Stay Connected
          </h2>
          <p className="hsh-body max-w-[34ch] text-[var(--hsh-text-secondary)]">
            Helpful updates and community resources, shared with care.
          </p>
          {/* No subscription surface exists in the Foundation Release, and
              collecting family email addresses is gated behind Samantha's
              unapproved consent and retention decisions (AGENTS.md §10). So
              this keeps the `primaryNav` unavailable treatment rather than
              linking to an inquiry form that is not a subscription. */}
          <span
            aria-disabled="true"
            className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] text-[var(--hsh-neutral-400)]"
          >
            <Sprout aria-hidden="true" className="size-5" strokeWidth={1.75} />
            Get Updates
            <span className="sr-only"> — coming soon</span>
          </span>
        </div>
      </div>

      {/* Decorative wave with the heart the reference sets on it. Presentational
          only: it carries no meaning, so it is hidden from assistive technology
          and it is the one thing here that may be dropped at any width. */}
      <div
        aria-hidden="true"
        className="hsh-container hsh-container-public hidden items-center gap-[var(--hsh-space-2)] md:flex"
        style={{ paddingLeft: "max(var(--hsh-gutter-desktop), 22%)" }}
      >
        <Heart className="size-6 shrink-0 fill-[var(--hsh-coral-500)] text-[var(--hsh-coral-700)]" />
        <svg
          viewBox="0 0 1200 24"
          preserveAspectRatio="none"
          className="h-6 w-full text-[var(--hsh-neutral-400)]"
        >
          <path
            d="M0 20 C 100 20, 120 6, 220 6 S 360 20, 480 20 S 700 6, 840 6 S 1080 20, 1200 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <Sprout
          className="size-6 shrink-0 text-[var(--hsh-forest-500)]"
          strokeWidth={1.75}
        />
      </div>

      {/* Verified contact, policy, review disclaimer, and attribution. */}
      <div className="mt-[var(--hsh-space-6)] border-t border-[var(--hsh-border-default)]">
        <div className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-4)] py-[var(--hsh-space-5)]">
          <div className="flex flex-col gap-[var(--hsh-space-2)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-[var(--hsh-space-6)]">
            <p className="hsh-body-sm flex items-start gap-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[var(--hsh-forest-500)]"
                strokeWidth={1.75}
              />
              <span>{contact.addressLines.join(", ")}</span>
            </p>
            {/* Standalone action, so it carries the MDS §8 44 px target. */}
            <a
              href={`tel:${contact.phone.replace(/-/g, "")}`}
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-small)] text-[var(--hsh-text-secondary)] hover:text-[var(--hsh-forest-700)]"
            >
              <Phone
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--hsh-forest-500)]"
                strokeWidth={1.75}
              />
              {contact.phone}
            </a>
            <a
              href={privacyPolicyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-small)] text-[var(--hsh-text-secondary)] hover:text-[var(--hsh-forest-700)]"
            >
              Privacy Policy
              <ExternalLink
                aria-hidden="true"
                className="size-4 shrink-0"
                strokeWidth={1.75}
              />
              <span className="sr-only"> (opens on homeschoolhaven.org)</span>
            </a>
          </div>

          <p className="hsh-caption text-[var(--hsh-text-muted)]">
            Private Foundation Review environment. Program details reflect
            currently published content and are confirmed directly with Home
            School Haven. Photography is supplied and approved by Home School
            Haven; the three program card images are placeholder art for layout
            review only and do not show real students.
          </p>
          <p className="hsh-caption text-[var(--hsh-text-muted)]">
            Powered by Mercurius
          </p>
        </div>
      </div>
    </footer>
  )
}

export { SiteFooter }
