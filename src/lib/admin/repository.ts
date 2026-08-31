/**
 * Authorized administrator reads for the operations overview (MPS-REQ-016/017/
 * 020/024, MDS-REF-009).
 *
 * WHERE THE BOUNDARY IS
 *
 * Nothing in this module narrows a query by a caller-supplied value, because
 * the caller is ultimately the browser. Reach comes from `private.is_admin()`
 * inside the `*_select_admin` policies, evaluated against the verified session.
 * A parent running these exact queries gets their own family's rows; an
 * educator gets their assigned programs; a viewer with no role grant gets
 * nothing. The page's `requireAdmin()` guard and these policies are two
 * independent controls, and neither is load-bearing alone.
 *
 * The client carries the publishable key like every other server read in this
 * repository. There is no service-role path here, so RLS is genuinely in force
 * rather than bypassed with a privileged key and re-checked in application code
 * (SECURITY-ARCHITECTURE "least privilege").
 *
 * AGGREGATES, NOT PEOPLE
 *
 * The overview needs to know *how many*, not *who*. So `students` is read for a
 * count and for the consent flag and never for a name; `families` is read for a
 * count and never for a name; `enrollments` is read for its state and never for
 * its note, its student, or its family. No child or family identifier reaches
 * the render tree, which is the cheapest possible way to keep one off a
 * screenshot, out of a log, and away from an analytics payload.
 *
 * NO WRITES, ANYWHERE
 *
 * This slice is read-only by its own boundary. Program lifecycle transitions
 * (MPS-REQ-016), enrollment reconciliation (MPS-REQ-017), and announcement
 * authoring (MPS-REQ-019) are later slices. Their RLS write policies already
 * exist and are already tested, so those actions will add a UI, not a new trust
 * boundary.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { deriveAttention } from "@/lib/admin/attention"
import { describeActivity } from "@/lib/admin/activity"

import type { AttentionResult } from "@/lib/admin/attention"
import type { EnrollmentState } from "@/lib/enrollment/repository"
import type { Enums } from "@/lib/supabase/types"

type PublicationState = Enums<"program_publication_state">

/**
 * One read, with "we could not look" kept distinct from "there is nothing
 * here". Shaped like `SectionState` in the enrollment repository, but carrying
 * a single value rather than a list, because most of what an overview shows is
 * a summary rather than a collection. Reads assembled from independent queries
 * can opt into typed `gaps` so unavailable related data is not rendered as an
 * empty relationship.
 */
type AdminRead<T, TGap extends string = never> =
  /** No Supabase project in this environment — not the same as "empty". */
  | { status: "unavailable" }
  /** The read failed. Never rendered as emptiness. */
  | { status: "failed" }
  | ([TGap] extends [never]
      ? { status: "ready"; data: T }
      : { status: "ready"; data: T; gaps: TGap[] })

/** A program as the operations table shows it. Program fields only. */
type ProgramOperationsRow = {
  id: string
  slug: string
  name: string
  publicationState: PublicationState
  educatorAssigned: boolean
  /**
   * Whether a program-specific external checkout URL is published. The URL
   * itself is deliberately not carried: the overview reports that a
   * registration path exists, and a link that leaves the platform belongs on
   * the program page where the handoff is explained (MPS-REQ-013).
   */
  hasCheckoutUrl: boolean
  needsContentReview: boolean
  hasUnpublishedDetail: boolean
  image: {
    src: string
    alt: string
    width: number
    height: number
    isPlaceholder: boolean
  } | null
}

type ProgramSummary = {
  total: number
  published: number
  draft: number
  archived: number
}

type EnrollmentSummary = {
  total: number
  byState: Record<EnrollmentState, number>
}

type FamilySummary = {
  families: number
  students: number
}

type EducatorSummary = {
  educatorAccounts: number
  assignments: number
  publishedWithoutEducator: number
}

