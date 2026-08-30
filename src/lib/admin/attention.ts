/**
 * "Items requiring attention" — derived, never invented.
 *
 * MDS-REF-009 draws an attention list at the top of the operations overview and
 * `custom.admin_operations` names its categories. This module is the whole of
 * that derivation, kept pure and free of Supabase so it can be tested against
 * fixtures rather than against a database: every input is a row the
 * administrator was already authorized to read, and every output is a count of
 * those rows plus a sentence describing what the count means.
 *
 * THE LINE THIS MODULE MUST NOT CROSS
 *
 * Each item is informational (MPS-RUL-004, DO-DONT "Trust states"). Nothing here
 * confirms a payment, confirms an enrollment, approves a consent, decides a
 * scholarship, or infers capacity. `payment_pending` in particular is described
 * as payment activity awaiting verification and explicitly *not* confirmed
 * enrollment, which is the same sentence the family reads on their own
 * dashboard — the administrator and the family must never be told different
 * things about one authoritative state (MPS-ACC-022).
 *
 * WHERE EACH SIGNAL COMES FROM
 *
 * Every category below rests on a column an approved migration already
 * maintains, not on a heuristic:
 *
 *   payment / review / blocked   `enrollments.state` — the MPS-WFL-003 enum
 *   consent                      `students.affirmation_version`, which a check
 *                                constraint pins to `demo-unapproved-v0` while
 *                                MPS GAP-005 leaves consent language unapproved
 *   educator assignment          absence of an `educator_assignments` row
 *   content review               `programs.import_status`, the content-QA flag
 *                                set during the approved import (MPS GAP-012)
 *   incomplete information       NULL `published_*` fields, which the programs
 *                                migration defines as "the source does not
 *                                publish this" — reported in those words, never
 *                                as a defect in the program
 */

import type { EnrollmentState } from "@/lib/enrollment/repository"

/** The approved operational categories, in the approved hierarchy order. */
type AttentionCategory =
  | "payment_pending_verification"
  | "enrollment_pending_review"
  | "consent_unavailable"
  | "enrollment_blocked"
  | "missing_educator_assignment"
  | "content_review_required"
  | "incomplete_program_information"

/**
 * Approved semantic tones from MDS-REF-009: warning, blocked, and information.
 * Each is paired with an icon and an explicit label at the render site, so no
 * item's meaning rests on colour (DESIGN-SYSTEM.md §10).
 */
type AttentionTone = "warning" | "blocked" | "information"

type AttentionItem = {
  category: AttentionCategory
  tone: AttentionTone
  /** Explicit text label. Never abbreviated to a colour or a number alone. */
  label: string
  /** What the count means, and what it does not mean. */
  detail: string
  count: number
  /**
   * What the count counts, plural, lower case. Rendered beside the number so a
   * bare figure never has to be interpreted from its position.
   */
  unit: string
  /** True when the underlying rows are sanitized sample records. */
  sample: boolean
}

/** Just enough of a program row to run the program-derived checks. */
type AttentionProgram = {
  publicationState: "draft" | "published" | "archived"
  educatorAssigned: boolean
  needsContentReview: boolean
  hasUnpublishedDetail: boolean
}

/** Just enough of a student row. No name, no grade, no relationship. */
type AttentionStudent = {
  consentApproved: boolean
}

type AttentionInput = {
  /** `null` when the enrollment read failed or was unavailable. */
  enrollmentStates: EnrollmentState[] | null
  /** `null` when the student read failed or was unavailable. */
  students: AttentionStudent[] | null
  /** `null` when the program read failed or was unavailable. */
  programs: AttentionProgram[] | null
}

type AttentionResult = {
  items: AttentionItem[]
  /**
   * True when at least one source could not be read, so the list is known to be
   * partial. The panel says so rather than presenting a short list as complete
   * — "nothing needs attention" and "we could not finish looking" are different
   * statements and must not render the same way.
   */
  incomplete: boolean
}

