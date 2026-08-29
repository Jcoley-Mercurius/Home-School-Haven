/**
 * Server-derived identity and role (MTS SECURITY-ARCHITECTURE "Derive identity
 * and role from authenticated server context").
 *
 * Three rules, all of them load-bearing:
 *
 *  1. Identity comes from `getClaims()`, which verifies the JWT signature.
 *     `getSession()` reads storage without re-validation and is never used for
 *     an authorization decision.
 *  2. Roles come from `public.user_roles` in Postgres. They are NOT read from
 *     `user_metadata`, which the user can edit themselves, and not from any
 *     request body, header, query string, or cookie.
 *  3. A visible role in the browser is not authorization (AGENTS.md §12). What
 *     this module returns decides what renders; RLS independently decides what
 *     the database will hand over.
 */

import "server-only"

import { cache } from "react"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { Enums } from "@/lib/supabase/types"

export type AppRole = Enums<"app_role">

export type Viewer = {
  userId: string
  email: string | null
  displayName: string | null
  roles: AppRole[]
}

/**
 * The current authenticated viewer, or `null` when signed out or when Supabase
 * is not configured in this environment.
 *
 * Memoised per request with `cache()` so a layout and its page do not each pay
 * for the round trip.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) return null

  const userId = data.claims.sub

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle(),
  ])

  return {
    userId,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    displayName: profile?.display_name ?? null,
    /* An account with no grant has no role. That is a real state — a verified
       adult who has not been given access yet — and it must read as "no access"
       rather than as a default. */
    roles: (roleRows ?? []).map((row) => row.role),
  }
})

/**
 * Checks if a viewer has a specific role.
 * @param viewer - The viewer to check, or null if not authenticated.
 * @param role - The role to check for.
 * @returns `true` if the viewer has the specified role, `false` otherwise.
 */
export function hasRole(viewer: Viewer | null, role: AppRole): boolean {
  return viewer?.roles.includes(role) ?? false
}

/** Administrator reach covers the owner, who is never *less* privileged. */
export function isAdmin(viewer: Viewer | null): boolean {
  return hasRole(viewer, "admin") || hasRole(viewer, "owner")
}

/** The portal destination for a viewer, or `null` when they have no access. */
export function homeRouteFor(viewer: Viewer | null): string | null {
  if (!viewer) return null
  if (isAdmin(viewer)) return "/admin"
  if (hasRole(viewer, "educator")) return "/educator"
  if (hasRole(viewer, "parent")) return "/family"
  return null
}
