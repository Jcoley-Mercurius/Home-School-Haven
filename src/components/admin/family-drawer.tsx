"use client"

import { EnrollmentStateBadge } from "@/components/enrollment/enrollment-state"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPopup,
} from "@/components/ui/dialog"

import type { AdminFamily, AdminFamilyDataGap } from "@/lib/admin/families"

/**
 * The family detail drawer (MDS `page_shells.admin_operations` detail drawer,
 * `components.dialog`; MPS-REQ-017, MPS-ACC-003).
 *
 * THERE IS NOTHING TO PRESS HERE, AND THAT IS THE DESIGN
 *
 * This drawer has one control: Close. A family account and its student profiles
 * belong to the parent (ACT-001), and an administrator seeing them in an
 * operations interface acquires no authority over them. Checklist §11 — how a
 * correction is requested, who approves a deletion, what is retained after a
 * family leaves — is unanswered, so there is no approved edit to offer
 * (GAP-ADMIN-009/010/011). Rendering a disabled Edit button would be worse than
 * rendering none: it would suggest the capability exists and is merely
 * withheld.
 *
 * Enrollment states are shown, and the one action available on them is a link
 * to `/admin/enrollments`, where that decision already lives with its
 * transition rules, its mandatory note, and its audit trail. Duplicating it
 * here would be a second place to get an enrollment wrong.
 *
 * WHAT CONSENT ACTUALLY SAYS TODAY
 *
 * MPS-ACC-003 requires an administrator to see the accepted policy version and
 * acceptance time. The panel below reads the real columns and would show a real
 * version the moment one exists. While MPS GAP-005 leaves the consent language
 * unconfirmed, every row carries the demo placeholder, so what it truthfully
 * reports is that no approved consent has been accepted. Printing
 * `demo-unapproved-v0` next to the word "Consent" would read as a consent
 * record to anyone skimming, which is the opposite of the criterion's purpose.
 *
 * WHAT IS NOT SHOWN, BECAUSE IT IS NOT READ
 *
 * No guardian email or phone, no assistance-request detail, no medical,
 * behavioral, accommodation, demographic, or date-of-birth field. Most of those
 * have no column to read (MPS-RUL-006); the contact details exist in
 * `auth.users` and this surface has no service-role reach to them.
 */
