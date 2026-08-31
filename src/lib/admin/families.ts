/**
 * Authorized administrator family reads (MPS-REQ-017, MPS-REQ-020;
 * MPS-RUL-003, MPS-RUL-006, MPS-RUL-007; MPS-ACC-003, MPS-ACC-004).
 *
 * READ-ONLY, AND NOT BY ACCIDENT
 *
 * There is no write in this module, and none may be added without an approved
 * requirement. Parents control family accounts and student profiles (ACT-001).
 * An administrator appearing in the same interface as a family record does not
 * acquire authority over it, and checklist §11 — how corrections are requested,
 * who may approve a deletion, what is retained after a family leaves — is
 * unanswered, so there is nothing approved to implement (GAP-ADMIN-009/010/011).
 *
 * The database agrees rather than merely being asked nicely: `families`,
 * `family_members`, and `students` hold no UPDATE or DELETE policy for any
 * client role and no write grant, so this boundary survives a refactor that
 * forgets it.
 *
 * MINIMUM NECESSARY, AS A SELECT LIST
 *
 * An administrator supporting a family needs to know who they are, who the
 * guardian is, which children are on the account, and what those children are
 * enrolled in. The select lists below are exactly that and stop there.
 *
 * Deliberately not read, at any depth: guardian email or phone (they live in
 * `auth.users`, which needs service-role reach this surface does not have and
 * does not want), assistance-request detail (MPS-RUL-003 keeps it private to
 * the owner), and every field that does not exist because MPS-RUL-006 forbade
 * inventing it — legal name, date of birth, medical, behavioral,
 * accommodation, emergency contact, demographic. There is no column to leak.
 *
 * CONSENT IS REPORTED HONESTLY, WHICH TODAY MEANS REPORTING ITS ABSENCE
 *
 * MPS-ACC-003 requires an administrator to see the accepted policy version and
 * acceptance time. The mechanism is built here and reads the real columns. But
 * `students_affirmation_unapproved` pins every row to `demo-unapproved-v0`
 * while MPS GAP-005 leaves the consent language unconfirmed, so what an
 * administrator truthfully sees today is that no approved consent exists yet.
 * `consentApproved` is derived from the data rather than hardcoded, so
 * approving consent language changes this surface by changing the data.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { AdminRead } from "@/lib/admin/repository"
import type { EnrollmentState } from "@/lib/admin/transitions"

/** A guardian on a family account. Name and role only — never contact detail. */
type FamilyGuardian = {
  userId: string
  /** `""` when the account has no profile row yet. Rendered explicitly. */
  displayName: string
  memberRole: "primary_guardian" | "invited_guardian"
}

/** A child, in the three columns that exist (MPS-RUL-006). */
type FamilyStudent = {
  id: string
  preferredName: string
  gradeLevel: string | null
  guardianRelationship: string | null
  /** The recorded affirmation version. Not consent until GAP-005 closes. */
  affirmationVersion: string
  affirmedAt: string
  /** False while the affirmation is the unapproved demo placeholder. */
  consentApproved: boolean
}

/** One of a family's enrollments, as the directory summarises it. */
type FamilyEnrollment = {
  id: string
  state: EnrollmentState
  stateChangedAt: string
  studentName: string
  program: { id: string; slug: string; name: string } | null
}

/** A family as the directory and its drawer show it. */
type AdminFamily = {
  id: string
  name: string
  createdAt: string
  guardians: FamilyGuardian[]
  students: FamilyStudent[]
  enrollments: FamilyEnrollment[]
}

/* One unbroken literal each — see the note in `programs.ts`. */
// prettier-ignore
const FAMILY_COLUMNS = "id,name,created_at"
// prettier-ignore
const MEMBER_COLUMNS = "family_id,user_id,member_role"
/* Guardian names come from a separate read rather than an embedding.
   `family_members.user_id` and `profiles.id` both reference `auth.users`, so
   there is no foreign key BETWEEN them for PostgREST to infer a relationship
   from, and asking for `profiles(display_name)` here fails at the type level.
   The two are joined in memory below. */
