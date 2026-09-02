import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { EnrollForm } from "@/components/family/enroll-form"
import { PortalNav } from "@/components/layout/portal-nav"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { AvailabilityBadge } from "@/components/program/availability-badge"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { contact, guidanceHref } from "@/content/foundation-content"
import { requireRole } from "@/lib/auth/guards"
import { getEnrollableProgram } from "@/lib/enrollment/repository"
import { getFamilyState } from "@/lib/family/repository"

/**
 * Register a student for a program (MPS-REQ-012, MPS-WFL-003, MPS-ACC-018).
 *
 * WHAT THIS PAGE CHECKS, AND WHAT IT DOES NOT
 *
 * It checks only what it needs in order not to walk a parent into a dead end:
 * do they have a family, do they have a student, and is the program readable
 * and open. Every one of those is checked AGAIN by
 * `public.family_request_enrollment` on a locked row, along with capacity,
 * waitlist, confirmation mode, and duplicates. Nothing here is the control —
 * this page is a courtesy, and the database is the boundary.
 *
 * WHY THE PROGRAM IS READ BY SLUG
 *
 * A slug is public. A program id in a form body would be a value the browser
 * supplies and the server trusts, and there is no reason to introduce one.
 *
 * NO PAYMENT PATH APPEARS ANYWHERE ON THIS PAGE. The external checkout handoff
 * belongs to the enrollment that a successful eligible registration produces
 * (MPS-REQ-013), never to the form that asks for one.
 */
export const metadata: Metadata = {
  title: "Register a student — Home School Haven of SWFL",
}

export default async function EnrollPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const viewer = await requireRole("parent", `/family/enroll/${slug}`)

  const [familyState, programState] = await Promise.all([
    getFamilyState(),
    getEnrollableProgram(slug),
  ])

  if (familyState.status === "incomplete") redirect("/family/setup")
  if (programState.status === "missing") notFound()

  const program = programState.status === "ready" ? programState.program : null
  const students = familyState.status === "ready" ? familyState.students : []

  return (
    <>
      <SiteHeader />
      <PortalNav viewer={viewer} area="family" />
      <main
        id="main"
        className="hsh-container hsh-container-public flex flex-1 flex-col gap-[var(--hsh-space-8)] py-[var(--hsh-space-12)]"
      >
        <header className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-3)]">
          <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
            Register a student
          </h1>
          {program ? (
            <>
              <p className="hsh-body text-[var(--hsh-text-secondary)]">
                {program.name}
                {program.publishedSchedule
                  ? ` — ${program.publishedSchedule}`
                  : ""}
              </p>
              <AvailabilityBadge state={program.availability} />
            </>
          ) : null}
        </header>

        <div className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-6)]">
          {familyState.status !== "ready" || programState.status !== "ready" ? (
            /* Not "no programs": the read did not happen. Rendering an empty
               form here would invite a registration nothing could accept. */
            <Alert tone="warning" title="This program could not be loaded">
              <p>
                Nothing was registered. Try again in a moment, or call{" "}
                {contact.phone} and Home School Haven will register your child
                with you.
              </p>
            </Alert>
          ) : program && program.availability === "closed" ? (
            /* MPS-RUL-002. The form is not rendered at all rather than rendered
               and refused: there is nothing useful a parent could submit. */
            <Alert tone="warning" title="Registration is closed">
              <p>
                Home School Haven is not taking registrations for {program.name}{" "}
                right now.{" "}
                <Link href={guidanceHref} data-inline-link="true">
                  Ask us about other options
                </Link>
                , or call {contact.phone}.
              </p>
            </Alert>
          ) : students.length === 0 ? (
            <Alert tone="info" title="Add a student first">
              <p>
                A registration belongs to one student. Add the student you are
                registering, then come back here.
              </p>
              <p>
                <Button
                  variant="secondary"
                  size="md"
                  render={<Link href="/family/students/new" />}
                >
                  Add a student
                </Button>
              </p>
            </Alert>
          ) : program ? (
            <EnrollForm program={program} students={students} />
          ) : null}
        </div>

        <Link
          href={`/programs/${slug}`}
          className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center self-start rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
        >
          Back to the program
        </Link>
      </main>
      <SiteFooter />
    </>
  )
}
