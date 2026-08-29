"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import {
  RECOVERY_COOKIE,
  recoveryCookieOptions,
} from "@/lib/auth/recovery-cookie"
import { getViewer, homeRouteFor } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import { type ResetPasswordFormState } from "./form-state"

/**
 * Choose a new password (MPS-REQ-011 recovery half, MPS-REQ-021).
 *
 * The session established by `/auth/confirm` is what authorizes this, and
 * Supabase verifies it independently of anything here — a forged marker cookie
 * changes nobody's password. What this action adds is the guarantee that the
 * *destination* afterwards is derived on the server from `public.user_roles`,
 * never from a form field.
 *
 * The password rules mirror `supabase/config.toml`
 * (`minimum_password_length = 12`, `password_requirements =
 * "lower_upper_letters_digits"`). Supabase remains the enforcement point; this
 * schema exists so the visitor gets the approved form-state message instead of
 * a raw Supabase error string, and so a drift between the two fails the test in
 * `tests/e2e/password-recovery.spec.ts` rather than reaching a parent.
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

export async function resetPassword(
  _previous: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
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

  let destination: string | null = null
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })

    if (error) {
      /* Two different failures, and they are owed different sentences.

         A password Supabase considers weak means the schema above and
         `supabase/config.toml` have drifted apart — the visitor should be told
         what to change, not that their link expired. Anything else is a gone
         session: the recovery window closed while the form sat open, which
         gets its own message and a route to a fresh link (MPS-ACC-017).

         The message is not passed through: it is upstream wording that has not
         been through MDS review. */
      const weak = error.status === 422 || error.code === "weak_password"
      return weak
        ? {
            status: "invalid",
            fieldErrors: {
              password:
                "That password was not accepted. Use at least 12 characters, with a lowercase letter, an uppercase letter, and a number.",
            },
          }
        : { status: "expired", fieldErrors: {} }
    }

    /* Server-derived, from `public.user_roles`. Nothing the form submitted has
       any say in where this lands. */
    const viewer = await getViewer()
    destination = homeRouteFor(viewer) ?? "/account"

    /* The marker has done its job. Clearing it means a back-button return to
       this page shows the expired state rather than a second password form. */
    const cookieStore = await cookies()
    cookieStore.set(RECOVERY_COOKIE, "", {
      ...recoveryCookieOptions,
      maxAge: 0,
    })
  } catch {
    /* Not logged: the error can carry the request that produced it, and that
       request holds a password. */
    return { status: "failed", fieldErrors: {} }
  }

  /* Outside the try: `redirect()` signals by throwing, and catching it here
     would report a completed reset as a failure. */
  redirect(destination)
}
