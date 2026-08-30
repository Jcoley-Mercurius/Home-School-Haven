"use client"

/* The destination list holds Lucide icon *components*, and `PortalShell` is a
   Client Component — a function cannot cross the server/client boundary as a
   prop. This file was a client module before the shell was extracted, and it
   stays one so the list is constructed on the same side that consumes it. The
   page still passes only `viewerLabel` and `children`, both serializable. */

import {
  CalendarDays,
  Heart,
  LayoutDashboard,
  Megaphone,
  BookOpen,
  UserRound,
  Users,
} from "lucide-react"

import { PortalShell } from "@/components/layout/portal-shell"

import type { PortalDestination } from "@/components/layout/portal-shell"

/**
 * The family portal shell (MDS `layout.sidebar`, `components.navigation`,
 * MDS-REF-005, MDS-REF-007).
 *
 * The responsive mechanism — 264 px sidebar, 72 px rail, 60 px header plus a
 * five-destination bottom bar — now lives in `portal-shell.tsx`, which the
 * administrator area shares. What stays here is the part that is actually
 * about families: which destinations exist, in which order, and which five
 * reach the mobile bar. The rendered markup is unchanged by the extraction.
 *
 * WHY FIVE ON MOBILE, AND WHICH FIVE
 *
 * MDS caps mobile bottom navigation at five and sends the rest to "the mobile
 * account or More menu". Announcements and Resources are the two that move,
 * because both are reachable in one tap from their own Overview cards, so the
 * deferred thing is a duplicate navigation path and not a piece of meaning.
 * Nothing about enrollment, payment, consent, or privacy is hidden to simplify
 * the layout, which is the rule that actually matters here.
 *
 * Authorization is NOT here. This is chrome. Every route calls its own guard,
 * and a link this component renders reaches nothing the server has not already
 * agreed to hand over.
 */

/* MDS components.navigation.specification.family, in the approved order. */
const DESTINATIONS: PortalDestination[] = [
  {
    label: "Overview",
    href: "/family",
    icon: LayoutDashboard,
    onMobileBar: true,
  },
  { label: "Programs", href: "/programs", icon: BookOpen, onMobileBar: true },
  {
    label: "Schedule",
    href: "/family/schedule",
    icon: CalendarDays,
    onMobileBar: true,
  },
  {
    label: "Announcements",
    href: "/family/announcements",
    icon: Megaphone,
    onMobileBar: false,
  },
  {
    label: "Resources",
    href: "/family/resources",
    icon: Heart,
    onMobileBar: false,
  },
  {
    label: "Family",
    href: "/family/household",
    icon: Users,
    onMobileBar: true,
  },
  { label: "Account", href: "/account", icon: UserRound, onMobileBar: true },
]

/**
 * Family portal shell with responsive role navigation.
 * @param viewerLabel - The signed-in adult's name or email. No child name
 *   appears in chrome that persists across every page.
 * @param children - The page content.
 * @returns The shell.
 */
function FamilyPortalShell({
  viewerLabel,
  children,
}: {
  viewerLabel: string
  children: React.ReactNode
}) {
  return (
    <PortalShell
      destinations={DESTINATIONS}
      navLabel="Family"
      mobileNavLabel="Family sections"
      homeHref="/family"
      homeLabel="Home School Haven of SWFL — family overview"
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

export { FamilyPortalShell, DESTINATIONS }
