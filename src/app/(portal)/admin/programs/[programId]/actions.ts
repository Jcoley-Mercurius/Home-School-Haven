"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import { setProgramPublication, updateProgramFacts } from "@/lib/admin/programs"
import { programFactsSchema, publicationSchema } from "@/lib/admin/validation"
import {
  createProgramSession,
  setProgramCapacity,
  setSessionState,
  updateProgramSession,
} from "@/lib/schedule/mutations"
import {
  capacitySchema,
  createSessionSchema,
  isValidRange,
  RANGE_MESSAGE,
  sessionStateSchema,
  updateSessionSchema,
} from "@/lib/schedule/validation"
import { isSupabaseConfigured } from "@/lib/env"

import {
  type CapacityFormState,
  type CapacityFormValues,
  type ProgramFactsFormState,
  type ProgramFactsValues,
  type PublicationFormState,
  type SessionFormState,
  type SessionFormValues,
  type SessionStateFormState,
} from "./form-state"

/**
 * Program operations mutations (MPS-REQ-016, MPS-REQ-020, MPS-REQ-024;
 * MPS-RUL-005 "only an administrator or Samantha may publish").
 *
 * WHAT EVERY ACTION HERE DOES, IN THIS ORDER
 *
 *   1. Read the submitted fields. They are untrusted; nothing is used before
 *      it is parsed.
 *   2. Validate with the shared Zod schema, which is the same rule the form
 *      renders its hints from.
 *   3. Re-authorize with `requireAdmin()`. A server action is a public HTTP
 *      endpoint and can be invoked without ever loading the page whose guard
 *      would have refused.
 *   4. Call the database function, which checks `private.is_admin()` AGAIN, in
 *      the transaction that writes, applies the approved transition rule, and
 *      refuses a write made against a stale copy of the row.
 *   5. Revalidate every surface whose content just became untrue.
 *
 * Step 4 is the control. Steps 1–3 are what turn a refusal into a sentence
 * someone can act on instead of an error.
 *
 * WHY THE PROGRAM ID IS ACCEPTED FROM THE FORM
 *
 * It is a client-supplied value and that is safe, because nothing downstream
 * trusts it: the database decides whether this caller may touch that row, and
 * a well-formed id belonging to a program the caller may not see produces the
 * same neutral "no longer available" as an id that never existed. The response
 * must not distinguish them.
 */

/** Read the facts form back out of `FormData`, unvalidated. */
function readFacts(formData: FormData): ProgramFactsValues {
  const read = (key: string) => String(formData.get(key) ?? "")
  return {
    name: read("name"),
    summary: read("summary"),
    audience: read("audience"),
    format: read("format"),
    location: read("location"),
    educator: read("educator"),
    dates: read("dates"),
    schedule: read("schedule"),
    duration: read("duration"),
    sessionLength: read("sessionLength"),
    price: read("price"),
    availability: read("availability"),
    checkoutUrl: read("checkoutUrl"),
  }
}

/**
 * Save the program's published facts, availability, and checkout link
 * (MPS-REQ-008, MPS-REQ-013, MPS-REQ-016).
 *
 * One update, so the audit trigger records one coherent change rather than a
 * dozen partial ones an operator would have to reassemble.
 *
 * Every optional fact goes to NULL when cleared, never to `""`. NULL means "the
 * source does not publish this" and renders as "Contact for details"; `""`
 * would be a published fact whose value is nothing.
 */
