/**
 * Server-side door to `public.submit_family_registration`.
 *
 * Same contract as `src/lib/enrollment/repository.ts`: the family and role come
 * from the session inside the database, the caller supplies no family id, and
 * the cookie-bound client is used, never the secret key. This module writes
 * nothing itself. No registration table grants a client role INSERT, so it
 * could not write a row directly even if it tried.
 *
 * Nothing imports this yet. No route, page, or server action exposes it
 * (Slice 2 builds the contract, not the UI). The caller must generate
 * `idempotencyKey` once per attempt and reuse it on every retry of that attempt.
 *
 * It never logs. Registration payloads carry child health, contact, signature,
 * and STEP UP data, and none of it belongs in a log line (MTS
 * SECURITY-ARCHITECTURE).
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import {
  parseRegistrationOutcome,
  registrationInputSchema,
  toRegistrationPayload,
  type RegistrationFailure,
  type RegistrationInput,
  type RegistrationOutcome,
} from "@/lib/registration/contract"

export type SubmitRegistrationResult =
  | { ok: false; reason: RegistrationFailure }
  | {
      ok: true
      outcome: RegistrationOutcome
      registrationId: string | null
      /** Zero-based index of the child whose selection blocked the submission. */
      blockerChildIndex: number | null
      blockerProgramId: string | null
    }

/**
 * Submits one family registration atomically.
 * @param input Untrusted input; validated here and again in the database.
 * @param idempotencyKey A UUID fixed for this attempt and reused on retry.
 */
export async function submitFamilyRegistration(
  input: RegistrationInput,
  idempotencyKey: string,
): Promise<SubmitRegistrationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" }

  const parsed = registrationInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: "invalid" }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("submit_family_registration", {
    idempotency_key: idempotencyKey,
    payload: toRegistrationPayload(parsed.data),
  })

  /* 42501: not a parent, no family, or a child that is not this family's. The
     answer is the same for all three, by design. 22023: a payload the database
     refused. Its message names a path, and it is still not passed on. */
  if (error) {
    return {
      ok: false,
      reason:
        error.code === "42501"
          ? "forbidden"
          : error.code === "22023"
            ? "invalid"
            : "failed",
    }
  }

  const row = Array.isArray(data) ? data[0] : null
  const outcome = parseRegistrationOutcome(row?.outcome)
  if (!row || !outcome) return { ok: false, reason: "failed" }

  return {
    ok: true,
    outcome,
    registrationId: row.registration_id ?? null,
    blockerChildIndex: row.blocker_child_index ?? null,
    blockerProgramId: row.blocker_program_id ?? null,
  }
}
