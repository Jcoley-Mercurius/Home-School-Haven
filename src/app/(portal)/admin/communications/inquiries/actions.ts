"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import { setInquiryState } from "@/lib/admin/inquiries"
import { isSupabaseConfigured } from "@/lib/env"

import { type InquiryActionFormState } from "./form-state"

/**
 * Triage one inquiry (MPS-REQ-010, MPS-REQ-024; MPS-WFL-004; MPS-RUL-004).
 *
 * WHAT THIS ACTION IS, AND WHAT IT REFUSES TO BE
 *
 * It records an authorized administrator's review position on a family's
 * request, and who owns it. That is all.
 *
 * It decides and issues no financial outcome. Moving an inquiry to
 * `approved_path_provided` records that the administrator gave the family a
 * registration or payment path — it grants no discount, awards no scholarship,
 * sets no price, and asserts no eligibility. MPS-RUL-004 permits recording a
 * status and forbids deciding the outcome, and this action holds exactly that
 * line. `not_available` is the same rule read the other way: it records that no
 * path was available, not that a family was assessed and declined.
 *
 * It does not notify the family. MPS-WFL-004 asks for a private outcome or next
 * step, and the approved channel for delivering one is a personal reply from
 * the administrator — MPS names no automated message here, and none is sent
 * (GAP-PUBLIC-001).
 *
 * THREE PLACES THE SAME RULES ARE ENFORCED
 *
 * `requireAdmin()` decides whether the caller may be here. The zod schema
 * refuses a malformed state before the database is asked. And
 * `admin_set_inquiry_state` applies the MPS-WFL-004 transition graph, checks
 * `private.is_admin()` itself, and refuses an owner who is not an
 * administrator — so a request that never touches this action meets the same
 * rules.
 */
const schema = z.object({
  inquiryId: z.uuid(),
  state: z
    .enum([
      "submitted",
      "under_review",
      "awaiting_family",
      "approved_path_provided",
      "not_available",
      "closed",
    ])
    .nullable(),
  claim: z.enum(["none", "claim", "release"]),
})

/**
 * Server action for an administrator's triage decision on one inquiry.
 * @param _previous - The previous form state (required by useActionState).
 * @param formData - The submitted inquiry id, target state, and ownership move.
 * @returns The updated form state.
 */
export async function setInquiryStateAction(
  _previous: InquiryActionFormState,
  formData: FormData,
): Promise<InquiryActionFormState> {
  const rawId = String(formData.get("inquiryId") ?? "")
  const rawState = String(formData.get("state") ?? "")

  const parsed = schema.safeParse({
    inquiryId: rawId,
    state: rawState === "" ? null : rawState,
    claim: String(formData.get("claim") ?? "none"),
  })

  if (!parsed.success) {
    return { status: "invalid", inquiryId: rawId || null }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", inquiryId: parsed.data.inquiryId }
  }

  /* The signed-in administrator is the only owner this action can assign. An
     owner id is never accepted from the browser: claiming is "this is mine",
     and reassigning someone else's queue is not a decision this surface makes
     (MPS-REQ-010 "authorized administrative owner"). */
  const viewer = await requireAdmin("/admin/communications/inquiries")

  const result = await setInquiryState({
    inquiryId: parsed.data.inquiryId,
    state: parsed.data.state,
    ownerUserId: parsed.data.claim === "claim" ? viewer.userId : null,
    clearOwner: parsed.data.claim === "release",
  })

  if (!result.ok) {
    return {
      status:
        result.reason === "forbidden"
          ? "forbidden"
          : result.reason === "notFound"
            ? "notFound"
            : result.reason === "invalidTransition"
              ? "invalidTransition"
              : "failed",
      inquiryId: parsed.data.inquiryId,
    }
  }

  revalidatePath("/admin/communications/inquiries")

  return { status: "updated", inquiryId: parsed.data.inquiryId }
}