/** One row of attributable history (MPS-REQ-024). */
type ActivityEntry = {
  id: number
  occurredAt: string
  /** Plain-language phrasing. No database enum or identifier is rendered. */
  description: string
  /** False when the change came from a migration, seed, or CLI operation. */
  attributed: boolean
}

type AdminOverview = {
  programs: AdminRead<ProgramOperationsRow[]>
  programSummary: AdminRead<ProgramSummary>
  enrollments: AdminRead<EnrollmentSummary>
  families: AdminRead<FamilySummary>
  educators: AdminRead<EducatorSummary>
  attention: AdminRead<AttentionResult>
  activity: AdminRead<ActivityEntry[]>
}

/** Every enrollment state at zero, so a state absent from the data still reads. */
const ZERO_ENROLLMENT_STATES: Record<EnrollmentState, number> = {
  started: 0,
  approval_pending: 0,
  payment_pending: 0,
  waitlisted: 0,
  confirmed: 0,
  payment_failed: 0,
  canceled: 0,
  blocked: 0,
}

/**
 * The whole operations overview, as one authorized round of reads.
 *
 * The six queries run in parallel and each section's state is derived only from
 * the queries it depends on, so a failed `audit_events` read costs the page its
 * activity list and nothing else. That is MPS-REQ-021's observable state per
 * section: a page that vanishes because one query failed tells an operator less
 * than a page that says which part is missing.
 *
 * @param activityLimit - How many history entries to show.
 * @returns Every section's state.
 */
