/**
 * Announcement and learning-resource reads for the educator workspace
 * (MPS-REQ-018, MPS-REQ-019, MPS-ACC-030).
 *
 * NO LONGER READ ONLY — AND THE WRITES ARE NOT HERE
 *
 * When this module was written, neither content table had a client write path
 * and this header said so. HSH-SLICE-CONTENT-01 added one. It did not add it
 * here: authoring lives in `@/lib/content/mutations.ts`, which calls SECURITY
 * DEFINER functions, and this module still only reads. The split is deliberate
 * — a read module that can also write is a read module nobody can be sure
 * about.
 *
 * EVERY STATE IS SHOWN, AND SHOWN AS ITSELF
 *
 * The family policies return `published` and `replaced`; the educator policies
 * deliberately filter on no state at all, so an educator sees drafts and
 * removed items on their own programs. That is surfaced rather than suppressed:
 * MPS-REQ-019 requires "a visible content state". Silently dropping a draft
 * would tell an educator their program has no announcement when it has one;
 * rendering it like a published one would tell them families can read it. Both
 * are worse than saying which it is.
 *
 * SCOPING
 *
 * Both reads are bounded by the program ids the caller has already proven the
 * viewer holds. The `.in()` is a narrowing over an authorized set, not the
 * authorization itself — `announcements_select_assigned_educator` and
 * `learning_resources_select_assigned_educator` decide that independently, and
 * a forged request reaching PostgREST directly meets them and nothing else.
 */

import "server-only"

import {
  listAnnouncements,
  listResources,
} from "@/lib/content/announcements-index"
import { isFamilyVisible } from "@/lib/content/lifecycle"

import type {
  EducatorAnnouncement,
  EducatorResource,
} from "@/lib/educator/workspace-state"
import type { SectionState } from "@/lib/enrollment/repository"

/**
 * Order content the way an educator needs to see it.
 *
 * What families can currently read comes first, then drafts an educator can act
 * on, then the settled history. Ordering on `published_at` alone would float a
 * draft — which has none — to the top of "Recent announcements", burying the
 * notice families can actually see (DEFECT-EW2).
 */
const STATE_ORDER = { published: 0, draft: 1, replaced: 2, removed: 3 } as const

/**
 * Announcements on the given assigned programs.
 *
 * @param programIds - Program ids the viewer's assignment already authorized.
 * @returns The announcements, or a state explaining why not.
 */
async function listEducatorAnnouncements(
  programIds: string[],
): Promise<SectionState<EducatorAnnouncement>> {
  const read = await listAnnouncements(programIds)
  if (read.status !== "ready") return read

  const items = read.items
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      state: row.state,
      familyVisible: isFamilyVisible(row.state),
      publishedAt: row.publishedAt,
      programId: row.programId,
      programName: row.programName,
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])

  return { status: "ready", items }
}

/**
 * Learning resources on the given assigned programs.
 *
 * @param programIds - Program ids the viewer's assignment already authorized.
 * @returns The resources, or a state explaining why not.
 */
async function listEducatorResources(
  programIds: string[],
): Promise<SectionState<EducatorResource>> {
  const read = await listResources(programIds)
  if (read.status !== "ready") return read

  const items = read.items
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      kind: row.kind,
      url: row.url,
      /* The route, never the storage path and never a signed URL. */
      downloadPath: row.hasFile ? `/resources/${row.id}/file` : null,
      fileName: row.fileName,
      fileSizeBytes: row.fileSizeBytes,
      state: row.state,
      familyVisible: isFamilyVisible(row.state),
      programId: row.programId,
      programName: row.programName,
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])

  return { status: "ready", items }
}

export { listEducatorAnnouncements, listEducatorResources }
