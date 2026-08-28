/**
 * Guidance-request recording boundary (MPS-REQ-010, MPS-WFL-001/004).
 *
 * MPS-REQ-010 requires each submitted inquiry to be recorded once with its
 * type, contact information, time, current state, and an authorized
 * administrative owner, and MPS-ACC-013 requires assistance requests to stay
 * private. None of that infrastructure exists yet in this repository:
 *
 *   - Supabase is not installed (MTS IMPLEMENTATION-PLAN Phase 1 is unstarted);
 *   - Resend is not configured and no recipient address is published;
 *   - writing contact details into runtime logs is prohibited by
 *     `mts/SECURITY-ARCHITECTURE.md` ("prevent sensitive fields from entering
 *     logs, analytics, URLs, errors, prompts, or fixtures").
 *
 * So there is currently nowhere authorized for a request to go, and the only
 * honest outcome is `unavailable`. Claiming "request received" with no record
 * behind it is the false confirmation MPS-ACC-014 forbids.
 *
 * Server-only module. It is imported solely by the `"use server"` action in
 * `src/app/guidance/actions.ts`, so nothing here reaches a browser bundle. The
 * `server-only` package is not a dependency of this repository, so that
 * boundary is maintained by review rather than enforced by the compiler — do
 * not import this module from a client component.
 *
 * **To wire the real destination**, implement `recordGuidanceRequest` here and
 * here only — the server action, the form, and every state it renders already
 * handle the `recorded` outcome. Nothing else changes.
 */

export type GuidanceRequestType = "guidance" | "visit" | "assistance"

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
  submittedAt: string
}

export type RecordResult =
  /** The request was durably recorded once and is owned by an administrator. */
  | { status: "recorded"; reference: string }
  /** No authorized destination is configured. Never claim success. */
  | { status: "unavailable" }
  /** A configured destination failed. Offer retry plus the contact path. */
  | { status: "failed" }

export async function recordGuidanceRequest(
  request: GuidanceRequest,
): Promise<RecordResult> {
  /* No destination is configured. The request is deliberately not read, not
     logged, and not persisted anywhere. */
  void request
  return { status: "unavailable" }
}
