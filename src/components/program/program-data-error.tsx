import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { contact, guidanceHref } from "@/content/foundation-content"

/**
 * Shown when the program system of record could not be read
 * (MDS `patterns.error`: plain-language problem, preservation reassurance,
 * recovery action, help route).
 *
 * This is deliberately NOT the empty state. "No programs are published" and
 * "we could not load the programs" are different facts, and showing the former
 * for the latter would tell a family something untrue (MPS-REQ-021).
 *
 * It is also deliberately not a cached copy of the last known catalog: stale
 * schedules and prices presented as current is the failure this state exists to
 * prevent.
 */
export function ProgramDataError({
  heading = "We could not load the programs just now",
}: {
  heading?: string
}) {
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] px-[var(--hsh-space-6)] py-[var(--hsh-space-16)] text-center"
    >
      <TriangleAlert
        aria-hidden="true"
        className="size-8 text-[var(--hsh-forest-500)]"
        strokeWidth={1.75}
      />
      <h2 className="hsh-h3 text-[var(--hsh-text-primary)]">{heading}</h2>
      <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
        Nothing you entered was lost. This is a problem on our side, not with
        your browser. Please refresh the page in a moment, or call{" "}
        <a
          href={telHref}
          data-inline-link="true"
          className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
        >
          {contact.phone}
        </a>{" "}
        and we will help you directly.
      </p>
      <Button
        variant="secondary"
        size="md"
        render={<Link href={guidanceHref} />}
      >
        Request Guidance
      </Button>
    </div>
  )
}
