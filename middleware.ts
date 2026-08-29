/**
 * Session refresh only. Route authorization lives in the server guards
 * (`src/lib/auth/guards.ts`) that each protected page calls, so a mistake in a
 * middleware matcher cannot expose a protected route.
 *
 * No analytics runs here. PostHog is approved for anonymous public routes only
 * and must never initialise on a family, educator, or administrator route
 * (MTS-ARCHITECTURE-ADDENDUM "PostHog privacy profile").
 */

import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

/**
 * Next.js middleware that refreshes authentication sessions for protected routes.
 * @param request - The incoming Next.js request.
 * @returns The response with refreshed session cookies if applicable.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request)
}

/**
 * Scoped to the routes that actually have a session to refresh.
 *
 * A catch-all matcher ran this on every public request too, including the RSC
 * payload requests Next.js issues when prefetching links. Returning a new
 * response from middleware for those made Next re-issue them as `_rsc`
 * cache-busting redirects, which never settled — a prefetch of `/programs`
 * stayed in flight for 28 seconds and the browser's network never went idle.
 *
 * Nothing is lost by narrowing it. Route authorization was never done here —
 * each protected page calls its own guard in `src/lib/auth/guards.ts`, which
 * reads the session itself. Middleware only rotates an expiring token, which
 * only matters on the routes listed below. Public pages neither read a session
 * nor render anything viewer-specific, so they are faster without it.
 */
export const config = {
  matcher: [
    "/account/:path*",
    "/family/:path*",
    "/educator/:path*",
    "/admin/:path*",
    "/sign-in",
    /* The recovery round trip: `/auth/confirm` establishes a session from an
       emailed link, and `/reset-password` reads it. Both need the refreshed
       token, and `/forgot-password` is matched so a signed-in visitor using it
       from a second device is not working against an expiring session. */
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
  ],
}
