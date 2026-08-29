"use client"

import { useActionState, useId } from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { signIn } from "@/app/(auth)/sign-in/actions"
import { emptySignInFormState } from "@/app/(auth)/sign-in/form-state"
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
 * Sign-in form (MDS `patterns.authentication`: brand context, account form,
 * recovery/help, privacy reassurance).
 *
 * Validation is server-side only — `noValidate` keeps a native constraint from
 * hiding the server boundary, matching `guidance-form.tsx`.
 *
 * Every failure reads the same way on purpose. A message that distinguished
 * "no such account" from "wrong password" would confirm to any visitor whether
 * a particular family has an account here.
 *
 * The recovery link carries `redirectTo` with it, so a parent who was heading
 * for `/family`, forgot their password, and went the long way round still lands
 * on `/family` at the end of it rather than on a generic page.
 */
export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(
    signIn,
    emptySignInFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  const announcement =
    state.status === "invalid"
      ? "You were not signed in. Check the highlighted fields below."
      : state.status === "rejected"
        ? "That email and password did not match an account."
        : state.status === "unavailable"
          ? "Sign-in is not open yet in this review environment."
          : state.status === "failed"
            ? "Sign-in could not be completed. Please try again."
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

      {state.status === "rejected" ? (
        <div className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-error)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]">
          <CircleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-error)]"
            strokeWidth={1.75}
          />
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            That email and password did not match an account. Please check both
            and try again.
          </p>
        </div>
      ) : null}

      {state.status === "unavailable" || state.status === "failed" ? (
        <div
          className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]"
          data-slot="sign-in-blocked"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              You were not signed in
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {state.status === "unavailable"
                ? "Accounts are not open yet in this review environment, so there is nothing to sign in to. Nothing you typed was sent anywhere."
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

      {state.status === "invalid" ? (
        <div className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-error)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]">
          <CircleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-error)]"
            strokeWidth={1.75}
          />
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            You were not signed in. Check the highlighted fields below and try
            again.
          </p>
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
          {/* Keyed on the echoed value: Base UI warns when the default value
              of an uncontrolled control changes after mount, so a re-render
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

        <Field invalid={Boolean(state.fieldErrors.password)}>
          <FieldLabel>Password</FieldLabel>
          <FieldDescription>
            Home School Haven will never ask for your password by phone or
            email.
          </FieldDescription>
          {/* Never given a defaultValue: a password is not echoed back. */}
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
          />
          <FieldError match={Boolean(state.fieldErrors.password)}>
            {state.fieldErrors.password}
          </FieldError>
        </Field>

        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign In"}
        </Button>

        {/* MDS patterns.authentication requires a recovery/help element. */}
        <TextLink
          href={`/forgot-password?redirectTo=${encodeURIComponent(redirectTo)}`}
        >
          Forgot your password?
        </TextLink>

        <p
          id={`${ids}-privacy`}
          className="hsh-body-sm text-[var(--hsh-text-secondary)]"
        >
          Your family&rsquo;s information is visible only to you and to
          authorized Home School Haven staff.
        </p>
      </form>
    </div>
  )
}
