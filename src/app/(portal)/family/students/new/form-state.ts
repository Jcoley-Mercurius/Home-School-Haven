/**
 * Demo student profile form state (deviation D-FF1).
 *
 * Separate from `actions.ts` for the same reason as every other form-state
 * module here: a `"use server"` module may export only async functions.
 */

export type StudentFormState = {
  status: "idle" | "invalid" | "forbidden" | "unavailable" | "failed"
  fieldErrors: {
    preferredName?: string
    gradeLevel?: string
    guardianRelationship?: string
    authority?: string
  }
  /**
   * Echoed on failure. These are sample values in this review, but they are
   * still treated as family data: they are never logged and never placed in a
   * URL (AGENTS.md §11).
   */
  values: {
    preferredName: string
    gradeLevel: string
    guardianRelationship: string
    authority: boolean
  }
}

export const emptyStudentFormState: StudentFormState = {
  status: "idle",
  fieldErrors: {},
  values: {
    preferredName: "",
    gradeLevel: "",
    guardianRelationship: "",
    authority: false,
  },
}
