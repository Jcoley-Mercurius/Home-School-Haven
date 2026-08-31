"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import { assignEducator, unassignEducator } from "@/lib/admin/assignments"
import { assignmentSchema } from "@/lib/admin/validation"
import { isSupabaseConfigured } from "@/lib/env"

import { type AssignmentActionFormState } from "./form-state"

/**
 * Assign and unassign an educator (MPS-REQ-017, MPS-REQ-024; MPS-WFL-005,
 * MPS-WFL-006).
 *
 * WHAT THESE ACTIONS ARE, AND WHAT THEY REFUSE TO BE
 *
 * They change who may reach one program's roster, resources, and announcements.
 * That is all.
 *
 * They grant no organization-wide authority. They do not promote anyone: the
 * `admin` and `owner` grants live in `public.user_roles`, which has no client
 * write policy and no write grant, so there is no route from this file to a
 * role change even if someone tried to add one. Samantha controls administrator
 * access (ACT-006), and self-service promotion is not a thing this product has.
 *
 * They send nothing. No invitation exists in this release and no transactional
 * email capability is built (GAP-ADMIN-012); an assignment is an access change,
 * not a message.
 *
 * They delete no account and suspend no educator. Checklist §9 leaves "how
 * access changes when an educator is reassigned or leaves" unanswered, so
 * removing assignments is the approved lever and the only one offered
 * (GAP-ADMIN-013).
 *
 * NOTHING FROM THE BROWSER IS TRUSTED
 *
 * The form carries two identifiers and a note. `assignmentSchema` checks that
 * they are well-formed; `admin_assign_educator` then re-checks administrator
 * authority against the verified session, that the target actually holds the
 * `educator` grant, that the program exists and is not archived, and that a
 * reason was given. A request that never reaches this action meets the same
 * rules, because the table's INSERT and DELETE grants were revoked and the
 * function is the only write path.
 *
 * THREE OUTCOMES THAT ARE NOT FAILURES
 *
 *   `unchanged` — the assignment already existed, or was already absent.
 *     Nothing was written and no audit row claims a change that did not happen.
 *     This is what makes a double-click, a double-tap, and two open tabs safe,
 *     and it is why a duplicate submission is reported as "already assigned"
 *     rather than as an error.
 *   `notEligible` — the target is not an educator, or the program is archived.
 *     The request was well-formed and the caller was authorized; the change is
 *     simply not admissible.
 *   `notFound` — reported identically to a program the caller may not see, so a
 *     manipulated identifier learns nothing.
 */

/**
 * Parse and authorize an assignment submission.
 *
 * Shared by both actions because both take exactly the same input and apply
 * exactly the same rules — a second copy would be a second place for one of
 * them to drift.
 *
 * @param formData - The submitted form.
 * @returns The validated input, or the form state to return instead.
 */
async function parseAssignment(
  formData: FormData,
): Promise<
  | { ok: true; educatorUserId: string; programId: string; note: string }
  | { ok: false; state: AssignmentActionFormState }
> {
  const educatorUserId = String(formData.get("educatorUserId") ?? "")
  const values = { note: String(formData.get("note") ?? "") }

  const parsed = assignmentSchema.safeParse({
    educatorUserId,
    programId: String(formData.get("programId") ?? ""),
    note: values.note,
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      ok: false,
      state: {
        status: "invalid",
        /* The unparsed id still identifies which drawer should show the error.
           It is not used for anything else, and never reaches a query. */
        educatorUserId: educatorUserId || null,
        fieldErrors: {
          note: flattened.fieldErrors.note?.[0],
          program:
            flattened.fieldErrors.programId?.[0] ??
            flattened.fieldErrors.educatorUserId?.[0],
        },
        values,
      },
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      state: {
        status: "unavailable",
        educatorUserId: parsed.data.educatorUserId,
        fieldErrors: {},
        values,
      },
    }
  }

  /* The server's own authorization, independent of anything the browser sent
     and independent of the database's. An expired session redirects to sign-in
     from here rather than surfacing as a confusing refusal. */
  await requireAdmin("/admin/educators")

  return { ok: true, ...parsed.data }
}

/**
 * Map a refusal to the form status.
 *
 * @param reason - The mutation's failure reason.
 * @returns The status to report.
 */
function statusFor(reason: string): AssignmentActionFormState["status"] {
  switch (reason) {
    case "notFound":
      return "notFound"
    case "forbidden":
      return "forbidden"
    case "invalidTransition":
      return "notEligible"
    case "rejected":
      return "invalid"
    default:
      return "failed"
  }
}

/**
 * Revalidate everything an assignment change is visible in.
 *
 * The overview counts assignments and lists recent activity; the programs list
 * shows whether each program has an educator; the program detail page shows who
 * is assigned; the educator directory shows the assignment itself. MPS-REQ-020
 * requires those to agree, and revalidating all four is what keeps them
 * agreeing a second after the change rather than a minute after it.
 *
 * @param programId - The program whose detail page changed.
 */
function revalidateAssignmentViews(programId: string): void {
  revalidatePath("/admin")
  revalidatePath("/admin/programs")
  revalidatePath(`/admin/programs/${programId}`)
  revalidatePath("/admin/educators")
}

/**
 * Assign an educator to a program.
 *
 * @param _previous - The previous form state, unused.
 * @param formData - The submitted form.
 * @returns The new form state.
 */
export async function assignEducatorAction(
  _previous: AssignmentActionFormState,
  formData: FormData,
): Promise<AssignmentActionFormState> {
  const input = await parseAssignment(formData)
  if (!input.ok) return input.state

  const values = { note: input.note }
  const result = await assignEducator({
    educatorUserId: input.educatorUserId,
    programId: input.programId,
    note: input.note,
  })

  if (!result.ok) {
    return {
      status: statusFor(result.reason),
      educatorUserId: input.educatorUserId,
      fieldErrors:
        result.reason === "rejected"
          ? { note: "Say why this assignment is changing. This is recorded." }
          : {},
      values,
    }
  }

  revalidateAssignmentViews(input.programId)

  return {
    status: result.outcome === "unchanged" ? "unchanged" : "assigned",
    educatorUserId: input.educatorUserId,
    fieldErrors: {},
    /* Cleared on success so the next decision starts from an empty note rather
       than inheriting the reason for the previous one. */
    values: { note: "" },
  }
}

/**
 * Remove an educator's assignment to a program.
 *
 * The educator loses access to that program's roster, resources, and
 * announcements on their next authorized request. No sign-out is required:
 * every policy that depends on assignment evaluates the table per statement.
 *
 * @param _previous - The previous form state, unused.
 * @param formData - The submitted form.
 * @returns The new form state.
 */
export async function unassignEducatorAction(
  _previous: AssignmentActionFormState,
  formData: FormData,
): Promise<AssignmentActionFormState> {
  const input = await parseAssignment(formData)
  if (!input.ok) return input.state

  const values = { note: input.note }
  const result = await unassignEducator({
    educatorUserId: input.educatorUserId,
    programId: input.programId,
    note: input.note,
  })

  if (!result.ok) {
    return {
      status: statusFor(result.reason),
      educatorUserId: input.educatorUserId,
      fieldErrors:
        result.reason === "rejected"
          ? { note: "Say why this assignment is changing. This is recorded." }
          : {},
      values,
    }
  }

  revalidateAssignmentViews(input.programId)

  return {
    status: result.outcome === "unchanged" ? "unchanged" : "unassigned",
    educatorUserId: input.educatorUserId,
    fieldErrors: {},
    values: { note: "" },
  }
}
