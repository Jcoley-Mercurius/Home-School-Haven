import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { safeReturnTo } from "@/lib/auth/return-to"

/**
 * Forgot password (MPS-REQ-011 recovery half, MPS-REQ-021; MDS
 * `patterns.authentication` "recovery/help").
 *
 * Reachable while signed in as well as signed out, deliberately. Someone who is
 * signed in on one device and locked out on another still needs this, and a
 * redirect away from it would be a dead end for them.
 *
 * There is no account-creation path here and no hint that one exists. Accounts
 * are provisioned during this review (`enable_signup = false` in
 * `supabase/config.toml`, enforced at the Auth server), and the approved
 * artifacts define no provisioning policy for this page to describe.
 */
export const metadata: Metadata = {
  title: "Forgot your password — Home School Haven of SWFL",
  description: "Request a link to choose a new Home School Haven password.",
}

/**
 * Never prerendered. The page reads a request-scoped destination, and the
 * recovery round trip must be evaluated per request rather than baked in at
 * build time.
 */
export const dynamic = "force-dynamic"

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>
}) {
  const { redirectTo } = await searchParams

  return (
    <div className="flex flex-col gap-[var(--hsh-space-8)]">
      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
          Home School Haven
        </p>
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          Forgot your password
        </h1>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          Enter the email address for your account and we will send a link to
          choose a new password. The link works once and expires after an hour.
        </p>
      </div>

      <ForgotPasswordForm redirectTo={safeReturnTo(redirectTo)} />
    </div>
  )
}
