"use client"

import { useActionState, useId } from "react"

import { inviteFamilyAction } from "@/app/(portal)/admin/families/actions"
import { emptyInviteFamilyFormState } from "@/app/(portal)/admin/families/form-state"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/**
 * Invite one family (MPS-REQ-011; MDS `patterns.forms`, `patterns.loading`,
 * `patterns.error`).
 *
 * ONE FIELD, AND THE ABSENCES ARE THE DESIGN
 *
 * An email address is the whole form. There is no role selector — an invitation
 * grants `parent` and only `parent`, decided in SQL, so a control offering
 * anything else would be offering something the database will refuse. There is
 * no family name, no student, no program, and no note: a parent names their own
 * family during setup (ACT-001), and MPS-RUL-006 forbids inventing fields
 * nobody approved.
 *
 * WHAT A REPEAT SUBMISSION DOES
 *
 * Resends the invitation that is already waiting, and says so. It never creates
 * a second one — the database refuses that with a unique partial index, so a
 * double-clicked button reaches the same single record.
 *
 * `noValidate` keeps a native constraint bubble from hiding the server
 * boundary, matching every other form in this repository.
 */
export function InviteFamilyForm() {
  const [state, formAction, pending] = useActionState(
    inviteFamilyAction,
    emptyInviteFamilyFormState,
  )
  const ids = useId()

  const announcement =
    state.status === "invited"
      ? "Invitation sent. It is now waiting to be accepted."
      : state.status === "resent"
        ? "That address already had an invitation waiting. A new link was sent and the previous one no longer works."
        : state.status === "existingAccount"
          ? "That address already has an account, so no invitation was sent."
          : state.status === "invalid"
            ? "No invitation was sent. Check the highlighted field below."
            : state.status === "idle"
              ? ""
              : "No invitation was sent."

  const blocked =
    state.status === "forbidden" ||
    state.status === "notConfigured" ||
    state.status === "unavailable" ||
    state.status === "failed"

  return (
    <div className="flex flex-col gap-[var(--hsh-space-5)]">
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        key={`${state.status}-${announcement}`}
      >
        {announcement}
      </p>

      {state.status === "invited" ? (
        <Alert tone="success" title="Invitation sent">
          The parent has one hour to open the link and set a password. Until
          they do, the invitation stays in the list below as waiting.
        </Alert>
      ) : null}

      {state.status === "resent" ? (
        <Alert tone="info" title="A new invitation was sent">
          That address already had an invitation waiting, so a new link replaced
          it. The previous link no longer works, and no second account was
          created.
        </Alert>
      ) : null}

      {/* Shown to an administrator who reached this page through
          `requireAdmin()`. No public surface in this release answers this
          question — the sign-in and recovery forms respond identically whether
          or not an address has an account. */}
      {state.status === "existingAccount" ? (
        <Alert tone="warning" title="No invitation was sent">
          That address already has a Home School Haven account, so inviting it
          again would create a second one. If the parent cannot get in, ask them
          to use <strong className="font-semibold">Forgot password</strong> on
          the sign-in page.
        </Alert>
      ) : null}

      {blocked ? (
        <Alert tone="warning" title="No invitation was sent">
          {state.status === "unavailable"
            ? "No Supabase project is configured in this environment, so no invitation can be sent. Nothing was saved."
            : state.status === "notConfigured"
              ? "Invitation sending is not configured in this environment. The Supabase secret key is missing, so no account can be provisioned here. Nothing was saved."
              : state.status === "forbidden"
                ? "This account is not authorized to invite a family. Nothing was saved."
                : "Something went wrong on our side. No invitation was sent and no account was created — please try again."}
        </Alert>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-5)]"
      >
        <Field invalid={Boolean(state.fieldErrors.email)}>
          <FieldLabel>Parent or guardian email</FieldLabel>
          <FieldDescription>
            The adult who will control the family account. They choose their own
            password from the emailed link.
          </FieldDescription>
          <Input
            key={state.values.email}
            name="email"
            type="email"
            autoComplete="off"
            maxLength={254}
            defaultValue={state.values.email}
            aria-describedby={`${ids}-scope`}
          />
          <FieldError match={Boolean(state.fieldErrors.email)}>
            {state.fieldErrors.email}
          </FieldError>
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={pending}
          className="self-start"
        >
          {pending ? "Sending…" : "Send invitation"}
        </Button>

        <p
          id={`${ids}-scope`}
          className="hsh-body-sm text-[var(--hsh-text-secondary)]"
        >
          An invitation creates a parent account and nothing else. It cannot
          create an educator or an administrator, and the email contains no
          information about children, enrollments, or requests for assistance.
        </p>
      </form>
    </div>
  )
}
