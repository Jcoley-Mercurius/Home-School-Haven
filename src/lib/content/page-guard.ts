import "server-only"

import { notFound } from "next/navigation"

import { requireRole } from "@/lib/auth/guards"
import { isUuid, mayAuthorForProgram } from "@/lib/content/authority"

import type { Viewer } from "@/lib/auth/session"

/**
 * The guard every program-scoped authoring page opens with.
 *
 * Written once because it is the same three steps on every one of them, and
 * because a page that forgets a step is a page that renders an authoring form
 * for a program its viewer does not hold.
 *
 *   1. `requireRole` — signed out redirects to sign-in preserving the
 *      destination; a parent gets `notFound()`, which does not confirm that an
 *      educator area exists at that path.
 *   2. the route's `programId` is checked for UUID shape BEFORE any query, so a
 *      malformed id becomes a 404 rather than a database error whose message
 *      would confirm the endpoint.
 *   3. authority is re-derived from the viewer's own assignments.
 *
 * A program the viewer does not hold and a program that never existed both get
 * `notFound()`. A distinguishable refusal would tell a prober which program ids
 * are real.
 *
 * This is not the control. `private.content_may_author()` inside each writing
 * transaction is. This is what turns a refusal into the right response.
 *
 * @param programId - The program's UUID, from the route.
 * @param returnTo - Where to come back to after signing in.
 * @returns The verified viewer.
 */
async function requireProgramAuthor(
  programId: string,
  returnTo: string,
): Promise<Viewer> {
  const viewer = await requireRole("educator", returnTo)

  if (!isUuid(programId)) notFound()
  if (!(await mayAuthorForProgram(viewer, programId))) notFound()

  return viewer
}

export { requireProgramAuthor }
