import { redirect } from "next/navigation"

/**
 * `/guidance` is now `/contact` (owner decision 2026-08-28, resolution A of
 * `prompts/public-contact-page.md` §1).
 *
 * The route is kept as a redirect rather than deleted: `/guidance` was the
 * Request Guidance destination throughout the earlier review, so links already
 * sent to a reviewer, bookmarked, or captured in a screenshot must still land
 * on the inquiry form rather than a 404.
 */
export default function GuidancePage() {
  redirect("/contact")
}
