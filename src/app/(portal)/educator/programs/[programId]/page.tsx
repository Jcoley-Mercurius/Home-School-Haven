import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import {
  AnnouncementList,
  ResourceList,
} from "@/components/educator/content-lists"
import { EducatorRosterSection } from "@/components/educator/roster-section"
import { ScheduleSection } from "@/components/educator/schedule-section"
import { ReadFailure } from "@/components/educator/states"
import { ListSkeleton } from "@/components/admin/list-skeleton"
import { Button } from "@/components/ui/button"
import { PublicationBadge } from "@/components/admin/publication-state"
import { ReviewDataBanner } from "@/components/family/section-states"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { getAssignedProgram } from "@/lib/educator/assignments"
import {
  listEducatorAnnouncements,
  listEducatorResources,
} from "@/lib/educator/content"

/**
 * One assigned program, read-only (MPS-REQ-018, MPS-REQ-020, MPS-ACC-028,
 * MPS-ACC-029; MDS `patterns.detail`).
 *
 * THE ROUTE PARAMETER IS UNTRUSTED, AND THREE THINGS MAKE THAT SAFE
 *
 *   * A value that is not a UUID is rejected before any query. Without that,
 *     PostgREST answers with a type error, the read reports "failed", and the
 *     page renders a 200 saying it could not load — which tells a prober that
 *     the route exists and reached the database (DEFECT-PE3 on the
 *     administrator equivalent).
 *   * A well-formed id for a program this educator does not hold matches no row
 *     in a query already bounded by their own user id, and returns `notFound()`
 *     — the identical response an id that never existed gets. The educator
 *     cannot tell "forbidden" from "does not exist", which is the point.
 *   * The denial is the server's. It is a 404 status on the response, not a
 *     client-side redirect that a disabled script or a direct `fetch` would
 *     skip. `expectStatus()` in the e2e suite asserts the status without
 *     rendering, so what is verified is the response and not the page.
 *
 * Removing the assignment revokes this on the next request: nothing caches it,
 * and the portal layout is `force-dynamic`.
 *
 * NO SUSPENSE AROUND THE PROGRAM READ
 *
 * The heading and every section depend on the row, and awaiting it before
 * returning keeps `notFound()` able to set the response status — a streamed
 * response would already have sent a 200. The roster, which cannot change the
 * status, does stream behind a skeleton.
 */
export const metadata: Metadata = {
  title: "Program — Educator — Home School Haven of SWFL",
}

/** Any RFC 4122 UUID. Shape only; the database decides whether it exists. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EducatorProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>
}) {
  const { programId } = await params
  const viewer = await requireRole(
    "educator",
    `/educator/programs/${programId}`,
  )

  /* Shape first, before anything is asked of the database. */
  if (!UUID.test(programId)) notFound()

  const result = await getAssignedProgram(viewer.userId, programId)

  if (result.status === "notFound") notFound()

  const shell = (children: React.ReactNode, trailLabel: string) => (
    <EducatorPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />
        <Breadcrumbs
          trail={[
            { label: "Overview", href: "/educator" },
            { label: "Assigned Programs", href: "/educator/programs" },
            { label: trailLabel },
          ]}
        />
        {children}
      </main>
    </EducatorPortalShell>
  )

  if (result.status !== "ready") {
    return shell(
      <ReadFailure status={result.status} subject="This program" />,
      "Program",
    )
  }

  const program = result.data
  const [announcements, resources] = await Promise.all([
    listEducatorAnnouncements([program.id]),
    listEducatorResources([program.id]),
  ])

  return shell(
    <>
      {/* The assignment context, stated rather than implied. An educator
          reading a roster must be able to see at a glance which program's
          roster it is. */}
      <header className="flex flex-col gap-[var(--hsh-space-3)]">
        <div className="flex flex-wrap items-center gap-[var(--hsh-space-3)]">
          <h1 className="hsh-display-lg m-0 text-[var(--hsh-text-primary)]">
            {program.name}
          </h1>
          <PublicationBadge state={program.publicationState} />
        </div>
        <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
          You are assigned to this program. This view is read-only.
        </p>
        {program.summary ? (
          <p className="hsh-body-lg m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            {program.summary}
          </p>
        ) : null}
      </header>

      <section
        aria-labelledby="summary-heading"
        className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
      >
        <h2
          id="summary-heading"
          className="hsh-h4 m-0 text-[var(--hsh-text-primary)]"
        >
          Program summary
        </h2>
        <dl className="grid grid-cols-1 gap-[var(--hsh-space-4)] sm:grid-cols-2">
          {[
            { label: "Format", value: program.format },
            { label: "Ages", value: program.audience },
            { label: "Location", value: program.location },
            { label: "Educator", value: program.educator },
          ]
            /* An unpublished fact is omitted, never rendered as a term with
               nothing after it (QA-005). */
            .filter((fact) => fact.value)
            .map((fact) => (
              <div
                key={fact.label}
                className="flex flex-col gap-[var(--hsh-space-1)]"
              >
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  {fact.label}
                </dt>
                <dd className="hsh-body m-0 text-[var(--hsh-text-primary)]">
                  {fact.value}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      <h2 className="hsh-h3 m-0 text-[var(--hsh-text-primary)]">Schedule</h2>
      <ScheduleSection
        program={program}
        headingId="detail-schedule"
        headingLevel="h3"
      />

      <h2 className="hsh-h3 m-0 text-[var(--hsh-text-primary)]">Roster</h2>
      <Suspense fallback={<ListSkeleton label="Loading the roster" rows={3} />}>
        <EducatorRosterSection
          programId={program.id}
          programName={program.name}
          headingId="detail-roster"
          headingLevel="h3"
        />
      </Suspense>

      <section
        aria-labelledby="detail-announcements"
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)]">
          <h2
            id="detail-announcements"
            className="hsh-h3 m-0 text-[var(--hsh-text-primary)]"
          >
            Announcements
          </h2>
          {/* Authoring is reached from the program's own page, where the
              program is already decided. The link is not a permission — the
              route it opens re-derives authority from the viewer's own
              assignments and answers 404 if they do not hold this program. */}
          <Button
            render={
              <Link
                href={`/educator/programs/${program.id}/announcements/new`}
              />
            }
            variant="primary"
            size="md"
          >
            New announcement
          </Button>
        </div>
        {announcements.status !== "ready" ? (
          <ReadFailure
            status={announcements.status}
            subject="This program's announcements"
          />
        ) : (
          <AnnouncementList
            items={announcements.items}
            showProgramName={false}
            manageBase={`/educator/programs/${program.id}`}
            emptyTitle="No announcements for this program"
            emptyBody="Nothing has been posted for this program yet. Compose the first one above — it stays a draft until you publish it."
          />
        )}
      </section>

      <section
        aria-labelledby="detail-resources"
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)]">
          <h2
            id="detail-resources"
            className="hsh-h3 m-0 text-[var(--hsh-text-primary)]"
          >
            Resources
          </h2>
          <Button
            render={
              <Link href={`/educator/programs/${program.id}/resources/new`} />
            }
            variant="primary"
            size="md"
          >
            New resource
          </Button>
        </div>
        {resources.status !== "ready" ? (
          <ReadFailure
            status={resources.status}
            subject="This program's resources"
          />
        ) : (
          <ResourceList
            items={resources.items}
            showProgramName={false}
            manageBase={`/educator/programs/${program.id}`}
            emptyTitle="No resources for this program"
            emptyBody="No learning resources have been added for this program yet. Add the first one above — it stays a draft until you publish it."
          />
        )}
      </section>
    </>,
    program.name,
  )
}
