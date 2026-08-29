import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { RECOVERY_COOKIE } from "@/lib/auth/recovery-cookie"
import { getViewer } from "@/lib/auth/session"

/**
 * Choose a new password (MPS-REQ-011 recovery half, MPS-ACC-017,
 * MPS-REQ-021).
 *
 * Two conditions must hold before the form renders, and they check different
 * things:
 *
 *  1. **A session**, established by `/auth/confirm` from the emailed link.
 *     This is the authorization, and Supabase re-verifies it on the mutation.
 *  2. **The recovery marker**, which says the session arrived through a
 *     recovery link rather than an ordinary sign-in. Without it this reset
 *     screen would double as an unannounced "change password" screen for any
 *     signed-in viewer who typed the URL — `secure_password_change = false`, so
 *     Supabase would not ask them to reauthenticate.
 *
 * Either one missing sends the visitor to the expired-link state, which offers
 * a new link rather than a dead end. The marker carries no authority of its own
 * (see `@/lib/auth/recovery-cookie`).
 */
export const metadata: Metadata = {
  title: "Choose a new password — Home School Haven of SWFL",
  /* A recovery surface has nothing to gain from being indexed. */
  robots: { index: false, follow: false },
}

/** Never prerendered: the answer depends on this request's cookies. */
export const dynamic = "force-dynamic"

export default async function ResetPasswordPage() {
  const cookieStore = await cookies()
  if (!cookieStore.get(RECOVERY_COOKIE)) {
    redirect("/link-expired?reason=expired")
  }

  const viewer = await getViewer()
  if (!viewer) redirect("/link-expired?reason=expired")

  return (
    <div className="flex flex-col gap-[var(--hsh-space-8)]">
      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
          Home School Haven
        </p>
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          Choose a new password
        </h1>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          You are changing the password for{" "}
          <strong className="font-semibold text-[var(--hsh-text-primary)]">
            {viewer.email}
          </strong>
          . Once saved, you will be signed in and taken to your area.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  )
}
