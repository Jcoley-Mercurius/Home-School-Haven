import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/** MDS §6 checkbox. Forest 600 when checked; state is paired with its label. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center",
        "rounded-[var(--hsh-radius-small)] border border-[var(--hsh-border-strong)]",
        "bg-[var(--hsh-surface-card)] transition-colors outline-none",
        "hover:border-[var(--hsh-forest-500)]",
        "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
        "focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-offset-[var(--hsh-focus-offset)]",
        "data-[checked]:border-[var(--hsh-forest-600)] data-[checked]:bg-[var(--hsh-forest-600)]",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex text-[var(--hsh-text-inverse)]">
        <Check aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/** 44 px interactive row wrapping a 20 px control, per MDS §8 touch targets. */
function CheckboxRow({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="checkbox-row"
      className={cn(
        "hsh-body flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-3)]",
        "text-[var(--hsh-text-secondary)]",
        className
      )}
      {...props}
    />
  )
}

export { Checkbox, CheckboxRow }