export async function saveProgramFactsAction(
  _previous: ProgramFactsFormState,
  formData: FormData,
): Promise<ProgramFactsFormState> {
  const values = readFacts(formData)
  const programId = String(formData.get("programId") ?? "")
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "")

  const parsed = programFactsSchema.safeParse({
    ...values,
    programId,
    expectedUpdatedAt,
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    const firstOf = (key: keyof ProgramFactsValues) =>
      flattened.fieldErrors[key]?.[0]
    return {
      status: "invalid",
      fieldErrors: {
        name: firstOf("name"),
        summary: firstOf("summary"),
        audience: firstOf("audience"),
        format: firstOf("format"),
        location: firstOf("location"),
        educator: firstOf("educator"),
        dates: firstOf("dates"),
        schedule: firstOf("schedule"),
        duration: firstOf("duration"),
        sessionLength: firstOf("sessionLength"),
        price: firstOf("price"),
        availability: firstOf("availability"),
        checkoutUrl: firstOf("checkoutUrl"),
      },
      values,
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", fieldErrors: {}, values }
  }

  await requireAdmin(`/admin/programs/${parsed.data.programId}`)

  const result = await updateProgramFacts({
    programId: parsed.data.programId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    name: parsed.data.name,
    summary: parsed.data.summary,
    audience: parsed.data.audience,
    format: parsed.data.format,
    location: parsed.data.location,
    educator: parsed.data.educator,
    dates: parsed.data.dates,
    schedule: parsed.data.schedule,
    duration: parsed.data.duration,
    sessionLength: parsed.data.sessionLength,
    price: parsed.data.price,
    availability: parsed.data.availability,
    checkoutUrl: parsed.data.checkoutUrl,
  })

  if (!result.ok) {
    if (result.reason === "rejected") {
      return {
        status: "invalid",
        fieldErrors: { checkoutUrl: result.message },
        values,
      }
    }
    return {
      status:
        result.reason === "stale"
          ? "stale"
          : result.reason === "notFound"
            ? "notFound"
            : result.reason === "forbidden"
              ? "forbidden"
              : "failed",
      fieldErrors: {},
      values,
    }
  }

  /* Everything that reads this program is now stale: the public catalog and
     detail page, the admin list, and the overview's counts and activity. */
  revalidatePath("/admin")
  revalidatePath("/admin/programs")
  revalidatePath(`/admin/programs/${parsed.data.programId}`)
  revalidatePath("/programs")
  revalidatePath("/programs/[slug]", "page")
  revalidatePath("/")

  /* No redirect: the administrator stays on the page they are working on, and
     the success alert appears above the form they just saved. `values: null`
     drops the echoed copy so the form re-renders from the freshly read row. */
  return { status: "saved", fieldErrors: {}, values: null }
}

/**
 * Publish, unpublish, archive, or restore a program (MPS-REQ-016, MPS-RUL-005,
 * MPS-ACC-026/027).
 *
 * The target state is submitted by the browser and is never trusted for being
 * present in a form: `publicationSchema` accepts only the three enum values,
 * and `admin_set_program_publication` refuses any transition the approved table
 * does not allow — including one an educator submits directly, which is
 * MPS-ACC-027 as an enforced control rather than a hidden button.
 *
 * Publishing additionally requires a summary. That refusal is surfaced with the
 * database's own sentence, which is written for an administrator to read.
 */
export async function setPublicationAction(
  _previous: PublicationFormState,
  formData: FormData,
): Promise<PublicationFormState> {
  const parsed = publicationSchema.safeParse({
    programId: String(formData.get("programId") ?? ""),
    expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
    publicationState: String(formData.get("publicationState") ?? ""),
  })

  if (!parsed.success) {
    return {
      status: "rejected",
      message:
        "That publication change could not be read. Reload the page and try again.",
    }
  }

  if (!isSupabaseConfigured()) return { status: "unavailable" }

  await requireAdmin(`/admin/programs/${parsed.data.programId}`)

  const result = await setProgramPublication({
    programId: parsed.data.programId,
    publicationState: parsed.data.publicationState,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
  })

  if (!result.ok) {
    return {
      status:
        result.reason === "stale"
          ? "stale"
          : result.reason === "notFound"
            ? "notFound"
            : result.reason === "forbidden"
              ? "forbidden"
              : result.reason === "invalidTransition"
                ? "invalidTransition"
                : result.reason === "rejected"
                  ? "rejected"
                  : "failed",
      message: result.message,
    }
  }

  revalidatePath("/admin")
  revalidatePath("/admin/programs")
  revalidatePath(`/admin/programs/${parsed.data.programId}`)
  revalidatePath("/programs")
  revalidatePath("/programs/[slug]", "page")
  revalidatePath("/")

  /* `unchanged` is reported, not hidden. A repeat submission wrote nothing and
     created no audit row, and saying so is more honest than showing the same
     success message twice. */
  return { status: result.outcome === "unchanged" ? "unchanged" : "updated" }
}

/* ---------------------------------------------------------------------------
   Schedule and capacity (HSH-SLICE-ADM-04)
   --------------------------------------------------------------------------- */

/**
 * Every action below follows the same five steps as the two above: read the
 * untrusted fields, validate with the shared schema, re-authorize with
 * `requireAdmin()` because a server action is a public HTTP endpoint, call the
 * database function which checks `private.is_admin()` again inside the
 * transaction that writes, and revalidate every surface that just became
 * untrue.
 *
 * The revalidation list is longer here than for program facts, because a
 * session appears on more surfaces than a program fact does: the public
 * calendar and program page, the family dashboard and schedule, the educator
 * schedule and program workspace, and three administrator screens. Missing one
 * would leave a family reading a cancelled class as though it were going ahead,
 * which is the exact failure MPS-ACC-031 is about.
 */
function revalidateScheduleSurfaces(programId: string) {
  revalidatePath("/admin")
  revalidatePath("/admin/schedule")
  revalidatePath("/admin/programs")
  revalidatePath(`/admin/programs/${programId}`)
  revalidatePath("/educator")
  revalidatePath("/educator/schedule")
  revalidatePath("/educator/programs")
  revalidatePath("/educator/programs/[programId]", "page")
  revalidatePath("/family")
  revalidatePath("/family/schedule")
  revalidatePath("/calendar")
  revalidatePath("/programs")
  revalidatePath("/programs/[slug]", "page")
}

/** Read the session form back out of `FormData`, unvalidated. */
function readSession(formData: FormData): SessionFormValues {
  const read = (key: string) => String(formData.get(key) ?? "")
  return {
    title: read("title"),
    startsAt: read("startsAt"),
    endsAt: read("endsAt"),
    location: read("location"),
    changeNote: read("changeNote"),
  }
}

/**
 * Map a schedule mutation refusal onto a form status.
 *
 * `rejected` and `invalidTransition` carry the database's own sentence, which
 * is written for an administrator to read; every other reason gets no message,
 * because an unexpected error's text can carry a column or constraint name that
 * does not belong on a screen.
 */
function scheduleFailureStatus(
  reason:
    | "forbidden"
    | "notFound"
    | "stale"
    | "invalidTransition"
    | "rejected"
    | "failed",
) {
  switch (reason) {
    case "stale":
      return "stale" as const
    case "notFound":
      return "notFound" as const
    case "forbidden":
      return "forbidden" as const
    case "rejected":
    case "invalidTransition":
      return "rejected" as const
    default:
      return "failed" as const
  }
}

/**
 * Author one session on a program (MPS-WFL-005 step 2, MPS-RUL-005).
 *
 * A session is administrator-authored verified detail. It is never derived from
 * the program's published schedule text: most published ranges carry no year,
 * and choosing one would invent the fact the beta content import rules forbid.
 */
export async function createSessionAction(
  _previous: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const values = readSession(formData)
  const programId = String(formData.get("programId") ?? "")

  const parsed = createSessionSchema.safeParse({ ...values, programId })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        title: flattened.fieldErrors.title?.[0],
        startsAt: flattened.fieldErrors.startsAt?.[0],
        endsAt: flattened.fieldErrors.endsAt?.[0],
        location: flattened.fieldErrors.location?.[0],
      },
      values,
    }
  }

  if (!isValidRange(parsed.data)) {
    return { status: "invalid", fieldErrors: { endsAt: RANGE_MESSAGE }, values }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", fieldErrors: {}, values }
  }

  await requireAdmin(`/admin/programs/${parsed.data.programId}`)

  const result = await createProgramSession({
    programId: parsed.data.programId,
    title: parsed.data.title,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    location: parsed.data.location,
  })

  if (!result.ok) {
    return {
      status: scheduleFailureStatus(result.reason),
      fieldErrors: {},
      values,
      message: result.message,
    }
  }

  revalidateScheduleSurfaces(parsed.data.programId)

  /* `values: null` clears the form, because the next session is a new one
     rather than an edit of the one just added. */
  return { status: "created", fieldErrors: {}, values: null }
}