async function getAdminOverview(activityLimit = 8): Promise<AdminOverview> {
  if (!isSupabaseConfigured()) {
    const unavailable = { status: "unavailable" } as const
    return {
      programs: unavailable,
      programSummary: unavailable,
      enrollments: unavailable,
      families: unavailable,
      educators: unavailable,
      attention: unavailable,
      activity: unavailable,
    }
  }

  const supabase = await createClient()

  const [
    programRows,
    assignmentRows,
    enrollmentRows,
    familyRows,
    studentRows,
    roleRows,
    activityRows,
  ] = await Promise.all([
    supabase
      .from("programs")
      /* One string literal, not a concatenation: PostgREST infers the row
         type from the literal, and a runtime-built string degrades every
         column to `GenericStringError`. */
      .select(
        "id,slug,name,publication_state,checkout_url,import_status,published_price,published_schedule,published_dates,image_src,image_alt,image_width,image_height,image_is_placeholder",
      )
      .order("sort_order"),
    supabase.from("educator_assignments").select("educator_user_id,program_id"),
    /* State only. Not the note, not the student, not the family — an aggregate
       needs none of them, and what is never read cannot be leaked. */
    supabase.from("enrollments").select("state"),
    supabase.from("families").select("id"),
    supabase.from("students").select("affirmation_version"),
    supabase.from("user_roles").select("role"),
    supabase
      .from("audit_events")
      .select("id,occurred_at,entity_type,action,actor_user_id")
      .order("occurred_at", { ascending: false })
      .limit(activityLimit),
  ])

  /* ---------------------------------------------------------------------
     Programs and their assignment state
     --------------------------------------------------------------------- */
  const assignments = assignmentRows.error ? null : (assignmentRows.data ?? [])
  const assignedProgramIds = assignments
    ? new Set(assignments.map((row) => row.program_id))
    : null

  const programOperations: ProgramOperationsRow[] | null =
    programRows.error || assignedProgramIds === null
      ? null
      : (programRows.data ?? []).map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          publicationState: row.publication_state,
          educatorAssigned: assignedProgramIds.has(row.id),
          hasCheckoutUrl: Boolean(row.checkout_url),
          needsContentReview:
            row.import_status === "import-title-review-detail",
          /* NULL means "the approved source does not publish this fact"
           (programs migration, import rule 3). It is reported as unpublished
           detail, never as a missing or wrong value. */
          hasUnpublishedDetail:
            row.published_price === null ||
            row.published_schedule === null ||
            row.published_dates === null,
          /* `programs_image_complete_check` guarantees these four columns are
           all set or all NULL, so one non-null check settles the whole shape.
           TypeScript cannot see that constraint, hence the explicit guards. */
          image:
            row.image_src !== null &&
            row.image_alt !== null &&
            row.image_width !== null &&
            row.image_height !== null
              ? {
                  src: row.image_src,
                  alt: row.image_alt,
                  width: row.image_width,
                  height: row.image_height,
                  isPlaceholder: row.image_is_placeholder,
                }
              : null,
        }))

  const programSummary: ProgramSummary | null = programOperations
    ? {
        total: programOperations.length,
        published: programOperations.filter(
          (program) => program.publicationState === "published",
        ).length,
        draft: programOperations.filter(
          (program) => program.publicationState === "draft",
        ).length,
        archived: programOperations.filter(
          (program) => program.publicationState === "archived",
        ).length,
      }
    : null

  /* ---------------------------------------------------------------------
     Enrollments
     --------------------------------------------------------------------- */
  const enrollmentStates: EnrollmentState[] | null = enrollmentRows.error
    ? null
    : (enrollmentRows.data ?? []).map((row) => row.state)

  const enrollmentSummary: EnrollmentSummary | null = enrollmentStates
    ? {
        total: enrollmentStates.length,
        byState: enrollmentStates.reduce<Record<EnrollmentState, number>>(
          (counts, state) => ({ ...counts, [state]: counts[state] + 1 }),
          { ...ZERO_ENROLLMENT_STATES },
        ),
      }
    : null

  /* ---------------------------------------------------------------------
     Families and students
     --------------------------------------------------------------------- */
  const students = studentRows.error
    ? null
    : (studentRows.data ?? []).map((row) => ({
        /* The check constraint pins this to `demo-unapproved-v0` while MPS
           GAP-005 is open, so today this is always false. It is derived rather
           than hardcoded so that approving consent language changes the
           dashboard by changing the data, not by changing this file. */
        consentApproved: row.affirmation_version !== "demo-unapproved-v0",
      }))

  const familySummary: FamilySummary | null =
    familyRows.error || students === null
      ? null
      : {
          families: (familyRows.data ?? []).length,
          students: students.length,
        }

  /* ---------------------------------------------------------------------
     Educators
     --------------------------------------------------------------------- */
  const educatorSummary: EducatorSummary | null =
    roleRows.error || assignments === null || programOperations === null
      ? null
      : {
          educatorAccounts: (roleRows.data ?? []).filter(
            (row) => row.role === "educator",
          ).length,
          assignments: assignments.length,
          publishedWithoutEducator: programOperations.filter(
            (program) =>
              program.publicationState === "published" &&
              !program.educatorAssigned,
          ).length,
        }

  /* ---------------------------------------------------------------------
     Attention and activity
     --------------------------------------------------------------------- */
  const attention = deriveAttention({
    enrollmentStates,
    students,
    programs: programOperations,
  })

  const activity: ActivityEntry[] | null = activityRows.error
    ? null
    : (activityRows.data ?? []).map((row) => ({
        id: row.id,
        occurredAt: row.occurred_at,
        description: describeActivity(row.entity_type, row.action),
        attributed: row.actor_user_id !== null,
      }))

  const read = <T>(value: T | null): AdminRead<T> =>
    value === null ? { status: "failed" } : { status: "ready", data: value }

  return {
    programs: read(programOperations),
    programSummary: read(programSummary),
    enrollments: read(enrollmentSummary),
    families: read(familySummary),
    educators: read(educatorSummary),
    /* Attention always renders: `deriveAttention` reports partiality through
       its own `incomplete` flag rather than by disappearing, so an operator is
       told which checks could not run instead of seeing a short list that
       looks complete. */
    attention: { status: "ready", data: attention },
    activity: read(activity),
  }
}

export { getAdminOverview }
export type {
  ActivityEntry,
  AdminOverview,
  AdminRead,
  EducatorSummary,
  EnrollmentSummary,
  FamilySummary,
  ProgramOperationsRow,
  ProgramSummary,
  PublicationState,
}
