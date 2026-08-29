/**
 * The marker that says a session arrived through a password-recovery link.
 *
 * Kept in its own module rather than exported from `app/auth/confirm/route.ts`:
 * a `route.ts` file may only export route handlers and the route config, so a
 * shared constant does not belong there.
 *
 * This is a marker, **not a credential**. It carries no token and grants
 * nothing. Supabase's session is what authorizes the password change, and
 * Supabase verifies that independently — a forged `hsh-recovery` cookie changes
 * nobody's password. What the marker decides is only whether `/reset-password`
 * shows the reset form or the expired-link state, so that a *reset* screen is
 * not silently reachable as a *change password* screen by any signed-in viewer
 * who types the URL (`secure_password_change = false` in
 * `supabase/config.toml`, so Supabase will not demand reauthentication).
 */

import "server-only"

export const RECOVERY_COOKIE = "hsh-recovery"

/** Scoped to the one route that reads it, so it rides on no other request. */
export const RECOVERY_COOKIE_PATH = "/reset-password"

/** Long enough to choose a password, short enough not to linger. */
export const RECOVERY_COOKIE_MAX_AGE = 60 * 15

/** Attributes shared by the write in `/auth/confirm` and the clear on success. */
export const recoveryCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: RECOVERY_COOKIE_PATH,
  secure: process.env.NODE_ENV === "production",
} as const