/**
 * Derive the attention list from authorized rows.
 * @param input - Rows already filtered by RLS, or `null` per failed source.
 * @returns The items with a non-zero count, in approved order, plus whether any
 *   source was missing.
 */
function deriveAttention({
  enrollmentStates,
  students,
  programs,
}: AttentionInput): AttentionResult {
  const items: AttentionItem[] = []

  const countStates = (...states: EnrollmentState[]) =>
    (enrollmentStates ?? []).filter((state) => states.includes(state)).length

  if (enrollmentStates) {
    const paymentPending = countStates("payment_pending")
    if (paymentPending > 0) {
      items.push({
        category: "payment_pending_verification",
        tone: "warning",
        label: "Payment verification pending",
        detail:
          "Payment activity is awaiting verification by an authorized administrator. It is not confirmed payment, and these enrollments are not confirmed.",
        count: paymentPending,
        unit: "enrollments",
        sample: true,
      })
    }

    /* `started` belongs here too: checkout was opened with the external
       provider and nothing authoritative has come back. It is a registration
       awaiting review exactly as much as `approval_pending` is. */
    const pendingReview = countStates("approval_pending", "started")
    if (pendingReview > 0) {
      items.push({
        category: "enrollment_pending_review",
        tone: "warning",
        label: "Enrollment pending review",
        detail:
          "Registrations are waiting on administrative review. Reviewing them is not part of this release.",
        count: pendingReview,
        unit: "registrations",
        sample: true,
      })
    }
  }

  if (students) {
    const withoutConsent = students.filter(
      (student) => !student.consentApproved,
    ).length
    if (withoutConsent > 0) {
      items.push({
        category: "consent_unavailable",
        tone: "blocked",
        label: "Consent policy not yet approved",
        detail:
          "Student profiles carry a demo authority affirmation because Samantha Dodson has not yet approved the consent language. Real-family activation stays blocked until she does.",
        count: withoutConsent,
        unit: "student profiles",
        sample: true,
      })
    }
  }

  if (enrollmentStates) {
    const blocked = countStates("blocked")
    if (blocked > 0) {
      items.push({
        category: "enrollment_blocked",
        tone: "blocked",
        label: "Enrollment blocked",
        detail:
          "These registrations cannot proceed until an authorized administrator looks at them. They are not confirmed.",
        count: blocked,
        unit: "enrollments",
        sample: true,
      })
    }
  }

  if (programs) {
    const missingEducator = programs.filter(
      (program) =>
        program.publicationState === "published" && !program.educatorAssigned,
    ).length
    if (missingEducator > 0) {
      items.push({
        category: "missing_educator_assignment",
        tone: "warning",
        label: "Missing educator assignment",
        detail:
          "Published programs have no assigned educator, so no educator can reach their schedule, roster, or announcements.",
        count: missingEducator,
        unit: "published programs",
        sample: false,
      })
    }

    const contentReview = programs.filter(
      (program) => program.needsContentReview,
    ).length
    if (contentReview > 0) {
      items.push({
        category: "content_review_required",
        tone: "information",
        label: "Content review required",
        detail:
          "The approved content import flagged these programs for a title or detail review before public launch.",
        count: contentReview,
        unit: "programs",
        sample: false,
      })
    }

    const incompleteInformation = programs.filter(
      (program) =>
        program.publicationState === "published" &&
        program.hasUnpublishedDetail,
    ).length
    if (incompleteInformation > 0) {
      items.push({
        category: "incomplete_program_information",
        tone: "information",
        label: "Program details not published",
        detail:
          "Published programs have no published price, schedule, or dates in the approved source. Families see “Contact for details” rather than an invented value.",
        count: incompleteInformation,
        unit: "published programs",
        sample: false,
      })
    }
  }

  return {
    items,
    incomplete: !enrollmentStates || !students || !programs,
  }
}

export { deriveAttention }
export type {
  AttentionCategory,
  AttentionItem,
  AttentionProgram,
  AttentionResult,
  AttentionStudent,
  AttentionTone,
}
