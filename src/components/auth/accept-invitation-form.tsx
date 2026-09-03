"use client"

import { useActionState, useId } from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { acceptInvitation } from "@/app/(auth)/invitation/accept/actions"
import { emptyAcceptInvitationFormState } from "@/app/(auth)/invitation/accept/form-state"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { TextLink } from "@/components/ui/text-link"
import { contact } from "@/content/foundation-content"

/**
 * Invitation-acceptance form (MDS `patterns.authentication`,
 * `patterns.loading`, `patterns.error`).
 *
 * Composed from the same approved fields and states as
 * `reset-password-form.tsx`, deliberately: a parent setting a password for the
 * first time and a parent replacing one meet the same rules, the same wording,
 * and the same failure shapes. That is REUSE, not a second convention.
 *
 * Neither field is ever given a `defaultValue`: a password is not echoed back,
 * not even the one that failed validation. No hidden field carries an
 * invitation id, an email, or a role — the server derives all three from the
 * session.
 */
export function AcceptInvitationForm() {
  const [state, formAction, pending] = useActionState(
    acceptInvitation,
    emptyAcceptInvitationFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  const announcement =
    state.status === "invalid"
      ? "Your account was not set up. Check the highlighted fields below."
      : state.status === "closed"
        ? "This invitation is no longer open. Ask for a new one."
        : state.status === "unavailable"
          ? "Accounts are not open yet in this review environment."
          : state.status === "failed"
            ? "Your account could not be set up. Please try again."
            : ""

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
            Your account was not set up. Check the highlighted fields below and
            try again.
          </p>
        </div>
      ) : null}

      {state.status === "closed" ||
      state.status === "unavailable" ||
      state.status === "failed" ? (
        <div
          className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]"
          data-slot="invitation-blocked"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              Your account was not set up
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {state.status === "closed"
                ? "This invitation is no longer open. It may have expired, already been used, or been withdrawn. Ask Home School Haven for a new invitation."
                : state.status === "unavailable"
                  ? "Accounts are not open yet in this review environment. Nothing you typed was sent anywhere."
                  : "Something went wrong on our side. Nothing you typed was sent anywhere. Please try again."}
            </p>
            {state.status === "closed" ? (
              <TextLink href="/contact">Contact Home School Haven</TextLink>
            ) : (
              <a
                href={telHref}
                className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
              >
                Call {contact.phone}
              </a>
            )}
          </div>
        </div>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-6)]"
      >
        <Field invalid={Boolean(state.fieldErrors.password)}>
          <FieldLabel>Password</FieldLabel>
          <FieldDescription>
            At least 12 characters, including a lowercase letter, an uppercase
            letter, and a number.
          </FieldDescription>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            aria-describedby={`${ids}-privacy`}
          />
          <FieldError match={Boolean(state.fieldErrors.password)}>
            {state.fieldErrors.password}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.confirmPassword)}>
          <FieldLabel>Confirm password</FieldLabel>
          <Input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
          />
          <FieldError match={Boolean(state.fieldErrors.confirmPassword)}>
            {state.fieldErrors.confirmPassword}
          </FieldError>
        </Field>

        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Setting up…" : "Set password and continue"}
        </Button>

        <p
          id={`${ids}-privacy`}
          className="hsh-body-sm text-[var(--hsh-text-secondary)]"
        >
          Home School Haven will never ask for your password by phone or email.
          Once saved, you will be signed in and taken to your family setup.
        </p>
      </form>
    </div>
  )
}
