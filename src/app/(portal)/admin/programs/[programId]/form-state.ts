/**
 * Program detail form states.
 *
 * Separate from `actions.ts` because a `"use server"` module may export only
 * async functions.
 *
 * `stale` is a first-class status rather than a variety of `failed`, because it
 * needs a different sentence and a different recovery: nothing is wrong, the
 * record simply moved, and the administrator needs to see where it moved to
 * before deciding again. Collapsing it into "something went wrong" would tell
 * them to retry the very thing that should not be retried blind.
 */

type ProgramFactsStatus =
  | "idle"
  | "invalid"
  | "stale"
  | "notFound"
  | "forbidden"
  | "unavailable"
  | "failed"
  | "saved"

type ProgramFactsValues = {
  name: string
  summary: string
  audience: string
  format: string
  location: string
  educator: string
  dates: string
  schedule: string
  duration: string
  sessionLength: string
  price: string
  availability: string
  checkoutUrl: string
  /** MPS-RUL-001: `instant` or `administrator_approval`. */
  confirmationMode: string
}

type ProgramFactsFormState = {
  status: ProgramFactsStatus
  fieldErrors: Partial<Record<keyof ProgramFactsValues, string>>
  /** Echoed on every failure. Program facts are not private, but losing an
      administrator's typing is still how a form makes someone give up. */
  values: ProgramFactsValues | null
}

const emptyProgramFactsFormState: ProgramFactsFormState = {
  status: "idle",
  fieldErrors: {},
  values: null,
}

type PublicationFormState = {
  status:
    | "idle"
    | "updated"
    /** The program already had that publication state. Nothing was written. */
    | "unchanged"
    | "invalidTransition"
    | "stale"
    | "notFound"
    | "forbidden"
    | "unavailable"
    | "rejected"
    | "failed"
  /** Safe to display. Never echoes a submitted value or a database detail. */
  message?: string
}

const emptyPublicationFormState: PublicationFormState = { status: "idle" }

export { emptyProgramFactsFormState, emptyPublicationFormState }
export type { ProgramFactsFormState, ProgramFactsValues, PublicationFormState }

/**
 * Schedule and capacity form states (HSH-SLICE-ADM-04).
 *
 * `overCapacity` is a first-class SUCCESS status, not a failure. The capacity
 * saved; confirmed places now exceed it; nothing was decided about who loses a
 * place, because MPS defines no rule for that (GAP-ADMIN-012). Folding it into
 * `saved` would hide the condition, and folding it into a failure would claim a
 * refusal that did not happen.
 *
 * `rescheduled` is likewise distinct from `saved`: the same submission that
 * corrects a title also moves a session, and only the database knows which
 * occurred. The administrator needs to see which one they just did.
 */
type SessionFormValues = {
  title: string
  startsAt: string
  endsAt: string
  location: string
  changeNote: string
}

type SessionFormState = {
  status:
    | "idle"
    | "invalid"
    | "stale"
    | "notFound"
    | "forbidden"
    | "unavailable"
    | "rejected"
    | "failed"
    | "created"
    | "saved"
    | "rescheduled"
    | "unchanged"
  fieldErrors: Partial<Record<keyof SessionFormValues, string>>
  /** Echoed on every failure, so an administrator's typing survives a refusal. */
  values: SessionFormValues | null
  /** Safe to display. Never echoes a submitted value or a database detail. */
  message?: string
}

const emptySessionFormState: SessionFormState = {
  status: "idle",
  fieldErrors: {},
  values: null,
}

type SessionStateFormState = {
  status:
    | "idle"
    | "updated"
    | "unchanged"
    | "invalidTransition"
    | "stale"
    | "notFound"
    | "forbidden"
    | "unavailable"
    | "rejected"
    | "failed"
  message?: string
}

const emptySessionStateFormState: SessionStateFormState = { status: "idle" }

type CapacityFormValues = { capacity: string; waitlistEnabled: boolean }

type CapacityFormState = {
  status:
    | "idle"
    | "invalid"
    | "saved"
    /** Saved, and confirmed places now exceed it (GAP-ADMIN-012). */
    | "overCapacity"
    | "unchanged"
    | "stale"
    | "notFound"
    | "forbidden"
    | "unavailable"
    | "rejected"
    | "failed"
  fieldErrors: Partial<Record<keyof CapacityFormValues, string>>
  values: CapacityFormValues | null
  message?: string
}

const emptyCapacityFormState: CapacityFormState = {
  status: "idle",
  fieldErrors: {},
  values: null,
}

export {
  emptyCapacityFormState,
  emptySessionFormState,
  emptySessionStateFormState,
}
export type {
  CapacityFormState,
  CapacityFormValues,
  SessionFormState,
  SessionFormValues,
  SessionStateFormState,
}
