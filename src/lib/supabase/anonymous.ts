/**
 * Request-less, anonymous Supabase client for build-time reads.
 *
 * `generateStaticParams` runs at build time with no HTTP request, so it cannot
 * use the cookie-bound client in `./server.ts` — Next.js throws if `cookies()`
 * is called there.
 *
 * Carrying no session is the right property rather than a workaround: this
 * client is subject to the `anon` RLS policies, so anything prerendered at
 * build time is by construction something a signed-out visitor may see. A draft
 * program cannot leak into a static path this way even if a caller asks for one.
 *
 * Use this ONLY where there is genuinely no request. Every request-scoped read
 * must use `./server.ts`, or it will silently ignore the signed-in viewer.
 */

import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { supabaseConfig } from "@/lib/env"

import type { Database } from "./database.types"

/**
 * Creates a session-less Supabase client for build-time or anonymous reads.
 * @returns A configured anonymous Supabase client without session persistence.
 * @throws When Supabase is not configured in the current environment.
 */
export function createAnonymousClient() {
  const config = supabaseConfig()
  if (!config) {
    throw new Error(
      "Supabase is not configured in this environment. See .env.example.",
    )
  }

  return createSupabaseClient<Database>(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
