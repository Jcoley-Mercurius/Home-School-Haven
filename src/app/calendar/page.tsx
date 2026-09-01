import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, HeartHandshake, Info } from "lucide-react"

import { CalendarView } from "@/components/calendar/calendar-view"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { ProgramCard } from "@/components/program/program-card"
import { ProgramDataError } from "@/components/program/program-data-error"
import { Button } from "@/components/ui/button"
import { calendarTermRanges, monthKeyOf } from "@/content/calendar"
import { guidanceHref, programsHref } from "@/content/foundation-content"
import { listPublishedPrograms } from "@/lib/programs/repository"
import { listPublicSessions } from "@/lib/schedule/repository"
import { sessionCalendarEntries } from "@/lib/schedule/calendar-entries"
import { calendarEntries } from "@/content/calendar"

/**
 * Public calendar (MPS-REQ-007, MPS-REQ-008, MPS-REQ-009, MPS-ACC-009,
 * MPS-ACC-010; DESIGN-SYSTEM.md §7 public shell, §8 responsive behavior).
 *
 * Content is the approved calendar inventory in
 * `mps/BETA-CONTENT-IMPORT-INVENTORY.md`, and nothing else. Two rules shape
 * everything on this page:
 *
 *   - a day cell exists only where the source publishes a day AND a year;
 *   - a published chronology stays as published. "August 2026–May 2026"
 *     (QA-002) is shown verbatim with its under-review note, because
 *     correcting it silently would manufacture a fact.
 *
 * The layout follows MDS-REF-010
 * (`mds/references/assets/public-calendar-reference.png`), approved by the owner
 * on 2026-08-28. Its approved rules cover the shell, month grid, notes rail,
 * program panel, and guidance band — not content. Two parts of the image are
 * therefore deliberately not built, as recorded in the reference index and in
 * `prompts/public-calendar-page.md` §4: the category chips (Classes / Workshops
 * / Community), because no source assigns any offering to those categories; and
 * the "Upcoming" panel title, which here reads "Published programs", because
 * most published program ranges carry no year and cannot be ordered in time.
 *
 * WHAT CHANGED IN HSH-SLICE-ADM-04
 *
 * The grid now also draws the dated sessions of published programs. Those are
 * not an exception to the two rules above — they are the first content that
 * SATISFIES the first one, because a session stores a real day and a real year
 * where the published ranges store neither. A cancelled or rescheduled session
 * is drawn and named as such rather than removed, so a family who planned
 * around it can learn from the public page that it changed (MPS-ACC-031).
 *
 * Statically rendered with no `revalidate`, for the reason recorded at length
 * in `src/app/programs/page.tsx`. Every schedule mutation calls
 * `revalidatePath("/calendar")`, so a change reaches this page on the next
 * request rather than on a timer.
 */
export const metadata: Metadata = {
  title: "Calendar — Home School Haven of SWFL",
  description:
    "Published Home School Haven classes, workshops, and community events. Details not published here are confirmed directly with Home School Haven.",
}

