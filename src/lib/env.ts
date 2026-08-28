/**
 * Environment contract and validation (MTS INTEGRATION-MANIFEST
 * "Environment-variable contract", TECHNOLOGY-BLUEPRINT "Environment boundary").
 *
 * Two rules shape this module:
 *
 *  1. **Only public values are read here.** No secret or service-role
 *     credential is referenced anywhere in application code. Seeding, migration,
 *     and type generation are Supabase CLI operations that read their own
 *     credentials.
 *  2. **Missing configuration is a truthful state, not a crash.** The Foundation
 *     preview must keep rendering public pages before a Supabase project exists,
 *     so `supabaseConfig()` returns `null` rather than throwing. A *malformed*
 *     value still throws, because silently ignoring a typo would present the
 *     staging catalog as if it were live data.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only for literal,
 * statically analysable member accesses, which is why each name is written out
 * in full below rather than looked up dynamically.
 *
 * Two names are accepted for the client key. Supabase is mid-migration from
 * legacy `anon` keys to publishable keys, and a given project's dashboard shows
 * one or the other depending on when it was created. Both are public by design
 * and both work with `@supabase/ssr`, so accepting either removes a
 * copy-the-wrong-name failure that looks identical to a broken project.
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` wins when both are set.
 *
 * This module is deliberately NOT marked `server-only`: the browser client in
 * `src/lib/supabase/client.ts` imports `supabaseConfig()`, and every value read
 * here is a `NEXT_PUBLIC_` variable that already ships to the browser. Adding
 * `server-only` would break the browser client; adding a secret to this module
 * would leak it. Keep both properties true — if a server-only value is ever
 * needed, put it in a separate `server-only` module rather than here.
 */

import { z } from "zod"

export type ReleaseTarget = "local" | "preview" | "production"

/**
 * Determines the current release environment target.
 * @returns The release target based on HSH_RELEASE_TARGET or VERCEL_ENV environment variables.
 */
export function releaseTarget(): ReleaseTarget {
  const raw = process.env.HSH_RELEASE_TARGET ?? process.env.VERCEL_ENV
  if (raw === "production") return "production"
  if (raw === "preview") return "preview"
  return "local"
}

const supabaseSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  /* Long enough to exclude a placeholder like `your_anon_key`. Both a legacy
     anon JWT and an `sb_publishable_…` key comfortably exceed this. */
  publishableKey: z.string().min(20),
})

export type SupabaseConfig = z.infer<typeof supabaseSchema>

/**
 * The validated Supabase configuration, or `null` when this environment has not
 * been connected to a project yet.
 *
 * @throws when a value is present but malformed — a typo must surface loudly
 *   rather than degrade to the offline catalog.
 */
export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url && !publishableKey) return null

  const parsed = supabaseSchema.safeParse({ url, publishableKey })
  if (!parsed.success) {
    throw new Error(
      "Supabase environment variables are partially set or malformed. " +
        "Set NEXT_PUBLIC_SUPABASE_URL together with either " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY, or set neither. " +
        "A placeholder value counts as malformed. See .env.example.",
      /* The zod issues are deliberately not interpolated: an issue message can
         echo the offending value, and a mistyped key would then reach a log. */
    )
  }
  return parsed.data
}

/**
 * Checks whether Supabase is configured in the current environment.
 * @returns `true` if Supabase configuration is available, `false` otherwise.
 */
export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null
}

/**
 * Canonical origin for auth redirect construction. Falls back to the Vercel
 * deployment URL, then to local dev.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`
  return "http://127.0.0.1:3000"
}
