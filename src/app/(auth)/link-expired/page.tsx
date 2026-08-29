import type { Metadata } from "next"
import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TextLink } from "@/components/ui/text-link"
import { contact } from "@/content/foundation-content"

/**
 * Expired, used, or invalid link (MPS-REQ-021 "observable confirmation, current
 * state, and recovery action for … failed, expired, blocked" outcomes;
 * MPS-ACC-017 "verification can be safely renewed"; MDS `patterns.error`).
 *
 * The screen deliberately does not say *which* of expired, already used, or
 * tampered with it was. Those are the same outcome to the person holding the
 * link, and distinguishing them would tell someone probing links which of their
 * guesses was closest.
 *
 * What it must do instead is offer the way forward, so an expired link is a
 * detour rather than a dead end: request a new one.
 */
export const metadata: Metadata = {
  title: "That link has expired — Home School Haven of SWFL",
  robots: { index: false, follow: false },
}

export default async function LinkExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  /* `unavailable` is the only distinction worth drawing: it is not the
     visitor's link that is wrong, it is that this review environment has no
     accounts yet, and no number of new links would help. */
  const unavailable = reason === "unavailable"
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  return (
    <div className="flex flex-col gap-[var(--hsh-space-8)]">
      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
          Home School Haven
        </p>
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          {unavailable ? "Accounts are not open yet" : "That link has expired"}
        </h1>
      </div>

      <div className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]">
        <TriangleAlert
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
          strokeWidth={1.75}
        />
        <div className="flex flex-col gap-[var(--hsh-space-2)]">
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {unavailable
              ? "This review environment has no accounts connected yet, so there is nothing for this link to open. Nothing about your account has changed."
              : "Password links work once and expire after an hour, so this one can no longer be used. Nothing about your account has changed, and your existing password still works."}
          </p>
          {!unavailable ? (
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              Request a new link and it will arrive in a moment.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-[var(--hsh-space-4)]">
        {!unavailable ? (
          <Button render={<Link href="/forgot-password" />} size="lg">
            Send me a new link
          </Button>
        ) : null}
        <TextLink href="/sign-in">Back to sign in</TextLink>
      </div>

      <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
        Still stuck? Call{" "}
        <a
          href={telHref}
          data-inline-link="true"
          className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
        >
          {contact.phone}
        </a>{" "}
        and we will help you back in.
      </p>
    </div>
  )
}
