import "server-only"

import { notFound } from "next/navigation"

import { isUuid, mayAuthorForProgram } from "@/lib/content/authority"
import { getAnnouncement } from "@/lib/content/announcements"
import { getResource } from "@/lib/content/resources"

import type { Viewer } from "@/lib/auth/session"
import type { AnnouncementRecord } from "@/lib/content/announcements"
import type { ResourceRecord } from "@/lib/content/resources"

/**
 * Load one content item for a manage page, with the viewer's authority over it.
 *
 * Written once because the educator area and the administrator area need
 * exactly the same thing, and two copies would be two places for the
 * `notFound()` to be forgotten.
 *
 * THE ID IS UNTRUSTED AND EVERY REFUSAL IS THE SAME REFUSAL
 *
 * Malformed, nonexistent, and unreadable-by-this-viewer all reach `notFound()`.
 * The read itself goes through RLS, so "unreadable" is decided by the database
 * rather than by a filter written here — this function cannot accidentally
 * widen what it returns, because it does not narrow anything.
 *
 * AUTHORITY IS SEPARATE FROM VISIBILITY, DELIBERATELY
 *
 * An administrator can READ every program's content and an assigned educator
 * can read their own. Being able to read it is not being able to change it, and
 * `canAuthor` carries that difference to the page so it renders actions only
 * where they would actually work.
 */

/** A content item plus what this viewer may do with it. */
type ManageLoad<T> = { record: T; canAuthor: boolean }

/**
 * Load an announcement for a manage page.
 * @param viewer - The verified viewer.
 * @param announcementId - The announcement's UUID, from the route.
 * @returns The record and the viewer's authority over it.
 */
async function loadAnnouncementForManage(
  viewer: Viewer,
  announcementId: string,
): Promise<ManageLoad<AnnouncementRecord>> {
  if (!isUuid(announcementId)) notFound()

  const record = await getAnnouncement(announcementId)
  if (!record) notFound()

  return {
    record,
    canAuthor: await mayAuthorForProgram(viewer, record.programId),
  }
}

/**
 * Load a learning resource for a manage page.
 * @param viewer - The verified viewer.
 * @param resourceId - The resource's UUID, from the route.
 * @returns The record and the viewer's authority over it.
 */
async function loadResourceForManage(
  viewer: Viewer,
  resourceId: string,
): Promise<ManageLoad<ResourceRecord>> {
  if (!isUuid(resourceId)) notFound()

  const record = await getResource(resourceId)
  if (!record) notFound()

  return {
    record,
    canAuthor: await mayAuthorForProgram(viewer, record.programId),
  }
}

export { loadAnnouncementForManage, loadResourceForManage }
export type { ManageLoad }
