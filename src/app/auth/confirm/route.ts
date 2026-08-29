import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

import { isRecovery, parseLinkType } from "@/lib/auth/link-types"
import {
  RECOVERY_COOKIE,
  RECOVERY_COOKIE_MAX_AGE,
  RECOVERY_COOKIE_PATH,
  recoveryCookieOptions,
} from "@/lib/auth/recovery-cookie"
import { safeReturnTo } from "@/lib/auth/return-to"
import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

/**
 * Emailed-link verification (MPS-REQ-011, MPS-ACC-017; MTS
 * TECHNOLOGY-BLUEPRINT "Identity").
 *
 * Why a Route Handler, and why `token_hash`:
 *
 * Supabase's default recovery email points at the Auth server, which redirects
 * back with the tokens in the **URL fragment**. A fragment is never sent to the
 * server, so only client-side JavaScript could read it — putting a recovery
 * token in the browser's history and in a client component. The committed email
 * templates in `supabase/templates/` instead build the link themselves with
 * `{{ .TokenHash }}` pointing here, so the token is exchanged for a session
 * cookie on the server and never reaches client JavaScript.
 *
 * That choice also survives a detail the PKCE `code` flow cannot: a link opened
 * in a different browser from the one that requested it. The PKCE verifier
 * lives in a cookie on the requesting browser, and a parent who requests a
 * reset on a phone and opens the email on a laptop is an ordinary case, not an
 * attack. `code` is still accepted below so that a link generated before these
 * templates landed, or by a Supabase dashboard action, is not a dead end.
 *
 * A Route Handler rather than a page for two reasons: it can write cookies
 * (a Server Component cannot — see `src/lib/supabase/server.ts`), and it never
 * renders, so the token does not sit in the address bar of a page the visitor
 * is reading. Every path here ends in a redirect, including failure.
 */

/** A verification is a per-request decision; nothing here may be cached. */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  /* Attacker-chosen, so it goes through the shared allow-list before it is used
     as a destination — a recovery link must never be able to land a visitor on
     another origin. */
  const next = safeReturnTo(params.get("next"))

  if (!isSupabaseConfigured()) redirect("/link-expired?reason=unavailable")

  const tokenHash = params.get("token_hash")
  const type = parseLinkType(params.get("type"))
  const code = params.get("code")

  let verified = false
  try {
    const supabase = await createClient()

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      })
      verified = !error
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      verified = !error
    }

    if (verified && isRecovery(type)) {
      /* Marks that this session arrived through a recovery link, so
         `/reset-password` can tell a reset from a signed-in viewer who typed
         the URL. See `@/lib/auth/recovery-cookie` — it is a marker, not a
         credential. */
      const cookieStore = await cookies()
      cookieStore.set(RECOVERY_COOKIE, "1", {
        ...recoveryCookieOptions,
        maxAge: RECOVERY_COOKIE_MAX_AGE,
      })
    }
  } catch {
    /* Not logged. The error can carry the request that produced it, and that
       request holds a single-use credential. */
    verified = false
  }

  /* Expired, already used, tampered with, or a type outside the allow-list —
     all one outcome. The visitor is told the link no longer works and offered a
     new one; they are not told which of those it was.

     `redirect()` signals by throwing, so both calls sit outside the try above:
     catching one would turn a successful verification into a failed link. */
  if (!verified) redirect("/link-expired?reason=expired")

  /* A recovery link opens the reset form; an invite or confirmation link
     establishes the session and goes on to role routing. A bare `code` cannot
     say which it was, so it is treated as a sign-in rather than assumed to be a
     recovery — the weaker of the two, and the one that cannot hand an
     unexpected visitor a password form. */
  redirect(isRecovery(type) ? RECOVERY_COOKIE_PATH : next)
}
