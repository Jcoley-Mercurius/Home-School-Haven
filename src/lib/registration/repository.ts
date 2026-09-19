/**
 * Server-side door to `public.submit_family_registration`, plus the two reads
 * the registration page needs around it.
 *
 * Same contract as `src/lib/enrollment/repository.ts`: the family and role come
 * from the session inside the database, the caller supplies no family id, and
 * the cookie-bound client is used, never the secret key. This module writes
 * nothing itself. No registration table grants a client role INSERT, so it
 * could not write a row directly even if it tried.
 *
 * `/family/registration` (Slice 3) is the one caller. It generates
 * `idempotencyKey` once per page and reuses it on every retry and resubmission.
 *
 * It never logs. Registration payloads carry child health, contact, signature,
 * and STEP UP data, and none of it belongs in a log line (MTS
 * SECURITY-ARCHITECTURE).
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import {
  ATTENDANCE_DAYS,
  parseRegistrationOutcome,
  registrationInputSchema,
  toRegistrationPayload,
  type AttendanceDay,
  type RegistrationFailure,
  type RegistrationInput,
  type RegistrationOutcome,
} from "@/lib/registration/contract"
import {
  DOCUMENT_KINDS,
  SERVER_PATH,
  type CatalogDocument,
  type CatalogProgram,
  type DocumentKind,
  type RegistrationCatalog,
} from "@/lib/registration/form"
import type { EnrollmentState } from "@/lib/enrollment/repository"

export type SubmitRegistrationResult =
  | {
      ok: false
      reason: RegistrationFailure
      /**
       * For `invalid` from the database only: the payload position it named,
       * for example `children[0].allergy_details`. Keys and indexes, never a
       * value, and checked against `SERVER_PATH` before it leaves this module.
       */
      invalidPath?: string | null
    }
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
  if (!parsed.success)
    return { ok: false, reason: "invalid", invalidPath: null }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("submit_family_registration", {
    idempotency_key: idempotencyKey,
    payload: toRegistrationPayload(parsed.data),
  })

  /* 42501: not a parent, no family, or a child that is not this family's. The
     answer is the same for all three, by design. 22023: a payload the database
     refused. Its message names a path, and it is still not passed on. */
  if (error) {
    if (error.code === "22023") {
      return {
        ok: false,
        reason: "invalid",
        invalidPath: payloadPathFrom(error.message),
      }
    }
    return {
      ok: false,
      reason: error.code === "42501" ? "forbidden" : "failed",
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

const PAYLOAD_PREFIX = "invalid registration payload: "

/**
 * The payload position a `22023` refusal names, or `null`.
 *
 * `private.reg_fail` writes `invalid registration payload: <path>[ <reason>]`,
 * where the path is built from payload keys and array indexes only. Only the
 * leading token is kept, and only when it matches the path grammar, so even a
 * future message that carried a value could not pass through here.
 */
export function payloadPathFrom(message: string | undefined): string | null {
  if (!message?.startsWith(PAYLOAD_PREFIX)) return null
  const token = message.slice(PAYLOAD_PREFIX.length).split(" ")[0]
  return SERVER_PATH.test(token) ? token : null
}

function byWeekday(a: AttendanceDay, b: AttendanceDay): number {
  return ATTENDANCE_DAYS.indexOf(a) - ATTENDANCE_DAYS.indexOf(b)
}

export type CatalogState =
  | { status: "unavailable" }
  | { status: "failed" }
  | { status: "ready"; catalog: RegistrationCatalog }

/**
 * Programs, their attendance rules, and the presented document versions, read
 * with the parent's own session.
 *
 * RLS decides what comes back: published programs, the attendance rules of
 * programs the viewer can read, and, for a parent, only the document version
 * `private.presented_document_version` would accept. An administrator sees every
 * version, so the same rule (approved, else draft) is applied here as well.
 * Nothing is logged.
 */
export async function getRegistrationCatalog(): Promise<CatalogState> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const [programs, rules, days, plans, documents] = await Promise.all([
    supabase
      .from("programs")
      .select(
        "id,slug,name,offering_type,published_schedule,availability,sort_order",
      )
      .eq("publication_state", "published")
      .order("sort_order", { ascending: true }),
    supabase
      .from("program_attendance_rules")
      .select("program_id,selection_mode"),
    supabase.from("program_attendance_days").select("program_id,day"),
    supabase
      .from("program_attendance_plans")
      .select("program_id,days_per_week"),
    supabase
      .from("registration_document_versions")
      .select("id,document_kind,version_label,title,status")
      .in("status", ["approved", "draft"]),
  ])

  if (
    programs.error ||
    rules.error ||
    days.error ||
    plans.error ||
    documents.error
  ) {
    return { status: "failed" }
  }

  const catalogPrograms: CatalogProgram[] = (programs.data ?? []).map((row) => {
    const rule = rules.data?.find((r) => r.program_id === row.id)
    const ruleDays = (days.data ?? [])
      .filter((d) => d.program_id === row.id)
      .map((d) => d.day)
      .sort(byWeekday)
    const rulePlans = (plans.data ?? [])
      .filter((p) => p.program_id === row.id)
      .map((p) => p.days_per_week)
      .sort((a, b) => a - b)
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      offeringType: row.offering_type,
      publishedSchedule: row.published_schedule,
      availability: row.availability,
      attendance: !rule
        ? null
        : rule.selection_mode === "fixed"
          ? { mode: "fixed", days: ruleDays }
          : { mode: "family_selects", days: ruleDays, plans: rulePlans },
    }
  })

  const presented = {} as Record<DocumentKind, CatalogDocument | null>
  for (const kind of DOCUMENT_KINDS) {
    const versions = (documents.data ?? []).filter(
      (d) => d.document_kind === kind,
    )
    const pick =
      versions.find((d) => d.status === "approved") ??
      versions.find((d) => d.status === "draft")
    presented[kind] = pick
      ? {
          id: pick.id,
          kind,
          title: pick.title,
          versionLabel: pick.version_label,
          status: pick.status === "approved" ? "approved" : "draft",
        }
      : null
  }

  return {
    status: "ready",
    catalog: { programs: catalogPrograms, documents: presented },
  }
}

