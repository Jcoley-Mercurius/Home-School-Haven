import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PROGRAM_STATUS_VALUES, SEARCH_MAX } from "@/lib/admin/filters"

import type { ProgramFilters } from "@/lib/admin/filters"

const STATUS_LABEL: Record<(typeof PROGRAM_STATUS_VALUES)[number], string> = {
  all: "All programs",
  draft: "Drafts",
  published: "Published",
  archived: "Archived",
}

/**
 * Program list filters (MDS `components.search` variant `filtered`,
 * `patterns.search_results`).
 *
 * A PLAIN GET FORM, ON PURPOSE
 *
 * No client component, no router push, no debounce. The filters are a `<form
 * method="get">`, so they work with JavaScript disabled, the result is a real
 * URL an administrator can bookmark or send to a colleague, and the back button
 * does what a back button should. It also means the state lives in exactly one
 * place — `searchParams`, parsed by `parseProgramFilters` — instead of being
 * mirrored in component state that can disagree with the URL.
 *
 * The status filter is a radio group styled as chips rather than a `<select>`.
 * Four options that fit on one line are faster to read and to reach than a
 * collapsed list, and each is independently focusable, which a select's options
 * are not. They are real radio inputs inside a real fieldset, so arrow-key
 * navigation and the group's legend come from the platform.
 */
function ProgramFilterBar({ filters }: { filters: ProgramFilters }) {
  return (
    <form
      method="get"
      role="search"
      aria-label="Filter programs"
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)]"
    >
      <div className="flex flex-col gap-[var(--hsh-space-2)] sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--hsh-space-2)]">
          <label
            htmlFor="program-search"
            className="hsh-label text-[var(--hsh-text-secondary)]"
          >
            Search programs
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-[var(--hsh-space-3)] size-5 -translate-y-1/2 text-[var(--hsh-text-muted)]"
              strokeWidth={1.75}
            />
            <Input
              id="program-search"
              name="q"
              type="search"
              maxLength={SEARCH_MAX}
              defaultValue={filters.search}
              placeholder="Program name"
              className="pl-[var(--hsh-space-10)]"
            />
          </div>
        </div>

        <div className="flex gap-[var(--hsh-space-2)]">
          <Button type="submit" variant="secondary" size="md">
            Apply
          </Button>
          {filters.active ? (
            <Button
              variant="quiet"
              size="md"
              render={<Link href="/admin/programs" />}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <fieldset className="flex flex-col gap-[var(--hsh-space-2)]">
        <legend className="hsh-label mb-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
          Publication status
        </legend>
        <div className="flex flex-wrap gap-[var(--hsh-space-2)]">
          {PROGRAM_STATUS_VALUES.map((value) => (
            <label
              key={value}
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] cursor-pointer items-center gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-pill)] border border-[var(--hsh-border-default)] px-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)] has-[:checked]:border-[var(--hsh-forest-600)] has-[:checked]:bg-[var(--hsh-forest-50)] has-[:checked]:font-semibold has-[:checked]:text-[var(--hsh-forest-700)] has-[:focus-visible]:outline-[length:var(--hsh-focus-width)] has-[:focus-visible]:outline-offset-[var(--hsh-focus-offset)] has-[:focus-visible]:outline-[color:var(--hsh-focus)] has-[:focus-visible]:outline-solid"
            >
              <input
                type="radio"
                name="status"
                value={value}
                defaultChecked={filters.status === value}
                /* Visually hidden rather than `display:none`: a hidden input is
                   not focusable, and the chip has to be reachable by keyboard.
                   The visible selected state is drawn by `has-[:checked]`. */
                className="sr-only"
              />
              {STATUS_LABEL[value]}
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  )
}

export { ProgramFilterBar }
