"use client"

import { useActionState, useId } from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { createFamilyAction } from "@/app/(portal)/family/setup/actions"
import { emptyFamilySetupFormState } from "@/app/(portal)/family/setup/form-state"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FAMILY_NAME_MAX } from "@/lib/family/validation"
import { contact } from "@/content/foundation-content"

/**
 * Family setup form (MPS-REQ-011, MDS `patterns.forms`).
 *
 * One field, and that is the whole point. Everything else a family setup form
 * might ask — guardian relationship, address, phone, consent — is an open
 * question in Samantha's checklist, and a field added to fill out the page
 * would be collected data nobody approved.
 *
 * `noValidate` keeps a native constraint bubble from hiding the server
 * boundary, matching `sign-in-form.tsx` and `guidance-form.tsx`. Validation is
 * the server's answer, announced rather than only coloured.
 */
export function FamilySetupForm() {
  const [state, formAction, pending] = useActionState(
    createFamilyAction,
    emptyFamilySetupFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  const announcement =
    state.status === "invalid"
      ? "Your family was not created. Check the highlighted field below."
      : state.status === "forbidden"
        ? "This account is not set up to create a family."
        : state.status === "unavailable"
          ? "Family setup is not open yet in this review environment."
          : state.status === "failed"
            ? "Your family could not be created. Please try again."
            : ""

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      {/* The single announcement channel for every outcome. Keyed on the
          status so a repeat of the same result is announced again rather than
          silently ignored. */}
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
            Your family was not created. Check the highlighted field below and
            try again.
          </p>
        </div>
      ) : null}

      {state.status === "forbidden" ||
      state.status === "unavailable" ||
      state.status === "failed" ? (
        <div
          className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]"
          data-slot="family-setup-blocked"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              Your family was not created
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {state.status === "unavailable"
                ? "Family setup is not open yet in this review environment. Nothing you typed was saved."
                : state.status === "forbidden"
                  ? "This account is not set up to manage a family yet. Nothing you typed was saved, and Home School Haven can put that right for you."
                  : "Something went wrong on our side. Nothing you typed was saved. Please try again."}
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
        <Field invalid={Boolean(state.fieldErrors.name)}>
          <FieldLabel>Family name</FieldLabel>
          <FieldDescription>
            However your family likes to be addressed, for example &ldquo;The
            Dodson Family&rdquo;. You can tell us if this needs to change.
          </FieldDescription>
          {/* Keyed on the echoed value for the same reason as the sign-in
              inputs: Base UI warns when an uncontrolled control's default
              changes after mount. */}
          <Input
            key={state.values.name}
            name="name"
            type="text"
            autoComplete="off"
            maxLength={FAMILY_NAME_MAX}
            defaultValue={state.values.name}
            aria-describedby={`${ids}-privacy`}
          />
          <FieldError match={Boolean(state.fieldErrors.name)}>
            {state.fieldErrors.name}
          </FieldError>
        </Field>

        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Creating your family…" : "Create My Family"}
        </Button>

        <p
          id={`${ids}-privacy`}
          className="hsh-body-sm text-[var(--hsh-text-secondary)]"
        >
          Your family&rsquo;s information is visible only to you and to
          authorized Home School Haven staff. If you come back to this page
          later, your setup picks up where it left off.
        </p>
      </form>
    </div>
  )
}