/** One child's recorded selections, as the database now holds them. */
export type RegistrationChildResult = {
  studentId: string
  studentName: string
  selections: {
    programId: string
    programName: string
    enrollmentId: string
    state: EnrollmentState
    /** Present only when the state is `started` and a link is published. */
    checkoutUrl: string | null
  }[]
}

/**
 * The authoritative outcome of a recorded registration, per child.
 *
 * `submit_family_registration` answers with an id, not with states, so the
 * states are read back here, under RLS, from the enrollments the submission
 * created or found. What the parent sees on success is therefore what the
 * database holds, not what the form hoped for.
 *
 * A checkout link is returned only for `started`, the one state that offers the
 * external handoff (`mayOfferCheckout`). It is never decorated with an
 * identifier. `null` means the read failed and the caller must say so rather
 * than guess.
 */
export async function getRegistrationResults(
  registrationId: string,
): Promise<RegistrationChildResult[] | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()

  const { data: selections, error } = await supabase
    .from("registration_selections")
    .select("registration_child_id,program_id,enrollment_id,created_at")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: true })
  if (error || !selections || selections.length === 0) return null

  const childIds = [...new Set(selections.map((s) => s.registration_child_id))]
  const enrollmentIds = [...new Set(selections.map((s) => s.enrollment_id))]
  const programIds = [...new Set(selections.map((s) => s.program_id))]

  const [children, enrollments, programs] = await Promise.all([
    supabase
      .from("registration_children")
      .select("id,student_id,students(preferred_name)")
      .in("id", childIds),
    supabase.from("enrollments").select("id,state").in("id", enrollmentIds),
    supabase
      .from("programs")
      .select("id,name,checkout_url")
      .in("id", programIds),
  ])
  if (children.error || enrollments.error || programs.error) return null

  const results: RegistrationChildResult[] = []
  for (const child of children.data ?? []) {
    const rows = selections.filter((s) => s.registration_child_id === child.id)
    const items: RegistrationChildResult["selections"] = []
    for (const s of rows) {
      const enrollment = enrollments.data?.find((e) => e.id === s.enrollment_id)
      if (!enrollment) return null
      const program = programs.data?.find((p) => p.id === s.program_id)
      items.push({
        programId: s.program_id,
        programName: program?.name ?? "This program",
        enrollmentId: enrollment.id,
        state: enrollment.state,
        checkoutUrl:
          enrollment.state === "started"
            ? (program?.checkout_url ?? null)
            : null,
      })
    }
    results.push({
      studentId: child.student_id,
      studentName: child.students?.preferred_name ?? "",
      selections: items,
    })
  }
  return results
}
