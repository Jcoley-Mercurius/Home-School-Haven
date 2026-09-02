"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { getViewer } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import { type AcceptInvitationFormState } from "./form-state"

/**
 * Complete an invited family account (MPS-REQ-011, MPS-ACC-015, MPS-REQ-021).
 *
 * WHAT AUTHORIZES THIS
 *
 * The session established by `/auth/confirm` from the emailed invitation, and
 * nothing else. Supabase verified the invitation token to create it, and
 * `accept_family_invitation()` re-derives who is calling from `auth.uid()`
 * inside the database. This action passes no identity of any kind.
 *
 * NOTHING FROM THE BROWSER NAMES ANYTHING
 *
 * There is no invitation id, no email, no family id, and no role in this form
 * or in the URL that reaches it — the only fields are a password and its
 * confirmation. An invitation cannot be redirected to another account by
 * editing a request, because no request carries an account.
 *
 * NO ROLE IS CHOSEN HERE
 *
 * `accept_family_invitation()` grants the literal role `parent`, in SQL, with
 * no parameter. Nothing in this file, this form, or this route could ask for a
 * different one.
 *
 * ORDER OF OPERATIONS
 *
 * Password first, then acceptance. If acceptance fails, the visitor still holds
 * their session and can submit again — the password call is idempotent and the
 * invitation is still pending. The reverse order would risk an account that
 * holds family access with no password anyone knows.
 *
 * The password rules mirror `supabase/config.toml`
 * (`minimum_password_length = 12`, `password_requirements =
 * "lower_upper_letters_digits"`) and the recovery form, so a parent meets one
 * rule in both places. Supabase remains the enforcement point.
 */
const schema = z
  .object({
    password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(72, "Use 72 characters or fewer.")
      .regex(/[a-z]/, "Include at least one lowercase letter.")
      .regex(/[A-Z]/, "Include at least one uppercase letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Both passwords must match.",
  })

/**
 * Server action that sets the invited parent's password and accepts their
 * invitation.
 * @param _previous - The previous form state (required by useActionState).
 * @param formData - The chosen password and its confirmation.
 * @returns The updated form state; success redirects instead of returning.
 */
export async function acceptInvitation(
  _previous: AcceptInvitationFormState,
  formData: FormData,
): Promise<AcceptInvitationFormState> {
  const parsed = schema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        password: flattened.fieldErrors.password?.[0],
        confirmPassword: flattened.fieldErrors.confirmPassword?.[0],
      },
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", fieldErrors: {} }
  }

  const viewer = await getViewer()
  if (!viewer) return { status: "closed", fieldErrors: {} }

  try {
    const supabase = await createClient()

    const { error: passwordError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })

    if (passwordError) {
      /* A weak password means this schema and `supabase/config.toml` have
         drifted; the visitor is told what to change. Anything else means the
         session is gone — the invitation link's window closed while the form
         sat open, which reads as a closed invitation and offers a route
         forward. The upstream message is not passed through: it has not been
         through MDS review. */
      const weak =
        passwordError.status === 422 || passwordError.code === "weak_password"
      return weak
        ? {
            status: "invalid",
            fieldErrors: {
              password:
                "That password was not accepted. Use at least 12 characters, with a lowercase letter, an uppercase letter, and a number.",
            },
          }
        : { status: "closed", fieldErrors: {} }
    }

    /* No arguments, by design. The database finds this account's own pending
       invitation, claims it exactly once, and grants the literal `parent`
       role. A NULL answer means expired, revoked, already accepted, or never
       invited — deliberately indistinguishable. */
    const { data, error } = await supabase.rpc("accept_family_invitation")

    if (error || data !== "accepted") {
      return { status: "closed", fieldErrors: {} }
    }
  } catch {
    /* Not logged: the error can carry the request that produced it, and that
       request holds a password. */
    return { status: "failed", fieldErrors: {} }
  }

  /* Outside the try: `redirect()` signals by throwing, and catching it here
     would report a completed acceptance as a failure.

     Family setup is the destination rather than the dashboard because a parent
     names their own family — an invitation provisions the account and grants
     the role; it does not create a family record on anyone's behalf. The setup
     page is already resumable, so a parent who stops partway can return
     (MPS-ACC-017). */
  redirect("/family/setup")
}
