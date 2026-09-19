"use server"

import { z } from "zod"

import { requireRole } from "@/lib/auth/guards"
import { isRecorded } from "@/lib/registration/contract"
import {
  getRegistrationCatalog,
  getRegistrationResults,
  submitFamilyRegistration,
} from "@/lib/registration/repository"

import type { RegistrationActionResult } from "./result"

/**
 * Submit one family registration (MPS-WFL-002/003; DEC-026 to DEC-033; MDS
 * DESIGN-SYSTEM §9.1).
 *
 * A Server Action is a public POST, so the page's guard does not protect it.
 * The guard runs again here. Behind that, `submit_family_registration`
 * re-derives the caller, their role, and their family from `auth.uid()`,
 * re-validates every field, checks the document versions against the ones it
 * presents, evaluates each selection on a locked program row, and writes all of
 * it or none of it. This action decides nothing. It passes the parent's input
 * and the page's attempt key through, and reports what the database decided.
 *
 * The input arrives as `unknown` and is parsed against the strict contract in
 * `submitFamilyRegistration`, so a family id, role, price, state, or STEP UP key
 * that a forged request adds is refused before the database is asked.
 *
 * Nothing is logged, and nothing a parent typed is returned. The per-child
 * result is read back from the database, not echoed from the input.
 */
const attemptKeySchema = z.uuid()

export async function submitRegistrationAction(
  input: unknown,
  attemptKey: unknown,
): Promise<RegistrationActionResult> {
  await requireRole("parent", "/family/registration")

  const key = attemptKeySchema.safeParse(attemptKey)
  if (!key.success) return { status: "invalid", path: null }

  const result = await submitFamilyRegistration(
    input as Parameters<typeof submitFamilyRegistration>[0],
    key.data,
  )

  if (!result.ok) {
    switch (result.reason) {
      case "invalid":
        return { status: "invalid", path: result.invalidPath ?? null }
      case "forbidden":
        return { status: "forbidden" }
      case "unavailable":
        return { status: "unavailable" }
      case "failed":
        /* Not "nothing was recorded": a timeout after commit looks the same
           as one before it. The same attempt key makes a retry safe either
           way. */
        return { status: "unconfirmed" }
    }
  }

  if (isRecorded(result.outcome) && result.registrationId) {
    const children = await getRegistrationResults(result.registrationId)
    return {
      status: "recorded",
      replayed: result.outcome === "replayed",
      children,
    }
  }

  if (result.outcome === "idempotency_conflict") return { status: "conflict" }

  if (result.outcome === "blocked_authority") {
    return { status: "invalid", path: "authority_affirmed" }
  }

  if (
    result.outcome === "blocked_document_version_stale" ||
    result.outcome === "blocked_documents_unavailable"
  ) {
    /* The family accepted a version that is no longer the one presented, or
       none is presented at all. Nothing was written. The current versions are
       read again so the page can ask for acceptance of what is presented now
       (DEC-029), never of what was presented before. */
    const catalog = await getRegistrationCatalog()
    return {
      status: "blocked",
      outcome: result.outcome,
      childIndex: null,
      programId: null,
      documents: catalog.status === "ready" ? catalog.catalog.documents : null,
    }
  }

  if (
    result.outcome === "blocked_attendance_unconfigured" ||
    result.outcome === "blocked_unavailable" ||
    result.outcome === "blocked_closed" ||
    result.outcome === "blocked_full" ||
    result.outcome === "blocked_duplicate"
  ) {
    return {
      status: "blocked",
      outcome: result.outcome,
      childIndex: result.blockerChildIndex,
      programId: result.blockerProgramId,
      documents: null,
    }
  }

  /* `submitted` or `replayed` without an id would be a database defect. It is
     not success until the database says which registration it is. */
  return { status: "unconfirmed" }
}
