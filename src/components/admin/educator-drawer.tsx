"use client"

import { useActionState, useId, useState } from "react"
import { CircleCheck, CircleSlash, Plus } from "lucide-react"

import {
  assignEducatorAction,
  unassignEducatorAction,
} from "@/app/(portal)/admin/educators/actions"
import { emptyAssignmentActionFormState } from "@/app/(portal)/admin/educators/form-state"
import { PublicationBadge } from "@/components/admin/publication-state"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { NOTE_MAX } from "@/lib/admin/validation"

import type { AdminEducator } from "@/lib/admin/educators"
import type { AssignableProgram } from "@/components/admin/educator-list"

/**
 * The educator detail drawer and the two approved assignment actions
 * (MPS-REQ-017, MPS-REQ-021, MPS-REQ-024; MPS-WFL-005, MPS-WFL-006;
 * MDS `page_shells.admin_operations` detail drawer, `components.dialog`).
 *
 * THE TWO OPERATIONS THIS RELEASE GRANTS OVER AN EDUCATOR
 *
 * Assign them to a program, and remove that assignment. Nothing else. There is
 * no invite, no activate, no suspend, no promote, no delete — not disabled, not
 * hidden behind a permission, simply absent, because no approved authority
 * exists for any of them and a greyed-out control would suggest the capability
 * exists and is merely withheld. §9 of the owner policy checklist is what these
 * wait on (GAP-ADMIN-012/013).
 *
 * WHAT AN ASSIGNMENT ACTUALLY DOES, IN THE WORDS THE ADMINISTRATOR READS
 *
 * It grants read scope over one program: its record, its enrollments, its
 * announcements and resources, and the children with a confirmed enrollment on
 * it. The confirmation dialog says exactly that, because "Assign" on its own
 * does not tell an administrator they are handing someone access to children's
 * names.
 *
 * REASSIGNMENT IS REMOVE THEN ASSIGN, AND THE DRAWER SAYS SO
 *
 * A program may carry several educators, so there is no single assignment for a
 * "reassign" to replace. Two explicit operations produce two attributable audit
 * events that say what actually happened, rather than one that glosses it.
 *
 * REMOVAL TAKES EFFECT IMMEDIATELY, AND THE DIALOG SAYS SO
 *
 * Every policy that depends on assignment evaluates it per statement, so a
 * removed educator loses the program on their next request with no sign-out. An
 * administrator removing access during an incident needs to know that without
 * having to ask.
 *
 * A DUPLICATE SUBMISSION IS NOT AN ERROR
 *
 * Submitting an assignment that already exists reports "already assigned" in
 * the information tone, not the warning one. Nothing was written, no second
 * audit row was created, and the administrator's intent is already true — that
 * is a reassurance, not a failure.
 */
