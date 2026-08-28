"use client"

import { useId, useMemo, useState, type ReactNode } from "react"
import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  Heart,
  Link2,
  Search,
  Sprout,
  User,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardGlyph } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  libraryHeading,
  resourceCategories,
  resourceKindActions,
  resourceKindLabels,
  resourcesHero,
  sampleNotice,
  sampleResources,
  type ResourceCategoryId,
  type ResourceKind,
} from "@/content/resources"
import { cn } from "@/lib/utils"

/**
 * The interactive region of the public Resources page: the find-a-resource
 * panel, the four category cards, and the entry grid they filter.
 *
 * **Why this is one client component rather than three.** The search field sits
 * in the hero and the category cards sit a section below, but both drive the
 * same filtered list. Splitting them would mean lifting the query and the active
 * category into a context or a store for two pieces of `useState` — so the
 * component spans the whole region instead, and the page passes the hero copy
 * in as `children` so the `h1` stays server-rendered.
 *
 * **Why the affordances filter instead of navigate.** The reference draws
 * "Explore resources →" on each category and "View all resources →" above the
 * grid, both of which read as links to routes. No category or index route
 * exists or is approved, and the owner ruled on 2026-08-27 that the review
 * contains no broken links, so each one does in place what it says it does
 * (`prompts/public-resources-page.md` §4, D-R3 and D-R4).
 *
 * Everything filtered here is a module constant. Nothing is fetched, nothing is
 * sent, and the query never reaches the URL, a log, or a server.
 */

/* One mark per category, in order, matching the drawn composition. */
const categoryMarks: Record<ResourceCategoryId, LucideIcon> = {
  "getting-started": Sprout,
  "program-information": User,
  "homeschool-support": Heart,
  "family-guides": Users,
}

const categoryMarkTones: Record<ResourceCategoryId, string> = {
  "getting-started": "bg-[var(--hsh-forest-100)] text-[var(--hsh-forest-700)]",
  "program-information": "bg-[var(--hsh-gold-100)] text-[var(--hsh-gold-700)]",
  "homeschool-support": "bg-[var(--hsh-coral-100)] text-[var(--hsh-coral-700)]",
  "family-guides": "bg-[var(--hsh-forest-100)] text-[var(--hsh-forest-700)]",
}

/**
 * Marks and tones follow the *kind*, not the position in the grid.
 *
 * The reference alternates them decoratively — two guides carry different
 * glyphs. Tying them to the kind instead means the mark, the kind label, and
 * the action wording all say the same thing, which is what DESIGN-SYSTEM.md §10
 * asks for (D-R8).
 */
const kindMarks: Record<ResourceKind, LucideIcon> = {
  guide: BookOpen,
  link: Link2,
  download: Download,
}

const kindMarkTones: Record<ResourceKind, string> = {
  guide: "bg-[var(--hsh-forest-100)] text-[var(--hsh-forest-700)]",
  link: "bg-[var(--hsh-gold-100)] text-[var(--hsh-gold-700)]",
  download: "bg-[var(--hsh-coral-100)] text-[var(--hsh-coral-700)]",
}