// prettier-ignore
const PROFILE_COLUMNS = "id,display_name"
// prettier-ignore
const STUDENT_COLUMNS = "id,family_id,preferred_name,grade_level,guardian_relationship,affirmation_version,affirmed_at"
// prettier-ignore
const ENROLLMENT_COLUMNS = "id,family_id,state,state_changed_at,students(preferred_name),programs(id,slug,name)"

/** The demo placeholder every affirmation carries while GAP-005 is open. */
const UNAPPROVED_AFFIRMATION = "demo-unapproved-v0"

/**
 * Every family the viewer is authorized to see, with its guardians, children,
 * and enrollments attached.
 *
 * No `.eq()` narrows any of these four queries. `families_select_admin` returns
 * all of them to an administrator; a parent running the identical code gets
 * their own family and their own children, because the database decides the row
 * set and this function does not. That is why the same module is safe whoever
 * calls it, and why nothing here checks a role.
 *
 * The four reads run in parallel and are assembled in memory. A join would be
 * fewer round trips, but PostgREST would then need a single embedding path
 * from `families` through `students` to `programs`, and the assembly below
 * keeps each read's failure independent — a broken enrollment read costs the
 * directory its enrollment summaries, not the directory.
 *
 * @returns The families, or a state explaining why not.
 */
async function listAdminFamilies(): Promise<AdminRead<AdminFamily[]>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const [familyRows, memberRows, profileRows, studentRows, enrollmentRows] =
    await Promise.all([
      supabase.from("families").select(FAMILY_COLUMNS).order("name"),
      supabase.from("family_members").select(MEMBER_COLUMNS),
      supabase.from("profiles").select(PROFILE_COLUMNS),
      supabase.from("students").select(STUDENT_COLUMNS).order("preferred_name"),
      supabase
        .from("enrollments")
        .select(ENROLLMENT_COLUMNS)
        .order("state_changed_at", { ascending: false }),
    ])

  /* The family list is the page. Without it there is nothing to attach to, so
     its failure is the only one that fails the whole read. */
  if (familyRows.error) return { status: "failed" }

  const nameById = new Map(
    (profileRows.data ?? []).map((row) => [row.id, row.display_name ?? ""]),
  )

  const membersByFamily = new Map<string, FamilyGuardian[]>()
  for (const row of memberRows.data ?? []) {
    const list = membersByFamily.get(row.family_id) ?? []
    list.push({
      userId: row.user_id,
      /* `""` when no profile row backs the membership. Rendered as an explicit
         observation, never as a blank cell that reads like an empty name. */
      displayName: nameById.get(row.user_id) ?? "",
      memberRole: row.member_role,
    })
    membersByFamily.set(row.family_id, list)
  }

  const studentsByFamily = new Map<string, FamilyStudent[]>()
  for (const row of studentRows.data ?? []) {
    const list = studentsByFamily.get(row.family_id) ?? []
    list.push({
      id: row.id,
      preferredName: row.preferred_name,
      gradeLevel: row.grade_level,
      guardianRelationship: row.guardian_relationship,
      affirmationVersion: row.affirmation_version,
      affirmedAt: row.affirmed_at,
      consentApproved: row.affirmation_version !== UNAPPROVED_AFFIRMATION,
    })
    studentsByFamily.set(row.family_id, list)
  }

  const enrollmentsByFamily = new Map<string, FamilyEnrollment[]>()
  for (const row of enrollmentRows.data ?? []) {
    const list = enrollmentsByFamily.get(row.family_id) ?? []
    list.push({
      id: row.id,
      state: row.state,
      stateChangedAt: row.state_changed_at,
      studentName: row.students?.preferred_name ?? "",
      program: row.programs
        ? {
            id: row.programs.id,
            slug: row.programs.slug,
            name: row.programs.name,
          }
        : null,
    })
    enrollmentsByFamily.set(row.family_id, list)
  }

  return {
    status: "ready",
    data: (familyRows.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      guardians: membersByFamily.get(row.id) ?? [],
      students: studentsByFamily.get(row.id) ?? [],
      enrollments: enrollmentsByFamily.get(row.id) ?? [],
    })),
  }
}

export { listAdminFamilies, UNAPPROVED_AFFIRMATION }
export type { AdminFamily, FamilyEnrollment, FamilyGuardian, FamilyStudent }
