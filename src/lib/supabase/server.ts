/**
 * Server Supabase client for Server Components, Server Actions, and Route
 * Handlers.
 *
 * Server-only: the `server-only` import makes the boundary a compile error
 * rather than a review convention (the gap noted in
 * `src/lib/contact/recorder.ts`).
 *
 * This client also carries the publishable key. The Foundation Release has no
 * service-role code path at all (SECURITY-ARCHITECTURE "least privilege"), so
 * every server read is still filtered by RLS — defence in depth behind the
 * server-side guards in `src/lib/auth/guards.ts`.
 */

import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { supabaseConfig } from "@/lib/env"

import type { Database } from "./database.types"

/**
 * Creates a server-side Supabase client for use in Server Components, Server
 * Actions, and Route Handlers.
 * @returns A configured Supabase server client with cookie-based session management.
 * @throws When Supabase is not configured in the current environment.
 */
export async function createClient() {
  const config = supabaseConfig()
  if (!config) {
    throw new Error(
      "Supabase is not configured in this environment. See .env.example.",
    )
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          /* Called from a Server Component, where cookies are read-only. The
             middleware refreshes the session on every matched request, so the
             refreshed cookie is written there instead. */
        }
      },
    },
  })
}
