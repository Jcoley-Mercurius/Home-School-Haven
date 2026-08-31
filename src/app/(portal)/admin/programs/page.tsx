import { Suspense } from "react"
import Link from "next/link"
import type { Metadata } from "next"
import { Plus } from "lucide-react"

import { ProgramFilterBar } from "@/components/admin/program-filters"
import { ProgramList } from "@/components/admin/program-list"
import { ListSkeleton } from "@/components/admin/list-skeleton"
import {
  EmptyState,
  ReviewDataBanner,
  SectionError,
} from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Button } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth/guards"
import { matchesSearch, parseProgramFilters } from "@/lib/admin/filters"
import { listAdminPrograms } from "@/lib/admin/programs"

import type { RawParams } from "@/lib/admin/filters"

/**
 * Program operations list (ACT-004, ACT-006; MPS-REQ-016/020/021/023;
 * MDS `page_shells.admin_operations`, `patterns.search_results`, MDS-REF-009).
 *
 * AUTHORIZATION, TWICE, INDEPENDENTLY
 *
 * `requireAdmin()` decides whether this page renders at all: signed out →
 * sign-in carrying the destination; signed in without an `admin` or `owner`
 * grant → `notFound()`, a 404 that does not confirm an administrator area
 * exists here. RLS then decides independently what `listAdminPrograms()`
 * returns, and it would return only published rows to anyone else. Neither
 * control depends on the other.
 *
 * The role is read from `public.user_roles` on every request and is never
 * cached in a cookie or token claim, so revoking a grant denies the very next
 * request.
 *
 * WHY FILTERING HAPPENS AFTER THE READ
 *
 * `searchParams` is whatever someone typed into the address bar. It never
 * reaches a query: the read returns the rows RLS authorizes, and the filters
 * narrow that list in memory. A filter that never becomes part of a query
 * cannot widen one, and a malformed value falls back to "all" rather than to an
 * error page.
 */
export const metadata: Metadata = {
  title: "Programs — Operations — Home School Haven of SWFL",
}

/**
 * The authorized read and the list it feeds.
 * @param filters - The parsed, validated filters.
 * @returns The list section.
 */
async function ProgramSection({
  filters,
}: {
  filters: ReturnType<typeof parseProgramFilters>
}) {
  const result = await listAdminPrograms()

  if (result.status === "unavailable") {
    return (
      <SectionError>
        Programs are not available in this environment because no Supabase
        project is configured. This is a setup state, not an empty catalog.
      </SectionError>
    )
  }

  if (result.status === "failed") {
    return (
      <SectionError>
        Programs could not be loaded. Nothing has changed — reload the page to
        try again.
      </SectionError>
    )
  }

  const all = result.data
  const programs = all.filter(
    (program) =>
      (filters.status === "all" ||
        program.publicationState === filters.status) &&
      matchesSearch(program.name, filters.search),
  )

  /* Empty database and no filter results are different facts and get different
     words. One is "there is nothing here yet"; the other is "your filters
     excluded everything", and only the second has an obvious next action. */
  if (all.length === 0) {
    return (
      <EmptyState title="No programs yet">
        <p>
          The catalog is empty. Create a draft to begin — a draft is not visible
          to families or visitors until it is published.
        </p>
        <Button
          variant="primary"
          size="md"
          render={<Link href="/admin/programs/new" />}
        >
          <Plus aria-hidden="true" strokeWidth={1.75} />
          New program draft
        </Button>
      </EmptyState>
    )
  }

  if (programs.length === 0) {
    return (
      <EmptyState title="No programs match these filters">
        <p>
          {all.length} {all.length === 1 ? "program exists" : "programs exist"},
          but none matches the current search and status.
        </p>
        {/* Deliberately not "Clear filters": the filter bar above already has
            a control with that name, and two identical links to the same place
            read as one repeated control to anyone navigating by link list. */}
        <Button
          variant="secondary"
          size="md"
          render={<Link href="/admin/programs" />}
        >
          Show all programs
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--hsh-space-3)]">
      {/* An announced count, so a filter change is perceivable to someone who
          cannot see the list shorten. */}
      <p role="status" className="hsh-body-sm text-[var(--hsh-text-secondary)]">
        Showing {programs.length} of {all.length}{" "}
        {all.length === 1 ? "program" : "programs"}.
      </p>
      <ProgramList programs={programs} />
    </div>
  )
}

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const viewer = await requireAdmin("/admin/programs")
  const filters = parseProgramFilters(await searchParams)

  return (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <Breadcrumbs
          trail={[
            { label: "Operations", href: "/admin" },
            { label: "Programs" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-4)] sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
              Programs
            </h1>
            <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              Every program, at every publication state. Only an administrator
              or Samantha publishes a program, a price, or a registration
              change.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            render={<Link href="/admin/programs/new" />}
          >
            <Plus aria-hidden="true" strokeWidth={1.75} />
            New program draft
          </Button>
        </header>

        <ProgramFilterBar filters={filters} />

        <Suspense
          /* Keyed on the filters so changing them shows the skeleton again
             rather than leaving the previous result on screen looking current. */
          key={`${filters.status}:${filters.search}`}
          fallback={<ListSkeleton label="Loading programs" rows={5} />}
        >
          <ProgramSection filters={filters} />
        </Suspense>
      </main>
    </AdminPortalShell>
  )
}
