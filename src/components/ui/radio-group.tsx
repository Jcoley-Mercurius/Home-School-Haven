import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"

/** MDS §6 radio group. Always render inside a labelled group or fieldset. */
function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("flex flex-col gap-[var(--hsh-space-1)]", className)}
      {...props}
    />
  )
}

function Radio({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full",
        "border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-card)]",
        "transition-colors outline-none",
        "hover:border-[var(--hsh-forest-500)]",
        "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
        "focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-offset-[var(--hsh-focus-offset)]",
        "data-[checked]:border-[var(--hsh-forest-600)]",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-[var(--hsh-forest-600)]" />
    </RadioPrimitive.Root>
  )
}

/** 44 px interactive row wrapping a 20 px control, per MDS §8 touch targets. */
function RadioRow({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="radio-row"
      className={cn(
        "hsh-body flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-3)]",
        "text-[var(--hsh-text-secondary)]",
        className
      )}
      {...props}
    />
  )
}

export { RadioGroup, Radio, RadioRow }
