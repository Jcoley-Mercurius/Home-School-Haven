"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/** MDS §6 select. Trigger matches the 44 px / 10 px input treatment. */
function Select<Value, Multiple extends boolean | undefined = false>(
  props: SelectPrimitive.Root.Props<Value, Multiple>
) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "hsh-body flex w-full items-center justify-between gap-[var(--hsh-space-2)]",
        "h-[var(--hsh-control-height-standard)] min-h-[var(--hsh-control-height-standard)]",
        "px-[var(--hsh-space-4)]",
        "rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)]",
        "bg-[var(--hsh-surface-card)] text-[var(--hsh-text-primary)]",
        "transition-colors outline-none",
        "hover:border-[var(--hsh-border-strong)]",
        "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
        "focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-offset-[var(--hsh-focus-offset)]",
        "data-[disabled]:cursor-not-allowed data-[disabled]:bg-[var(--hsh-surface-elevated)]",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-[var(--hsh-text-muted)]">
        <ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={4} alignItemWithTrigger={false}>
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "min-w-[var(--anchor-width)] overflow-hidden p-[var(--hsh-space-1)]",
            "rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)]",
            "bg-[var(--hsh-surface-card)] shadow-[var(--hsh-shadow-overlay)]",
            "outline-none",
            className
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "hsh-body flex min-h-[var(--hsh-touch-target)] cursor-default items-center",
        "justify-between gap-[var(--hsh-space-3)] px-[var(--hsh-space-3)]",
        "rounded-[var(--hsh-radius-small)] text-[var(--hsh-text-primary)] outline-none",
        "data-[highlighted]:bg-[var(--hsh-forest-50)]",
        "data-[selected]:bg-[var(--hsh-forest-100)]",
        "data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="text-[var(--hsh-forest-700)]">
        <Check aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
