"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { safeReturnTo } from "@/lib/auth/return-to"
import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import { type SignInFormState } from "./form-state"

/**
 * Password sign-in (MTS TECHNOLOGY-BLUEPRINT "Identity: Supabase Auth").
 *
 * Foundation Release scope: accounts are provisioned, not self-registered.
 * `enable_signup = false` in `supabase/config.toml`. Self-service account
 * creation, verification, and recovery (MPS-REQ-011) are MTS IMPLEMENTATION-PLAN
 * Phase 3 and depend on Resend custom SMTP, which is not configured yet.
 *
 * Two deliberate refusals:
 *
 *  1. **No account enumeration.** Every failure — unknown email, wrong
 *     password, unconfirmed address — returns the same message. Distinguishing
 *     them would let anyone test whether a family has an account here.
 *  2. **Nothing is logged.** Not the email, not the failure reason. Contact
 *     details must not reach runtime logs (SECURITY-ARCHITECTURE).
 *
 * Where the user lands afterwards is decided by `/account` from server-derived
 * roles, never by a role or destination submitted with this form.
 */
const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter the email address for your account.")
    .max(254, "Enter a shorter email address.")
    .pipe(
      z.email("Enter a valid email address, for example name@example.com."),
    ),
  password: z.string().min(1, "Enter your password."),
})

/**
 * Server action for password-based sign-in.
 * @param _previous - The previous form state (unused but required by useActionState).
 * @param formData - The submitted form data containing email and password.
 * @returns The updated form state with validation errors or success.
 */
export async function signIn(
  _previous: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const emailValue = String(formData.get("email") ?? "")
  const destination = safeReturnTo(formData.get("redirectTo"))

  const parsed = schema.safeParse({
    email: emailValue,
    password: String(formData.get("password") ?? ""),
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        email: flattened.fieldErrors.email?.[0],
        password: flattened.fieldErrors.password?.[0],
      },
      values: { email: emailValue },
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      fieldErrors: {},
      values: { email: emailValue },
    }
  }

  /* A transport or configuration failure is a different state from a refused
     credential, and the visitor is owed a different sentence: "try again"
     rather than "check your password" (MPS-REQ-021). `redirect()` is called
     after the block, never inside it — it signals by throwing, and catching
     that here would turn a successful sign-in into a "failed" message.

     The caught error is not logged. It can carry the request that produced it,
     and that request holds a password. */
  let rejected = false
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })
    /* One message for every cause — unknown address, wrong password,
       unconfirmed address. The error is deliberately not inspected further:
       distinguishing them would confirm whether a family has an account here. */
    rejected = Boolean(error)
  } catch {
    return {
      status: "failed",
      fieldErrors: {},
      values: { email: emailValue },
    }
  }

  if (rejected) {
    return {
      status: "rejected",
      fieldErrors: {},
      values: { email: emailValue },
    }
  }

  redirect(destination)
}

/**
 * Server action for signing out the current user.
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect("/")
}
