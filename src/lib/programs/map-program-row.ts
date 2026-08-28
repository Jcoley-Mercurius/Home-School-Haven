/**
 * Row → `Program` mapping for the program repository.
 *
 * Deliberately separate from `repository.ts`, which is `server-only`: this
 * module is pure, imports no Next.js or Supabase runtime, and is therefore
 * directly unit-testable (`tests/program-mapping.test.mts`). The mapping is
 * where a schema change silently becomes a wrong page, so it is the part that
 * most needs a test.
 */

import type {
  AvailabilityState,
  ImportStatus,
  Program,
} from "@/content/programs"
import type { Tables } from "@/lib/supabase/types"

export type ProgramRow = Pick<
  Tables<"programs">,
  | "slug"
  | "name"
  | "published_dates"
  | "published_schedule"
  | "published_duration"
  | "published_session_length"
  | "published_price"
  | "published_registration_options"
  | "summary"
  | "audience"
  | "format"
  | "location"
  | "educator"
  | "enrollment_window"
  | "availability"
  | "checkout_url"
  | "import_status"
  | "source"
  | "unverified_details"
  | "image_src"
  | "image_alt"
  | "image_width"
  | "image_height"
  | "image_is_placeholder"
  | "sort_order"
>

export function mapProgramRow(row: ProgramRow): Program {
  return {
    slug: row.slug,
    name: row.name,
    publishedDates: row.published_dates,
    publishedSchedule: row.published_schedule,
    publishedDuration: row.published_duration,
    publishedSessionLength: row.published_session_length,
    publishedPrice: row.published_price,
    publishedRegistrationOptions: row.published_registration_options,
    summary: row.summary,
    audience: row.audience,
    format: row.format,
    location: row.location,
    educator: row.educator,
    enrollmentWindow: row.enrollment_window,
    availability: row.availability as AvailabilityState,
    checkoutUrl: row.checkout_url,
    importStatus: row.import_status as ImportStatus,
    source: row.source,
    unverifiedDetails: Array.isArray(row.unverified_details)
      ? row.unverified_details.filter(
          (detail): detail is string => typeof detail === "string",
        )
      : [],
    /* The image constraint in the schema guarantees all four columns move
       together, so one non-null check is enough — but each field is still
       narrowed for the type checker. */
    image:
      row.image_src && row.image_alt && row.image_width && row.image_height
        ? {
            src: row.image_src,
            alt: row.image_alt,
            width: row.image_width,
            height: row.image_height,
            isPlaceholder: true,
          }
        : null,
  }
}
