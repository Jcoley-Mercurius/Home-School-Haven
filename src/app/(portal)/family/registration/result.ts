import type { RegistrationOutcome } from "@/lib/registration/contract"
import type { CatalogDocument, DocumentKind } from "@/lib/registration/form"
import type { RegistrationChildResult } from "@/lib/registration/repository"

/**
 * What the registration action can answer.
 *
 * Separate from `actions.ts` because a `"use server"` module may export only
 * async functions.
 *
 * Every variant is something the parent must be told differently, which is why
 * `blocked`, `conflict`, and `unconfirmed` are not folded into one "failed":
 *
 *   * `blocked`: the database refused a named selection or document and wrote
 *     nothing. The parent needs the reason, not a retry.
 *   * `conflict`: this page's attempt key already recorded a registration with
 *     different details, typically after an unconfirmed attempt was then
 *     edited. Something WAS recorded, and it is not this form's content.
 *   * `unconfirmed`: nobody knows. Retrying with the same key is safe.
 */
export type RegistrationActionResult =
  | {
      status: "recorded"
      /** True when this was a retry of an attempt that had already committed. */
      replayed: boolean
      /** `null` when the read-back failed: recorded, but states unknown here. */
      children: RegistrationChildResult[] | null
    }
  | { status: "invalid"; path: string | null }
  | {
      status: "blocked"
      outcome: Exclude<
        RegistrationOutcome,
        "submitted" | "replayed" | "idempotency_conflict" | "blocked_authority"
      >
      childIndex: number | null
      programId: string | null
      /** For the document outcomes: the versions presented now. */
      documents: Record<DocumentKind, CatalogDocument | null> | null
    }
  | { status: "conflict" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfirmed" }
