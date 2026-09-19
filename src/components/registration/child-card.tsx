"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"

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
  childHasEntries,
  childHeading,
  fieldId,
  type ChildDraft,
} from "@/lib/registration/form"
import { cn } from "@/lib/utils"

import { useRegistration } from "./registration-context"

/**
 * One child, as a collapsible card (MDS DESIGN-SYSTEM §9.1 "Child cards").
 *
 * The heading is the child's preferred name, or "New child" until one is known.
 * The expand control is a real 44 px button with `aria-expanded` and
 * `aria-controls`. A collapsed card still says what it holds and how many of its
 * fields need attention, so collapsing never hides a problem. The panel stays in
 * the DOM while collapsed (`hidden`), so the values in it are never unmounted
 * and lost.
 *
 * There is no expand animation, so reduced motion needs no special case.
 */
export function ChildCard({
  child,
  index,
  step,
  summary,
  removable = false,
  children,
}: {
  child: ChildDraft
  index: number
  step: 4 | 5
  summary: string
  removable?: boolean
  children: React.ReactNode
}) {
  const {
    students,
    expanded,
    setExpanded,
    childErrorCount,
    update,
    announce,
    focusLater,
    busy,
  } = useRegistration()
  const [confirming, setConfirming] = useState(false)

  const heading = childHeading(child, students)
  const open = expanded(child.key)
  const panelId = `reg-child-${child.key}-step-${step}-panel`
  const headingId = `reg-child-${child.key}-step-${step}-heading`
  const errors = childErrorCount(child.key, step)

  const remove = () => {
    update((d) => ({
      ...d,
      children: d.children.filter((c) => c.key !== child.key),
    }))
    announce(`${heading} removed from this registration.`)
    focusLater(fieldId.addChild)
  }

  return (
    <section
      aria-labelledby={headingId}
      data-slot="child-card"
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] shadow-[var(--hsh-shadow-subtle)] sm:p-[var(--hsh-space-6)]"
    >
      <div className="flex items-start justify-between gap-[var(--hsh-space-3)]">
        <div className="flex min-w-0 flex-col gap-[var(--hsh-space-1)]">
          <p className="hsh-caption text-[var(--hsh-text-muted)]">
            Child {index + 1}
          </p>
          <h3
            id={headingId}
            className="hsh-h3 break-words text-[var(--hsh-text-primary)]"
          >
            {heading}
          </h3>
          {!open ? (
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {summary}
            </p>
          ) : null}
          {errors > 0 && !open ? (
            <p className="hsh-body-sm font-semibold text-[var(--hsh-error)]">
              {errors === 1
                ? "1 item needs attention"
                : `${errors} items need attention`}
            </p>
          ) : null}
        </div>
        <Button
          variant="quiet"
          size="icon"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setExpanded(child.key, !open)}
        >
          {open ? (
            <ChevronUp aria-hidden="true" strokeWidth={1.75} />
          ) : (
            <ChevronDown aria-hidden="true" strokeWidth={1.75} />
          )}
          <span className="sr-only">
            {open ? `Collapse ${heading}` : `Expand ${heading}`}
          </span>
        </Button>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className={cn("flex flex-col gap-[var(--hsh-space-6)]")}
      >
        {children}

        {removable ? (
          <div className="border-t border-[var(--hsh-border-default)] pt-[var(--hsh-space-4)]">
            <Button
              variant="quiet"
              size="md"
              disabled={busy}
              onClick={() =>
                childHasEntries(child) ? setConfirming(true) : remove()
              }
            >
              <Trash2 aria-hidden="true" strokeWidth={1.75} />
              Remove {heading}
            </Button>
          </div>
        ) : null}
      </div>

      {removable ? (
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogPopup size="small">
            <DialogHeader
              title={`Remove ${heading}?`}
              description="Everything you entered for this child on this page will be removed. Nothing has been submitted yet."
              closeLabel="Keep this child"
            />
            <DialogBody>
              <p className="hsh-body text-[var(--hsh-text-secondary)]">
                You can add the child again afterward, but you will need to
                enter their details again.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose
                render={
                  <Button variant="secondary" size="md">
                    Keep this child
                  </Button>
                }
              />
              <Button
                variant="destructive"
                size="md"
                onClick={() => {
                  setConfirming(false)
                  remove()
                }}
              >
                Remove {heading}
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      ) : null}
    </section>
  )
}
