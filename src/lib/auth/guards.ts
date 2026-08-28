/**
 * Route guards — the server half of "enforce authorization in the database and
 * the server rather than relying on UI visibility".
 *
 * Every protected page calls one of these before it renders or queries
 * anything. RLS would also refuse the data, but a guard gives the viewer the
 * approved redirect or not-found response instead of an empty screen, and it
 * keeps the denial decision in one auditable place.
 *
 * Denial style is deliberate:
 *   * not signed in  → redirect to `/sign-in`, preserving where they were going
 *   * signed in, wrong role → `notFound()`. A 404 does not confirm that an
 *     administrator area exists at that path.
 */

import "server-only"

import { notFound, redirect } from "next/navigation"

import {
  getViewer,
  hasRole,
  isAdmin,
  type AppRole,
  type Viewer,
} from "./session"

/** Only relative, single-slash paths survive — never an open redirect. */
function safeRedirectTarget(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/account"
  return pathname
}

/**
 * Requires an authenticated viewer, redirecting to sign-in if not authenticated.
 * @param returnTo - The path to return to after authentication.
 * @returns The authenticated viewer.
 */
export async function requireViewer(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) {
    const target = encodeURIComponent(safeRedirectTarget(returnTo))
    redirect(`/sign-in?redirectTo=${target}`)
  }
  return viewer
}

/**
 * Requires an authenticated viewer with a specific role.
 * @param role - The required role.
 * @param returnTo - The path to return to after authentication.
 * @returns The authenticated viewer with the required role.
 */
export async function requireRole(
  role: AppRole,
  returnTo: string,
): Promise<Viewer> {
  const viewer = await requireViewer(returnTo)
  /* Administrators and the owner may reach role areas for support and
     verification (ACT-004, ACT-006). An educator never reaches a family area,
     and a parent never reaches either back-office area. */
  if (!hasRole(viewer, role) && !isAdmin(viewer)) notFound()
  return viewer
}

/**
 * Requires an authenticated viewer with administrator privileges.
 * @param returnTo - The path to return to after authentication.
 * @returns The authenticated administrator viewer.
 */
export async function requireAdmin(returnTo: string): Promise<Viewer> {
  const viewer = await requireViewer(returnTo)
  if (!isAdmin(viewer)) notFound()
  return viewer
}
