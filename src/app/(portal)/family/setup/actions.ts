"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { requireRole } from "@/lib/auth/guards"
import { createFamily } from "@/lib/family/repository"
import { familyNameSchema } from "@/lib/family/validation"
import { isSupabaseConfigured } from "@/lib/env"

import { type FamilySetupFormState } from "./form-state"

/**
 * Establish the viewer's family (MPS-REQ-011, MPS-ACC-015/016/017).
 *
 * A Server Action is a public HTTP endpoint. The page's guard does not protect
 * it, so the guard is called again here — and behind that, the database
 * function re-derives `auth.uid()` and checks the parent role itself. Three
 * layers, none of them the browser.
 *
 * Nothing is logged. The family name is family data.
 */
export async function createFamilyAction(
  _previous: FamilySetupFormState,
  formData: FormData,
): Promise<FamilySetupFormState> {
  const nameValue = String(formData.get("name") ?? "")

  const parsed = familyNameSchema.safeParse({ name: nameValue })
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: { name: flattened.fieldErrors.name?.[0] },
      values: { name: nameValue },
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      fieldErrors: {},
      values: { name: nameValue },
    }
  }

  await requireRole("parent", "/family/setup")

  /* `redirect()` signals by throwing, so it is called after the try block.
     Catching it inside would turn a completed setup into a "failed" message. */
  let result
  try {
    result = await createFamily(parsed.data.name)
  } catch {
    return { status: "failed", fieldErrors: {}, values: { name: nameValue } }
  }

  if (!result.ok) {
    return {
      status: result.reason === "forbidden" ? "forbidden" : "failed",
      fieldErrors: {},
      values: { name: nameValue },
    }
  }

  /* Submitting twice lands here twice with the same family. That is the point:
     the second call created nothing (MPS-ACC-016). */
  redirect("/family")
}
