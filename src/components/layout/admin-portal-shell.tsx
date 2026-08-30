"use client"

/* Client module for the same reason as the family shell: the destination list
   holds Lucide icon components, and functions cannot be passed to a Client
   Component as props. */

import { LayoutDashboard, UserRound } from "lucide-react"

import { PortalShell } from "@/components/layout/portal-shell"

import type { PortalDestination } from "@/components/layout/portal-shell"

/**
 * The administrator operations shell (MDS `layout.sidebar`,
 * `page_shells.admin_operations`, `navigation.specification.admin`,
 * MDS-REF-009).
 *
 * It shares the responsive mechanism in `portal-shell.tsx` with the family
 * area, so the 264 px sidebar, the 72 px tablet rail with accessible labels,
 * and the 60 px mobile header plus bottom bar behave identically in both.
 *
 * WHICH DESTINATIONS ARE LISTED, AND WHY THE OTHER SEVEN ARE NOT
 *
 * MDS `navigation.specification.admin` names nine destinations: Overview,
 * Programs, Enrollments, Families, Educators, Schedule, Communications,
 * Reports, and Settings. Exactly one of them is built. `/programs` exists but
 * is the *public* catalog, which shows published rows only — linking to it from
 * an administrator sidebar would misrepresent what it is.
 *
 * The MDS component set has no approved "destination not yet available"
 * navigation pattern, and inventing one would be a new reusable convention,
 * which DO-DONT requires be treated as an MDS gap rather than decided here
 * (MDS-GAP-ADMIN-003). So the unbuilt destinations stay out of the navigation
 * entirely, following the owner decision of 2026-08-27 that only destinations
 * which exist are listed. Each one joins this list in the slice that builds it;
 * `prompts/admin-operations-foundation.md` §18 records the order.
 *
 * A two-item sidebar is thinner than MDS-REF-009 draws, and that is recorded as
 * deviation D-AO3 rather than papered over with links that go nowhere.
 *
 * Authorization is NOT here. This is chrome: `/admin` calls `requireAdmin()`
 * itself, and RLS decides independently what the database will hand over.
 */

const DESTINATIONS: PortalDestination[] = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
    onMobileBar: true,
  },
  { label: "Account", href: "/account", icon: UserRound, onMobileBar: true },
]

/**
 * Administrator portal shell with responsive role navigation.
 * @param viewerLabel - The signed-in administrator's name or email.
 * @param children - The page content.
 * @returns The shell.
 */
function AdminPortalShell({
  viewerLabel,
  children,
}: {
  viewerLabel: string
  children: React.ReactNode
}) {
  return (
    <PortalShell
      destinations={DESTINATIONS}
      navLabel="Administration"
      mobileNavLabel="Administration sections"
      homeHref="/admin"
      homeLabel="Home School Haven of SWFL — operations overview"
      brandPanel={{
        title: "A Haven, Not Just a Platform",
        body: "Creativity. Curiosity. Character. Community.",
      }}
      viewerLabel={viewerLabel}
    >
      {children}
    </PortalShell>
  )
}

export { AdminPortalShell, DESTINATIONS }
