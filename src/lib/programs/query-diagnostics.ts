/**
 * TEMPORARY diagnostic reporting for the program read path.
 *
 * WHY THIS EXISTS — AND WHEN TO DELETE IT
 *
 * A Vercel Preview build fails at `/page` with "Failed to fetch featured
 * programs from the system of record". The homepage throw is correct
 * (MPS-REQ-021: never present stale content as current truth), but it discards
 * the reason: `listPublishedPrograms` returns a bare `null`, so the build log
 * cannot distinguish an invalid key from an unreachable host from a schema
 * mismatch. The same query succeeds against the linked project from a
 * workstation, so the difference is only visible from inside the build.
 *
 * Delete this module and its single call site once the cause is classified.
 * It is not part of the approved observability posture (MTS: Vercel runtime
 * logs plus privacy-scrubbed browser errors; no Sentry, no session replay).
 *
 * WHAT IT MAY EMIT — THE RULE, NOT A GUIDELINE
 *
 * Every field is either a boolean, an enum, a numeric status, or a message
 * authored by PostgREST. It never emits the project URL, the project ref, any
 * key, token, or header, any returned row, or any person's data. `details` is
 * withheld unless it passes {@link isSafeDetails}, because postgrest-js puts a
 * *stack trace* there on a network failure and a stack is neither useful here
 * nor ours to publish.
 *
 * The project-ref comparison is reported only as `true`, `false`, or `null`
 * (not checkable). The refs themselves are compared in memory and never
 * printed — which is the whole point: knowing that two identifiers disagree is
 * the diagnosis, and printing them is not required to reach it.
 */

import "server-only"

import type { PostgrestError } from "@supabase/supabase-js"

/**
 * The project this deployment is expected to talk to.
 *
 * A Supabase project ref is not a secret — it is the hostname in
 * `NEXT_PUBLIC_SUPABASE_URL`, which ships to every browser — and this one is
 * already recorded in `prompts/vercel-preview-deployment.md`. It is still never
 * logged; it exists only as the left side of a boolean comparison.
 *
 * `HSH_EXPECTED_SUPABASE_PROJECT_REF` overrides it, so a different environment
 * can be checked without editing code.
 */
const EXPECTED_PROJECT_REF = "uedgcwoxyhtirsihvrnf"

/** A hosted project ref is 20 lowercase alphanumerics in the hostname. */
const HOSTED_REF = /^([a-z0-9]{20})\.supabase\.(co|in)$/

/**
 * The project ref named by a Supabase URL, or `null` when there isn't one
 * (an unset value, a malformed URL, or a local stack on `127.0.0.1`).
 */
function projectRefOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.match(HOSTED_REF)?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * Whether a PostgREST `details` string is safe to reproduce in a log.
 *
 * Conservative by construction: anything that looks like a stack trace, a URL,
 * an address, a long opaque token, or simply too much text is withheld rather
 * than inspected. A withheld `details` costs one classification hint; a leaked
 * one cannot be taken back.
 */
function isSafeDetails(details: string | null | undefined): boolean {
  if (!details) return false
  if (details.length > 200) return false
  if (details.includes("@")) return false // an address, or a stack frame
  if (details.includes("://")) return false // a URL
  if (/\n\s*at /.test(details)) return false // a stack trace
  if (/[A-Za-z0-9_-]{20,}/.test(details)) return false // an opaque token
  return true
}

/** The shape of the publishable key, without any of its bytes. */
function keyStyle(key: string | undefined): "sb_publishable" | "legacy" | null {
  if (!key) return null
  if (key.startsWith("sb_publishable_")) return "sb_publishable"
  if (key.startsWith("eyJ")) return "legacy"
  return null
}

/**
 * Reports why a program read failed, in fields that carry no credential and no
 * private data.
 *
 * Call it in an error path and then return exactly what that path already
 * returned — this function changes no behavior and swallows nothing.
 *
 * @param operation - The repository function reporting the failure.
 * @param error - The PostgREST error, when there was one.
 * @param status - The transport status; `0` is postgrest-js's network failure.
 * @param dataWasNull - Whether the response carried no data.
 */
export function reportProgramQueryFailure({
  operation,
  error,
  status,
  dataWasNull,
}: {
  operation: string
  error: PostgrestError | null
  status?: number
  dataWasNull: boolean
}): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const observedRef = projectRefOf(url)
  const expectedRef =
    process.env.HSH_EXPECTED_SUPABASE_PROJECT_REF ?? EXPECTED_PROJECT_REF

  /* `null` means "could not be checked" — a local stack or a custom domain has
     no ref to compare — and is deliberately distinct from `false`. */
  const projectRefMatches =
    observedRef === null ? null : observedRef === expectedRef

  console.error(
    "[program-query-diagnostic] " +
      JSON.stringify({
        operation,
        errorPresent: Boolean(error),
        errorName: error?.name ?? null,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        errorHint: error?.hint ?? null,
        errorDetails: isSafeDetails(error?.details)
          ? error?.details
          : error?.details
            ? "[withheld]"
            : null,
        transportStatus: status ?? null,
        networkFailure: status === 0,
        dataWasNull,
        vercelEnv: process.env.VERCEL_ENV ?? null,
        supabaseUrlPresent: Boolean(url),
        publishableKeyPresent: Boolean(key),
        publishableKeyStyle: keyStyle(key),
        projectRefMatches,
      }),
  )
}
