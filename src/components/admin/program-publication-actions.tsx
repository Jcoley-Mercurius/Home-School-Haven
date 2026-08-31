"use client"

import { useActionState, useState } from "react"
import { Archive, Eye, EyeOff, RotateCcw } from "lucide-react"

import { setPublicationAction } from "@/app/(portal)/admin/programs/[programId]/actions"
import { emptyPublicationFormState } from "@/app/(portal)/admin/programs/[programId]/form-state"
import { PUBLICATION } from "@/components/admin/publication-state"
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
import { allowedPublicationTargets } from "@/lib/admin/transitions"

import type { AdminProgram } from "@/lib/admin/programs"
import type { PublicationState } from "@/lib/admin/transitions"

/**
 * Publication actions for one program (MPS-REQ-016, MPS-RUL-005,
 * MPS-ACC-026/027).
 *
 * WHY EACH ACTION OPENS A DIALOG
 *
 * MDS `components.dialog.specification`: "Destructive, consent, and financial
 * dialogs require explicit action language and safe cancellation." Publishing
 * puts a program in front of every visitor; archiving takes it away from
 * families who may be looking at it. Both are consequential enough that the
 * consequence should be stated in words before the click, and both offer
 * Cancel.
 *
 * The confirm button never says "Confirm". It says what will happen — "Publish
 * to the catalog", "Archive this program" — so a dialog read at speed still
 * says which of two similar decisions is being made.
 *
 * WHICH BUTTONS EXIST
 *
 * Only the transitions `allowedPublicationTargets` permits. That table is a
 * copy of the one the database enforces, and it is used here only to avoid
 * offering an action that would be refused. If the two ever disagree, the
 * database wins and the administrator sees the refusal — which is the safe
 * direction for a disagreement to fail in.
 *
 * There is no Delete. Retention and deletion are an unanswered owner question
 * (checklist §11), and archiving is reversible while deletion is not.
 */

const ACTION: Record<
  PublicationState,
  {
    label: string
    icon: typeof Eye
    variant: "primary" | "secondary"
    title: string
    body: React.ReactNode
    confirm: string
  }
> = {
  published: {
    label: "Publish",
    icon: Eye,
    variant: "primary",
    title: "Publish this program?",
    body: (
      <>
        <p>
          The program becomes visible in the public catalog and on its own page,
          to anyone, immediately.
        </p>
        <p>
          Only the details you have saved are shown. Anything left unset appears
          as &ldquo;Contact for details&rdquo; rather than as a guess.
        </p>
        <p>
          You can unpublish it again at any time. The change is recorded with
          your account and the time.
        </p>
      </>
    ),
    confirm: "Publish to the catalog",
  },
  draft: {
    label: "Unpublish",
    icon: EyeOff,
    variant: "secondary",
    title: "Unpublish this program?",
    body: (
      <>
        <p>
          The program is removed from the public catalog and its page stops
          being reachable by visitors. It becomes a draft again.
        </p>
        <p>
          Existing enrollments are not changed, cancelled, or refunded by this.
          Families who already hold one keep it, and their dashboard still shows
          it.
        </p>
      </>
    ),
    confirm: "Unpublish this program",
  },
  archived: {
    label: "Archive",
    icon: Archive,
    variant: "secondary",
    title: "Archive this program?",
    body: (
      <>
        <p>
          The program is withdrawn from the catalog and from the working list.
          Nothing is deleted: its details, its history, and its enrollments are
          all kept.
        </p>
        <p>
          Existing enrollments are not changed, cancelled, or refunded by this.
        </p>
        <p>You can restore it to a draft later.</p>
      </>
    ),
    confirm: "Archive this program",
  },
}

/** `archived → draft` is a restore, and deserves to be labelled as one. */
const RESTORE = {
  label: "Restore to draft",
  icon: RotateCcw,
  title: "Restore this program to a draft?",
  confirm: "Restore to draft",
}

