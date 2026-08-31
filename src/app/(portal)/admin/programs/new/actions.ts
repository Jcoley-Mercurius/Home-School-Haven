"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import { createProgramDraft } from "@/lib/admin/programs"
import { createProgramSchema } from "@/lib/admin/validation"
import { isSupabaseConfigured } from "@/lib/env"

import { type CreateProgramFormState } from "./form-state"

/**
 * Create a program draft (MPS-REQ-016; MPS-WFL-005 main path step 1;
 * MPS-RUL-005).
 *
 * A DRAFT AND NOTHING MORE
 *
 * Name, web address, and an optional summary. Every published fact — dates,
 * schedule, price, audience, location, educator — is left unset, because NULL
 * means "the source does not publish this" and renders as "Contact for
 * details", while a value typed to fill in a form would be a published fact
 * nobody verified (BETA-CONTENT-IMPORT-INVENTORY import rule 3).
 *
 * `publication_state` is not a field on this form and is not a parameter of the
 * database function. A new program is a draft; publishing is a separate,
 * separately audited decision made from the program's own page.
 *
 * WHY THE GUARD IS NOT THE ONLY CHECK
 *
 * `requireAdmin()` runs here, and `admin_create_program_draft` checks
 * `private.is_admin()` again inside the transaction that writes. A server
 * action is a public HTTP endpoint: it can be invoked directly, without ever
 * loading the page whose guard would have refused. The database check is the
 * one that cannot be skipped.
 */
export async function createProgramDraftAction(
  _previous: CreateProgramFormState,
  formData: FormData,
): Promise<CreateProgramFormState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    summary: String(formData.get("summary") ?? ""),
  }

  const parsed = createProgramSchema.safeParse(values)

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        name: flattened.fieldErrors.name?.[0],
        slug: flattened.fieldErrors.slug?.[0],
        summary: flattened.fieldErrors.summary?.[0],
      },
      values,
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", fieldErrors: {}, values }
  }

  await requireAdmin("/admin/programs/new")

  const result = await createProgramDraft({
    name: parsed.data.name,
    slug: parsed.data.slug,
    summary: parsed.data.summary,
  })

  if (!result.ok) {
    /* A duplicate slug is a fixable mistake with an obvious next step, so it
       gets a field error rather than the generic failure banner. */
    if (result.reason === "duplicate") {
      return {
        status: "duplicate",
        fieldErrors: {
          slug: "That web address is already used by another program. Choose a different one.",
        },
        values,
      }
    }
    if (result.reason === "rejected") {
      return {
        status: "invalid",
        fieldErrors: { name: result.message },
        values,
      }
    }
    return {
      status: result.reason === "forbidden" ? "forbidden" : "failed",
      fieldErrors: {},
      values,
    }
  }

  /* The overview counts programs and lists recent activity; the list shows the
     new draft. Both are now stale. */
  revalidatePath("/admin")
  revalidatePath("/admin/programs")

  /* `createProgramDraft` only ever returns `created` on success, but the shared
     `MutationResult` union also carries the update outcomes. Narrowing rather
     than asserting means a future change to that union fails here at compile
     time instead of producing a redirect to `/admin/programs/undefined`. */
  if (result.outcome !== "created") {
    return { status: "failed", fieldErrors: {}, values }
  }

  redirect(`/admin/programs/${result.id}?created=1`)
}
