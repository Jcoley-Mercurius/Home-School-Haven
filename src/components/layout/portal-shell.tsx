"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoreHorizontal } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { cn } from "@/lib/utils"

/**
 * The portal shell mechanism shared by every authenticated role area
 * (MDS `layout.sidebar`, `layout.header`, `components.navigation`,
 * MDS-REF-005, MDS-REF-007, MDS-REF-009).
 *
 * This is the family shell's markup, lifted verbatim and parameterised. It was
 * extracted rather than copied because the administrator area needs exactly the
 * same three compositions, and two copies of a responsive navigation contract
 * drift: the day one of them gains a safe-area fix or a focus correction, the
 * other silently does not.
 *
 * Three compositions, not one shrinking layout (DO-DONT "Do not shrink desktop
 * compositions until they technically fit"):
 *
 *   desktop 1024+    264 px expanded sidebar, labels visible
 *   tablet 640–1023  72 px rail, icon with an accessible name
 *   mobile 0–639     60 px header plus a bottom bar of at most five
 *                    destinations, with the rest in a More group
 *
 * WHAT EACH ROLE SUPPLIES, AND WHAT IT MAY NOT
 *
 * A caller supplies its destination list, landmark names, home link, and brand
 * panel. A caller does NOT supply authorization: this is chrome. Every route
 * calls its own guard, and a link rendered here reaches nothing the server has
 * not already agreed to hand over. Rendering a destination is not permission to
 * enter it, and hiding one is not a control.
 *
 * The rail and the bottom bar are separate <nav> landmarks with distinct
 * accessible names, so a screen-reader user is never offered "the same
 * navigation" twice with different contents.
 */

type PortalDestination = {
  label: string
  href: string
  icon: LucideIcon
  /** In the five-destination mobile bottom bar rather than the More menu. */
  onMobileBar: boolean
}

/** The quiet brand panel MDS-REF-007 and MDS-REF-009 both draw in the sidebar. */
type PortalBrandPanel = {
  title: string
  body: string
}

/**
 * `/family` must not light up while the viewer is on `/family/schedule`, and
 * `/programs` must light up on `/programs/art-lab`. The home destination is the
 * only one matched exactly, because every other destination in a portal sits
 * beneath it in the path.
 */
function isCurrent(pathname: string, href: string, homeHref: string): boolean {
  if (href === homeHref) return pathname === homeHref
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Responsive portal shell with role navigation.
 * @param destinations - The role's approved destinations, in approved order.
 * @param navLabel - Accessible name for the sidebar/rail landmark.
 * @param mobileNavLabel - Accessible name for the bottom-bar landmark. It must
 *   differ from `navLabel`: the two landmarks hold different contents.
 * @param homeHref - The role's overview route. Matched exactly for `current`.
 * @param homeLabel - Accessible name for the logo link.
 * @param brandPanel - The desktop-only brand panel, or `null` for none.
 * @param viewerLabel - The signed-in adult's name or email. No child name
 *   appears in chrome that persists across every page.
 * @param children - The page content.
 * @returns The shell.
 */
function PortalShell({
  destinations,
  navLabel,
  mobileNavLabel,
  homeHref,
  homeLabel,
  brandPanel,
  viewerLabel,
  children,
}: {
  destinations: PortalDestination[]
  navLabel: string
  mobileNavLabel: string
  homeHref: string
  homeLabel: string
  brandPanel: PortalBrandPanel | null
  viewerLabel: string
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const mobileBar = destinations.filter((item) => item.onMobileBar)
  const mobileMore = destinations.filter((item) => !item.onMobileBar)

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--hsh-surface-page)] sm:flex-row">
      {/* ---------------------------------------------------------------
          Tablet rail and desktop sidebar. Forest 700 panel with the
          canonical logo on its own warm-ivory surface, as MDS-REF-007 and
          MDS-REF-009 both draw it and DO-DONT requires — never a reversed
          or redrawn variant.
          --------------------------------------------------------------- */}
      <div
        className={cn(
          "hidden shrink-0 bg-[var(--hsh-forest-700)] sm:flex sm:flex-col",
          "sm:sticky sm:top-0 sm:h-dvh sm:w-[72px] lg:w-[264px]",
          "px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] lg:px-[var(--hsh-space-4)]",
        )}
      >
        <Link
          href={homeHref}
          aria-label={homeLabel}
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

        <nav aria-label={navLabel} className="flex-1">
          <ul className="flex flex-col gap-[var(--hsh-space-2)]">
            {destinations.map((item) => {
              const current = isCurrent(pathname, item.href, homeHref)
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

        {/* Decorative and desktop-only: the rail has no room for it, and it
            carries no operational meaning. */}
        {brandPanel ? (
          <div className="hidden rounded-[var(--hsh-radius-card)] bg-[var(--hsh-forest-600)] p-[var(--hsh-space-4)] lg:block">
            <p className="hsh-label text-[var(--hsh-text-inverse)]">
              {brandPanel.title}
            </p>
            <p className="hsh-body-sm mt-[var(--hsh-space-2)] text-[var(--hsh-forest-100)]">
              {brandPanel.body}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header — 60 px, MDS layout.header.mobile. */}
        <header className="flex h-[60px] items-center justify-between gap-[var(--hsh-space-4)] border-b border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-gutter-mobile)] sm:hidden">
          <Link
            href={homeHref}
            aria-label={homeLabel}
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
            {/* Sign out stays in the chrome rather than only on /account. A
                portal you cannot leave from the page you are on is a portal
                with a missing exit. */}
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
            the last thing on the page. Two rows of bar need more room than
            one, so the reserve follows whether a More group is rendered. */}
        <div
          className={cn(
            "flex flex-1 flex-col sm:pb-0",
            mobileMore.length > 0 ? "pb-[124px]" : "pb-[84px]",
          )}
        >
          {children}
        </div>

        {/* Mobile bottom navigation — at most five destinations, safe-area
            padding, 44 px targets. The More group keeps the remaining
            destinations reachable rather than hidden. */}
        <nav
          aria-label={mobileNavLabel}
          className="sticky bottom-0 z-40 border-t border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <ul className="flex items-stretch justify-between gap-[var(--hsh-space-2)] px-[var(--hsh-space-2)] py-[var(--hsh-space-1)]">
            {mobileBar.map((item) => {
              const current = isCurrent(pathname, item.href, homeHref)
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

          {mobileMore.length > 0 ? (
            <ul className="flex items-center gap-[var(--hsh-space-2)] border-t border-[var(--hsh-border-default)] px-[var(--hsh-space-2)] py-[var(--hsh-space-1)]">
              <li className="flex items-center gap-[var(--hsh-space-2)] pl-[var(--hsh-space-2)] text-[var(--hsh-text-muted)]">
                <MoreHorizontal
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
                <span className="hsh-caption">More</span>
              </li>
              {mobileMore.map((item) => {
                const current = isCurrent(pathname, item.href, homeHref)
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
          ) : null}
        </nav>
      </div>
    </div>
  )
}

export { PortalShell }
export type { PortalDestination, PortalBrandPanel }
