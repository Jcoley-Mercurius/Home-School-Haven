import type { Metadata } from "next"
import Link from "next/link"
import { Leaf } from "lucide-react"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { ProgramCard } from "@/components/program/program-card"
import { Button } from "@/components/ui/button"
import { ProgramDataError } from "@/components/program/program-data-error"
import { contact, guidanceHref } from "@/content/foundation-content"
import { listPublishedPrograms } from "@/lib/programs/repository"

/**
 * Program catalog (MPS-REQ-007, MPS-REQ-008, MPS-ACC-009, MPS-ACC-010;
 * DESIGN-SYSTEM.md §7 "Catalog"; MDS-REF-005 §2).
 *
 * Every published program in `mps/BETA-CONTENT-IMPORT-INVENTORY.md` is listed
 * and links to its own detail page. Facts the source does not publish read
 * "Contact for details" rather than being estimated (import rule 3, QA-005).
 *
 * Deviation D-2, recorded for MDS review: MDS-REF-005 §2 shows a filter rail
 * over Program / Format / Schedule / Availability. Three of those four facts
 * are unpublished for every program, so building the rail would require
 * inventing filter values, which import rule 3 forbids. Filters and search are
 * deferred until those facts are published; the catalog is not redesigned in
 * their place.
 *
 * The catalog carries no register, pay, or checkout action. Checkout is a
 * handoff that lives on the detail page behind its trust notice.
 *
 * Programs come from Supabase (MTS-ARCHITECTURE-ADDENDUM: Supabase is the
 * single source of truth). `listPublishedPrograms` returns `null` when the
 * system of record cannot be read, which renders the error state rather than a
 * stale or empty catalog.
 */
export const metadata: Metadata = {
  title: "Programs — Home School Haven of SWFL",
  description:
    "Published Home School Haven programs. Details not published here are confirmed directly with Home School Haven.",
}

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

export default async function ProgramsPage() {
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`
  const programs = await listPublishedPrograms()

  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-4)] py-[var(--hsh-space-12)]">
          <Breadcrumbs
            trail={[{ label: "Home", href: "/" }, { label: "Programs" }]}
          />
          <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
            Programs
          </p>
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Published programs
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            These are the programs Home School Haven publishes today. Open any
            program to see its verified details and next steps. Anything not
            published here is confirmed directly with Home School Haven.
          </p>
        </section>

        <section
          aria-labelledby="catalog-heading"
          className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-8)] pb-[var(--hsh-space-16)]"
        >
          <h2 id="catalog-heading" className="sr-only">
            Program results
          </h2>

          {programs === null ? (
            <ProgramDataError />
          ) : programs.length > 0 ? (
            <ul className="grid gap-[var(--hsh-space-6)] sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => (
                <li key={program.slug} className="flex">
                  <ProgramCard program={program} variant="catalog" />
                </li>
              ))}
            </ul>
          ) : (
            /* MPS-ACC-010: an empty result offers a path, never a dead end. */
            <div className="flex flex-col items-center gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] px-[var(--hsh-space-6)] py-[var(--hsh-space-16)] text-center">
              <Leaf
                aria-hidden="true"
                className="size-8 text-[var(--hsh-forest-500)]"
                strokeWidth={1.75}
              />
              <h3 className="hsh-h3 text-[var(--hsh-text-primary)]">
                No programs are published right now
              </h3>
              <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                New sessions are added each term. Tell us about your child and
                we will let you know what is coming, or call{" "}
                <a
                  href={telHref}
                  data-inline-link="true"
                  className="rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
                >
                  {contact.phone}
                </a>
                .
              </p>
              <Button
                variant="primary"
                size="md"
                render={<Link href={guidanceHref} />}
              >
                Request Guidance
              </Button>
            </div>
          )}

          <div className="flex flex-col items-center gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] px-[var(--hsh-space-6)] py-[var(--hsh-space-10)] text-center md:flex-row md:justify-center md:text-left">
            <Leaf
              aria-hidden="true"
              className="size-8 shrink-0 text-[var(--hsh-forest-500)]"
              strokeWidth={1.75}
            />
            <h2 className="hsh-h3 text-[var(--hsh-text-primary)]">
              Not sure which program fits your child?
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
      </main>

      <SiteFooter />
    </>
  )
}
