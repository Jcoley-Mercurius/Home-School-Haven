import { randomUUID } from "node:crypto"
import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ReviewDataBanner } from "@/components/family/section-states"
import { FamilyPortalShell } from "@/components/layout/family-portal-shell"
import { RegistrationForm } from "@/components/registration/registration-form"
import { RegistrationSkeleton } from "@/components/registration/registration-skeleton"
import { Alert } from "@/components/ui/alert"
import { contact } from "@/content/foundation-content"
import { requireRole } from "@/lib/auth/guards"
import { getFamilyState, type Student } from "@/lib/family/repository"
import { getRegistrationCatalog } from "@/lib/registration/repository"

/**
 * Family registration (MPS-WFL-002/003, MPS-REQ-012/014; DEC-026 to DEC-033;
 * MDS DESIGN-SYSTEM §9.1, MDS-DEC-023/024).
 *
 * One route, eight steps, one atomic submission. Moving between steps writes
 * nothing: the draft lives in the browser's memory until "Submit registration",
 * and then `public.submit_family_registration` records all of it or none of it.
 *
 * WHERE AUTHORIZATION LIVES
 *
 * `requireRole("parent")` decides whether this page renders: a signed-out
 * visitor goes to sign-in and comes back, and an educator gets a 404. The
 * catalog reads run under the parent's own RLS. The action re-checks the role,
 * and the database function decides everything else from `auth.uid()`. The
 * only value this page reads from the URL is `?program=`, a public slug, and it
 * only preselects a program that the catalog already contains.
 *
 * WHY SUSPENSE AND NOT loading.tsx
 *
 * Same reason as the family dashboard: a route-level `loading.tsx` streams the
 * 200 before the guard runs, so an educator would stop getting a 404. The guard
 * and the family read resolve first, and only the catalog suspends.
 *
 * THE ATTEMPT KEY
 *
 * Generated here, once per page render, and held by the form for the life of
 * the page. Every submit and retry reuses it, which is what lets
 * `submit_family_registration` replay an attempt that committed but whose answer
 * was lost, instead of recording it twice (MPS-REQ-014, MPS-ACC-023). It is
 * random and says nothing about the family.
 */
export const metadata: Metadata = {
  title: "Family Registration — Home School Haven of SWFL",
}

async function RegistrationLoader({
  students,
  requestedProgram,
  guardianName,
  guardianEmail,
}: {
  students: Student[]
  requestedProgram: string | null
  guardianName: string
  guardianEmail: string
}) {
  const state = await getRegistrationCatalog()

  if (state.status !== "ready") {
    /* The catalog is the list of what can be registered for. Rendering the
       form without it would invite a registration nothing could accept. */
    return (
      <Alert
        tone="warning"
        title="Registration could not be loaded"
        className="max-w-[var(--hsh-content-reading)]"
      >
        <p>
          {state.status === "unavailable"
            ? "Registration is not connected in this review environment yet."
            : "We could not load the programs and registration documents just now. Nothing was submitted. Please refresh in a moment."}{" "}
          You can also call {contact.phone} and Home School Haven will register
          your family with you.
        </p>
      </Alert>
    )
  }

  const initialProgramId =
    state.catalog.programs.find((p) => p.slug === requestedProgram)?.id ?? null

  return (
    <RegistrationForm
      catalog={state.catalog}
      students={students.map((s) => ({
        id: s.id,
        preferredName: s.preferredName,
      }))}
      attemptKey={randomUUID()}
      initialProgramId={initialProgramId}
      guardianName={guardianName}
      guardianEmail={guardianEmail}
    />
  )
}

export default async function FamilyRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>
}) {
  const viewer = await requireRole("parent", "/family/registration")
  const family = await getFamilyState()

  /* No family is a setup state. Registration belongs to a family, so the one
     action that resolves it comes first. */
  if (family.status === "incomplete") redirect("/family/setup")

  const { program } = await searchParams
  const requestedProgram =
    typeof program === "string" && /^[a-z0-9-]{1,80}$/.test(program)
      ? program
      : null

  return (
    <FamilyPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <header className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Family Registration
          </h1>
          <p className="hsh-body-lg text-[var(--hsh-text-secondary)]">
            Register one or more children for Home School Haven programs in one
            form. Nothing is sent until you choose Submit registration on the
            last step.
          </p>
        </header>

        {family.status === "ready" ? (
          <Suspense fallback={<RegistrationSkeleton />}>
            <RegistrationLoader
              students={family.students}
              requestedProgram={requestedProgram}
              guardianName={viewer.displayName ?? ""}
              guardianEmail={viewer.email ?? ""}
            />
          </Suspense>
        ) : (
          <Alert
            tone="warning"
            title="Registration could not be loaded"
            className="max-w-[var(--hsh-content-reading)]"
          >
            <p>
              {family.status === "unavailable"
                ? "Family records are not connected in this review environment yet."
                : "We could not load your family details just now. Nothing was submitted. Please refresh in a moment."}
            </p>
          </Alert>
        )}
      </main>
    </FamilyPortalShell>
  )
}
