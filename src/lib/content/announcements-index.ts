/**
 * The content reads, re-exported from one place.
 *
 * `announcements.ts` and `resources.ts` are separate modules because their
 * column lists and row shapes are separate concerns, but almost every caller
 * wants both. This barrel exists so a surface imports the reads once rather
 * than reaching into two modules and drifting on which it updated.
 */

export { getAnnouncement, listAnnouncements } from "./announcements"
export { getResource, listResources } from "./resources"
export type { AnnouncementRecord } from "./announcements"
export type { ResourceRecord } from "./resources"
