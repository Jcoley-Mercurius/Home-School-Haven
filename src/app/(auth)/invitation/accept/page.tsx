import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form"
import { TextLink } from "@/components/ui/text-link"
import { getViewer, homeRouteFor } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

/**
 * Accept a family invitation (MPS-REQ-011, MPS-ACC-015/016/017, MPS-REQ-021;
 * MDS `page_shells.authentication`, `patterns.authentication`).
 *
 * HOW A VISITOR GETS HERE
 *
 * Only from the emailed invitation: the link goes to `/auth/confirm`, which
 * verifies the token server-side and establishes a session before redirecting
 * here. This route takes no parameters at all — no token, no email, no
 * invitation id, no account id. There is nothing in the address bar to edit,
 * nothing to forward, and nothing to read out of a browser history or a
 * referrer header.
 *
 * WHAT DECIDES WHAT RENDERS
 *
 * `public.family_invitation_status()`, which answers only about the calling
 * account's own invitation and folds expiry in. Four different closures —
 * expired, revoked, already accepted, never invited — produce one message and
 * one route forward, so this page cannot be used to probe whether an address
 * was ever invited.
 *
 * THE ONE REDIRECT
 *
 * An account that already holds a role goes to its own area. That is the
 * ordinary case of a parent re-opening an old invitation email after they have
 * already set a password: sending them to their dashboard is more useful than
 * a dead end, and it discloses nothing they do not already have.
 */
export const metadata: Metadata = {
  title: "Accept your invitation — Home School Haven of SWFL",
  /* An account-completion surface has nothing to gain from being indexed. */
  robots: { index: false, follow: false },
}

/** Never prerendered: the answer depends on this request's session. */
export const dynamic = "force-dynamic"

export default async function AcceptInvitationPage() {
  if (!isSupabaseConfigured()) redirect("/link-expired?reason=unavailable")

  const viewer = await getViewer()
  /* No session means the link was never verified, or its window closed. The
     shared expired-link state offers a way forward rather than a dead end. */
  if (!viewer) redirect("/link-expired?reason=expired")

  const home = homeRouteFor(viewer)
  if (home) redirect(home)

  const supabase = await createClient()
  const { data: status, error } = await supabase.rpc("family_invitation_status")

  if (error) {
    return (
      <div className="flex flex-col gap-[var(--hsh-space-4)]">
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          We could not check your invitation
        </h1>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          Nothing has changed and nothing you do next will be lost. Reload this
          page to try again.
        </p>
      </div>
    )
  }

  if (status !== "pending") {
    return (
      <div className="flex flex-col gap-[var(--hsh-space-4)]">
        <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
          Home School Haven
        </p>
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          This invitation is no longer open
        </h1>
        {/* One sentence for expired, revoked, already accepted, and never
            invited. Which one it was is not disclosed. */}
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          It may have expired, already been used, or been withdrawn. If you
          already set a password, sign in below. Otherwise, ask Home School
          Haven to send you a new invitation — nothing about your family has
          been changed.
        </p>
        <div className="flex flex-col gap-[var(--hsh-space-2)]">
          <TextLink href="/sign-in">Sign in</TextLink>
          <TextLink href="/contact">Contact Home School Haven</TextLink>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--hsh-space-8)]">
      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
          Home School Haven
        </p>
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          Set your password
        </h1>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          Your email address{" "}
          <strong className="font-semibold text-[var(--hsh-text-primary)]">
            {viewer.email}
          </strong>{" "}
          is confirmed. Choose a password to finish setting up your family
          account.
        </p>
      </div>

      <AcceptInvitationForm />
    </div>
  )
}
