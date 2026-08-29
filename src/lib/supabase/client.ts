/**
 * Browser Supabase client (MTS INTEGRATION-MANIFEST "Separate browser-safe and
 * server-only clients").
 *
 * Carries the publishable key only. Everything this client can reach is decided
 * by Row Level Security, never by what the UI chooses to render — see
 * `supabase/migrations/*_foundation_rls_policies.sql`.
 *
 * Importing `@/lib/env` from a client module is intentional and safe: that
 * module reads only `NEXT_PUBLIC_` variables, which are already part of the
 * browser bundle. It holds no secret, by construction — see its header.
 */

"use client"

import { createBrowserClient } from "@supabase/ssr"

import { supabaseConfig } from "@/lib/env"

import type { Database } from "./database.types"

/**
 * Creates a browser-side Supabase client for use in Client Components.
 * @returns A configured Supabase browser client.
 * @throws When Supabase is not configured in the current environment.
 */
export function createClient() {
  const config = supabaseConfig()
  if (!config) {
    throw new Error(
      "Supabase is not configured in this environment. See .env.example.",
    )
  }
  return createBrowserClient<Database>(config.url, config.publishableKey)
}
