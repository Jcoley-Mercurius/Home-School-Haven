"use client"

import { useId } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SEARCH_MAX } from "@/lib/admin/filters"

/**
 * Directory search for the family and educator lists (MDS `components.search`,
 * variants `compact`/`full`, states `empty`/`typing`/`results`/`no_results`).
 *
 * WHY THIS ONE DOES NOT TOUCH THE URL
 *
 * Every other filter in the operations area is a `<form method="get">` whose
 * state lives in `searchParams`, and for programs and enrollment states that is
 * right: those are operational facts, and a bookmarkable URL is a feature.
 *
 * A family name is not an operational fact. It is the name of a household with
 * children in it, and `lib/admin/filters.ts` already settled the principle for
 * enrollments — what goes in a query string goes into browser history, into a
 * referrer header, into server access logs, and into every screenshot of the
 * address bar (AGENTS.md §11). Educator names get the same treatment, both
 * because they are staff members' names and because two search boxes that look
 * identical must not behave differently about where what you type ends up.
 *
 * So this filters a list the viewer is already authorized to see, in the
 * browser, in component state. Nothing is sent anywhere: no request, no query
 * parameter, no history entry. The trade is that a filtered view cannot be
 * bookmarked or linked, which for a list of families is the correct trade.
 *
 * WHY IT IS NOT A FORM
 *
 * There is nothing to submit. Filtering happens as the value changes, and a
 * form would imply an Enter key that does something more. `role="search"` gives
 * the landmark a `<form>` would have contributed; the input is a real labelled
 * `<input type="search">`, so it is announced, clearable, and keyboard-operable
 * without any of that behaviour being ours to implement.
 *
 * The result count is announced politely rather than assertively: a screen
 * reader user typing into this field is mid-task, and each keystroke changing
 * the count must not interrupt them.
 */
function DirectorySearch({
  label,
  value,
  onValueChange,
  resultCount,
  totalCount,
  noun,
}: {
  /** Visible label. Names what is being searched, e.g. "Search families". */
  label: string
  value: string
  onValueChange: (next: string) => void
  /** How many records match now. */
  resultCount: number
  /** How many exist in total, for the unfiltered announcement. */
  totalCount: number
  /** Plural noun for the announcement, e.g. "families". */
  noun: string
}) {
  const inputId = useId()
  const statusId = useId()

  return (
    <div
      role="search"
      className="flex flex-col gap-[var(--hsh-space-2)] sm:max-w-[420px]"
    >
      <label
        htmlFor={inputId}
        className="hsh-label text-[var(--hsh-text-secondary)]"
      >
        {label}
      </label>

      <div className="flex items-center gap-[var(--hsh-space-2)]">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-[var(--hsh-space-3)] size-4 -translate-y-1/2 text-[var(--hsh-text-secondary)]"
          />
          <Input
            id={inputId}
            type="search"
            value={value}
            maxLength={SEARCH_MAX}
            autoComplete="off"
            aria-describedby={statusId}
            placeholder="Start typing to narrow the list"
            className="pl-[var(--hsh-space-8)]"
            onChange={(event) => onValueChange(event.target.value)}
          />
        </div>

        {/* Only rendered while there is something to clear, so the row does not
            carry a permanently disabled control. */}
        {value !== "" ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            aria-label="Clear the search"
            onClick={() => onValueChange("")}
          >
            <X aria-hidden="true" strokeWidth={1.75} />
          </Button>
        ) : null}
      </div>

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]"
      >
        {value === ""
          ? `Showing all ${totalCount} ${noun}.`
          : `Showing ${resultCount} of ${totalCount} ${noun}.`}
      </p>
    </div>
  )
}

export { DirectorySearch }
