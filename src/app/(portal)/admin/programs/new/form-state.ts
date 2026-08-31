/**
 * Create-program-draft form state.
 *
 * Separate from `actions.ts` because a `"use server"` module may export only
 * async functions.
 */

type CreateProgramFormState = {
  status:
    | "idle"
    | "invalid"
    /** The slug is already in use. Its own status: it has its own fix. */
    | "duplicate"
    | "forbidden"
    | "unavailable"
    | "failed"
  fieldErrors: {
    name?: string
    slug?: string
    summary?: string
  }
  /** Echoed on every failure, so nothing an administrator typed is lost. */
  values: {
    name: string
    slug: string
    summary: string
  }
}

const emptyCreateProgramFormState: CreateProgramFormState = {
  status: "idle",
  fieldErrors: {},
  values: { name: "", slug: "", summary: "" },
}

export { emptyCreateProgramFormState }
export type { CreateProgramFormState }
