import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ExternalLink } from "lucide-react"

import { ProgramFactsForm } from "@/components/admin/program-form"
import { ListSkeleton } from "@/components/admin/list-skeleton"
import { RosterSection } from "@/components/admin/roster-section"
import { CapacitySection } from "@/components/admin/capacity-section"
import { ScheduleSection } from "@/components/admin/schedule-section"
import { PublicationActions } from "@/components/admin/program-publication-actions"
import { PublicationBadge } from "@/components/admin/publication-state"
import { AvailabilityBadge } from "@/components/program/availability-badge"
import {
  ReviewDataBanner,
  SectionError,
} from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Alert } from "@/components/ui/alert"
import { TextLink } from "@/components/ui/text-link"
import { requireAdmin } from "@/lib/auth/guards"
import { getAdminProgram } from "@/lib/admin/programs"

/**
 * Program detail and the approved editing actions (ACT-004, ACT-006;
 * MPS-REQ-008/013/016/020/021/024; MPS-RUL-005; MDS `patterns.detail`,
 * `patterns.forms`, MDS-REF-009).
 *
 * THE ROUTE PARAMETER IS UNTRUSTED, AND NOTHING TREATS IT OTHERWISE
 *
 * `programId` comes from the URL. Two things make that safe, and they are
 * different things:
 *
 *   * A well-formed id belonging to a program this viewer may not see returns
 *     `notFound()`, exactly as an id that never existed does. RLS decides that,
 *     not this page, and the response never confirms whether a record exists to
 *     someone who may not have it.
 *   * A value that is not a UUID at all is rejected before the read. Without
 *     that, PostgREST answers with a type error, the read reports "failed", and
 *     the page renders a 200 saying the program could not be loaded — which
 *     tells a prober that the route exists and reached the database. It is a
 *     404, like every other unfindable program (DEFECT-PE3).
 *
 * Authorization is decided twice and independently: `requireAdmin()` here, and
 * `private.is_admin()` inside every function that writes.
 *
 * NO SUSPENSE BOUNDARY ON THIS PAGE
 *
 * Unlike the list, this page cannot render a useful shell before its read
 * resolves — the heading, the forms, and the available actions all depend on
 * the row. Awaiting the read before returning also keeps `notFound()` able to
 * set the response status, which a streamed response would have already sent.
 */
export const metadata: Metadata = {
  title: "Program — Operations — Home School Haven of SWFL",
}

/** Any RFC 4122 UUID. Shape only; the database decides whether it exists. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AdminProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { programId } = await params
  const viewer = await requireAdmin(`/admin/programs/${programId}`)

  /* Shape first, before anything is asked of the database. */
  if (!UUID.test(programId)) notFound()

  const justCreated = (await searchParams).created === "1"

  const result = await getAdminProgram(programId)

  if (result.status === "notFound") notFound()

  const shell = (children: React.ReactNode) => (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        {children}
      </main>
    </AdminPortalShell>
  )

  if (result.status === "unavailable" || result.status === "failed") {
    return shell(
      <>
        <ReviewDataBanner />
        <Breadcrumbs
          trail={[
            { label: "Operations", href: "/admin" },
            { label: "Programs", href: "/admin/programs" },
            { label: "Program" },
          ]}
        />
        <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
          Program
        </h1>
        <SectionError>
          {result.status === "unavailable"
            ? "Programs are not available in this environment because no Supabase project is configured."
            : "This program could not be loaded. Nothing has changed — reload the page to try again."}
        </SectionError>
      </>,
    )
  }

  const program = result.data

  return shell(
    <>
      <ReviewDataBanner />

      <Breadcrumbs
        trail={[
          { label: "Operations", href: "/admin" },
          { label: "Programs", href: "/admin/programs" },
          { label: program.name },
        ]}
      />

      {justCreated ? (
        <Alert tone="success" title="Draft created" live="polite">
          Add the published details below. The program stays invisible to
          families and visitors until you publish it.
        </Alert>
      ) : null}

      <header className="flex flex-col gap-[var(--hsh-space-3)]">
        <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
          {program.name}
        </h1>
        <div className="flex flex-wrap items-center gap-[var(--hsh-space-3)]">
          <PublicationBadge state={program.publicationState} />
          <AvailabilityBadge state={program.availability} />
          {program.educatorAssigned ? null : (
            <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              No educator assigned
            </span>
          )}
        </div>
        {program.publicationState === "published" ? (
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            <TextLink href={`/programs/${program.slug}`}>
              View the public page families see
              <ExternalLink
                aria-hidden="true"
                className="ml-[var(--hsh-space-1)] inline size-4"
                strokeWidth={1.75}
              />
            </TextLink>
          </p>
        ) : (
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            This program is not in the public catalog, so it has no public page.
          </p>
        )}
      </header>

      {program.needsContentReview ? (
        <Alert tone="warning" title="This program needs content review">
          Its imported details were flagged as ambiguous in the beta content
          inventory. Confirm them against Home School Haven&rsquo;s published
          material before publishing.
        </Alert>
      ) : null}

      <PublicationActions program={program} />

      <section
        aria-labelledby="details-heading"
        className="flex flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
      >
        <h2
          id="details-heading"
          className="hsh-h4 text-[var(--hsh-text-primary)]"
        >
          Program details
        </h2>
        <ProgramFactsForm program={program} />
      </section>

      {/* Each of the three sections below streams separately from the program
          facts and from one another: every one is its own authorized read, and
          a slow or failed schedule must cost this page its schedule rather than
          the form an administrator came here to use. */}
      <Suspense
        fallback={<ListSkeleton label="Loading the schedule" rows={3} />}
      >
        <ScheduleSection programId={program.id} programName={program.name} />
      </Suspense>

      <Suspense fallback={<ListSkeleton label="Loading capacity" rows={2} />}>
        <CapacitySection program={program} />
      </Suspense>

      <Suspense fallback={<ListSkeleton label="Loading the roster" rows={3} />}>
        <RosterSection programId={program.id} programName={program.name} />
      </Suspense>

      <p className="hsh-body-sm max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
        Scholarships, discounts, refunds, credits, and transfers are not managed
        here: every financial decision remains an offline matter under Home
        School Haven&rsquo;s existing policy, and nothing on this page decides
        or issues one. Capacity above is a number an administrator sets; it
        creates and removes no enrollment. Educator assignments for this program
        are managed from <TextLink href="/admin/educators">Educators</TextLink>,
        and enrollment records — including moving a waitlisted record to
        confirmed — from{" "}
        <TextLink href="/admin/enrollments">Enrollments</TextLink>.
      </p>
    </>,
  )
}