export default async function CalendarPage() {
  /* Build-time month. `CalendarView` moves to the visitor's current month once
     it mounts; passing it in keeps the server and client markup identical. */
  const initialMonth = monthKeyOf(new Date())
  const [programs, sessions] = await Promise.all([
    listPublishedPrograms(),
    listPublicSessions(),
  ])
  const datedPrograms = programs?.filter((program) => program.publishedDates)

  /* Two sets, merged here rather than in either source. The inventory is what
     Home School Haven publishes; the sessions are what an administrator
     authored, and each carries a real day and year — which is exactly the
     condition `src/content/calendar.ts` requires before anything is drawn.
     RLS already narrowed the sessions to published programs, so no filter is
     repeated here. A failed session read leaves the published inventory
     drawing exactly what it drew before, rather than emptying the calendar. */
  const entries = [
    ...calendarEntries,
    ...(sessions.status === "ready"
      ? sessionCalendarEntries(sessions.items)
      : []),
  ]

  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-4)] py-[var(--hsh-space-12)]">
          <Breadcrumbs
            trail={[{ label: "Home", href: "/" }, { label: "Calendar" }]}
          />
          <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
            Calendar
          </p>
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Plan your learning season
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Families can view published classes, workshops, and community
            events; details not published are confirmed directly with Home
            School Haven.
          </p>
        </section>

        <div className="hsh-container hsh-container-public grid items-start gap-[var(--hsh-space-8)] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-[var(--hsh-space-12)]">
            <CalendarView initialMonth={initialMonth} entries={entries} />

            <section
              aria-labelledby="term-ranges-heading"
              className="flex flex-col gap-[var(--hsh-space-4)]"
            >
              <h2
                id="term-ranges-heading"
                className="hsh-h3 font-[family-name:var(--hsh-font-display)] text-[var(--hsh-text-primary)]"
              >
                Published term ranges
              </h2>
              <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                These ranges are published by month rather than by date, so they
                are listed here instead of being placed on the calendar.
              </p>
              <ul className="grid gap-[var(--hsh-space-4)] sm:grid-cols-2 lg:grid-cols-1">
                {calendarTermRanges.map((range) => (
                  <li
                    key={range.id}
                    className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)]"
                  >
                    <p className="hsh-h4 font-[family-name:var(--hsh-font-display)] text-[var(--hsh-text-primary)]">
                      {range.title}
                    </p>
                    <p className="hsh-body text-[var(--hsh-text-secondary)]">
                      {range.publishedRange}
                    </p>
                    {range.qaNote ? (
                      /* QA-002 surfaced, not corrected. The icon plus this text
                       means the state never rests on colour alone. */
                      <p className="hsh-body-sm flex items-start gap-[var(--hsh-space-2)] text-[var(--hsh-text-muted)]">
                        <Info
                          aria-hidden="true"
                          className="mt-1 size-4 shrink-0 text-[var(--hsh-gold-700)]"
                          strokeWidth={1.75}
                        />
                        {range.qaNote}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section
            aria-labelledby="published-programs-heading"
            className="flex flex-col gap-[var(--hsh-space-4)]"
          >
            <h2
              id="published-programs-heading"
              className="hsh-h3 font-[family-name:var(--hsh-font-display)] text-[var(--hsh-text-primary)]"
            >
              Published programs
            </h2>

            {/* These carry published date text, so they belong beside a
                calendar. They are NOT ordered as "upcoming": most publish no
                year, and inventing one to sort them would invent a fact. */}
            {datedPrograms === undefined ? (
              <ProgramDataError />
            ) : (
              <ul className="flex flex-col gap-[var(--hsh-space-3)]">
                {datedPrograms.map((program) => (
                  <li key={program.slug} className="flex">
                    <ProgramCard program={program} variant="compact" />
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={programsHref}
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-1)] font-semibold text-[var(--hsh-text-link)] hover:underline"
            >
              View all programs
              <ChevronRight
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            </Link>
          </section>
        </div>

        <section
          aria-labelledby="calendar-guidance-heading"
          className="hsh-container hsh-container-public mt-[var(--hsh-space-12)]"
        >
          <div className="flex flex-col items-start gap-[var(--hsh-space-6)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-8)] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-[var(--hsh-space-4)]">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--hsh-surface-quiet)] text-[var(--hsh-forest-500)]"
              >
                <HeartHandshake className="size-6" strokeWidth={1.75} />
              </span>
              <div className="flex flex-col gap-[var(--hsh-space-2)]">
                <h2
                  id="calendar-guidance-heading"
                  className="hsh-h3 font-[family-name:var(--hsh-font-display)] text-[var(--hsh-text-primary)]"
                >
                  Need help planning?
                </h2>
                <p className="hsh-body max-w-[52ch] text-[var(--hsh-text-secondary)]">
                  We are here to help you find the right mix of classes,
                  workshops, and community events for your family.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-[var(--hsh-space-2)]">
              <Button
                variant="primary"
                size="lg"
                render={<Link href={guidanceHref} />}
              >
                Request Guidance
              </Button>
              <p className="hsh-body-sm max-w-[34ch] text-[var(--hsh-text-muted)]">
                Details not published are confirmed directly with Home School
                Haven.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
