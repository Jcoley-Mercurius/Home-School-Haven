import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { Button } from "@/components/ui/button"
import { featuredPrograms, guidanceHref } from "@/content/foundation-content"

/**
 * Programs — stub route.
 *
 * This exists so the home page's Explore Programs and View Details actions lead
 * somewhere real instead of rendering as dimmed controls (owner decision,
 * 2026-08-27). It is NOT the approved catalog screen: no filters, no search, no
 * detail pages, no availability, and no enrollment or checkout action.
 *
 * It shows only facts already published in the import inventory, exactly as the
 * home page does, and says plainly that the full catalog opens later.
 */
export const metadata: Metadata = {
  title: "Programs — Home School Haven of SWFL",
  description:
    "Published Home School Haven programs. Full program details are confirmed directly with Home School Haven.",
}

export default function ProgramsPage() {
  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-4)] py-[var(--hsh-space-12)]">
          <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
            Programs
          </p>
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Published programs
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            These are the programs Home School Haven publishes today. The full
            catalog, with filters and individual program pages, opens later in
            this review. Anything not shown here is confirmed directly with Home
            School Haven.
          </p>
        </section>

        <section className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-6)] pb-[var(--hsh-space-16)]">
          <ul className="flex flex-col gap-[var(--hsh-space-6)]">
            {featuredPrograms.map((program) => {
              const details = [
                program.publishedDates,
                program.publishedDuration,
                program.publishedPrice,
              ].filter((detail): detail is string => Boolean(detail))

              return (
                <li
                  key={program.slug}
                  id={program.slug}
                  className="scroll-mt-[96px] overflow-hidden rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] shadow-[var(--hsh-shadow-card)] sm:flex"
                >
                  <div className="relative h-[180px] shrink-0 sm:h-auto sm:w-[240px]">
                    <Image
                      src={program.image.src}
                      alt={program.image.alt}
                      fill
                      sizes="(min-width: 640px) 240px, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-[var(--hsh-space-3)] p-[var(--hsh-space-6)]">
                    <h2 className="hsh-h3 text-[var(--hsh-text-primary)]">
                      {program.name}
                    </h2>
                    {details.length > 0 ? (
                      <ul className="flex flex-col gap-[var(--hsh-space-1)]">
                        {details.map((detail) => (
                          <li
                            key={detail}
                            className="hsh-body text-[var(--hsh-text-secondary)]"
                          >
                            {detail}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
                      Contact for details
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="flex flex-col items-center gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] px-[var(--hsh-space-6)] py-[var(--hsh-space-10)] text-center md:flex-row md:justify-center md:text-left">
            <h2 className="hsh-h3 text-[var(--hsh-text-primary)]">
              Have a question about a program?
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
