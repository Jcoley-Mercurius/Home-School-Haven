"use client"

import { useActionState } from "react"

import { setCapacityAction } from "@/app/(portal)/admin/programs/[programId]/actions"
import { emptyCapacityFormState } from "@/app/(portal)/admin/programs/[programId]/form-state"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox, CheckboxRow } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { CAPACITY_MAX } from "@/lib/schedule/validation"
import { describeCapacity, describeWaitlist } from "@/lib/schedule/capacity"

import type { CapacitySummary } from "@/lib/schedule/capacity"

/**
 * Program capacity and the waitlist setting (MPS-RUL-002, MPS-FEA-012,
 * MPS-ACC-018/020; MDS `patterns.forms`, `components.enrollment_state`).
 *
 * EMPTY IS A REAL VALUE, AND IT IS THE DEFAULT
 *
 * Leaving the field empty means Home School Haven has not established a
 * capacity for this program, and every surface then says exactly that in words
 * — no number, no "spaces left", no progress bar. Home School Haven's real
 * capacities are unconfirmed (checklist §1, GAP-ADMIN-004), so an empty field
 * is the honest state for most programs and clearing it is a real correction
 * rather than a way of skipping the form.
 *
 * Empty is NOT zero. Zero is a capacity of no places, which is a much stronger
 * claim, and the two are kept distinguishable all the way to the column.
 *
 * SETTING A NUMBER DECIDES NOTHING ABOUT ANYBODY
 *
 * No enrollment is created, confirmed, waitlisted, or cancelled by a capacity
 * change, and that is structural rather than promised: the database function
 * this form calls updates `public.programs` and names no other table.
 *
 * If confirmed places already exceed the number, the save SUCCEEDS and the
 * condition is reported. Choosing which family loses a place is a policy
 * decision MPS does not define (GAP-ADMIN-012), so this product will not make
 * it — and refusing the save instead would leave an administrator unable to
 * correct a room size.
 *
 * WHAT THE WAITLIST CHECKBOX DOES AND DOES NOT DO
 *
 * It records whether this program accepts waitlist placements (MPS-ACC-020). It
 * starts no payment (MPS-RUL-002), promotes nobody, and orders nobody: a
 * waitlisted record becomes confirmed only by an administrator's explicit
 * decision on the Enrollments page (GAP-ADMIN-011).
 */
function CapacityForm({
  programId,
  updatedAt,
  capacity,
  waitlistEnabled,
  summary,
}: {
  programId: string
  updatedAt: string
  capacity: number | null
  waitlistEnabled: boolean
  summary: CapacitySummary
}) {
  const [state, formAction, pending] = useActionState(
    setCapacityAction,
    emptyCapacityFormState,
  )

  /* On failure the echoed values win, so nothing typed is lost. On success and
     on first render the freshly read row wins. */
  const capacityValue = state.values
    ? state.values.capacity
    : capacity === null
      ? ""
      : String(capacity)

  const waitlistValue = state.values
    ? state.values.waitlistEnabled
    : waitlistEnabled

  const announcement =
    state.status === "saved"
      ? "Capacity saved."
      : state.status === "overCapacity"
        ? "Capacity saved. Confirmed places now exceed it. No enrollment was changed."
        : state.status === "unchanged"
          ? "Nothing changed."
          : state.status === "invalid"
            ? "Nothing was saved. Check the highlighted field below."
            : state.status === "stale"
              ? "Nothing was saved. This program changed while you were editing it."
              : state.status === "notFound"
                ? "Nothing was saved. This program is no longer available."
                : state.status === "forbidden"
                  ? "This account is not authorized to set capacity."
                  : state.status === "unavailable"
                    ? "Capacity cannot be changed in this environment."
                    : state.status === "failed" || state.status === "rejected"
                      ? "Nothing was saved. Please try again."
                      : ""

  const waitlistSentence = describeWaitlist(waitlistEnabled, summary.waitlisted)

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

      <div className="flex flex-col gap-[var(--hsh-space-2)]">
        <p className="hsh-body m-0 text-[var(--hsh-text-primary)]">
          {describeCapacity(summary)}
        </p>
        {waitlistSentence ? (
          <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            {waitlistSentence}
          </p>
        ) : null}
      </div>

      {state.status === "saved" ? (
        <Alert tone="success" title="Capacity saved" live="polite">
          The change is recorded in operations history with your account and the
          time. No enrollment was created, confirmed, or removed.
        </Alert>
      ) : null}

      {/* A success that reports a condition, not a failure. GAP-ADMIN-012. */}
      {state.status === "overCapacity" ? (
        <Alert
          tone="warning"
          title="Capacity saved, and confirmed places now exceed it"
          live="assertive"
        >
          Nothing was changed about any enrollment. Home School Haven has not
          approved a rule for which place is given up when capacity is reduced,
          so this product will not choose one. Reduce the confirmed places on
          the Enrollments page if that is the intention, or raise the capacity
          again.
        </Alert>
      ) : null}

      {state.status === "unchanged" ? (
        <Alert tone="info" title="Nothing changed" live="polite">
          The capacity and waitlist setting were already what you submitted, so
          nothing was written and no history entry was recorded.
        </Alert>
      ) : null}

      {state.status === "invalid" ? (
        <Alert tone="error" title="Nothing was saved" live="polite">
          Check the highlighted field below. Everything you typed is still here.
        </Alert>
      ) : null}

      {state.status === "stale" ? (
        <Alert
          tone="warning"
          title="This program changed while you were editing it"
          live="assertive"
        >
          Nothing was saved, and nobody&rsquo;s work was overwritten. Reload the
          page to see the current capacity, then make your change again.
        </Alert>
      ) : null}

      {state.status === "notFound" ||
      state.status === "forbidden" ||
      state.status === "unavailable" ||
      state.status === "rejected" ||
      state.status === "failed" ? (
        <Alert tone="warning" title="Nothing was saved" live="polite">
          {state.status === "notFound"
            ? "This program is no longer available. Return to the program list."
            : state.status === "forbidden"
              ? "This account is not authorized to set capacity."
              : state.status === "unavailable"
                ? "No Supabase project is configured in this environment."
                : (state.message ??
                  "Something went wrong on our side. Please try again.")}
        </Alert>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <input type="hidden" name="programId" value={programId} />
        <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />

        <Field invalid={Boolean(state.fieldErrors.capacity)}>
          <FieldLabel>Capacity</FieldLabel>
          <Input
            key={`capacity-${capacityValue}`}
            name="capacity"
            type="text"
            inputMode="numeric"
            defaultValue={capacityValue}
            maxLength={String(CAPACITY_MAX).length}
          />
          <FieldDescription>
            The number of places Home School Haven has confirmed for this
            program. Leave this empty if no capacity has been established — that
            is what most programs should show, and it renders to families as no
            number rather than as a zero.
          </FieldDescription>
          <FieldError>{state.fieldErrors.capacity}</FieldError>
        </Field>

        <CheckboxRow>
          <Checkbox
            name="waitlistEnabled"
            defaultChecked={waitlistValue}
            value="on"
          />
          <span className="flex flex-col gap-[var(--hsh-space-1)]">
            <span className="hsh-body text-[var(--hsh-text-primary)]">
              This program accepts waitlist placements
            </span>
            <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              A waitlist place is not enrollment and collects no payment. Nobody
              is moved from the waitlist automatically — an administrator
              confirms each one on the Enrollments page.
            </span>
          </span>
        </CheckboxRow>

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save capacity"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export { CapacityForm }
