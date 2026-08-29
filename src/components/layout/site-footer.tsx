import Link from "next/link"
import { MapPin, Phone } from "lucide-react"

import { contact, positioning, primaryNav } from "@/content/foundation-content"

/**
 * Public footer. Contact facts come from the approved import inventory; the
 * published phone number carries QA-003 and is provisional until confirmed.
 */
function SiteFooter() {
  return (
    <footer className="mt-[var(--hsh-space-20)] border-t border-[var(--hsh-border-default)] bg-[var(--hsh-surface-elevated)]">
      <div className="hsh-container hsh-container-public grid gap-[var(--hsh-space-10)] py-[var(--hsh-space-12)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[var(--hsh-space-3)]">
          <p className="hsh-h4 font-[family-name:var(--hsh-font-display)] font-semibold">
            Home School Haven of SWFL
          </p>
          <p className="hsh-body max-w-[46ch] text-[var(--hsh-text-secondary)]">
            {positioning.summary}
          </p>
          <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
            {positioning.faithIdentity}
          </p>
        </div>

        <div className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-label text-[var(--hsh-text-primary)]">Visit</h2>
          <p className="hsh-body flex items-start gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
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
          </p>
          <p className="hsh-body flex items-center gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
            <Phone
              aria-hidden="true"
              className="size-5 shrink-0 text-[var(--hsh-forest-500)]"
              strokeWidth={1.75}
            />
            {/* Standalone action, so it carries the MDS §8 44 px target. */}
            <a
              href={`tel:${contact.phone.replace(/-/g, "")}`}
              className="inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] hover:text-[var(--hsh-forest-700)]"
            >
              {contact.phone}
            </a>
          </p>
        </div>

        <div className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-label text-[var(--hsh-text-primary)]">Explore</h2>
          <ul className="flex flex-col gap-[var(--hsh-space-2)]">
            {primaryNav.map((item) => (
              <li key={item.label}>
                {item.available ? (
                  <Link
                    href={item.href}
                    className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] text-[var(--hsh-text-secondary)] hover:text-[var(--hsh-forest-700)]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="hsh-body text-[var(--hsh-neutral-400)]"
                  >
                    {item.label}
                    <span className="sr-only"> — coming soon</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--hsh-border-default)]">
        <div className="hsh-container hsh-container-public py-[var(--hsh-space-5)]">
          <p className="hsh-caption text-[var(--hsh-text-muted)]">
            Private Foundation Review environment. Program details reflect
            currently published content and are confirmed directly with Home
            School Haven. Photography on this site is placeholder art for layout
            review only — it is not approved photography and does not show real
            students.
          </p>
        </div>
      </div>
    </footer>
  )
}

export { SiteFooter }
