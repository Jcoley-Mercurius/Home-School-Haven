import Image from "next/image"
import Link from "next/link"
import { connection } from "next/server"
import { Leaf } from "lucide-react"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { ProgramCard } from "@/components/program/program-card"
import { ValueBand } from "@/components/public/value-band"
import { Button } from "@/components/ui/button"
import {
  communityImage,
  guidanceHref,
  heroImage,
  positioning,
  programsHref,
} from "@/content/foundation-content"
import { isDemoPreview } from "@/lib/env"
import { listFeaturedPrograms } from "@/lib/programs/repository"

/**
 * Foundation Release public home page (MPS-REQ-007, MPS-REQ-009, MPS-ACC-007).
 * Composition follows MDS-REF-006; navigation behavior follows MDS-REF-005 §4.
 *
 * Content comes only from `mps/BETA-CONTENT-IMPORT-INVENTORY.md`. The page shows
 * no availability, capacity, or enrollment state, and carries no register, pay,
 * or checkout action — checkout is an external handoff handled elsewhere.
 *
 * Hero and story imagery is DEMO-ONLY placeholder art reused from MDS-REF-006
 * (owner decision, 2026-08-27). It is not approved photography and the people in
 * it are not real students (DESIGN-SYSTEM.md §5); every alt text says so and the
 * footer states it on the page. See `public/placeholder/README.md` for the
 * replacement procedure — swapping the files needs no change here.
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

export default async function Home() {
  /* TEMPORARY, Demo Preview only (see `isDemoPreview`): the Vercel build
     container cannot reach Supabase, so this read moves to request time there.
     Everything below is unchanged — same query, same real project, same
     anonymous RLS, same fail-closed handling. In production and locally this
     line is not reached and the page is still statically prerendered. */
  if (isDemoPreview()) await connection()

  const featuredPrograms = await listFeaturedPrograms()

  // Fail prerendering rather than caching a database error as static output.
  // A runtime failure on an already-deployed static page still shows the error
  // UI, but the build must not succeed while the database is unreachable.
  if (featuredPrograms === null) {
    throw new Error(
      "Failed to fetch featured programs from the system of record. " +
        "This page cannot be prerendered without database access.",
    )
  }

  return (
    <>
      <SkipLink />

      <SiteHeader />

      <main id="main" className="flex-1">
        {/* Editorial hero */}
        {/* MDS-REF-006: from the desktop breakpoint the hero photo bleeds to the
            top and right viewport edges. Below that it returns to an inset,
            rounded panel in normal flow so it stays legible when stacked.
            `overflow-hidden` keeps the bleed from creating horizontal scroll. */}
        <section className="relative overflow-hidden bg-[var(--hsh-surface-page)]">
          {/* The grid must NOT be a positioning ancestor: the photo below anchors
              to this section, which spans the viewport, so `right-0` reaches the
              viewport edge rather than the 1200 px container edge. */}
          <div className="hsh-container hsh-container-public grid gap-[var(--hsh-space-12)] py-[var(--hsh-space-12)] lg:min-h-[480px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:py-[var(--hsh-space-20)]">
            <div className="flex flex-col gap-[var(--hsh-space-6)] lg:pr-[var(--hsh-space-8)]">
              <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
                {positioning.eyebrow}
              </p>
              <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
                A place to learn, create, and belong.
              </h1>
              <p className="hsh-body-lg max-w-[52ch] text-[var(--hsh-text-secondary)]">
                {positioning.summary}
              </p>
              <p className="hsh-body max-w-[52ch] text-[var(--hsh-text-secondary)]">
                {positioning.learningCharacter}
              </p>
              <div className="flex flex-wrap gap-[var(--hsh-space-4)]">
                <Button
                  variant="primary"
                  size="lg"
                  render={<Link href={programsHref} />}
                >
                  Explore Programs
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  render={<Link href={guidanceHref} />}
                >
                  Request Guidance
                </Button>
              </div>
            </div>

            {/* Demo-only placeholder art — see the module header. */}
            {/* The container is centred, so a 50vw box anchored to the section's
                right edge starts exactly on the container's midpoint — flush
                with the text column, never over it, at any viewport width. */}
            <div className="relative min-h-[280px] overflow-hidden rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] lg:absolute lg:inset-y-0 lg:right-0 lg:w-[50vw] lg:rounded-none">
              <Image
                src={heroImage.src}
                alt={heroImage.alt}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* Value band */}
        <section
          aria-labelledby="values-heading"
          className="hsh-container hsh-container-public"
        >
          <h2 id="values-heading" className="sr-only">
            What we value
          </h2>
          <ValueBand />
        </section>

        {/* Featured programs */}
        <section
          aria-labelledby="programs-heading"
          className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-8)] pt-[var(--hsh-space-16)]"
        >
          <div className="flex flex-col gap-[var(--hsh-space-3)] text-center">
            <h2
              id="programs-heading"
              className="hsh-h2 text-[var(--hsh-text-primary)]"
            >
              Find the right experience for your child
            </h2>
            <p className="hsh-body mx-auto max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              Published program details are shown as they appear today. Anything
              not published here is confirmed directly with Home School Haven.
            </p>
          </div>

          <ul className="grid gap-[var(--hsh-space-6)] sm:grid-cols-2 lg:grid-cols-3">
            {featuredPrograms.map((program) => (
              <li key={program.slug} className="flex">
                <ProgramCard program={program} />
              </li>
            ))}
          </ul>
        </section>

        {/* Guidance pathway */}
        <section
          aria-labelledby="guidance-heading"
          className="hsh-container hsh-container-public pt-[var(--hsh-space-12)]"
        >
          <div className="flex flex-col items-center gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] px-[var(--hsh-space-6)] py-[var(--hsh-space-10)] text-center md:flex-row md:justify-center md:text-left">
            <Leaf
              aria-hidden="true"
              className="size-8 text-[var(--hsh-forest-500)]"
              strokeWidth={1.75}
            />
            <h2
              id="guidance-heading"
              className="hsh-h3 text-[var(--hsh-text-primary)]"
            >
              Not sure where to begin?
            </h2>
            <Button
              variant="secondary"
              size="md"
              render={<Link href={guidanceHref} />}
            >
              Request Guidance
            </Button>
          </div>
        </section>

        {/* Community story */}
        <section
          aria-labelledby="community-heading"
          className="hsh-container hsh-container-public grid gap-[var(--hsh-space-8)] pt-[var(--hsh-space-16)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center"
        >
          <div className="flex flex-col gap-[var(--hsh-space-4)]">
            <h2
              id="community-heading"
              className="hsh-h2 text-[var(--hsh-text-primary)]"
            >
              A community that grows together
            </h2>
            <p className="hsh-body-lg max-w-[52ch] text-[var(--hsh-text-secondary)]">
              One trusted, Christ-centered place to discover programs,
              participate in meaningful learning, and stay connected.
            </p>
            <p className="hsh-body max-w-[52ch] text-[var(--hsh-text-secondary)]">
              {positioning.faithIdentity}
            </p>
          </div>

          {/* Reserved for approved photography, as above. */}
          {/* Demo-only placeholder art — see the module header. */}
          <div className="relative min-h-[240px] overflow-hidden rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] lg:min-h-[360px]">
            <Image
              src={communityImage.src}
              alt={communityImage.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
