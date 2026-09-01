"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTrigger,
} from "@/components/ui/dialog"

import {
  announcementLifecycleAction,
  resourceLifecycleAction,
} from "@/lib/content/actions"
import { canTransition, type ContentState } from "@/lib/content/lifecycle"

/**
 * Publish and remove, for one announcement or one resource (MPS-REQ-019,
 * MPS-ACC-030, MPS-ACC-031).
 *
 * WHICH BUTTONS EXIST IS A RENDERING DECISION, NOT A PERMISSION
 *
 * `canTransition` mirrors `private.content_transition_allowed`, so a button for
 * a move the database would refuse is never drawn. That is courtesy: the action
 * re-authorizes, and the database refuses the transition inside the writing
 * transaction whatever this component drew. A missing button has never been a
 * control here, and `tests/content-lifecycle.test.mts` pins this table to the
 * database's so the two cannot drift into disagreeing about what is offered.
 *
 * REMOVAL IS BEHIND A DIALOG, AND SAYS WHAT IT DOES
 *
 * The MDS requires destructive dialogs to use explicit action language and
 * offer safe cancellation. The wording says removal withdraws the item from
 * families — not that it deletes it — because it does not delete it: the record
 * and any file are retained and access is revoked (GAP-CONTENT-03). Telling an
 * author their content was deleted when it was not would be the kind of
 * comfortable inaccuracy that matters later.
 */
function LifecycleActions({
  kind,
  id,
  state,
  expectedUpdatedAt,
  basePath,
  replaceHref,
}: {
  kind: "announcement" | "resource"
  id: string
  state: ContentState
  expectedUpdatedAt: string
  basePath: string
  /** Where "Publish a replacement" goes, when replacement is possible. */
  replaceHref: string
}) {
  const [open, setOpen] = useState(false)

  const action =
    kind === "announcement"
      ? announcementLifecycleAction
      : resourceLifecycleAction
  const idField = kind === "announcement" ? "announcementId" : "resourceId"

  const mayPublish = canTransition(state, "published")
  const mayReplace = canTransition(state, "replaced")
  const mayRemove = canTransition(state, "removed")

  if (!mayPublish && !mayReplace && !mayRemove) {
    return (
      <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
        {state === "replaced"
          ? "This version has been superseded. Open the newer version to make changes."
          : "This has been withdrawn. Nothing further can be changed on it."}
      </p>
    )
  }

  const noun = kind === "announcement" ? "announcement" : "resource"

  return (
    <div className="flex flex-col gap-[var(--hsh-space-3)] sm:flex-row sm:flex-wrap">
      {mayPublish ? (
        <form action={action}>
          <input type="hidden" name={idField} value={id} />
          <input type="hidden" name="basePath" value={basePath} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={expectedUpdatedAt}
          />
          <input type="hidden" name="move" value="publish" />
          <Button type="submit" variant="primary" size="md">
            Publish
          </Button>
        </form>
      ) : null}

      {mayReplace ? (
        <Button render={<a href={replaceHref} />} variant="secondary" size="md">
          Publish a replacement
        </Button>
      ) : null}

      {mayRemove ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="quiet" size="md">
                Remove
              </Button>
            }
          />
          <DialogPopup>
            <DialogHeader
              title={`Remove this ${noun}?`}
              description={
                state === "published"
                  ? `Families enrolled in this program will no longer see it. The record is kept for the history, and nothing is deleted.`
                  : `This draft will be withdrawn. The record is kept for the history, and nothing is deleted.`
              }
              /* "Close", not "Keep it" — the footer already has a button by that
                 name, and two controls sharing one accessible name inside a
                 dialog is ambiguous to anyone navigating by name. */
              closeLabel="Close"
            />
            <DialogBody>
              <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                {kind === "resource"
                  ? "Any attached file stops being downloadable straight away, including through a link a family already has open."
                  : "This cannot be undone from here. To say something new, publish a new announcement."}
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose
                render={
                  <Button variant="quiet" size="md">
                    Keep it
                  </Button>
                }
              />
              <form action={action}>
                <input type="hidden" name={idField} value={id} />
                <input type="hidden" name="basePath" value={basePath} />
                <input
                  type="hidden"
                  name="expectedUpdatedAt"
                  value={expectedUpdatedAt}
                />
                <input type="hidden" name="move" value="remove" />
                <Button type="submit" variant="primary" size="md">
                  Remove {noun}
                </Button>
              </form>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      ) : null}
    </div>
  )
}

export { LifecycleActions }
