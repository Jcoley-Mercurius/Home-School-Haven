"use client"

import { useActionState, useId } from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { resetPassword } from "@/app/(auth)/reset-password/actions"
import { emptyResetPasswordFormState } from "@/app/(auth)/reset-password/form-state"
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
 * New-password form (MDS `patterns.authentication`, `patterns.loading`,
 * `patterns.error`).
 *
 * The password rules are stated before the visitor types, not revealed by a
 * rejection afterwards. They mirror `supabase/config.toml` — 12 characters,
 * with a lowercase letter, an uppercase letter, and a number.
 *
 * Neither field is ever given a `defaultValue`: a password is not echoed back,
 * not even the one that failed validation.
 */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    resetPassword,
    emptyResetPasswordFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  const announcement =
    state.status === "invalid"
      ? "Your password was not changed. Check the highlighted fields below."
      : state.status === "expired"
        ? "That reset link is no longer valid. Request a new one."
        : state.status === "unavailable"
          ? "Password changes are not open yet in this review environment."
          : state.status === "failed"
            ? "Your password could not be changed. Please try again."
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
            Your password was not changed. Check the highlighted fields below
            and try again.
          </p>
        </div>
      ) : null}

      {state.status === "expired" ||
      state.status === "unavailable" ||
      state.status === "failed" ? (
        <div
          className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]"
          data-slot="reset-blocked"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              Your password was not changed
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {state.status === "expired"
                ? "This reset link has expired or has already been used. Your existing password still works, and you can request a new link."
                : state.status === "unavailable"
                  ? "Accounts are not open yet in this review environment. Nothing you typed was sent anywhere."
                  : "Something went wrong on our side. Nothing you typed was sent anywhere. Please try again."}
            </p>
            {state.status === "expired" ? (
              <TextLink href="/forgot-password">
                Request a new reset link
              </TextLink>
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
          <FieldLabel>New password</FieldLabel>
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
          <FieldLabel>Confirm new password</FieldLabel>
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
          {pending ? "Saving…" : "Save new password"}
        </Button>

        <p
          id={`${ids}-privacy`}
          className="hsh-body-sm text-[var(--hsh-text-secondary)]"
        >
          Home School Haven will never ask for your password by phone or email.
          Once saved, you will be signed in.
        </p>
      </form>
    </div>
  )
}
