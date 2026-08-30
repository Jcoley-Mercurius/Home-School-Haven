"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  Heart,
  LayoutDashboard,
  Megaphone,
  BookOpen,
  UserRound,
  Users,
  MoreHorizontal,
} from "lucide-react"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { cn } from "@/lib/utils"

/**
 * The family portal shell (MDS `layout.sidebar`, `components.navigation`,
 * MDS-REF-005, MDS-REF-007).
 *
 * This closes the MDS gap `portal-nav.tsx` recorded on 2026-08-27: "with one
 * destination per role there is nothing to navigate between ... the full
 * sidebar is built when the destinations exist." They exist now.
 *
 * Three compositions, not one shrinking layout (DO-DONT "Do not shrink desktop
 * compositions until they technically fit"):
 *
 *   desktop 1024+  264 px expanded sidebar, all seven destinations, labels
 *   tablet 640–1023  72 px rail, all seven, icon with an accessible name
 *   mobile 0–639   60 px header plus five-destination bottom navigation
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
 * The rail and the bottom bar are rendered as separate <nav> landmarks with
 * distinct accessible names, so a screen-reader user is never offered "the same
 * navigation" twice with different contents.
 *
 * Authorization is NOT here. This is chrome. Every route calls its own guard,
 * and a link this component renders reaches nothing the server has not already
 * agreed to hand over.
 */

type Destination = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  /** In the five-destination mobile bottom bar rather than the More menu. */
  onMobileBar: boolean
}