function ResourceLibrary({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] =
    useState<ResourceCategoryId | null>(null)

  const searchId = useId()

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sampleResources.filter((entry) => {
      if (activeCategory !== null && entry.category !== activeCategory) {
        return false
      }
      if (needle === "") return true
      /* The kind word is searchable too, so "guide" behaves the way a visitor
         reading the kind labels would expect. */
      return [
        entry.title,
        entry.description,
        resourceKindLabels[entry.kind],
      ].some((field) => field.toLowerCase().includes(needle))
    })
  }, [activeCategory, query])

  const isFiltered = activeCategory !== null || query.trim() !== ""

  const activeCategoryName =
    resourceCategories.find((category) => category.id === activeCategory)?.name

  function clearFilters() {
    setQuery("")
    setActiveCategory(null)
  }

  return (
    <>
      {/* Hero — copy left, the find-a-resource panel right, stacked below lg */}
      <section className="bg-[var(--hsh-surface-page)]">
        <div className="hsh-container hsh-container-public grid gap-[var(--hsh-space-10)] py-[var(--hsh-space-10)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:py-[var(--hsh-space-16)]">
          {children}

          {/* The reference sets a decorative botanical illustration beside this
              panel. No such asset exists and none may be generated
              (DESIGN-SYSTEM.md §5), so the panel stands on its own (D-R1). */}
          <div className="rounded-[var(--hsh-radius-feature)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-6)] shadow-[var(--hsh-shadow-card)] lg:p-[var(--hsh-space-8)]">
            <label
              htmlFor={searchId}
              className="hsh-h4 block text-[var(--hsh-text-primary)]"
            >
              {resourcesHero.searchPanelLabel}
            </label>
            <p className="hsh-body-sm mt-[var(--hsh-space-2)] text-[var(--hsh-text-muted)]">
              Searching narrows the entries shown below on this page.
            </p>
            <div className="relative mt-[var(--hsh-space-4)]">
              <Input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={resourcesHero.searchPlaceholder}
                aria-describedby={`${searchId}-count`}
                className="pr-[var(--hsh-space-12)]"
              />
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-[var(--hsh-space-4)] size-5 -translate-y-1/2 text-[var(--hsh-text-muted)]"
                strokeWidth={1.75}
              />
            </div>
            {/* Polite, so a result count reaches a screen-reader user without
                interrupting their typing (DESIGN-SYSTEM.md §10). */}
            <p
              id={`${searchId}-count`}
              aria-live="polite"
              className="hsh-body-sm mt-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
            >
              {matches.length === sampleResources.length && !isFiltered
                ? `${sampleResources.length} sample entries`
                : `${matches.length} of ${sampleResources.length} sample entries shown`}
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section
        aria-labelledby="resource-categories-heading"
        className="hsh-container hsh-container-public"
      >
        <h2 id="resource-categories-heading" className="sr-only">
          Resource categories
        </h2>
        <ul className="grid gap-[var(--hsh-space-6)] sm:grid-cols-2 lg:grid-cols-4">
          {resourceCategories.map((category) => {
            const Mark = categoryMarks[category.id]
            const isActive = activeCategory === category.id
            return (
              <li key={category.id} className="flex">
                <Card
                  className={cn(
                    "w-full justify-between",
                    isActive && "border-[var(--hsh-forest-600)]",
                  )}
                >
                  <div className="flex items-start gap-[var(--hsh-space-4)]">
                    <CardGlyph
                      className={cn("size-11", categoryMarkTones[category.id])}
                    >
                      <Mark className="size-5" strokeWidth={1.75} />
                    </CardGlyph>
                    <div className="flex flex-col gap-[var(--hsh-space-2)]">
                      <h3 className="hsh-h4 text-[var(--hsh-text-primary)]">
                        {category.name}
                      </h3>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                  {/* The pressed state is carried by the word and the check
                      mark as well as the border, never by colour alone. */}
                  <Button
                    variant="text"
                    size="md"
                    aria-pressed={isActive}
                    onClick={() =>
                      setActiveCategory(isActive ? null : category.id)
                    }
                    className="self-start"
                  >
                    {isActive ? (
                      <Check
                        aria-hidden="true"
                        className="size-4"
                        strokeWidth={1.75}
                      />
                    ) : null}
                    {isActive ? "Showing" : "Explore resources"}
                    <span className="sr-only"> — {category.name}</span>
                    {isActive ? null : (
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4"
                        strokeWidth={1.75}
                      />
                    )}
                  </Button>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Library */}
      <section
        aria-labelledby="resource-library-heading"
        className="hsh-container hsh-container-public mt-[var(--hsh-space-16)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-4)]">
          <h2
            id="resource-library-heading"
            className="hsh-h2 text-[var(--hsh-text-primary)]"
          >
            {libraryHeading.heading}
          </h2>
          <Button
            variant="text"
            size="md"
            onClick={clearFilters}
            disabled={!isFiltered}
          >
            {libraryHeading.clearLabel}
            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
          </Button>
        </div>

        {/* The honest label for what these entries are. Kept beside them rather
            than in a footnote, because a reviewer reads the cards, not the
            small print (prompt §1). */}
        <div className="mt-[var(--hsh-space-6)] flex items-start gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-5)]">
          <Sprout
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-forest-600)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-1)]">
            <p className="hsh-label text-[var(--hsh-text-primary)]">
              {sampleNotice.heading}
            </p>
            <p className="hsh-body-sm max-w-[68ch] text-[var(--hsh-text-secondary)]">
              {sampleNotice.body}
            </p>
          </div>
        </div>

        {activeCategoryName ? (
          <p className="hsh-body-sm mt-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
            Filtered to {activeCategoryName}.
          </p>
        ) : null}

        {matches.length === 0 ? (
          <div className="mt-[var(--hsh-space-6)] flex flex-col items-start gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-8)]">
            <p className="hsh-h4 text-[var(--hsh-text-primary)]">
              No sample entries match that search
            </p>
            <p className="hsh-body max-w-[56ch] text-[var(--hsh-text-secondary)]">
              Try a different word, or clear the search to see all
              {` ${sampleResources.length} `}
              entries again.
            </p>
            <Button variant="secondary" size="md" onClick={clearFilters}>
              Clear search and filters
            </Button>
          </div>
        ) : (
          <ul className="mt-[var(--hsh-space-6)] grid gap-[var(--hsh-space-6)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {matches.map((entry) => {
              const Mark = kindMarks[entry.kind]
              return (
                <li key={entry.id} className="flex">
                  <Card className="w-full justify-between">
                    <div className="flex flex-col gap-[var(--hsh-space-3)]">
                      <CardGlyph
                        className={cn("size-11", kindMarkTones[entry.kind])}
                      >
                        <Mark className="size-5" strokeWidth={1.75} />
                      </CardGlyph>
                      {/* The kind is a content type, not a status, so it is a
                          label rather than a `Badge` — the badge component is
                          the MDS §6 *status* indicator and borrowing it here
                          would make a guide read as an enrollment state. The
                          word carries the meaning either way. */}
                      <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
                        {resourceKindLabels[entry.kind]}
                      </p>
                      {/* Body size, not `hsh-h4`: five entries share the 1200 px
                          public container, and the reference sets these titles
                          at reading size. Still an h3 in the outline. */}
                      <h3 className="hsh-body font-[family-name:var(--hsh-font-ui)] font-semibold text-[var(--hsh-text-primary)]">
                        {entry.title}
                      </h3>
                      <CardDescription className="hsh-body-sm">
                        {entry.description}
                      </CardDescription>
                    </div>
                    {/* The reference draws each action as a link. There is no
                        file, URL, or storage object behind any sample entry, so
                        the wording is kept and stated as unavailable rather
                        than rendered as a link that goes nowhere. */}
                    <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
                      {resourceKindActions[entry.kind]} — not available for a
                      sample entry
                    </p>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

export { ResourceLibrary }
