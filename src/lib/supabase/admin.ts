/**
 * Server-only Supabase Admin API client.
 *
 * WHY THIS EXISTS AT ALL — READ BEFORE USING IT
 *
 * Until this slice, the Foundation Release had NO service-role code path, and
 * `src/lib/supabase/server.ts` still says so for every other module: each
 * server read is filtered by RLS behind the guards in `src/lib/auth/guards.ts`.
 * INTEGRATION-MANIFEST records that adding a secret to the runtime "requires an
 * approved server-side need (SECURITY-ARCHITECTURE, least privilege)".
 *
 * The approved need is the owner's 2026-09-02 decision that family provisioning
 * is invite-only. Public signup stays disabled (`enable_signup = false`), so
 * there is no path by which an invited parent's account can come into
 * existence except the Supabase Admin API. No amount of RLS can substitute:
 * `auth.users` is not a table this project may write.
 *
 * THE BOUNDARY, STATED NARROWLY
 *
 * `src/lib/admin/invitations.ts` is the only importer, and it makes exactly two
 * kinds of call: `auth.admin.inviteUserByEmail` and `auth.admin.deleteUser`.
 * Nothing here reads or writes application data — every application read and
 * write in the invitation flow still goes through the ordinary RLS-filtered
 * client, so an administrator's authority is still checked by
 * `private.is_admin()` in the database and not assumed from this key.
 *
 * `server-only` makes the boundary a build error rather than a review
 * convention. The key is read from a non-`NEXT_PUBLIC_` variable, so Next.js
 * cannot inline it into a browser bundle, and it is never logged, never
 * returned to a caller, and never interpolated into an error message.
 *
 * NO SESSION, EVER
 *
 * `persistSession` and `autoRefreshToken` are off. This client must never
 * acquire, store, or refresh a user session — it is a privileged tool used for
 * one call and discarded, not an identity.
 */

import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { supabaseConfig } from "@/lib/env"

import type { Database } from "./database.types"

/**
 * Whether this environment carries the Supabase secret key.
 *
 * Missing is a truthful setup state, not a crash — the same shape
 * `supabaseConfig()` already models. A preview without the key shows the
 * invitation surface as unavailable rather than failing a page render.
 * @returns `true` when both the project URL and the secret key are present.
 */
export function isAdminApiConfigured(): boolean {
  return Boolean(secretKey() && supabaseConfig())
}

/** The secret key, or `undefined`. Never logged and never returned upward. */
function secretKey(): string | undefined {
  /* Written out in full rather than looked up dynamically, for the reason given
     in `@/lib/env`: a literal member access is what Next.js can analyse. Both
     names are accepted because Supabase is mid-migration from `service_role`
     JWTs to `sb_secret_…` keys, exactly as with the publishable key. */
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  return key && key.length >= 20 ? key : undefined
}

/**
 * A Supabase client holding the secret key, for Admin API calls only.
 * @returns The privileged client.
 * @throws When the secret key is absent — callers must check
 *   {@link isAdminApiConfigured} first and report the setup state.
 */
export function createAdminClient() {
  const config = supabaseConfig()
  const key = secretKey()

  if (!config || !key) {
    throw new Error(
      "The Supabase secret key is not configured in this environment. " +
        "Set SUPABASE_SECRET_KEY (server scope only — never NEXT_PUBLIC_). " +
        "See .env.example.",
    )
  }

  return createSupabaseClient<Database>(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
