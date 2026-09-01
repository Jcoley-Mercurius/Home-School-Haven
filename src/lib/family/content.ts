/**
 * Announcement and learning-resource reads for the authenticated family viewer.
 *
 * Neither query filters by program or by state. It does not need to: the RLS
 * policies return only rows that are `published` or `replaced` AND attached to
 * a program this viewer's family holds a non-cancelled enrollment in. Writing
 * that rule here as well would put the family boundary in two places, one of
 * which could drift.
 *
 * WHY A FAMILY SEES A REPLACED ITEM AND NOT A REMOVED ONE
 *
 * Deviation D-C2. MPS-ACC-030 asks for a truthful current state. Withdrawing a
 * notice a family already read is not a truthful state, it is a disappearance,
 * so a replaced item stays and says it was superseded. A REMOVED item is the
 * opposite case: losing it is exactly what removal means, and the policy is
 * what takes it away rather than a filter written here.
 *
 * These are thin shapings over `@/lib/content/*`, which is the one place the
 * columns and the mapping live (MPS-REQ-020). A family surface reading its own
 * copy of those columns is how three surfaces come to describe one row three
 * different ways.
 */

import "server-only"

import {
  listAnnouncements,
  listResources,
} from "@/lib/content/announcements-index"

import type { ContentState } from "@/lib/content/lifecycle"
import type { SectionState } from "@/lib/enrollment/repository"

export type Announcement = {
  id: string
  title: string
  body: string
  publishedAt: string | null
  programId: string
  programName: string | null
  /** Always `published` or `replaced` — the policy returns nothing else. */
  state: ContentState
}

export type LearningResource = {
  id: string
  title: string
  description: string | null
  /** `null` for a file-backed resource, which is fetched through `downloadPath`. */
  url: string | null
  /**
   * The application route that authorizes and then redirects to a fresh signed
   * URL, or `null` when this resource is a link. Never a storage path and never
   * a signed URL: both would be durable in a page a browser keeps.
   */
  downloadPath: string | null
  fileName: string | null
  fileSizeBytes: number | null
  programId: string
  programName: string | null
  state: ContentState
}

/**
 * Published announcements for the programs the viewer's family is enrolled in.
 * @param limit - Optional cap, for the dashboard summary card.
 * @returns The authorized announcements, or a state explaining why not.
 */
export async function getFamilyAnnouncements(
  limit?: number,
): Promise<SectionState<Announcement>> {
  const read = await listAnnouncements()
  if (read.status !== "ready") return read

  const items = read.items.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    publishedAt: row.publishedAt,
    programId: row.programId,
    programName: row.programName,
    state: row.state,
  }))

  return { status: "ready", items: limit ? items.slice(0, limit) : items }
}

/**
 * Published learning resources for the programs the family is enrolled in.
 * @param limit - Optional cap, for the dashboard summary card.
 * @returns The authorized resources, or a state explaining why not.
 */
export async function getFamilyResources(
  limit?: number,
): Promise<SectionState<LearningResource>> {
  const read = await listResources()
  if (read.status !== "ready") return read

  const items = read.items.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    url: row.url,
    downloadPath: row.hasFile ? `/resources/${row.id}/file` : null,
    fileName: row.fileName,
    fileSizeBytes: row.fileSizeBytes,
    programId: row.programId,
    programName: row.programName,
    state: row.state,
  }))

  return { status: "ready", items: limit ? items.slice(0, limit) : items }
}