function EducatorDrawer({
  educator,
  programs,
  onClose,
}: {
  educator: AdminEducator | null
  /** Every non-archived program, for the assignment control. */
  programs: AssignableProgram[]
  onClose: () => void
}) {
  const [assignState, assignAction, assignPending] = useActionState(
    assignEducatorAction,
    emptyAssignmentActionFormState,
  )
  const [removeState, removeAction, removePending] = useActionState(
    unassignEducatorAction,
    emptyAssignmentActionFormState,
  )
  const [removing, setRemoving] = useState<AssignableProgram | null>(null)
  const [chosenProgram, setChosenProgram] = useState("")

  const programFieldId = useId()
  const assignNoteId = useId()
  const assignHintId = useId()
  const removeNoteId = useId()
  const removeHintId = useId()

  /* React's "adjust state during render" pattern rather than an effect, so the
     confirmation dialog never flashes open over a settled result. */
  const [settled, setSettled] = useState(removeState)
  if (removeState !== settled) {
    setSettled(removeState)
    if (
      removeState.status === "unassigned" ||
      removeState.status === "unchanged"
    ) {
      setRemoving(null)
    }
  }

  if (!educator) return null

  /* An outcome from a different educator must not be shown against this one —
     the drawer is reused, and a stale success would attach a change to the
     wrong person. */
  const assigned = educator.assignments.map(
    (assignment) => assignment.programId,
  )
  const assignOutcome =
    assignState.educatorUserId === educator.userId ? assignState.status : "idle"
  const removeOutcome =
    removeState.educatorUserId === educator.userId ? removeState.status : "idle"

  /* Only programs the educator does not already hold. A control that offers a
     duplicate is a control that invites a no-op. */
  const available = programs.filter((program) => !assigned.includes(program.id))

  const outcomeMessage = (
    status: typeof assignOutcome,
    verb: "assigned" | "unassigned",
  ) => {
    switch (status) {
      case "assigned":
        return {
          tone: "success" as const,
          title: "Educator assigned",
          body: "They can now reach that program's roster, resources, and announcements. The change is recorded with your account and the time.",
        }
      case "unassigned":
        return {
          tone: "success" as const,
          title: "Assignment removed",
          body: "They lose access to that program on their next request. The change is recorded with your account and the time.",
        }
      case "unchanged":
        return {
          tone: "info" as const,
          title:
            verb === "assigned"
              ? "Already assigned"
              : "That assignment was already removed",
          body: "Nothing was changed and nothing was recorded, because the assignment was already the way you asked for it.",
        }
      case "notEligible":
        return {
          tone: "warning" as const,
          title: "That assignment is not allowed",
          body: "The account does not hold the educator role, or the program is archived. Nothing was changed.",
        }
      case "notFound":
        return {
          tone: "warning" as const,
          title: "That program could not be found",
          body: "Nothing was changed. Reload the page and try again.",
        }
      case "forbidden":
        return {
          tone: "warning" as const,
          title: "You are not authorized to change assignments",
          body: "Nothing was changed. Your session may have ended — reload the page.",
        }
      case "unavailable":
      case "failed":
        return {
          tone: "warning" as const,
          title: "That change could not be saved",
          body: "Nothing was changed. Reload the page and try again.",
        }
      default:
        return null
    }
  }

  const assignMessage = outcomeMessage(assignOutcome, "assigned")
  const removeMessage =
    removeOutcome === "unassigned" || removeOutcome === "unchanged"
      ? outcomeMessage(removeOutcome, "unassigned")
      : null

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup size="panel">
        <DialogHeader
          title={educator.displayName || "Name not available"}
          description="Educator detail and program assignments"
          closeLabel="Close educator detail"
        />

        <DialogBody>
          <div className="flex flex-col gap-[var(--hsh-space-6)]">
            {assignMessage ? (
              <Alert
                tone={assignMessage.tone}
                title={assignMessage.title}
                live="polite"
              >
                {assignMessage.body}
              </Alert>
            ) : null}

            {removeMessage ? (
              <Alert
                tone={removeMessage.tone}
                title={removeMessage.title}
                live="polite"
              >
                {removeMessage.body}
              </Alert>
            ) : null}

            {/* Account linkage ------------------------------------------ */}
            {!educator.accountLinked ? (
              <Alert tone="warning" title="No account is linked to this grant">
                This educator role is granted to an account with no profile.
                Assigning a program would grant access to nobody. Home School
                Haven has no educator invitation in this release, so the account
                is created outside the platform.
              </Alert>
            ) : null}

            {/* Current assignments -------------------------------------- */}
            <section className="flex flex-col gap-[var(--hsh-space-3)]">
              <h3 className="hsh-heading-sm m-0 text-[var(--hsh-text-primary)]">
                Assigned programs
              </h3>

              {educator.assignments.length === 0 ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  This educator is not assigned to any program, so they can
                  reach no roster, resource, or announcement.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-[var(--hsh-space-2)] p-0">
                  {educator.assignments.map((assignment) => (
                    <li
                      key={assignment.programId}
                      className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-3)]"
                    >
                      <div className="flex min-w-0 flex-col gap-[var(--hsh-space-1)]">
                        <span className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                          {assignment.programName}
                        </span>
                        <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                          Assigned{" "}
                          {new Date(assignment.assignedAt).toLocaleDateString()}
                        </span>
                        <PublicationBadge state={assignment.publicationState} />
                      </div>

                      <Button
                        variant="secondary"
                        size="md"
                        aria-label={`Remove ${educator.displayName || "this educator"} from ${assignment.programName}`}
                        onClick={() =>
                          setRemoving({
                            id: assignment.programId,
                            name: assignment.programName,
                          })
                        }
                      >
                        <CircleSlash aria-hidden="true" strokeWidth={1.75} />
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Assign --------------------------------------------------- */}
            <section className="flex flex-col gap-[var(--hsh-space-3)]">
              <h3 className="hsh-heading-sm m-0 text-[var(--hsh-text-primary)]">
                Assign to a program
              </h3>

              {available.length === 0 ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  {programs.length === 0
                    ? "There is no program available to assign. Archived programs cannot be assigned."
                    : "This educator is already assigned to every available program."}
                </p>
              ) : (
                <form
                  action={assignAction}
                  className="flex flex-col gap-[var(--hsh-space-4)]"
                >
                  <input
                    type="hidden"
                    name="educatorUserId"
                    value={educator.userId}
                  />

                  <Field
                    invalid={Boolean(
                      assignOutcome === "invalid" &&
                      assignState.fieldErrors.program,
                    )}
                  >
                    {/* A real label paired by id, exactly as the enrollment
                        filters do it. Base UI's Field does not register the
                        select trigger, and an `aria-label` alone left the
                        control unreachable by `getByLabel` — the same trap
                        `contact-form.tsx` documents for textareas. */}
                    <FieldLabel htmlFor={programFieldId}>Program</FieldLabel>
                    <Select
                      name="programId"
                      value={chosenProgram}
                      /* Base UI hands back `null` when the selection is
                         cleared; the form needs a string either way. */
                      onValueChange={(value) => setChosenProgram(value ?? "")}
                      items={[
                        { label: "Choose a program", value: "" },
                        ...available.map((program) => ({
                          label: program.name,
                          value: program.id,
                        })),
                      ]}
                    >
                      <SelectTrigger id={programFieldId}>
                        <SelectValue placeholder="Choose a program" />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError
                      match={Boolean(
                        assignOutcome === "invalid" &&
                        assignState.fieldErrors.program,
                      )}
                    >
                      {assignState.fieldErrors.program}
                    </FieldError>
                  </Field>

                  {/* Base UI's Field associates its label with a REGISTERED
                      Field control. A native <textarea> is not one, so the
                      explicit id/htmlFor is what gives it an accessible name —
                      same fix, same reason, as contact-form.tsx. */}
                  <Field
                    invalid={Boolean(
                      assignOutcome === "invalid" &&
                      assignState.fieldErrors.note,
                    )}
                  >
                    <FieldLabel htmlFor={assignNoteId}>
                      Reason (recorded)
                    </FieldLabel>
                    <FieldDescription id={assignHintId}>
                      Say why this educator is being given access to this
                      program. Do not include anything about a family or a
                      child.
                    </FieldDescription>
                    {/* No `required` attribute: native constraint validation
                        blocks the submit in the browser and shows a transient
                        bubble, so the server's refusal never renders and the
                        announced FieldError below is never reached. The note is
                        enforced on the server and again in SQL (22023). */}
                    <Textarea
                      id={assignNoteId}
                      name="note"
                      rows={3}
                      aria-required="true"
                      aria-describedby={assignHintId}
                      maxLength={NOTE_MAX}
                      defaultValue=""
                    />
                    <FieldError
                      match={Boolean(
                        assignOutcome === "invalid" &&
                        assignState.fieldErrors.note,
                      )}
                    >
                      {assignState.fieldErrors.note}
                    </FieldError>
                  </Field>

                  <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                    Assigning gives this educator the program&rsquo;s roster,
                    resources, and announcements, including the preferred names
                    of children with a confirmed enrollment. It grants no
                    pricing, availability, cancellation, or administrator
                    authority.
                  </p>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={assignPending}
                  >
                    {assignPending ? "Working…" : "Assign to program"}
                    <Plus aria-hidden="true" strokeWidth={1.75} />
                  </Button>
                </form>
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

        {/* Removal confirmation ---------------------------------------- */}
        {removing ? (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setRemoving(null)
            }}
          >
            <DialogPopup size="small">
              <form action={removeAction}>
                <input
                  type="hidden"
                  name="educatorUserId"
                  value={educator.userId}
                />
                <input type="hidden" name="programId" value={removing.id} />

                <DialogHeader
                  title={`Remove access to ${removing.name}?`}
                  closeLabel="Cancel"
                />

                <DialogBody>
                  <div className="hsh-body-sm flex flex-col gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
                    <p className="m-0">
                      {educator.displayName || "This educator"} will lose the
                      roster, resources, and announcements for {removing.name}{" "}
                      on their next request. They do not need to sign out.
                    </p>
                    <p className="m-0">
                      Their other assignments are unaffected, and this can be
                      undone by assigning them again.
                    </p>
                  </div>

                  <Field
                    invalid={Boolean(
                      removeOutcome === "invalid" &&
                      removeState.fieldErrors.note,
                    )}
                  >
                    <FieldLabel htmlFor={removeNoteId}>
                      Reason (recorded)
                    </FieldLabel>
                    <FieldDescription id={removeHintId}>
                      Say why this access is being removed. Do not include
                      anything about a family or a child.
                    </FieldDescription>
                    <Textarea
                      id={removeNoteId}
                      name="note"
                      rows={3}
                      aria-required="true"
                      aria-describedby={removeHintId}
                      maxLength={NOTE_MAX}
                      defaultValue=""
                    />
                    <FieldError
                      match={Boolean(
                        removeOutcome === "invalid" &&
                        removeState.fieldErrors.note,
                      )}
                    >
                      {removeState.fieldErrors.note}
                    </FieldError>
                  </Field>
                </DialogBody>

                <DialogFooter>
                  <DialogClose
                    render={
                      <Button variant="quiet" size="md" type="button">
                        Cancel
                      </Button>
                    }
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    size="md"
                    disabled={removePending}
                  >
                    {removePending ? "Working…" : "Remove access"}
                    <CircleCheck aria-hidden="true" strokeWidth={1.75} />
                  </Button>
                </DialogFooter>
              </form>
            </DialogPopup>
          </Dialog>
        ) : null}
      </DialogPopup>
    </Dialog>
  )
}

export { EducatorDrawer }
