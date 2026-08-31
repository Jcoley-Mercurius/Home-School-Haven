"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * MDS §6 dialog (`components.dialog`: variants confirmation / form /
 * information / destructive, sizes small / medium / large) and the
 * `page_shells.admin_operations` detail drawer.
 *
 * Approved component, first implementation. EXTEND, not CREATE.
 *
 * WHY THE DRAWER IS A DIALOG
 *
 * MDS names a "detail drawer" for admin operations and a "dialog" for
 * confirmations. Behaviourally they are one thing: a modal surface that traps
 * focus, closes on Escape, restores focus to whatever opened it, and makes the
 * page behind it inert. Building them as two primitives would mean testing that
 * behaviour twice and getting it right twice. `panel` positions the same
 * primitive against the right edge on desktop and as a full-height sheet on
 * mobile; `small`/`medium` centre it.
 *
 * ACCESSIBILITY THAT COMES FROM THE PRIMITIVE, NOT FROM US
 *
 * Focus trap, focus return (`finalFocus` defaults to the trigger), Escape,
 * `aria-modal`, and inert background are Base UI's. What is ours: every dialog
 * MUST render a `DialogTitle`, because an untitled modal announces nothing; the
 * close control is a real button with an accessible name and a 44 px target;
 * and the transitions below are disabled under `prefers-reduced-motion`.
 *
 * MDS `components.dialog.specification`: "Destructive, consent, and financial
 * dialogs require explicit action language and safe cancellation." That is a
 * rule for the caller's words, which no primitive can enforce — every call site
 * in this slice names the actual consequence in the confirm button, and every
 * one offers Cancel.
 */

/** Dialog root. Controlled by the caller so a server action can close it. */
const Dialog = DialogPrimitive.Root

/** Opens the dialog and receives focus back when it closes. */
const DialogTrigger = DialogPrimitive.Trigger

/** Closes the dialog. Used for both Cancel and the corner control. */
const DialogClose = DialogPrimitive.Close

/**
 * Dim backdrop.
 * @param className - Additional CSS classes.
 * @param props - Backdrop primitive props.
 * @returns Backdrop component.
 */
function DialogBackdrop({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--hsh-ink-900)_45%,transparent)]",
        "transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        "motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  )
}

const SIZE = {
  small: "sm:max-w-[420px]",
  medium: "sm:max-w-[560px]",
} as const

/**
 * The dialog surface.
 *
 * @param size - `small` and `medium` centre the dialog; `panel` docks it to the
 *   right edge as the operations detail drawer, and becomes a full-width sheet
 *   below `sm` where there is no room to dock anything.
 * @param className - Additional CSS classes.
 * @param children - Dialog contents; must include a `DialogTitle`.
 * @param props - Popup primitive props.
 * @returns Popup component.
 */
function DialogPopup({
  size = "medium",
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props & { size?: "small" | "medium" | "panel" }) {
  const isPanel = size === "panel"

  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-popup"
        className={cn(
          "fixed z-50 flex flex-col bg-[var(--hsh-surface-card)] outline-none",
          "shadow-[var(--hsh-shadow-overlay)]",
          "transition-[opacity,transform] motion-reduce:transition-none",
          isPanel
            ? [
                /* Full-height right dock on tablet and up; a full-screen sheet
                   below 640 px, where a 420 px panel would leave a strip of
                   unusable page beside it. */
                "inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[min(480px,100vw)]",
                "sm:rounded-l-[var(--hsh-radius-card)]",
                "data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
                "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
              ]
            : [
                "inset-x-[var(--hsh-space-4)] top-auto bottom-0 max-h-[90dvh]",
                "rounded-t-[var(--hsh-radius-card)]",
                "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2",
                "sm:w-[calc(100vw-var(--hsh-space-8))] sm:-translate-x-1/2 sm:-translate-y-1/2",
                "sm:rounded-[var(--hsh-radius-card)]",
                SIZE[size],
                "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
                "data-[ending-style]:translate-y-2 data-[starting-style]:translate-y-2",
                "sm:data-[ending-style]:translate-y-[calc(-50%+8px)] sm:data-[starting-style]:translate-y-[calc(-50%+8px)]",
              ],
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

/**
 * Sticky dialog header with the title and the close control.
 * @param title - The dialog title. Required — an untitled modal announces nothing.
 * @param description - Optional supporting sentence, associated with the dialog.
 * @param closeLabel - Accessible name for the close control.
 * @returns Header component.
 */
function DialogHeader({
  title,
  description,
  closeLabel = "Close",
}: {
  title: React.ReactNode
  description?: React.ReactNode
  closeLabel?: string
}) {
  return (
    <div className="flex items-start justify-between gap-[var(--hsh-space-4)] border-b border-[var(--hsh-border-default)] px-[var(--hsh-space-5)] py-[var(--hsh-space-4)]">
      <div className="flex min-w-0 flex-col gap-[var(--hsh-space-1)]">
        <DialogPrimitive.Title className="hsh-h4 text-[var(--hsh-text-primary)]">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {description}
          </DialogPrimitive.Description>
        ) : null}
      </div>
      <DialogPrimitive.Close
        /* 44 px, per MDS touch targets, even though it is a corner control —
           especially because it is a corner control. */
        className={cn(
          "inline-flex size-[var(--hsh-control-height-standard)] shrink-0 items-center justify-center",
          "rounded-[var(--hsh-radius-control)] text-[var(--hsh-text-secondary)]",
          "transition-colors outline-none hover:bg-[var(--hsh-surface-quiet)]",
          "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
          "focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)]",
        )}
      >
        <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
        <span className="sr-only">{closeLabel}</span>
      </DialogPrimitive.Close>
    </div>
  )
}

/**
 * Scrollable dialog body.
 * @param className - Additional CSS classes.
 * @param props - Standard div props.
 * @returns Body component.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-[var(--hsh-space-4)] overflow-y-auto",
        "px-[var(--hsh-space-5)] py-[var(--hsh-space-5)]",
        className,
      )}
      {...props}
    />
  )
}

/**
 * Action row.
 *
 * Actions are ordered cancel-then-confirm and separated by 8 px, so the safe
 * choice is never the one adjacent to a mis-tap.
 *
 * @param className - Additional CSS classes.
 * @param props - Standard div props.
 * @returns Footer component.
 */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-[var(--hsh-space-2)] border-t border-[var(--hsh-border-default)]",
        "px-[var(--hsh-space-5)] py-[var(--hsh-space-4)] sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTrigger,
}