/**
 * Edit or move one session.
 *
 * One action for both, because separating them would let a session's time
 * change without the record saying it moved. The database decides which
 * happened: a changed time yields `rescheduled`, preserves the original start,
 * and requires a note; a corrected title yields `saved` and does not.
 */
export async function updateSessionAction(
  _previous: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const values = readSession(formData)

  const parsed = updateSessionSchema.safeParse({
    ...values,
    sessionId: String(formData.get("sessionId") ?? ""),
    programId: String(formData.get("programId") ?? ""),
    expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        title: flattened.fieldErrors.title?.[0],
        startsAt: flattened.fieldErrors.startsAt?.[0],
        endsAt: flattened.fieldErrors.endsAt?.[0],
        location: flattened.fieldErrors.location?.[0],
        changeNote: flattened.fieldErrors.changeNote?.[0],
      },
      values,
    }
  }

  if (!isValidRange(parsed.data)) {
    return { status: "invalid", fieldErrors: { endsAt: RANGE_MESSAGE }, values }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", fieldErrors: {}, values }
  }

  await requireAdmin(`/admin/programs/${parsed.data.programId}`)

  const result = await updateProgramSession({
    sessionId: parsed.data.sessionId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    title: parsed.data.title,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    location: parsed.data.location,
    changeNote: parsed.data.changeNote,
  })

  if (!result.ok) {
    /* The missing-note refusal is a FIELD error, not a page-level one: it names
       the one input the administrator has to fill in, and the database's own
       sentence says why. */
    if (result.reason === "rejected" && result.message?.includes("note")) {
      return {
        status: "invalid",
        fieldErrors: { changeNote: result.message },
        values,
      }
    }
    return {
      status: scheduleFailureStatus(result.reason),
      fieldErrors: {},
      values,
      message: result.message,
    }
  }

  revalidateScheduleSurfaces(parsed.data.programId)

  return {
    status:
      result.outcome === "rescheduled"
        ? "rescheduled"
        : result.outcome === "unchanged"
          ? "unchanged"
          : "saved",
    fieldErrors: {},
    values: null,
  }
}

