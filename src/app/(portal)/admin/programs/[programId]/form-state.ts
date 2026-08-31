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
