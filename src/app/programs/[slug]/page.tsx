import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Leaf } from "lucide-react"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { ProgramActionRail } from "@/components/program/program-action-rail"
import { ProgramCard } from "@/components/program/program-card"
import { VerifiedFacts } from "@/components/program/verified-facts"
import { ProgramDataError } from "@/components/program/program-data-error"
import { positioning } from "@/content/foundation-content"
import {
  getPublishedProgram,
  listPublishedProgramSlugs,
  listRelatedPrograms,
} from "@/lib/programs/repository"

/**
 * Program detail (DESIGN-SYSTEM.md §7 "Program detail: identity and verified
 * facts, long-form content, sticky status/action rail, related programs";
 * MDS-REF-005 §2; MPS-REQ-008, MPS-REQ-020, MPS-ACC-009, MPS-ACC-011).
 *
 * One reusable screen serves every published program. Content comes only from
 * the approved import inventory, so a program with few published facts renders
 * the same shell with honest "Contact for details" values rather than filler.
 *
 * The page publishes no description: the inventory contains none, and
 * MDS-REF-005 shows only the literal placeholder "Approved program description
 * appears here." Writing one here would invent product content (import rule 3).
 *
 * Details whose source association is unproven (QA-001 — the Etiquette Series
 * dates, the Gardening session length) live in `Program.unverifiedDetails` and
 * are deliberately not rendered.
 *
 * Programs come from Supabase. `getPublishedProgram` distinguishes three
 * answers that must not be collapsed into one: a program (render it),
 * `undefined` (no such published program — 404), and `null` (the system of
 * record could not be read — error state, never a 404, because "not found"
 * would tell a family the program was withdrawn).
 */

/**
 * Deliberately statically rendered, with no `revalidate`.
 *
 * Time-based ISR was tried here and removed: with `revalidate` set, Next.js
 * 16.3.3 left the RSC payload requests it issues when prefetching links in
 * flight for 25+ seconds each. Hovering a link would hang a request, which is a
 * far worse defect than the staleness ISR was meant to fix.
 *
 * The staleness is real and stays recorded: a static prerender captures the
 * database as it was at build time, so an administrator publishing a program
 * will not change this page until the next deploy. That is acceptable only
 * because the Foundation Release has no administrator write surface yet — every
 * program change already goes through a migration or seed, followed by a
 * deploy.
 *
 * When the administrator write surface lands (MTS IMPLEMENTATION-PLAN Phase 4),
 * the fix is on-demand revalidation — `revalidatePath()` called from the server
 * action that publishes the change — not a timer. It is precise, it keeps
 * MPS-REQ-020 consistency across surfaces, and it does not reintroduce this
 * prefetch behavior.
 */

/**
 * Pre-renders the programs published at build time. `dynamicParams` stays at
 * its default `true`, so a program published in Supabase after the build still
 * resolves on request rather than 404ing until the next deploy.
 *
 * This reads through the anonymous build-time client, not the request-scoped
 * one: `generateStaticParams` runs without an HTTP request, so `cookies()` is
 * unavailable there.
 */
export async function generateStaticParams() {
  const slugs = await listPublishedProgramSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const program = await getPublishedProgram(slug)
  if (!program)
    return { title: "Program not found — Home School Haven of SWFL" }

  return {
    title: `${program.name} — Home School Haven of SWFL`,
    description: `Published details for ${program.name}. Details not published here are confirmed directly with Home School Haven.`,
  }
}

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const program = await getPublishedProgram(slug)
  if (program === undefined) notFound()

  if (program === null) {
    return (
      <>
        <SkipLink />
        <SiteHeader />
        <main
          id="main"
          className="hsh-container hsh-container-public flex-1 py-[var(--hsh-space-16)]"
        >
          <ProgramDataError heading="We could not load this program just now" />
        </main>
        <SiteFooter />
      </>
    )
  }

  const related = await listRelatedPrograms(program.slug)

  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-4)] pt-[var(--hsh-space-8)] pb-[var(--hsh-space-6)]">
          <Breadcrumbs
            trail={[
              { label: "Home", href: "/" },
              { label: "Programs", href: "/programs" },
              { label: program.name },
            ]}
          />
        </section>

        {/* Identity, verified facts, and the action rail.
            MDS §8: the rail is sticky at 1024 px and above; below that it
            returns to normal flow, ordered before the long-form content so its
            availability and checkout meaning is never demoted. */}
        <div className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-10)] pb-[var(--hsh-space-16)] lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-start">
          <div className="flex flex-col gap-[var(--hsh-space-8)] lg:col-start-1 lg:row-start-1">
            <div className="flex flex-col gap-[var(--hsh-space-4)]">
              <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
                Program
              </p>
              <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
                {program.name}
              </h1>
              <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                {positioning.learningCharacter}
              </p>
            </div>

            {program.image ? (
              <div
                data-slot="program-hero"
                className="relative min-h-[240px] overflow-hidden rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] lg:min-h-[320px]"
              >
                <Image
                  src={program.image.src}
                  alt={program.image.alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : (
              /* No released or placeholder imagery exists for this program.
                 A decorative panel keeps the composition intact without
                 implying a photograph (MDS-QA Gate 3). */
              <div
                aria-hidden="true"
                data-slot="program-hero"
                className="flex min-h-[160px] items-center justify-center rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] lg:min-h-[200px]"
              >
                <Leaf
                  className="size-10 text-[var(--hsh-forest-500)]"
                  strokeWidth={1.75}
                />
              </div>
            )}
          </div>

          {/* MDS §8 and MDS-REF-005 §5: sticky beside the content from 1024 px;
              below that it takes an explicit priority position between the
              program identity and the long-form content, never the page
              bottom (DO-DONT.md: important states are not demoted on mobile). */}
          <ProgramActionRail
            program={program}
            className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
          />

          <div className="flex flex-col gap-[var(--hsh-space-8)] lg:col-start-1 lg:row-start-2">
            <VerifiedFacts program={program} />

            <section
              aria-labelledby="about-heading"
              className="flex flex-col gap-[var(--hsh-space-3)]"
            >
              <h2
                id="about-heading"
                className="hsh-h3 text-[var(--hsh-text-primary)]"
              >
                About this program
              </h2>
              <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                Home School Haven has not published a full description for{" "}
                {program.name} yet, so none is shown here rather than an
                approximation. The details above are exactly what is published
                today.
              </p>
              <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                {positioning.faithIdentity}
              </p>
            </section>
          </div>
        </div>

        {related.length > 0 ? (
          <section
            aria-labelledby="related-heading"
            className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-6)] pb-[var(--hsh-space-16)]"
          >
            <h2
              id="related-heading"
              className="hsh-h3 text-[var(--hsh-text-primary)]"
            >
              Other published programs
            </h2>
            <ul className="grid gap-[var(--hsh-space-4)] lg:grid-cols-3">
              {related.map((other) => (
                <li key={other.slug} className="flex">
                  <ProgramCard program={other} variant="compact" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  )
}
