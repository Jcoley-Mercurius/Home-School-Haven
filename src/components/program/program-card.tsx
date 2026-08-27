import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { Program } from "@/content/foundation-content"

/**
 * Program card, featured variant (DESIGN-SYSTEM.md §6, MDS-REF-006).
 *
 * MDS-REF-006 shows a horizontal card: image panel on the left, content on the
 * right. Below the tablet breakpoint it stacks so the image stays legible.
 *
 * Truthful content only: a field the source does not publish renders as
 * "Contact for details" (BETA-CONTENT-IMPORT-INVENTORY rule 3, QA-005).
 * No availability, capacity, or enrollment state is shown, and the card carries
 * no register, pay, or checkout action.
 *
 * The image is demo-only placeholder art; its alt text says so, and replacing
 * the file in `public/placeholder/` needs no change here.
 */
function ProgramCard({ program }: { program: Program }) {
  const details = [
    program.publishedDates,
    program.publishedDuration,
    program.publishedPrice,
  ].filter((detail): detail is string => Boolean(detail))

  return (
    <article
      data-slot="card"
      className="flex h-full w-full flex-col overflow-hidden rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] shadow-[var(--hsh-shadow-card)] sm:flex-row"
    >
      <div className="relative h-[160px] shrink-0 sm:h-auto sm:w-[38%]">
        <Image
          src={program.image.src}
          alt={program.image.alt}
          fill
          sizes="(min-width: 1024px) 160px, (min-width: 640px) 40vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-[var(--hsh-space-3)] p-[var(--hsh-space-5)]">
        <h3 className="hsh-h4 font-[family-name:var(--hsh-font-display)] font-semibold text-[var(--hsh-text-primary)]">
          {program.name}
        </h3>

        {details.length > 0 ? (
          <ul className="flex flex-col gap-[var(--hsh-space-1)]">
            {details.map((detail) => (
              <li
                key={detail}
                className="hsh-body-sm text-[var(--hsh-text-secondary)]"
              >
                {detail}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
          Contact for details
        </p>

        <div className="mt-auto pt-[var(--hsh-space-2)]">
          <Button
            variant="primary"
            size="md"
            render={<Link href={program.href} />}
          >
            View Details
            <span className="sr-only"> for {program.name}</span>
          </Button>
        </div>
      </div>
    </article>
  )
}

export { ProgramCard }
