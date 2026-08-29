/**
 * Session refresh for the Next.js middleware (MTS TECHNOLOGY-BLUEPRINT
 * "Identity"). Runs on every matched request so an expiring access token is
 * rotated before a Server Component tries to use it.
 *
 * `getClaims()` is used rather than `getSession()`: the session is read from
 * storage without re-validation, so it must never drive an authorization
 * decision. `getClaims()` verifies the JWT signature.
 */

import "server-only"

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { supabaseConfig } from "@/lib/env"

import type { Database } from "./database.types"

/**
 * Updates the authentication session for incoming requests in Next.js middleware.
 * @param request - The incoming Next.js request.
 * @returns A Next.js response with refreshed authentication cookies if applicable.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const config = supabaseConfig()
  /* No project connected yet: public pages must still render (see
     `src/lib/programs/repository.ts`), so pass the request through untouched. */
  if (!config) return response

  /* No auth cookie means there is no session to refresh, so skip the call.
     `getClaims()` is a network round trip to the Auth server, and without this
     guard it fires on every single request — including Next.js link prefetches
     of purely public pages. That added a Supabase round trip to each of them,
     kept the browser's network permanently busy, and put load on Auth
     proportional to anonymous public traffic rather than to sign-ins.
     A signed-out visitor now reaches no network at all here. */
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    )
  if (!hasAuthCookie) return response

  const supabase = createServerClient<Database>(
    config.url,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  /* Refreshes the token and rewrites the cookie via setAll above. The result is
     deliberately unused: route protection is enforced by the server guards in
     `src/lib/auth/guards.ts`, not here, so that a middleware change can never
     silently open a protected route. */
  await supabase.auth.getClaims()

  return response
}
