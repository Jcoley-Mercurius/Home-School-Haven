"use server"

import { z } from "zod"

import { safeReturnTo } from "@/lib/auth/return-to"
import { isSupabaseConfigured, siteUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import { type ForgotPasswordFormState } from "./form-state"

/**
 * Password recovery request (MPS-REQ-011 recovery half, MPS-ACC-016,
 * MPS-ACC-017; MTS TECHNOLOGY-BLUEPRINT "Identity").
 *
 * Three refusals shape this action:
 *
 *  1. **No account enumeration.** A known and an unknown address produce the
 *     same `sent` state and the same words on screen. Supabase already answers
 *     uniformly; rendering anything conditional on the result would undo that
 *     and turn this form into a "does this family have an account here?"
 *     oracle.
 *  2. **Nothing is logged.** Not the address, not the outcome
 *     (SECURITY-ARCHITECTURE: contact details must not reach runtime logs).
 *  3. **The destination is not trusted.** `redirectTo` is built from
 *     `siteUrl()` and a path that has been through the shared allow-list, so a
 *     recovery email can never carry a link to another origin.
 *
 * The rate limit is real and low — `[auth.rate_limit] email_sent = 2` per hour
 * in `supabase/config.toml`. A throttled attempt gets its own truthful state
 * rather than a false "sent", and that state still reveals nothing about
 * whether an account exists, because it is reached by anyone who asks twice.
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
})

export async function requestPasswordReset(
  _previous: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const emailValue = String(formData.get("email") ?? "")
  const destination = safeReturnTo(formData.get("redirectTo"))

  const parsed = schema.safeParse({ email: emailValue })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: { email: flattened.fieldErrors.email?.[0] },
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

  /* Where the recovery link lands. `next` survives the round trip so a parent
     who was heading for `/family` still gets there after choosing a new
     password, instead of being dropped on a generic landing page. */
  const callback = new URL("/auth/confirm", siteUrl())
  callback.searchParams.set("next", destination)

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: callback.toString() },
    )

    /* The only error distinguished from success is the rate limit, and only
       because "we sent it" would otherwise be untrue. Every other cause —
       including an address with no account — reads as `sent`. `status` is read
       rather than the message so a wording change upstream cannot silently
       reclassify a throttle as a success. */
    if (error && error.status === 429) {
      return {
        status: "throttled",
        fieldErrors: {},
        values: { email: emailValue },
      }
    }
  } catch {
    /* Not logged: the error can carry the request that produced it, and that
       request holds an email address. */
    return {
      status: "failed",
      fieldErrors: {},
      values: { email: emailValue },
    }
  }

  return { status: "sent", fieldErrors: {}, values: { email: emailValue } }
}
