/**
 * Offering taxonomy for public presentation (owner evidence of 2026-09-14;
 * MPS DEC-024; prompts/public-offering-model.md §4).
 *
 * Home School Haven offers programs in five ways, and a family choosing between
 * them needs to see which is which: Haven Days is a multi-day program, not one
 * class among many, and tutoring is booked by the hour rather than by term.
 *
 * Pure and dependency-free so it is unit-testable without Next.js or Supabase
 * (`tests/offering-model.test.mts`).
 */

import type { Enums } from "@/lib/supabase/types"

export type OfferingType = Enums<"offering_type">

type OfferingGroupLabel = {
  /** Section heading on the catalog, e.g. "Ready Set programs". */
  heading: string
  /** One offering, as the detail-page eyebrow names it. */
  singular: string
}

/**
 * Every offering type, in the order the catalog presents them. Exhaustive by
 * construction: adding an enum value without a label is a type error.
 */
export const OFFERING_GROUPS = {
  haven_days: { heading: "Haven Days", singular: "Haven Days" },
  ready_set: { heading: "Ready Set programs", singular: "Ready Set program" },
  individual_class: {
    heading: "Individual classes",
    singular: "Individual class",
  },
  tutoring: { heading: "Tutoring", singular: "Tutoring" },
  monthly_club: { heading: "Monthly clubs", singular: "Monthly club" },
} as const satisfies Record<OfferingType, OfferingGroupLabel>

/**
 * The catalog order, as a literal tuple so callers that need the exact values —
 * `z.enum` in `src/lib/admin/validation.ts` — keep them instead of widening to
 * `string`. Written out rather than taken from `Object.keys`, which loses the
 * literal types, and guarded below so it cannot drift from the enum.
 */
export const OFFERING_ORDER = [
  "haven_days",
  "ready_set",
  "individual_class",
  "tutoring",
  "monthly_club",
] as const satisfies readonly OfferingType[]

/* Compile-time proof that the order above names every offering type. Adding a
   value to the database enum without a place in the catalog order makes
   `Missing` non-never, and this declaration stops type-checking. */
type MissingFromOrder = Exclude<OfferingType, (typeof OFFERING_ORDER)[number]>
const _orderNamesEveryOfferingType: [MissingFromOrder] extends [never]
  ? true
  : never = true
void _orderNamesEveryOfferingType

export type OfferingGroup<T> = {
  type: OfferingType
  heading: string
  programs: T[]
}

/**
 * Group programs by offering type, in catalog order.
 *
 * A group with no programs is left out rather than rendered as an empty
 * heading, which would read as an offering that exists with nothing in it.
 * Order within a group is the order the caller passed, which is the
 * administrator's `sort_order`.
 *
 * A program with no offering type is not placed in any group. The database
 * refuses to publish one (`programs_published_has_offering_type`), so on a
 * public surface this cannot occur; assigning it a group here would invent a
 * classification.
 *
 * @param programs - Published programs, already in display order.
 * @returns The non-empty groups, in catalog order.
 */
export function groupPrograms<T extends { offeringType: OfferingType | null }>(
  programs: readonly T[],
): OfferingGroup<T>[] {
  return OFFERING_ORDER.map((type) => ({
    type,
    heading: OFFERING_GROUPS[type].heading,
    programs: programs.filter((program) => program.offeringType === type),
  })).filter((group) => group.programs.length > 0)
}

/**
 * The detail-page eyebrow for a program: its offering type in the singular, or
 * the neutral "Program" when it has none.
 */
export function offeringLabel(type: OfferingType | null): string {
  return type ? OFFERING_GROUPS[type].singular : "Program"
}