/**
 * Cancel or complete one session (MPS-WFL-005 alternate paths).
 *
 * Decides no refund, credit, transfer, or enrollment outcome (MPS-RUL-004). The
 * dialog says so in words before the click, and the database function cannot do
 * otherwise — it does not name the `enrollments` table.
 */
export async function setSessionStateAction(
  _previous: SessionStateFormState,
  formData: FormData,
): Promise<SessionStateFormState> {
  const parsed = sessionStateSchema.safeParse({
    sessionId: String(formData.get("sessionId") ?? ""),
    programId: String(formData.get("programId") ?? ""),
    expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
    state: String(formData.get("state") ?? ""),
    note: String(formData.get("note") ?? ""),
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "rejected",
      message:
        flattened.fieldErrors.note?.[0] ??
        "That session change could not be read. Reload the page and try again.",
    }
  }

  if (!isSupabaseConfigured()) return { status: "unavailable" }

  await requireAdmin(`/admin/programs/${parsed.data.programId}`)

  const result = await setSessionState({
    sessionId: parsed.data.sessionId,
    state: parsed.data.state,
    note: parsed.data.note,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
  })

  if (!result.ok) {
    return {
      status:
        result.reason === "invalidTransition"
          ? "invalidTransition"
          : scheduleFailureStatus(result.reason),
      message: result.message,
    }
  }

  revalidateScheduleSurfaces(parsed.data.programId)

  return { status: result.outcome === "unchanged" ? "unchanged" : "updated" }
}

/**
 * Set one program's capacity and waitlist setting (MPS-RUL-002, MPS-FEA-012).
 *
 * Creates and removes no enrollment. An `overCapacity` result is a SUCCESS that
 * reports a condition: confirmed places now exceed the number, and nothing was
 * decided about who loses one, because MPS defines no rule for that
 * (GAP-ADMIN-012).
 */
export async function setCapacityAction(
  _previous: CapacityFormState,
  formData: FormData,
): Promise<CapacityFormState> {
  const values: CapacityFormValues = {
    capacity: String(formData.get("capacity") ?? ""),
    /* An unchecked checkbox sends nothing at all, so presence is the value. */
    waitlistEnabled: formData.get("waitlistEnabled") !== null,
  }

  const parsed = capacitySchema.safeParse({
    ...values,
    programId: String(formData.get("programId") ?? ""),
    expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: { capacity: flattened.fieldErrors.capacity?.[0] },
      values,
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", fieldErrors: {}, values }
  }

  await requireAdmin(`/admin/programs/${parsed.data.programId}`)

  const result = await setProgramCapacity({
    programId: parsed.data.programId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    capacity: parsed.data.capacity,
    waitlistEnabled: parsed.data.waitlistEnabled,
  })

  if (!result.ok) {
    return {
      status: scheduleFailureStatus(result.reason),
      fieldErrors: {},
      values,
      message: result.message,
    }
  }

  /* Capacity reaches the public catalog and detail page too: MDS
     `limited_spaces` is "exact capacity only when verified", and a number an
     administrator has now set is verified. */
  revalidateScheduleSurfaces(parsed.data.programId)

  return {
    status:
      result.outcome === "updatedOverCapacity"
        ? "overCapacity"
        : result.outcome === "unchanged"
          ? "unchanged"
          : "saved",
    fieldErrors: {},
    values: null,
  }
}
