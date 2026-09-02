/**
 * Contact-request recording boundary (MPS-REQ-010, MPS-WFL-001/004).
 *
 * MPS-REQ-010 requires each submitted inquiry to be recorded once with its
 * type, contact information, time, current state, and an authorized
 * administrative owner, and MPS-ACC-013 requires assistance requests to stay
 * private. This module is where a validated request meets that record.
 *
 * WHERE THE REQUEST ACTUALLY GOES
 *
 * `public.submit_inquiry` in
 * `supabase/migrations/20260904000000_inquiry_capture_foundation.sql`. That
 * function is the only path by which an inquiry can be created: the table
 * grants no INSERT to `anon` or to `authenticated`, so nothing here — and
 * nothing a forged request could reach — writes a row any other way.
 *
 * The database, not this module, decides the state (always `submitted`), the
 * owner (always NULL until an administrator claims it), the reference, and the
 * recorded time. This module supplies only what the sender typed.
 *
 * WHAT IS STILL NOT SENT
 *
 * No email. MPS names no confirmation *channel* for MPS-ACC-012 or the
 * MPS-WFL-004 notification "Confirm receipt privately", and Resend remains
 * unconfigured (`mts/INTEGRATION-MANIFEST.md`). Receipt is confirmed on screen
 * with the reference below, and the administrator queue at `/admin/inquiries`
 * is the notification. Adding email is GAP-PUBLIC-001 and needs an owner
 * decision, not a code change here.
 *
 * PRIVACY
 *
 * Nothing in a request is logged, placed in a URL, or included in an error.
 * `mts/SECURITY-ARCHITECTURE.md` prohibits sensitive fields entering logs,
 * analytics, URLs, errors, prompts, or fixtures, and an assistance request is
 * exactly the content MPS-RUL-003 calls a sensitive family matter. The failure
 * paths below deliberately discard the driver's error rather than surfacing or
 * recording it — a PostgREST error carries the arguments that produced it.
 *
 * Server-only, enforced by the `server-only` import: this module can never be
 * pulled into a browser bundle.
 */

import "server-only"

import { createClient } from "@/lib/supabase/server"
import { supabaseConfig } from "@/lib/env"

/**
 * The request types MPS-REQ-009 offers from the public experience. `question`
 * was added by owner decision on 2026-08-28 for the "General Question" pathway
 * on `/contact`; the remaining three are the approved general-guidance, visit,
 * and discounted-class-assistance paths. MPS-REQ-009's fourth path, direct
 * registration, is the program checkout handoff and is not an inquiry type.
 *
 * These four values are the `public.inquiry_type` enum, and the database
 * refuses anything else.
 */
export type GuidanceRequestType =
  "guidance" | "question" | "visit" | "assistance"

/**
 * A validated request. Contact details of the requesting adult only — this
 * flow collects no child or student information (AGENTS.md §11, MPS-RUL-006).
 */
export type GuidanceRequest = {
  type: GuidanceRequestType
  name: string
  email: string
  phone: string | null
  programSlug: string | null
  message: string
  /**
   * Idempotency key (MPS-ACC-012 "created once"). Generated once per submission
   * attempt by the server action, so a double-clicked button, a retried action,
   * or a resubmitted form reaches the same single record. It is not the record
   * id and is never shown to anyone.
   */
  submissionToken: string
}

export type RecordResult =
  /** The request was durably recorded once and is owned by an administrator. */
  | { status: "recorded"; reference: string }
  /** No authorized destination is configured. Never claim success. */
  | { status: "unavailable" }
  /** A configured destination failed. Offer retry plus the contact path. */
  | { status: "failed" }

/**
 * Records one public inquiry (MPS-REQ-010).
 * @param request - The server-validated request.
 * @returns `recorded` with the sender's reference, or a truthful failure state.
 */
export async function recordGuidanceRequest(
  request: GuidanceRequest,
): Promise<RecordResult> {
  /* No Supabase project in this environment — a real state in a preview built
     before the database exists, not an error. Claiming "received" with nowhere
     to receive it is the false confirmation MPS-ACC-014 forbids. */
  if (!supabaseConfig()) {
    return { status: "unavailable" }
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc("submit_inquiry", {
      p_type: request.type,
      p_name: request.name,
      p_email: request.email,
      /* The generated argument types are non-nullable, so an absent optional
         value is sent as an empty string. `submit_inquiry` folds an empty
         string back to NULL (`nullif(btrim(...), '')`), so "no phone given"
         and "no program named" arrive as the absence they are. */
      p_phone: request.phone ?? "",
      p_program_slug: request.programSlug ?? "",
      p_message: request.message,
      p_submission_token: request.submissionToken,
    })

    /* `error` is discarded rather than logged: it echoes the arguments, and
       those arguments are the family's contact details and message. `data` is
       the reference — an opaque code carrying no contact detail, which is what
       makes it safe to show, to screenshot, and to read aloud on the phone. */
    if (error || typeof data !== "string" || data.length === 0) {
      return { status: "failed" }
    }

    return { status: "recorded", reference: data }
  } catch {
    /* Network failure, an unreachable project, a timeout. Nothing is known to
       have been recorded, so nothing is claimed. */
    return { status: "failed" }
  }
}
