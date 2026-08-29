"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

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

/** Only a relative, single-slash path is honoured — never an open redirect. */
function safeRedirect(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return "/account"
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/account"
  if (raw.includes("\\")) return "/account"
  return raw
}

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
  const destination = safeRedirect(formData.get("redirectTo"))

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

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    /* One message for every cause. The error object is deliberately not
       inspected further and never logged. */
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
