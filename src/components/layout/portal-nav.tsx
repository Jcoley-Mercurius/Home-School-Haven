import Link from "next/link"

import { SignOutButton } from "@/components/auth/sign-out-button"

import type { Viewer } from "@/lib/auth/session"

/**
 * Role-specific portal navigation (MDS `navigation.portal_sidebar`, and the
 * per-role destination lists in `navigation.specification`).
 *
 * Foundation scope: only the destinations that exist are listed. MDS specifies
 * the full family, educator, and administrator destination sets, but linking to
 * Schedule, Rosters, or Reports before they are built would produce the broken
 * links the header already avoids (owner decision, 2026-08-27). The remaining
 * destinations arrive with MTS IMPLEMENTATION-PLAN Phases 3 and 4.
 *
 * MDS gap recorded for review: `layout.sidebar` specifies a 264px expanded
 * desktop sidebar, a 72px tablet rail, and a maximum five-destination mobile
 * bottom navigation. With one destination per role there is nothing to
 * navigate between, so this renders as a context bar rather than a sidebar with
 * a single item in it. The full sidebar is built when the destinations exist.
 */
const ROLE_LABELS: Record<string, string> = {
  family: "Family",
  educator: "Educator",
  admin: "Administration",
}

export function PortalNav({
  viewer,
  area,
}: {
  viewer: Viewer
  area: "family" | "educator" | "admin"
}) {
  return (
    <div className="border-b border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)]">
      <div className="hsh-container hsh-container-public flex min-h-[64px] flex-wrap items-center justify-between gap-[var(--hsh-space-4)] py-[var(--hsh-space-3)]">
        <nav aria-label="Portal">
          <ul className="flex items-center gap-[var(--hsh-space-4)]">
            <li>
              <Link
                href={`/${area}`}
                aria-current="page"
                className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-primary)]"
              >
                {ROLE_LABELS[area]}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex items-center gap-[var(--hsh-space-4)]">
          {/* Identifies the signed-in adult only. No child name appears in
              chrome that persists across every page. */}
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {viewer.displayName ?? viewer.email}
          </p>
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
