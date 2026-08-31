"use client"

/* Client module for the same reason as the family and administrator shells:
   the destination list holds Lucide icon components, and a function cannot be
   passed to a Client Component as a prop. The page still passes only
   `viewerLabel` and `children`, both serializable. */

import {
  BookOpen,
  CalendarDays,
  Heart,
  LayoutDashboard,
  Megaphone,
  UserRound,
  Users,
} from "lucide-react"

import { PortalShell } from "@/components/layout/portal-shell"

import type { PortalDestination } from "@/components/layout/portal-shell"

/**
 * The educator workspace shell (MDS `layout.sidebar`,
 * `navigation.specification.educator`, `page_shells.educator_workspace`).
 *
 * It shares the responsive mechanism in `portal-shell.tsx` with the family and
 * administrator areas, so the 264 px desktop sidebar, the 72 px tablet rail
 * with accessible labels, and the 60 px mobile header plus bottom bar behave
 * identically in all three. What lives here is only the part that is about
 * educators: which destinations exist, in which order, and which reach the
 * mobile bar.
 *
 * EVERY APPROVED DESTINATION EXISTS
 *
 * MDS names six for this role — Overview, Assigned Programs, Schedule, Rosters,
 * Announcements, Resources — and this slice builds all six. Unlike the
 * administrator shell there is no destination left out and no D-AO3 equivalent
 * to record: the sidebar is the specified sidebar.
 *
 * Account is appended as a seventh, which the MDS educator list does not name.
 * That is deviation D-EW1, and it is the same one the family and administrator
 * shells already carry: a portal needs an exit from whatever page you are on,
 * and sign-out lives in the chrome. It adds no reach — `/account` is the same
 * route every signed-in viewer already has.
 *
 * WHICH FIVE REACH THE MOBILE BAR
 *
 * MDS caps mobile bottom navigation at five at 44 px targets. Overview,
 * Assigned Programs, Schedule, Rosters, and Account take the bar; Announcements
 * and Resources take the shell's existing "More" row. That mirrors the family
 * shell's choice and rests on the same reasoning: both are one tap from their
 * own Overview cards, so what is deferred is a duplicate navigation path rather
 * than a piece of meaning. Nothing about a child's enrollment state is moved
 * off the bar to make the layout tidier.
 *
 * Authorization is NOT here. This is chrome: every educator route calls
 * `requireRole("educator", …)` itself, every read is filtered to the viewer's
 * own assignments, and RLS decides independently what the database returns. A
 * link rendered here reaches nothing the server has not already agreed to hand
 * over, and hiding one would not be a control.
 */

const DESTINATIONS: PortalDestination[] = [
  {
    label: "Overview",
    href: "/educator",
    icon: LayoutDashboard,
    onMobileBar: true,
  },
  {
    label: "Assigned Programs",
    href: "/educator/programs",
    icon: BookOpen,
    onMobileBar: true,
  },
  {
    label: "Schedule",
    href: "/educator/schedule",
    icon: CalendarDays,
    onMobileBar: true,
  },
  {
    label: "Rosters",
    href: "/educator/rosters",
    icon: Users,
    onMobileBar: true,
  },
  {
    label: "Announcements",
    href: "/educator/announcements",
    icon: Megaphone,
    onMobileBar: false,
  },
  {
    label: "Resources",
    href: "/educator/resources",
    icon: Heart,
    onMobileBar: false,
  },
  { label: "Account", href: "/account", icon: UserRound, onMobileBar: true },
]

/**
 * Educator portal shell with responsive role navigation.
 * @param viewerLabel - The signed-in educator's name or email. No child name
 *   appears in chrome that persists across every page.
 * @param children - The page content.
 * @returns The shell.
 */
function EducatorPortalShell({
  viewerLabel,
  children,
}: {
  viewerLabel: string
  children: React.ReactNode
}) {
  return (
    <PortalShell
      destinations={DESTINATIONS}
      navLabel="Educator"
      mobileNavLabel="Educator sections"
      homeHref="/educator"
      homeLabel="Home School Haven of SWFL — educator overview"
      brandPanel={{
        title: "A Haven, Not Just a Platform",
        body: "Inspire. Equip. Encourage.",
      }}
      viewerLabel={viewerLabel}
    >
      {children}
    </PortalShell>
  )
}

export { DESTINATIONS, EducatorPortalShell }