/* MDS components.navigation.specification.family, in the approved order. */
const DESTINATIONS: Destination[] = [
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

const MOBILE_BAR = DESTINATIONS.filter((item) => item.onMobileBar)
const MOBILE_MORE = DESTINATIONS.filter((item) => !item.onMobileBar)

/**
 * `/family` must not light up while the viewer is on `/family/schedule`, and
 * `/programs` must light up on `/programs/art-lab`.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/family") return pathname === "/family"
  return pathname === href || pathname.startsWith(`${href}/`)
}

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
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--hsh-surface-page)] sm:flex-row">
      {/* ---------------------------------------------------------------
          Tablet rail and desktop sidebar. Forest 700 panel with the
          canonical logo on its own warm-ivory surface, as MDS-REF-007 draws
          it and DO-DONT requires — never a reversed or redrawn variant.
          --------------------------------------------------------------- */}
      <div
        className={cn(
          "hidden shrink-0 bg-[var(--hsh-forest-700)] sm:flex sm:flex-col",
          "sm:sticky sm:top-0 sm:h-dvh sm:w-[72px] lg:w-[264px]",
          "px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] lg:px-[var(--hsh-space-4)]",
        )}
      >
        <Link
          href="/family"
          aria-label="Home School Haven of SWFL — family overview"
          className="mb-[var(--hsh-space-6)] flex items-center justify-center rounded-[var(--hsh-radius-card)] bg-[var(--hsh-ivory-100)] p-[var(--hsh-space-1)] lg:p-[var(--hsh-space-4)]"
        >
          <Image
            src="/brand/home-school-haven-logo.png"
            alt=""
            width={994}
            height={479}
            priority
            className="h-auto w-[56px] lg:w-[168px]"
          />
        </Link>

        <nav aria-label="Family" className="flex-1">
          <ul className="flex flex-col gap-[var(--hsh-space-2)]">
            {DESTINATIONS.map((item) => {
              const current = isCurrent(pathname, item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "hsh-body flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-3)]",
                      "rounded-[var(--hsh-radius-control)] font-semibold transition-colors",
                      "justify-center px-[var(--hsh-space-2)] lg:justify-start lg:px-[var(--hsh-space-4)]",
                      current
                        ? "bg-[var(--hsh-forest-600)] text-[var(--hsh-text-inverse)]"
                        : "text-[var(--hsh-forest-100)] hover:bg-[var(--hsh-forest-600)] hover:text-[var(--hsh-text-inverse)]",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-5"
                      strokeWidth={1.75}
                    />
                    {/* The rail keeps the name available to assistive
                        technology rather than dropping it (MDS layout.sidebar
                        "collapsed navigation rail with accessible labels"). */}
                    <span className="sr-only lg:not-sr-only">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* MDS-REF-007's quiet brand panel. Decorative and desktop-only: the
            rail has no room for it, and it carries no operational meaning. */}
        <div className="hidden rounded-[var(--hsh-radius-card)] bg-[var(--hsh-forest-600)] p-[var(--hsh-space-4)] lg:block">
          <p className="hsh-label text-[var(--hsh-text-inverse)]">
            A Haven, Not Just a Platform
          </p>
          <p className="hsh-body-sm mt-[var(--hsh-space-2)] text-[var(--hsh-forest-100)]">
            Inspire. Equip. Encourage.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header — 60 px, MDS layout.header.mobile. */}
        <header className="flex h-[60px] items-center justify-between gap-[var(--hsh-space-4)] border-b border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-gutter-mobile)] sm:hidden">
          <Link
            href="/family"
            aria-label="Home School Haven of SWFL — family overview"
            className="flex items-center rounded-[var(--hsh-radius-small)]"
          >
            <Image
              src="/brand/home-school-haven-logo.png"
              alt=""
              width={994}
              height={479}
              className="h-auto w-[104px]"
            />
          </Link>
          <div className="flex min-w-0 items-center gap-[var(--hsh-space-3)]">
            <p className="hsh-body-sm truncate text-[var(--hsh-text-secondary)]">
              {viewerLabel}
            </p>
            {/* Sign out stays in the chrome rather than only on /account. It
                left with `PortalNav`, and a portal you cannot leave from the
                page you are on is a portal with a missing exit. */}
            <SignOutButton />
          </div>
        </header>

        {/* Tablet and desktop context bar — 64 px, MDS layout.header.portal_desktop. */}
        <div className="hidden min-h-[64px] items-center justify-end gap-[var(--hsh-space-4)] border-b border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-gutter-tablet)] sm:flex lg:px-[var(--hsh-gutter-desktop)]">
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {viewerLabel}
          </p>
          <SignOutButton />
        </div>

        {/* Bottom padding on mobile only, so the sticky bar below cannot cover
            the last thing on the page. Without it the final action — "Add A
            Student" on the household page — sat underneath the bar. */}
        <div className="flex flex-1 flex-col pb-[124px] sm:pb-0">
          {children}
        </div>

        {/* Mobile bottom navigation — five destinations, safe-area padding,
            44 px targets. The More group keeps Announcements and Resources
            reachable rather than hidden. */}
        <nav
          aria-label="Family sections"
          className="sticky bottom-0 z-40 border-t border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <ul className="flex items-stretch justify-between gap-[var(--hsh-space-2)] px-[var(--hsh-space-2)] py-[var(--hsh-space-1)]">
            {MOBILE_BAR.map((item) => {
              const current = isCurrent(pathname, item.href)
              const Icon = item.icon
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-[var(--hsh-touch-target)] flex-col items-center justify-center gap-[2px]",
                      "rounded-[var(--hsh-radius-control)] px-[var(--hsh-space-1)] py-[var(--hsh-space-1)]",
                      current
                        ? "bg-[var(--hsh-forest-100)] text-[var(--hsh-forest-700)]"
                        : "text-[var(--hsh-text-secondary)]",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-5"
                      strokeWidth={1.75}
                    />
                    <span className="hsh-caption">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <ul className="flex items-center gap-[var(--hsh-space-2)] border-t border-[var(--hsh-border-default)] px-[var(--hsh-space-2)] py-[var(--hsh-space-1)]">
            <li className="flex items-center gap-[var(--hsh-space-2)] pl-[var(--hsh-space-2)] text-[var(--hsh-text-muted)]">
              <MoreHorizontal
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              <span className="hsh-caption">More</span>
            </li>
            {MOBILE_MORE.map((item) => {
              const current = isCurrent(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "hsh-caption flex min-h-[var(--hsh-touch-target)] items-center",
                      "rounded-[var(--hsh-radius-control)] px-[var(--hsh-space-3)] font-semibold",
                      current
                        ? "bg-[var(--hsh-forest-100)] text-[var(--hsh-forest-700)]"
                        : "text-[var(--hsh-text-link)]",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}

export { FamilyPortalShell, DESTINATIONS }
