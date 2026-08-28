import Image from "next/image"
import Link from "next/link"
import { ChevronRight, Leaf } from "lucide-react"

import { AvailabilityBadge } from "@/components/program/availability-badge"
import { Button } from "@/components/ui/button"
import {
  programHref,
  publishedFacts,
  type Program,
} from "@/content/foundation-content"
import { cn } from "@/lib/utils"

/**
 * Program card (DESIGN-SYSTEM.md §6 "Program card: catalog, featured, compact").
 *
 * - `featured` — MDS-REF-006: horizontal, image panel left, content right;
 *   stacks below the tablet breakpoint so the image stays legible.
 * - `catalog` — MDS-REF-004 §3 card grid: image above, content below.
 * - `compact` — MDS-REF-004 §3 compact list: thumbnail, facts, chevron.
 *
 * Truthful content only. A field the source does not publish is omitted and the
 * card says "Contact for details" (import rule 3, QA-005). The card carries no
 * register, pay, or checkout action — checkout is a handoff that lives on the
 * program detail page behind its trust notice.
 *
 * Imagery is demo-only placeholder art; its alt text says so. A program with no
 * image renders a decorative botanical panel rather than a broken frame
 * (MDS-QA Gate 3: "missing images ... do not break layouts").
 */
function ProgramImage({
  program,
  className,
  sizes,
}: {
  program: Program
  className?: string
  sizes: string
}) {
  if (!program.image) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center bg-[var(--hsh-surface-quiet)]",
          className,
        )}
      >
        <Leaf
          className="size-8 text-[var(--hsh-forest-500)]"
          strokeWidth={1.75}
        />
      </div>
    )
  }

  return (
    <div className={cn("relative", className)}>
      <Image
        src={program.image.src}
        alt={program.image.alt}
        fill
        sizes={sizes}
        className="object-cover"
      />
    </div>
  )
}

/** Published facts, or the truthful fallback when none are published. */
function ProgramFacts({ program }: { program: Program }) {
  const facts = publishedFacts(program)

  return (
    <>
      {facts.length > 0 ? (
        <ul className="flex flex-col gap-[var(--hsh-space-1)]">
          {facts.map((fact) => (
            <li
              key={fact}
              className="hsh-body-sm text-[var(--hsh-text-secondary)]"
            >
              {fact}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
        Contact for details
      </p>
    </>
  )
}

/**
 * Program card in one of the three approved variants.
 * @param program - Published program record
 * @param variant - featured (MDS-REF-006), catalog, or compact
 * @returns Program card component
 */
function ProgramCard({
  program,
  variant = "featured",
}: {
  program: Program
  variant?: "featured" | "catalog" | "compact"
}) {
  const href = programHref(program.slug)
  const surface =
    "overflow-hidden rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] shadow-[var(--hsh-shadow-card)]"

  if (variant === "compact") {
    return (
      <article data-slot="card" className={cn("w-full", surface)}>
        <Link
          href={href}
          className="flex min-h-[var(--hsh-touch-target)] items-stretch gap-[var(--hsh-space-4)] p-[var(--hsh-space-3)] hover:bg-[var(--hsh-forest-50)]"
        >
          <ProgramImage
            program={program}
            className="w-[72px] shrink-0 self-stretch overflow-hidden rounded-[var(--hsh-radius-small)]"
            sizes="72px"
          />
          <div className="flex flex-1 flex-col gap-[var(--hsh-space-2)] py-[var(--hsh-space-1)]">
            <h3 className="hsh-h4 font-[family-name:var(--hsh-font-display)] font-semibold text-[var(--hsh-text-primary)]">
              {program.name}
            </h3>
            <ProgramFacts program={program} />
            <AvailabilityBadge state={program.availability} />
          </div>
          <ChevronRight
            aria-hidden="true"
            className="size-5 shrink-0 self-center text-[var(--hsh-forest-500)]"
            strokeWidth={1.75}
          />
        </Link>
      </article>
    )
  }

  if (variant === "catalog") {
    return (
      <article
        data-slot="card"
        className={cn("flex h-full w-full flex-col", surface)}
      >
        <ProgramImage
          program={program}
          className="h-[180px] w-full shrink-0"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
        <div className="flex flex-1 flex-col gap-[var(--hsh-space-3)] p-[var(--hsh-space-5)]">
          <h3 className="hsh-h4 font-[family-name:var(--hsh-font-display)] font-semibold text-[var(--hsh-text-primary)]">
            {program.name}
          </h3>
          <ProgramFacts program={program} />
          <AvailabilityBadge state={program.availability} />
          <div className="mt-auto pt-[var(--hsh-space-2)]">
            <Button variant="primary" size="md" render={<Link href={href} />}>
              View Details
              <span className="sr-only"> for {program.name}</span>
            </Button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      data-slot="card"
      className={cn("flex h-full w-full flex-col sm:flex-row", surface)}
    >
      <ProgramImage
        program={program}
        className="h-[160px] shrink-0 sm:h-auto sm:w-[38%]"
        sizes="(min-width: 1024px) 160px, (min-width: 640px) 40vw, 100vw"
      />

      <div className="flex flex-1 flex-col gap-[var(--hsh-space-3)] p-[var(--hsh-space-5)]">
        <h3 className="hsh-h4 font-[family-name:var(--hsh-font-display)] font-semibold text-[var(--hsh-text-primary)]">
          {program.name}
        </h3>

        <ProgramFacts program={program} />

        <div className="mt-auto pt-[var(--hsh-space-2)]">
          <Button variant="primary" size="md" render={<Link href={href} />}>
            View Details
            <span className="sr-only"> for {program.name}</span>
          </Button>
        </div>
      </div>
    </article>
  )
}

export { ProgramCard }
