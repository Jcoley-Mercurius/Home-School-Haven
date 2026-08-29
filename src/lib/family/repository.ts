/**
 * Family reads and writes for the authenticated viewer.
 *
 * Every function here derives the family from the session. None of them accepts
 * a family id from a caller, because the caller is ultimately the browser:
 * "never trust a client-supplied family ID" (AGENTS.md §11). The reads let RLS
 * do the filtering — a query for "all families" returns exactly one row, and
 * that is the boundary working rather than a `.eq()` we could forget.
 *
 * Writes go through the SECURITY DEFINER functions added in
 * `20260829120000_family_setup_and_demo_students.sql`. `families`,
 * `family_members`, and `students` have no client write policy at all, so a
 * forged request to the Data API has nothing to reach.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export type Family = { id: string; name: string }

/** A demo student profile (deviation D-FF1). No child data beyond these. */
export type Student = {
  id: string
  preferredName: string
  gradeLevel: string | null
  guardianRelationship: string | null
}

export type FamilyState =
  /** No Supabase project in this environment — not the same as "no family". */
  | { status: "unavailable" }
  /** The read failed. Distinct from "empty" so the UI never claims emptiness. */
  | { status: "failed" }
  /** MPS-WFL-002 `family_incomplete`: verified adult, setup not finished. */
  | { status: "incomplete" }
  /** MPS-WFL-002 `family_ready`. */
  | { status: "ready"; family: Family; students: Student[] }

export async function getFamilyState(): Promise<FamilyState> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  /* No `.eq()` on an owner column: RLS returns the viewer's own family and
     nothing else. `maybeSingle()` would throw if that were ever untrue, which
     is the failure we would want to hear about. */
  const { data: families, error } = await supabase
    .from("families")
    .select("id,name")
    .limit(1)

  if (error) return { status: "failed" }

  const family = families?.[0]
  if (!family) return { status: "incomplete" }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id,preferred_name,grade_level,guardian_relationship")
    .order("preferred_name")

  if (studentsError) return { status: "failed" }

  return {
    status: "ready",
    family,
    students: (students ?? []).map((row) => ({
      id: row.id,
      preferredName: row.preferred_name,
      gradeLevel: row.grade_level,
      guardianRelationship: row.guardian_relationship,
    })),
  }
}

export type WriteResult =
  | { ok: true }
  /** The database refused: no role, no family, or not authenticated (42501). */
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "failed" }

/**
 * Create the viewer's family, or return successfully if they already have one.
 *
 * Idempotent by contract, not by hope: the function returns the existing family
 * id on a repeat call, and a unique index on `family_members.user_id` is what
 * holds when two calls race (MPS-ACC-016).
 */
export async function createFamily(name: string): Promise<WriteResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("create_family_for_current_user", {
    family_name: name,
  })

  if (!error) return { ok: true }
  /* `42501` is the function's own refusal — not a parent, or not signed in.
     Nothing is logged here: the family name and the viewer's identity must not
     reach runtime logs (SECURITY-ARCHITECTURE). */
  return { ok: false, reason: error.code === "42501" ? "forbidden" : "failed" }
}

/** Add a demo student to the viewer's own family (deviation D-FF1). */
export async function addStudent(input: {
  preferredName: string
  gradeLevel: string | null
  guardianRelationship: string | null
}): Promise<WriteResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  /* The optional arguments are omitted rather than sent as null: the function
     defaults them, and PostgREST types a defaulted argument as optional. */
  const { error } = await supabase.rpc("add_student_to_own_family", {
    preferred_name: input.preferredName,
    ...(input.gradeLevel ? { grade_level: input.gradeLevel } : {}),
    ...(input.guardianRelationship
      ? { guardian_relationship: input.guardianRelationship }
      : {}),
  })

  if (!error) return { ok: true }
  return { ok: false, reason: error.code === "42501" ? "forbidden" : "failed" }
}

/**
 * Remove a demo student from the viewer's own family.
 *
 * The id is client-supplied, which is safe only because the database checks
 * membership itself: an id belonging to another family deletes nothing and
 * returns the same answer as an id that never existed.
 */
export async function removeStudent(studentId: string): Promise<WriteResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("remove_student_from_own_family", {
    student_id: studentId,
  })

  if (!error) return { ok: true }
  return { ok: false, reason: error.code === "42501" ? "forbidden" : "failed" }
}
