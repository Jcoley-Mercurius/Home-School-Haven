"use client"

import { useActionState, useId } from "react"
import { CircleAlert, MailCheck, TriangleAlert } from "lucide-react"

import { requestPasswordReset } from "@/app/(auth)/forgot-password/actions"
import { emptyForgotPasswordFormState } from "@/app/(auth)/forgot-password/form-state"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { TextLink } from "@/components/ui/text-link"
import { contact } from "@/content/foundation-content"

/**
 * Password recovery request form (MDS `patterns.authentication`: brand context,
 * account form, recovery/help, privacy reassurance; `patterns.loading`,
 * `patterns.error`).
 *
 * The confirmation panel is deliberately identical for an address that has an
 * account and one that does not. It is written to be true either way — "if that
 * address has an account, a link is on its way" — rather than claiming an email
 * was sent to an address that has none.
 *
 * Validation is server-side only; `noValidate` keeps a native constraint from
 * hiding the server boundary, matching `sign-in-form.tsx`.
 */
export function ForgotPasswordForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    emptyForgotPasswordFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  const announcement =
    state.status === "invalid"
      ? "Nothing was sent. Check the highlighted field below."
      : state.status === "sent"
        ? "Check your email. If that address has an account, a reset link is on its way."
        : state.status === "throttled"
          ? "Another email cannot be sent just yet. Please try again shortly."
          : state.status === "unavailable"
            ? "Password recovery is not open yet in this review environment."
            : state.status === "failed"
              ? "The request could not be completed. Please try again."
              : ""

  /* Success replaces the form. Leaving it on screen invites a second submission
     that the rate limit would refuse, which would read as a failure. */
  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-[var(--hsh-space-6)]">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <div
          className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
          data-slot="recovery-sent"
        >
          <MailCheck
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-success)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              Check your email
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              If that address has a Home School Haven account, a link to choose
              a new password is on its way. The link works once and expires
              after an hour.
            </p>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              We do not say whether an address has an account here, so that
              nobody can use this form to find out.
            </p>
          </div>
        </div>
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          Nothing arrived? Check the spam folder, or call{" "}
          <a
            href={telHref}
            data-inline-link="true"
            className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
          >
            {contact.phone}
          </a>{" "}
          and we will help.
        </p>
        <TextLink href="/sign-in">Back to sign in</TextLink>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      <p
        role="status"
        aria-live="assertive"
        className="sr-only"
        key={`${state.status}-${announcement}`}
      >
        {announcement}
      </p>

      {state.status === "invalid" ? (
        <div className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-error)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]">
          <CircleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-error)]"
            strokeWidth={1.75}
          />
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Nothing was sent. Check the highlighted field below and try again.
          </p>
        </div>
      ) : null}

      {state.status === "throttled" ||
      state.status === "unavailable" ||
      state.status === "failed" ? (
        <div
          className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]"
          data-slot="recovery-blocked"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              No email was sent
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {state.status === "throttled"
                ? "Another email cannot be sent just yet. Please wait a few minutes and try again — if an earlier link reached you, it still works."
                : state.status === "unavailable"
                  ? "Accounts are not open yet in this review environment, so there is nothing to recover. Nothing you typed was sent anywhere."
                  : "Something went wrong on our side. Nothing you typed was sent anywhere. Please try again."}
            </p>
            <a
              href={telHref}
              className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              Call {contact.phone}
            </a>
          </div>
        </div>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-6)]"
      >
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <Field invalid={Boolean(state.fieldErrors.email)}>
          <FieldLabel>Email</FieldLabel>
          {/* Keyed on the echoed value: Base UI warns when the default value of
              an uncontrolled control changes after mount, so a re-render
              carrying a new echoed email remounts the control instead. */}
          <Input
            key={state.values.email}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values.email}
            aria-describedby={`${ids}-privacy`}
          />
          <FieldError match={Boolean(state.fieldErrors.email)}>
            {state.fieldErrors.email}
          </FieldError>
        </Field>

        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Email a reset link"}
        </Button>

        <p
          id={`${ids}-privacy`}
          className="hsh-body-sm text-[var(--hsh-text-secondary)]"
        >
          Home School Haven will never ask for your password by phone or email.
          A reset link is the only way we will ever ask you to change it.
        </p>

        <TextLink href="/sign-in">Back to sign in</TextLink>
      </form>
    </div>
  )
}
