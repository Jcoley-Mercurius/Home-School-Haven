"use client"

import Link from "next/link"

import { ENROLLMENT_STATE } from "@/components/enrollment/enrollment-state"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ENROLLMENT_STATE_VALUES } from "@/lib/admin/filters"

import type { EnrollmentFilters } from "@/lib/admin/filters"

/** Filter labels distinguish stored states that share one display vocabulary. */
const ENROLLMENT_FILTER_LABEL = {
  all: "All states",
  started: ENROLLMENT_STATE.started.label,
  approval_pending: ENROLLMENT_STATE.approval_pending.label,
  payment_pending: ENROLLMENT_STATE.payment_pending.label,
  waitlisted: ENROLLMENT_STATE.waitlisted.label,
  confirmed: ENROLLMENT_STATE.confirmed.label,
  payment_failed: "Payment failed — not confirmed",
  canceled: ENROLLMENT_STATE.canceled.label,
  blocked: "Blocked — not confirmed",
} as const satisfies Record<(typeof ENROLLMENT_STATE_VALUES)[number], string>

/**
 * Enrollment list filters (MDS `components.search` variant `filtered`,
 * `patterns.search_results`).
 *
 * THERE IS NO SEARCH BOX HERE, AND THAT IS THE POINT
 *
 * The useful thing to type about an enrollment is a child's name. A search box
 * would put it into the URL, and from there into browser history, into a
 * referrer header, and into every screenshot of the address bar — which
 * AGENTS.md §11 forbids outright. So enrollments are narrowed by two
 * operational facts instead: the program, which is public information, and the
 * state. Between them they answer the questions this list exists for — "what
 * needs review" and "who is in this program" — without a child's name ever
 * reaching a query string.
 *
 * A plain `<form method="get">`, like the program filters: it produces a real
 * URL an administrator can bookmark or send on, the back button behaves, and
 * the filter state lives in exactly one place — `searchParams` — instead of
 * being mirrored in component state that can disagree with the URL.
 *
 * This one is a Client Component only because the MDS select is: Base UI
 * renders a hidden native input carrying `name`, so it still submits with the
 * GET form rather than needing a router push. The state chips stay native radio
 * inputs, which work with or without JavaScript.
 *
 * The state labels come from `ENROLLMENT_STATE` — the same table the family
 * dashboard renders from. An administrator filtering for "Payment verification
 * pending" is using the words the family sees, which is what MPS-ACC-022's one
 * consistent state means in practice.
 */
function EnrollmentFilterBar({
  filters,
  programs,
}: {
  filters: EnrollmentFilters
  /** Slug and name of every program that actually has an enrollment. */
  programs: { slug: string; name: string }[]
}) {
  return (
    <form
      method="get"
      aria-label="Filter enrollments"
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)]"
    >
      <fieldset className="flex flex-col gap-[var(--hsh-space-2)]">
        <legend className="hsh-label mb-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
          Enrollment state
        </legend>
        <div className="flex flex-wrap gap-[var(--hsh-space-2)]">
          {ENROLLMENT_STATE_VALUES.map((value) => (
            <label
              key={value}
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] cursor-pointer items-center gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-pill)] border border-[var(--hsh-border-default)] px-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)] has-[:checked]:border-[var(--hsh-forest-600)] has-[:checked]:bg-[var(--hsh-forest-50)] has-[:checked]:font-semibold has-[:checked]:text-[var(--hsh-forest-700)] has-[:focus-visible]:outline-[length:var(--hsh-focus-width)] has-[:focus-visible]:outline-offset-[var(--hsh-focus-offset)] has-[:focus-visible]:outline-[color:var(--hsh-focus)] has-[:focus-visible]:outline-solid"
            >
              <input
                type="radio"
                name="state"
                value={value}
                defaultChecked={filters.state === value}
                /* Visually hidden rather than `display:none`, which would make
                   the chip unreachable by keyboard. */
                className="sr-only"
              />
              {ENROLLMENT_FILTER_LABEL[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-[var(--hsh-space-2)] sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--hsh-space-2)]">
          <label
            htmlFor="enrollment-program"
            className="hsh-label text-[var(--hsh-text-secondary)]"
          >
            Program
          </label>
          <Select
            name="program"
            defaultValue={filters.program}
            items={[
              { label: "All programs", value: "" },
              ...programs.map((program) => ({
                label: program.name,
                value: program.slug,
              })),
            ]}
          >
            <SelectTrigger id="enrollment-program">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All programs</SelectItem>
              {programs.map((program) => (
                <SelectItem key={program.slug} value={program.slug}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-[var(--hsh-space-2)]">
          <Button type="submit" variant="secondary" size="md">
            Apply
          </Button>
          {filters.active ? (
            <Button
              variant="quiet"
              size="md"
              render={<Link href="/admin/enrollments" />}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
        There is no name search here on purpose: a search term becomes part of
        the web address, and a student&rsquo;s name must never travel in one.
      </p>
    </form>
  )
}

export { EnrollmentFilterBar }
