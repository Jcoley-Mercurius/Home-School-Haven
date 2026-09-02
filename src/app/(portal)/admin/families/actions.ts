"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import {
  inviteFamily,
  resendInvitation,
  revokeInvitation,
} from "@/lib/admin/invitations"

import {
  type InvitationActionFormState,
  type InviteFamilyFormState,
} from "./form-state"

/**
 * Invite one family, resend, or withdraw (MPS-REQ-011, MPS-REQ-024).
 *
 * APPROVED PRODUCT DECISION, 2026-09-02: family provisioning is invite-only.
 * Only an authorized administrator may invite a family, and an invitation may
 * create the `parent` role and nothing else.
 *
 * FOUR PLACES THE SAME RULES ARE ENFORCED
 *
 * `requireAdmin()` decides whether the caller may be here at all. The zod
 * schema refuses a malformed address before anything privileged runs. RLS
 * refuses the write to `family_invitations` unless `private.is_admin()` holds
 * for the verified session. And `accept_family_invitation()` grants the literal
 * role `parent` with no parameter, so even a request that never touches this
 * file cannot produce an educator or an administrator.
 *
 * WHAT IS NEVER TAKEN FROM THE BROWSER
 *
 * The inviting and revoking administrator is `viewer.userId`, read from the
 * verified server session. A role, a family id, or an actor id submitted in the
 * form would be ignored — there is no field for one and nothing reads one.
 *
 * The invitation id in the resend and revoke forms is the one exception, and it
 * is safe for the reason every other admin id in this repository is: it is read
 * back through the RLS-filtered client before anything acts on it, so it can
 * only ever name a row this administrator was already allowed to see.
 *
 * NO EMAIL IS SENT FROM THIS FILE
 *
 * Delivery is Supabase Auth's, using the committed template in
 * `supabase/templates/invite.html`. No second provider is introduced, and the
 * email carries no child, assistance, enrollment, or family detail.
 */
const inviteSchema = z.object({
  email: z
    .email("Enter a valid email address.")
    .max(254, "Use 254 characters or fewer."),
})

const idSchema = z.object({ invitationId: z.uuid() })

/** Where the administrator is standing, for the sign-in round trip. */
const RETURN_TO = "/admin/families"

/**
 * Server action for inviting one family.
 * @param _previous - The previous form state (required by useActionState).
 * @param formData - The submitted email address.
 * @returns The updated form state.
 */
export async function inviteFamilyAction(
  _previous: InviteFamilyFormState,
  formData: FormData,
): Promise<InviteFamilyFormState> {
  const emailValue = String(formData.get("email") ?? "")
  const parsed = inviteSchema.safeParse({ email: emailValue.trim() })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: { email: flattened.fieldErrors.email?.[0] },
      values: { email: emailValue },
    }
  }

  const viewer = await requireAdmin(RETURN_TO)
  const result = await inviteFamily(parsed.data.email, viewer.userId)

  if (!result.ok) {
    return {
      status:
        result.reason === "existingAccount"
          ? "existingAccount"
          : result.reason === "forbidden"
            ? "forbidden"
            : result.reason === "notConfigured"
              ? "notConfigured"
              : result.reason === "unavailable"
                ? "unavailable"
                : "failed",
      fieldErrors: {},
      /* The address is kept so a failure the administrator can act on — a
         missing key, a transient outage — does not cost them their typing. */
      values: { email: emailValue },
    }
  }

  revalidatePath(RETURN_TO)

  return {
    status: result.outcome === "resent" ? "resent" : "invited",
    fieldErrors: {},
    /* Cleared on success, so the next invitation starts from an empty field
       rather than from an address that has already been sent. */
    values: { email: "" },
  }
}

/**
 * Server action for reissuing one invitation (MPS-ACC-017).
 * @param _previous - The previous form state.
 * @param formData - The invitation id.
 * @returns The updated form state.
 */
export async function resendInvitationAction(
  _previous: InvitationActionFormState,
  formData: FormData,
): Promise<InvitationActionFormState> {
  const rawId = String(formData.get("invitationId") ?? "")
  const parsed = idSchema.safeParse({ invitationId: rawId })

  if (!parsed.success) return { status: "invalid", invitationId: null }

  await requireAdmin(RETURN_TO)
  const result = await resendInvitation(parsed.data.invitationId)

  if (!result.ok) {
    return {
      status:
        result.reason === "notFound"
          ? "notFound"
          : result.reason === "notResendable"
            ? "notResendable"
            : result.reason === "sendLimit"
              ? "sendLimit"
              : result.reason === "forbidden"
                ? "forbidden"
                : result.reason === "notConfigured"
                  ? "notConfigured"
                  : result.reason === "unavailable"
                    ? "unavailable"
                    : "failed",
      invitationId: parsed.data.invitationId,
    }
  }

  revalidatePath(RETURN_TO)

  return { status: "resent", invitationId: parsed.data.invitationId }
}

/**
 * Server action for withdrawing one invitation.
 * @param _previous - The previous form state.
 * @param formData - The invitation id.
 * @returns The updated form state.
 */
export async function revokeInvitationAction(
  _previous: InvitationActionFormState,
  formData: FormData,
): Promise<InvitationActionFormState> {
  const rawId = String(formData.get("invitationId") ?? "")
  const parsed = idSchema.safeParse({ invitationId: rawId })

  if (!parsed.success) return { status: "invalid", invitationId: null }

  const viewer = await requireAdmin(RETURN_TO)
  const result = await revokeInvitation(parsed.data.invitationId, viewer.userId)

  if (!result.ok) {
    return {
      status:
        result.reason === "notFound"
          ? "notFound"
          : result.reason === "notRevocable"
            ? "notRevocable"
            : result.reason === "forbidden"
              ? "forbidden"
              : result.reason === "notConfigured"
                ? "notConfigured"
                : result.reason === "unavailable"
                  ? "unavailable"
                  : "failed",
      invitationId: parsed.data.invitationId,
    }
  }

  revalidatePath(RETURN_TO)

  return { status: "revoked", invitationId: parsed.data.invitationId }
}
