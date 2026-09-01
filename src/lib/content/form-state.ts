/**
 * Form states for announcement and resource authoring.
 *
 * Kept beside the actions rather than beside each route, because the same four
 * verbs are reached from the educator area and the administrator area and a
 * per-route copy is how the two surfaces come to report the same failure
 * differently.
 *
 * `forbidden` and `notFound` collapse into one rendered message on purpose. The
 * action knows which happened; the browser is told only that the item is no
 * longer available, so a response never confirms a record exists to someone who
 * may not see it.
 */

/** What happened to a submitted authoring form. */
type ContentFormStatus =
  "idle" | "invalid" | "stale" | "rejected" | "gone" | "unavailable" | "failed"

/** Field-level messages, keyed by the form field they belong to. */
type ContentFieldErrors = {
  title?: string
  body?: string
  description?: string
  url?: string
  kind?: string
  programId?: string
  file?: string
}

/** The state an announcement form carries between submissions. */
type AnnouncementFormState = {
  status: ContentFormStatus
  fieldErrors: ContentFieldErrors
  /** Echoed back so a rejected submission never loses what was typed. */
  values: { title: string; body: string; programId: string }
  /** A sentence from the server, safe to show. Never echoes a submitted value. */
  message?: string
}

/** The state a resource form carries between submissions. */
type ResourceFormState = {
  status: ContentFormStatus
  fieldErrors: ContentFieldErrors
  values: {
    title: string
    description: string
    url: string
    kind: string
    programId: string
  }
  message?: string
}

const emptyAnnouncementFormState: AnnouncementFormState = {
  status: "idle",
  fieldErrors: {},
  values: { title: "", body: "", programId: "" },
}

const emptyResourceFormState: ResourceFormState = {
  status: "idle",
  fieldErrors: {},
  values: { title: "", description: "", url: "", kind: "link", programId: "" },
}

/**
 * The sentence shown for a status that is not a field problem.
 *
 * One function so the educator and administrator surfaces cannot describe the
 * same failure differently (MPS-REQ-020 applied to error copy).
 * @param status - The form status.
 * @param message - A server sentence, when the status carries one.
 * @returns The sentence, or `null` when the status needs no banner.
 */
function statusMessage(
  status: ContentFormStatus,
  message?: string,
): string | null {
  switch (status) {
    case "stale":
      return "Someone else changed this while you were working. Reload the page to see their version, then make your change again. Nothing you typed was saved."
    case "rejected":
      return message ?? "That change was refused. Nothing was saved."
    case "gone":
      return "This is no longer available. It may have been removed, or your access to it may have changed."
    case "unavailable":
      return "No Supabase project is configured in this environment, so nothing can be saved here. Nothing you typed was saved."
    case "failed":
      return "Something went wrong on our side. Nothing you typed was saved — please try again."
    default:
      return null
  }
}

export { emptyAnnouncementFormState, emptyResourceFormState, statusMessage }
export type {
  AnnouncementFormState,
  ContentFieldErrors,
  ContentFormStatus,
  ResourceFormState,
}
