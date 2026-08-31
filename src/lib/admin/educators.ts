/**
 * Authorized administrator educator reads (MPS-REQ-017, MPS-REQ-018).
 *
 * THERE IS NO EDUCATOR TABLE, AND THIS IS WHY
 *
 * An educator is an account holding the `educator` grant in `public.user_roles`
 * plus a `public.profiles` row. Creating an `educators` table would create a
 * second answer to "who is an educator" — one that could disagree with the role
 * grant that RLS actually enforces — and it would need columns nobody has
 * approved. Checklist §9 does not define an educator's operational fields, so a
 * `title`, `bio`, `specialty`, `status`, or `start_date` column would be
 * inventing published facts (GAP-ADMIN-013). The directory below is derived
 * from the two tables that already decide the answer.
 *
 * PUBLIC PROFILE AND PRIVATE ACCOUNT STAY SEPARATE
 *
 * `profiles` holds a display name and nothing that authorizes anything — its
 * own comment says so. `user_roles` holds authority and is never client-
 * writable. This module reads a name from one and a grant from the other, and
 * touches neither `auth.users` nor `raw_user_meta_data`: no email, no
 * credential, no token, no editable metadata. There is no service-role client
 * anywhere in this path, so an email could not be read even by mistake.
 *
 * WHAT "ACCOUNT LINKED" MEANS HERE
 *
 * `handle_new_user` creates a profile when an account is created, so a role
 * grant without a profile row means the grant was made for an account that does
 * not exist yet, or for one whose profile was removed. That is worth surfacing
 * — an assignment to such an account would grant scope to nobody — but it is
 * reported as an observation, never as an invitation state. No invitation
 * capability exists in this release (GAP-ADMIN-012).
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { AdminRead } from "@/lib/admin/repository"
import type { PublicationState } from "@/lib/admin/transitions"

/** One of an educator's current program assignments. */
type EducatorAssignment = {
  programId: string
  programSlug: string
  programName: string
  publicationState: PublicationState
  assignedAt: string
}

/** An educator as the directory and its drawer show it. */
type AdminEducator = {
  userId: string
  /** `""` when no profile row exists. Rendered as an explicit observation. */
  displayName: string
  /** Whether a `profiles` row backs the role grant. See the module note. */
  accountLinked: boolean
  assignments: EducatorAssignment[]
}

/* One unbroken literal each — see the note in `programs.ts`. */
// prettier-ignore
const ROLE_COLUMNS = "user_id,role,granted_at"
// prettier-ignore
const PROFILE_COLUMNS = "id,display_name"
// prettier-ignore
const ASSIGNMENT_COLUMNS = "educator_user_id,program_id,assigned_at,programs(id,slug,name,publication_state)"

/**
 * Every educator the viewer is authorized to see, with current assignments.
 *
 * `user_roles_select_admin` is what makes this an organization-wide list; an
 * educator running the same code reads only their own grant and their own
 * assignments, and everyone else reads nothing. No role check happens here.
 *
 * @returns The educators, or a state explaining why not.
 */
async function listAdminEducators(): Promise<AdminRead<AdminEducator[]>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const [roleRows, profileRows, assignmentRows] = await Promise.all([
    supabase.from("user_roles").select(ROLE_COLUMNS).eq("role", "educator"),
    supabase.from("profiles").select(PROFILE_COLUMNS),
    supabase.from("educator_assignments").select(ASSIGNMENT_COLUMNS),
  ])

  /* The role grant is the definition of the list. Without it there is no
     directory, and guessing one from profiles would answer a different
     question — "who has an account" rather than "who is an educator". */
  if (roleRows.error || profileRows.error || assignmentRows.error) {
    return { status: "failed" }
  }

  const nameById = new Map(
    (profileRows.data ?? []).map((row) => [row.id, row.display_name ?? ""]),
  )

  const assignmentsByEducator = new Map<string, EducatorAssignment[]>()
  for (const row of assignmentRows.data ?? []) {
    /* An assignment whose program join did not resolve is skipped rather than
       rendered as a nameless one: an assignment is only meaningful as "to this
       program", and an unnamed row would read as a permission to nowhere. The
       count difference surfaces as the program list being shorter, which the
       drawer states. */
    if (!row.programs) continue
    const list = assignmentsByEducator.get(row.educator_user_id) ?? []
    list.push({
      programId: row.programs.id,
      programSlug: row.programs.slug,
      programName: row.programs.name,
      publicationState: row.programs.publication_state,
      assignedAt: row.assigned_at,
    })
    assignmentsByEducator.set(row.educator_user_id, list)
  }

  const educators: AdminEducator[] = (roleRows.data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: nameById.get(row.user_id) ?? "",
    accountLinked: nameById.has(row.user_id),
    assignments: (assignmentsByEducator.get(row.user_id) ?? []).sort((a, b) =>
      a.programName.localeCompare(b.programName),
    ),
  }))

  /* An educator with no profile row has no name to sort by, so those sort last
     rather than clustering at the top under an empty string. */
  educators.sort((a, b) => {
    if (a.accountLinked !== b.accountLinked) return a.accountLinked ? -1 : 1
    return a.displayName.localeCompare(b.displayName)
  })

  return { status: "ready", data: educators }
}

export { listAdminEducators }
export type { AdminEducator, EducatorAssignment }
