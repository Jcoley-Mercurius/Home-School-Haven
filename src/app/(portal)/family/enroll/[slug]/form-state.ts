import type { EnrollmentOutcome } from "@/lib/enrollment/eligibility"

/**
 * Registration form state.
 *
 * Separate from `actions.ts` because a `"use server"` module may export only
 * async functions.
 *
 * `blocked` is a first-class status rather than a variety of `failed`. Nothing
 * went wrong: the MPS-REQ-012 evaluation refused, and the parent needs the
 * reason and a way forward (MPS-ACC-018). Folding it into a generic failure
 * would tell them to retry the one thing that will refuse again.
 */
type EnrollFormValues = {
  studentId: string
  authority: string
}

type EnrollFormState = {
  status:
    "idle" | "invalid" | "blocked" | "forbidden" | "unavailable" | "failed"
  fieldErrors: Partial<Record<keyof EnrollFormValues, string>>
  /** Set only when `status` is `blocked`. Names which check refused. */
  outcome?: EnrollmentOutcome
  /** Echoed so a refusal does not clear the parent's selection. */
  values: EnrollFormValues
}

const emptyEnrollFormState: EnrollFormState = {
  status: "idle",
  fieldErrors: {},
  values: { studentId: "", authority: "" },
}

export { emptyEnrollFormState }
export type { EnrollFormState, EnrollFormValues }
