import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { contact } from "@/content/foundation-content"
import { getViewer, homeRouteFor } from "@/lib/auth/session"

/**
 * Post-sign-in router. The destination is derived on the server from
 * `public.user_roles`, never from a role, cookie, or query parameter supplied
 * by the browser.
 *
 * An account with no role grant is a real state — a verified adult whose access
 * has not been assigned yet — and it gets a truthful explanation rather than an
 * empty dashboard or a redirect loop (MPS-REQ-021).
 */
export const metadata: Metadata = {
  title: "Your account — Home School Haven of SWFL",
}

/**
 * Never prerendered, never cached.
 *
 * Without this the build statically renders these routes. In an environment
 * with no Supabase project that even "succeeds" — `getViewer()` returns null
 * before it touches cookies, the guard redirects, and Next bakes that redirect
 * into a static page. The result would be a protected route whose answer was
 * decided at build time instead of per request. Authorization must be
 * evaluated on every request, for every viewer.
 */
export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const viewer = await getViewer()
  if (!viewer) redirect("/sign-in?redirectTo=%2Faccount")

  const home = homeRouteFor(viewer)
  if (home) redirect(home)

  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main
        id="main"
        className="hsh-container hsh-container-public flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-16)]"
      >
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          Your account is not set up yet
        </h1>
        <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          You are signed in, but this account has not been given access to a
          family, program, or administrative area yet. Home School Haven
          completes that step. Call{" "}
          <a
            href={telHref}
            data-inline-link="true"
            className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
          >
            {contact.phone}
          </a>{" "}
          and we will finish setting it up with you.
        </p>
        <div>
          <SignOutButton />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
