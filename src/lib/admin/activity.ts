/**
 * Plain-language phrasing for a row of attributable history (MPS-REQ-024).
 *
 * `public.audit_events` stores an entity type and an action as bare strings,
 * and `changed_fields` holds enum labels. Rendering any of that verbatim would
 * put internal vocabulary — and, for a future entity, an internal name this
 * code has never seen — on an operator's screen. Every known pair is mapped
 * here, and the fallback is the control: an unmapped pair produces a neutral
 * sentence rather than leaking the string.
 *
 * It lives beside `attention.ts`, apart from the repository, for the same
 * reason that one does: it is pure, it imports nothing at runtime, and that is
 * what lets `tests/admin-attention.test.mts` exercise it directly. The
 * repository is `server-only` and reaches Supabase, so nothing importable by a
 * plain Node test can live inside it.
 */

const ACTIVITY_PHRASES: Record<string, string> = {
  "program:created": "Program created",
  "program:updated": "Program details updated",
  "program:deleted": "Program removed",
  "educator_assignment:assigned": "Educator assignment added",
  "educator_assignment:unassigned": "Educator assignment removed",
  "enrollment:created": "Enrollment record created",
  "enrollment:state_changed": "Enrollment state changed",
  "enrollment:deleted": "Enrollment record removed",
  /* Emitted by `create_family_for_current_user` and the `students` audit
     trigger. The rows carry no family or child name and none is added here:
     that a profile was added is operational history, who it belongs to is not
     the administrator's business on an overview. */
  "family:created": "Family account created",
  "student:created": "Student profile added",
  "student:deleted": "Student profile removed",
}

/**
 * Describe an audited change.
 * @param entityType - The audited entity, as stored.
 * @param action - The recorded action, as stored.
 * @returns A sentence an administrator can read, never a database string.
 */
function describeActivity(entityType: string, action: string): string {
  return (
    ACTIVITY_PHRASES[`${entityType}:${action}`] ?? "Operational change recorded"
  )
}

export { describeActivity }
