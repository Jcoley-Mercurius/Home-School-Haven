"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Dialog } from "@base-ui/react/dialog"
import { Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { accountNav, primaryNav, type NavItem } from "@/content/foundation-content"
import { cn } from "@/lib/utils"

/**
 * Public site header. MDS-REF-005 §4: 72 px sticky desktop header;
 * 60 px mobile header with a full menu panel that keeps every destination.
 *
 * Destinations whose routes do not exist yet render as non-navigating,
 * aria-disabled items so the private review contains no broken links
 * (owner decision, 2026-08-27).
 */

/**
 * Navigation label component that renders available links or disabled text.
 * @param item - Navigation item with label, href, and availability
 * @param className - Additional CSS classes
 * @returns Navigation label component
 */
function NavLabel({ item, className }: { item: NavItem; className?: string }) {
  if (!item.available) {
    /* Muted, non-navigating, and announced as unavailable. One visible notice
       explains the state for the whole group rather than repeating a badge on
       every item, which would clutter the calm header (DO-DONT.md). */
    return (
      <span
        aria-disabled="true"
        className={cn(
          "hsh-body whitespace-nowrap text-[var(--hsh-neutral-400)]",
          className
        )}
      >
        {item.label}
        <span className="sr-only"> — not yet available in this review</span>
      </span>
    )
  }

  return (
    <a
      href={item.href}
      className={cn(
        "hsh-body text-[var(--hsh-text-secondary)] hover:text-[var(--hsh-forest-700)]",
        className
      )}
    >
      {item.label}
    </a>
  )
}

/**
 * Site header with logo, navigation, and mobile menu.
 * @returns Site header component
 */
function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hsh-border-default)] bg-[var(--hsh-surface-page)]/95 backdrop-blur">
      <div className="hsh-container hsh-container-public flex h-[60px] items-center justify-between gap-[var(--hsh-space-6)] lg:h-[72px]">
        <Link
          href="/"
          className="flex items-center rounded-[var(--hsh-radius-small)]"
          aria-label="Home School Haven of SWFL — home"
        >
          <Image
            src="/brand/home-school-haven-logo.png"
            alt=""
            width={994}
            height={479}
            priority
            className="h-auto w-[132px] lg:w-[156px]"
          />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-[var(--hsh-space-8)] lg:flex"
        >
          {primaryNav.map((item) => (
            <NavLabel key={item.label} item={item} />
          ))}
        </nav>

        <div className="hidden items-center gap-[var(--hsh-space-4)] lg:flex">
          <NavLabel item={accountNav} />
          <Button variant="primary" size="md" disabled>
            Request Guidance
            <span className="sr-only">— coming soon</span>
          </Button>
        </div>

        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger
            render={
              <button
                type="button"
                aria-label="Open menu"
                className="flex size-[var(--hsh-touch-target)] items-center justify-center rounded-[var(--hsh-radius-control)] text-[var(--hsh-forest-700)] lg:hidden"
              />
            }
          >
            <Menu aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-[rgb(31_37_34/40%)]" />
            <Dialog.Popup className="fixed inset-x-0 top-0 z-50 flex max-h-dvh flex-col gap-[var(--hsh-space-6)] overflow-y-auto bg-[var(--hsh-surface-page)] p-[var(--hsh-space-4)] shadow-[var(--hsh-shadow-overlay)] outline-none">
              <div className="flex items-center justify-between">
                <Dialog.Title className="hsh-h4">Menu</Dialog.Title>
                <Dialog.Close
                  render={
                    <button
                      type="button"
                      aria-label="Close menu"
                      className="flex size-[var(--hsh-touch-target)] items-center justify-center rounded-[var(--hsh-radius-control)] text-[var(--hsh-forest-700)]"
                    />
                  }
                >
                  <X aria-hidden="true" className="size-6" strokeWidth={1.75} />
                </Dialog.Close>
              </div>

              <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
                Section pages open later in this review.
              </p>

              <nav aria-label="Primary mobile">
                <ul className="flex flex-col">
                  {[...primaryNav, accountNav].map((item) => (
                    <li
                      key={item.label}
                      className="flex min-h-[var(--hsh-touch-target)] items-center border-b border-[var(--hsh-border-default)]"
                    >
                      <NavLabel item={item} />
                    </li>
                  ))}
                </ul>
              </nav>

              <Button variant="primary" size="lg" disabled className="w-full">
                Explore Programs
                <span className="sr-only">— coming soon</span>
              </Button>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  )
}

export { SiteHeader }
