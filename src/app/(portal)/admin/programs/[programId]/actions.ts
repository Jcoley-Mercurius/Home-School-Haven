"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import { setProgramPublication, updateProgramFacts } from "@/lib/admin/programs"
import { programFactsSchema, publicationSchema } from "@/lib/admin/validation"
import { isSupabaseConfigured } from "@/lib/env"

import {
  type ProgramFactsFormState,
  type ProgramFactsValues,
  type PublicationFormState,
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
