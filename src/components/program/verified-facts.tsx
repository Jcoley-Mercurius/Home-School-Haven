import { CircleCheck } from "lucide-react"

import type { Program } from "@/content/foundation-content"

/**
 * Verified program details (MDS-REF-005 §2, MPS-REQ-008, MPS-ACC-009).
 *
 * Every approved program field is listed so a family can see what is and is not
 * published. A field the source publishes is shown verbatim; a field it does
 * not publish reads "Contact for details" (import rule 3, QA-005). Nothing here
 * is inferred, and no field is silently omitted to make the panel look full.
 *
 * A `<dl>` is used so each label is programmatically associated with its value.
 */
const FALLBACK = "Contact for details"

function VerifiedFacts({ program }: { program: Program }) {
  const rows: { label: string; value: string | null }[] = [
    { label: "Dates", value: program.publishedDates },
    { label: "Schedule", value: program.publishedSchedule },
    { label: "Duration", value: program.publishedDuration },
    { label: "Session length", value: program.publishedSessionLength },
    { label: "Ages or grades", value: program.audience },
    { label: "Format", value: program.format },
    { label: "Location", value: program.location },
    { label: "Educator", value: program.educator },
    { label: "Price", value: program.publishedPrice },
    {
      label: "Registration options",
      value: program.publishedRegistrationOptions,
    },
    { label: "Enrollment period", value: program.enrollmentWindow },
  ]

  return (
    <section
      aria-labelledby="verified-facts-heading"
      className="flex flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-6)]"
    >
      <div className="flex items-center gap-[var(--hsh-space-3)]">
        <CircleCheck
          aria-hidden="true"
          className="size-5 shrink-0 text-[var(--hsh-forest-600)]"
          strokeWidth={1.75}
        />
        <h2
          id="verified-facts-heading"
          className="hsh-h4 text-[var(--hsh-text-primary)]"
        >
          Verified program details
        </h2>
      </div>

      <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
        These are the details Home School Haven publishes today. Anything shown
        as “{FALLBACK}” is confirmed directly with Home School Haven rather than
        estimated here.
      </p>

      <dl className="grid gap-x-[var(--hsh-space-6)] gap-y-[var(--hsh-space-4)] sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-[var(--hsh-space-1)]"
          >
            <dt className="hsh-label text-[var(--hsh-text-primary)]">
              {row.label}
            </dt>
            <dd
              className={
                row.value
                  ? "hsh-body text-[var(--hsh-text-secondary)]"
                  : "hsh-body text-[var(--hsh-text-muted)]"
              }
            >
              {row.value ?? FALLBACK}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export { VerifiedFacts }
