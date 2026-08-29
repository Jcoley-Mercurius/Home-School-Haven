import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { StudentForm } from "@/components/family/student-form"
import { PortalNav } from "@/components/layout/portal-nav"
import { requireRole } from "@/lib/auth/guards"
import { getFamilyState } from "@/lib/family/repository"

/**
 * Add a demo student profile (deviation D-FF1).
 *
 * A parent with no family is sent to setup first: a student profile belongs to
 * a family, and the database derives that family from the session rather than
 * from anything this page could pass along.
 */
export const metadata: Metadata = {
  title: "Add a student — Home School Haven of SWFL",
}

export default async function NewStudentPage() {
  const viewer = await requireRole("parent", "/family/students/new")
  const state = await getFamilyState()

  if (state.status === "incomplete") redirect("/family/setup")

  return (
    <>
      <PortalNav viewer={viewer} area="family" />
      <main
        id="main"
        className="hsh-container hsh-container-public flex flex-1 flex-col gap-[var(--hsh-space-8)] py-[var(--hsh-space-12)]"
      >
        <header className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-3)]">
          <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
            Add a student
          </h1>
          <p className="hsh-body text-[var(--hsh-text-secondary)]">
            You manage every student in your family. Home School Haven asks for
            as little as it can.
          </p>
        </header>

        <div className="max-w-[var(--hsh-content-reading)]">
          <StudentForm />
        </div>

        <Link
          href="/family"
          className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center self-start rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
        >
          Back to your family
        </Link>
      </main>
    </>
  )
}