function PublicationActions({ program }: { program: AdminProgram }) {
  const [state, formAction, pending] = useActionState(
    setPublicationAction,
    emptyPublicationFormState,
  )
  const [openTarget, setOpenTarget] = useState<PublicationState | null>(null)

  const targets = allowedPublicationTargets(program.publicationState)
  const outcome = state.status

  /* Close the dialog once its submission has settled: its job is done, and
     leaving it open over a record that has already changed invites a second
     submission of a decision already made.

     This is React's "adjust state during render" pattern rather than an
     effect — it runs before the browser paints, so the dialog never flashes
     open with a stale result behind it. `settled` records which action state
     was already handled, so opening a *different* dialog afterwards does not
     immediately close it on the previous outcome. */
  const [settled, setSettled] = useState(state)
  if (state !== settled) {
    setSettled(state)
    if (
      openTarget !== null &&
      (outcome === "updated" || outcome === "unchanged")
    ) {
      setOpenTarget(null)
    }
  }

  const message =
    outcome === "updated"
      ? "The program's publication state was changed and recorded in operations history."
      : outcome === "unchanged"
        ? "The program was already in that state. Nothing was changed and nothing was recorded."
        : outcome === "stale"
          ? "This program changed while this page was open. Nothing was changed. Reload to see the current state."
          : outcome === "invalidTransition"
            ? "That publication change is not approved from the program's current state."
            : outcome === "notFound"
              ? "This program is no longer available."
              : outcome === "forbidden"
                ? "This account is not authorized to publish or archive a program."
                : outcome === "unavailable"
                  ? "No Supabase project is configured in this environment."
                  : outcome === "rejected"
                    ? (state.message ??
                      "That change was refused. Nothing was changed.")
                    : outcome === "failed"
                      ? "Something went wrong on our side. Nothing was changed."
                      : ""

  const tone =
    outcome === "updated"
      ? "success"
      : outcome === "unchanged"
        ? "info"
        : "warning"

  return (
    <section
      aria-labelledby="publication-heading"
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <div className="flex flex-col gap-[var(--hsh-space-1)]">
        <h2
          id="publication-heading"
          className="hsh-h4 text-[var(--hsh-text-primary)]"
        >
          Publication
        </h2>
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          {PUBLICATION[program.publicationState].sentence} Only an administrator
          or Samantha may publish a program, a price, or a registration change.
        </p>
      </div>

      {message ? (
        <Alert
          tone={tone}
          title={
            outcome === "updated"
              ? "Publication updated"
              : outcome === "unchanged"
                ? "No change"
                : "Nothing was changed"
          }
          live="polite"
        >
          {message}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-[var(--hsh-space-2)]">
        {targets.map((target) => {
          const isRestore =
            program.publicationState === "archived" && target === "draft"
          const config = ACTION[target]
          const Icon = isRestore ? RESTORE.icon : config.icon

          return (
            <Dialog
              key={target}
              open={openTarget === target}
              onOpenChange={(open) => setOpenTarget(open ? target : null)}
            >
              <Button
                variant={isRestore ? "secondary" : config.variant}
                size="md"
                onClick={() => setOpenTarget(target)}
              >
                <Icon aria-hidden="true" strokeWidth={1.75} />
                {isRestore ? RESTORE.label : config.label}
              </Button>

              <DialogPopup size="small">
                <DialogHeader
                  title={isRestore ? RESTORE.title : config.title}
                  description={program.name}
                />
                <DialogBody>
                  <div className="hsh-body-sm flex flex-col gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
                    {isRestore ? (
                      <p>
                        The program returns to the working list as a draft. It
                        is not published by this, and it stays invisible to
                        families and visitors until you publish it.
                      </p>
                    ) : (
                      config.body
                    )}
                  </div>
                </DialogBody>
                <DialogFooter>
                  <DialogClose
                    render={
                      <Button variant="quiet" size="md" type="button">
                        Cancel
                      </Button>
                    }
                  />
                  <form action={formAction}>
                    <input type="hidden" name="programId" value={program.id} />
                    <input
                      type="hidden"
                      name="expectedUpdatedAt"
                      value={program.updatedAt}
                    />
                    <input
                      type="hidden"
                      name="publicationState"
                      value={target}
                    />
                    <Button
                      type="submit"
                      variant={target === "published" ? "primary" : "secondary"}
                      size="md"
                      disabled={pending}
                    >
                      {pending
                        ? "Working…"
                        : isRestore
                          ? RESTORE.confirm
                          : config.confirm}
                    </Button>
                  </form>
                </DialogFooter>
              </DialogPopup>
            </Dialog>
          )
        })}
      </div>
    </section>
  )
}

export { PublicationActions }
