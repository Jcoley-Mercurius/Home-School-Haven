"use client"

/* Client module for the same reason as the family shell: the destination list
   holds Lucide icon components, and functions cannot be passed to a Client
   Component as props. */

import {
  BookOpen,
  GraduationCap,
  Home,
  LayoutDashboard,
  UserRound,
  Users,
} from "lucide-react"

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
 * WHICH DESTINATIONS ARE LISTED, AND WHY THE OTHER FIVE ARE NOT
 *
 * MDS `navigation.specification.admin` names nine destinations: Overview,
 * Programs, Enrollments, Families, Educators, Schedule, Communications,
 * Reports, and Settings. Six of them are built. Programs and Enrollments joined
 * this list in the program-and-enrollment-operations slice; Families and
 * Educators joined it in the family-and-educator-operations slice, which
 * narrows deviation D-AO3 from five missing destinations to three.
 *
 * `/admin/programs` is the operations list, which shows drafts and archived
 * programs as well as published ones. It is deliberately not the public
 * `/programs` catalog — linking an administrator sidebar to a surface that
 * hides drafts would misrepresent what it is.
 *
 * The MDS component set has no approved "destination not yet available"
 * navigation pattern, and inventing one would be a new reusable convention,
 * which DO-DONT requires be treated as an MDS gap rather than decided here
 * (MDS-GAP-ADMIN-003). So the unbuilt destinations stay out of the navigation
 * entirely, following the owner decision of 2026-08-27 that only destinations
 * which exist are listed. Each one joins this list in the slice that builds it.
 *
 * A six-item sidebar is still thinner than the nine MDS-REF-009 draws, and that
 * remains deviation D-AO3 rather than being papered over with links that go
 * nowhere.
 *
 * WHY ONLY FOUR OF THE SIX SIT ON THE MOBILE BAR
 *
 * The MDS mobile bottom bar holds a small number of destinations legibly at
 * 44 px targets with 8 px between them. Overview, Programs, Enrollments, and
 * Account are the four an administrator moves between constantly; Families and
 * Educators are reference surfaces reached from the sidebar and the rail, so
 * they take the shell's existing "More" row, which keeps them reachable on
 * mobile rather than hidden. Cramming six onto the bar itself would shrink the
 * targets below the approved 44 px minimum, which the MDS does not permit for
 * the sake of a shorter path.
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
  {
    label: "Programs",
    href: "/admin/programs",
    icon: BookOpen,
    onMobileBar: true,
  },
  {
    label: "Enrollments",
    href: "/admin/enrollments",
    icon: Users,
    onMobileBar: true,
  },
  {
    label: "Families",
    href: "/admin/families",
    icon: Home,
    onMobileBar: false,
  },
  {
    label: "Educators",
    href: "/admin/educators",
    icon: GraduationCap,
    onMobileBar: false,
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