function FamilyDrawer({
  family,
  gaps,
  onClose,
}: {
  family: AdminFamily | null
  gaps: AdminFamilyDataGap[]
  onClose: () => void
}) {
  /* Same shape as the enrollment drawer: one reused instance, rendered only
     when something is selected, so no family's detail sits in the DOM while
     the drawer is closed. */
  if (!family) return null

  const guardianRoleLabel = (
    role: AdminFamily["guardians"][number]["memberRole"],
  ) => (role === "primary_guardian" ? "Primary guardian" : "Invited guardian")

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup size="panel">
        <DialogHeader
          title={family.name}
          description="Family account detail. This information is controlled by the family's parent or guardian and is not editable here."
          closeLabel="Close family detail"
        />

        {/* `tabIndex` and a label on the scrollable region, because this
            drawer is the one modal in the product with NO focusable content:
            it is read-only by design, so it holds no button, link, or field a
            keyboard user could tab into and scroll from. Without this, a
            keyboard-only or screen-reader user can open the drawer and be
            unable to read past the fold — axe flags it "serious", and it is.
            Every other dialog here has controls and needs neither attribute. */}
        <DialogBody
          tabIndex={0}
          role="group"
          aria-label={`${family.name} account detail`}
        >
          <div className="flex flex-col gap-[var(--hsh-space-6)]">
            {/* Guardians ------------------------------------------- */}
            <section className="flex flex-col gap-[var(--hsh-space-3)]">
              <h3 className="hsh-heading-sm m-0 text-[var(--hsh-text-primary)]">
                Parents and guardians
              </h3>

              {gaps.includes("guardians") ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  Guardian information could not be loaded. Reload the page to
                  try again.
                </p>
              ) : family.guardians.length === 0 ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  No guardian account is linked to this family yet.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-[var(--hsh-space-2)] p-0">
                  {family.guardians.map((guardian) => (
                    <li
                      key={guardian.userId}
                      className="flex flex-col gap-[var(--hsh-space-1)]"
                    >
                      <span className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                        {guardian.displayName || "Name not available"}
                      </span>
                      <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                        {guardianRoleLabel(guardian.memberRole)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Students -------------------------------------------- */}
            <section className="flex flex-col gap-[var(--hsh-space-3)]">
              <h3 className="hsh-heading-sm m-0 text-[var(--hsh-text-primary)]">
                Students
              </h3>

              {gaps.includes("students") ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  Student information could not be loaded. Reload the page to
                  try again.
                </p>
              ) : family.students.length === 0 ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  This family has not added a student profile yet. Only the
                  family&rsquo;s parent or guardian can add one.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0">
                  {family.students.map((student) => (
                    <li
                      key={student.id}
                      className="flex flex-col gap-[var(--hsh-space-1)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-3)]"
                    >
                      <span className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                        {student.preferredName}
                      </span>
                      <dl className="m-0 flex flex-wrap gap-x-[var(--hsh-space-4)] gap-y-[var(--hsh-space-1)]">
                        <div className="flex gap-[var(--hsh-space-2)]">
                          <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                            Grade
                          </dt>
                          <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                            {student.gradeLevel ?? "Not recorded"}
                          </dd>
                        </div>
                        <div className="flex gap-[var(--hsh-space-2)]">
                          <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                            Relationship
                          </dt>
                          <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                            {student.guardianRelationship ?? "Not recorded"}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Enrollments ----------------------------------------- */}
            <section className="flex flex-col gap-[var(--hsh-space-3)]">
              <h3 className="hsh-heading-sm m-0 text-[var(--hsh-text-primary)]">
                Enrollments
              </h3>

              {gaps.includes("enrollments") ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  Enrollment information could not be loaded. Reload the page to
                  try again.
                </p>
              ) : family.enrollments.length === 0 ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  This family has no enrollments.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0">
                  {family.enrollments.map((enrollment) => (
                    <li
                      key={enrollment.id}
                      className="flex flex-col gap-[var(--hsh-space-2)]"
                    >
                      <span className="hsh-body-sm text-[var(--hsh-text-primary)]">
                        {enrollment.studentName || "Student not available"}
                        {" — "}
                        {enrollment.program?.name ?? "Program not available"}
                      </span>
                      <EnrollmentStateBadge state={enrollment.state} />
                    </li>
                  ))}
                </ul>
              )}

              <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                Enrollment states are changed on the Enrollments page, where
                each decision is recorded with a reason.
              </p>
            </section>

            {/* Consent --------------------------------------------- */}
            <section className="flex flex-col gap-[var(--hsh-space-3)]">
              <h3 className="hsh-heading-sm m-0 text-[var(--hsh-text-primary)]">
                Consent
              </h3>

              {gaps.includes("students") ? (
                <Alert tone="warning" title="Consent information unavailable">
                  Student information could not be loaded, so consent records
                  cannot be reported. Reload the page to try again.
                </Alert>
              ) : family.students.every(
                  (student) => !student.consentApproved,
                ) ? (
                <Alert tone="info" title="No approved consent record">
                  <p className="m-0">
                    Home School Haven has not yet approved the parent authority
                    and consent language for the platform, so these student
                    profiles carry a placeholder affirmation rather than an
                    accepted policy. Accepted policy versions and acceptance
                    times appear here once that language is approved.
                  </p>
                </Alert>
              ) : (
                <ul className="flex list-none flex-col gap-[var(--hsh-space-2)] p-0">
                  {family.students.map((student) => (
                    <li key={student.id} className="hsh-body-sm">
                      <span className="font-semibold">
                        {student.preferredName}
                      </span>
                      {": "}
                      {student.consentApproved
                        ? `${student.affirmationVersion}, accepted ${new Date(student.affirmedAt).toLocaleDateString()}`
                        : "No approved consent record"}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="secondary" size="md" type="button">
                Close
              </Button>
            }
          />
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}

export { FamilyDrawer }
