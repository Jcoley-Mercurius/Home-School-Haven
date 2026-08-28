import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignInForm } from "@/components/auth/sign-in-form"
import { getViewer, homeRouteFor } from "@/lib/auth/session"

/**
 * Sign in (MDS `patterns.authentication`; MTS TECHNOLOGY-BLUEPRINT "Identity").
 *
 * The Foundation Release has no self-service sign-up: accounts are provisioned
 * by Home School Haven, and `enable_signup = false` in `supabase/config.toml`
 * enforces that at the Auth server, not just in this UI. The page says so
 * rather than offering a "Create account" action that would fail.
 *
 * Students never sign in (ACT-002, MPS OOS-BETA-001), which the page states so
 * a parent does not go looking for a child login.
 */
export const metadata: Metadata = {
  title: "Sign In — Home School Haven of SWFL",
  description: "Sign in to your Home School Haven family account.",
}

/** Only a relative, single-slash path is honoured — never an open redirect. */
function safeRedirect(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/account"
  return raw
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>
}) {
  const { redirectTo } = await searchParams
  const destination = safeRedirect(redirectTo)

  /* Already signed in: send them where they belong rather than showing a form
     that would sign them in as themselves again. */
  const viewer = await getViewer()
  if (viewer) redirect(homeRouteFor(viewer) ?? destination)

  return (
    <div className="flex flex-col gap-[var(--hsh-space-8)]">
      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
          Home School Haven
        </p>
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          Sign in to your account
        </h1>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          Family accounts are set up by Home School Haven during this review.
          There is no self-service sign-up yet, and students do not have their
          own logins — a parent or guardian manages the family account.
        </p>
      </div>

      <SignInForm redirectTo={destination} />
    </div>
  )
}
