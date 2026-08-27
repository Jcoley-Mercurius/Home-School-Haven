import { Field as FieldPrimitive } from "@base-ui/react/field"

import { cn } from "@/lib/utils"

/**
 * MDS §6 form field scaffolding. Field associates the label, description, and
 * error with the control, so validation is announced rather than only coloured
 * (DESIGN-SYSTEM.md §10; DO-DONT.md "states never rely on color alone").
 */
function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("flex flex-col gap-[var(--hsh-space-2)]", className)}
      {...props}
    />
  )
}

/**
 * Field label for associating text with form control.
 * @param className - Additional CSS classes
 * @param props - Field label primitive props
 * @returns Field label component
 */
function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn("hsh-label text-[var(--hsh-text-primary)]", className)}
      {...props}
    />
  )
}

/**
 * Field description for providing helper text.
 * @param className - Additional CSS classes
 * @param props - Field description primitive props
 * @returns Field description component
 */
function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("hsh-body-sm text-[var(--hsh-text-muted)]", className)}
      {...props}
    />
  )
}

/**
 * Field error message for displaying validation errors.
 * @param className - Additional CSS classes
 * @param props - Field error primitive props
 * @returns Field error component
 */
function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn("hsh-body-sm text-[var(--hsh-error)]", className)}
      {...props}
    />
  )
}

export { Field, FieldLabel, FieldDescription, FieldError }
