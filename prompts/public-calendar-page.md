# Implementation prompt — Public calendar page

Target visual: `mds/references/assets/public-calendar-reference.png` (MDS-REF-010)
Requested by owner, 2026-08-27. Approved as canonical MDS by the owner on
2026-08-28 — see §14.

## 0. Authority notice (read first)

`mds/references/assets/public-calendar-reference.png` is the approved,
canonical **MDS-REF-010** reference for this page. It authorizes the calendar
shell, month grid, notes rail, programs panel, and guidance pathway. The
written MDS sources remain authoritative for every visual decision, including
`mds/specification/DESIGN-SYSTEM.md`, `mds/tokens/`, and the canonical
component, shell/grid, and public-hierarchy references (MDS-REF-004 through
MDS-REF-006).

MDS-REF-010 does not authorize inferred content, taxonomy, chronology, or
unseen interaction states. Its promotion is recorded in MDS-CHG-008; any
future version bump remains an MDS governance action for the owner.

## 1. Goal and scope

Ship `/calendar` as a public, statically rendered page showing the published
Home School Haven calendar: a month grid, a list view of the same events, a
published-programs panel, and the guidance pathway. Make Calendar a live
destination in the primary navigation.

Out of scope: calendar download / iCalendar export (MPS-FEA-015 is a **Should**,
deferred by `mps/SCOPE-RELEASE-PLAN.md` until Must workflows are stable),
per-family or enrollment-aware calendars, any authenticated calendar surface,
event administration, and any Supabase schema change.

## 2. Applicable IDs

- MPS-REQ-007 / MPS-REQ-008 (public discovery of published content),
  MPS-REQ-020 / MPS-REQ-021 (consistency; never present stale or invented state),
  MPS-REQ-009 (Request Guidance pathway), MPS-ACC-009 / MPS-ACC-010 (published
  facts only; empty states offer a path).
- Import rules 1, 3, 7 and QA-001, QA-002, QA-005, QA-006 in
  `mps/BETA-CONTENT-IMPORT-INVENTORY.md`.
- DESIGN-SYSTEM.md §2 colour, §3 type roles, §4 spacing/shape/elevation,
  §5 iconography (Lucide, 1.75 px), §6 component contract and trust-state rules,
  §7 containers/shells, §8 responsive behaviour, §10 accessibility.
- MDS-REF-005 §4 header/shell, MDS-REF-004 badge and card contracts.
- MTS: no new integration; public read path only.

## 3. Content truth — the whole point of this page

Source: the **Calendar inventory** table in
`mps/BETA-CONTENT-IMPORT-INVENTORY.md`, preserved verbatim:

| Event | Published detail |
|---|---|
| Summer Break | June 26, 2026–September 7, 2026; Enrichment only |
| Fall Preview Day / Open House | August 3, 2026; Enrichment and Ready Set Prep |
| Ready Set Prep begins | August 4, 2026 |
| Ready Set Prep operating range | "August 2026–May 2026" (QA-002) |
| Haven Days Enrichment begins | September 1, 2026 |
| Haven Days Enrichment range | September 2026–June 2027 |

Rules this page must obey:

1. **Only entries that publish an explicit day and year are plotted on the
   grid.** Program ranges such as Sewing's "September 15–October 5" publish no
   year; assigning one would invent a fact (import rule 3). Art Lab's
   "August 22–September 26, 2026" does publish a year and is plotted.
2. **QA-002 is preserved, not corrected.** "August 2026–May 2026" renders as
   written, in a term-range list, with a visible note that the published range
   is under review with Home School Haven. Do not silently write 2027.
3. Month-level ranges (the two term ranges) are never drawn as day cells.
4. Every event carries its published detail text as written. Nothing is
   summarized into a new claim.
5. The page says plainly that not all details are published here and that they
   are confirmed directly with Home School Haven.

## 4. Deviations from the proposed image (each with its reason)

- **D-C1 — Category filter chips (All / Classes / Workshops / Community) are
  omitted.** No published source assigns any offering or calendar entry to those
  categories. Building the chips requires inventing a taxonomy and then
  inventing each entry's membership (import rule 3; the same reasoning already
  recorded as D-2 on the catalog filter rail).
- **D-C2 — The default month is the current month, not May 2026.** The image
  shows an empty May 2026 with a decorative dot on the 12th, which corresponds
  to no published event.
- **D-C3 — The right panel is titled "Published programs", not "Upcoming".**
  Most published program ranges carry no year, so ordering them as "upcoming"
  would assert a chronology the source does not publish. The panel reuses
  `listPublishedPrograms()` and shows each program's published date text.
- **D-C4 — Program-detail imagery in that panel stays the existing demo
  placeholder set**, with the established "Placeholder photo — demo only" alt
  text. No new imagery is generated.
- **D-C5 — The footer is the existing approved `SiteFooter`.** The image shows a
  different footer composition (values row, link columns); the implemented
  footer is already approved and is not redesigned here.
- **D-C6 — Month / List is a real view toggle over the same data**, kept from
  the image because it introduces no content, and because the list view is what
  makes the month grid usable on small viewports.

## 5. Repository evidence inspected

- `src/app/programs/page.tsx`, `src/app/page.tsx` — public page shell pattern:
  `SkipLink` + `SiteHeader` + `main#main` + `SiteFooter`, `hsh-container
  hsh-container-public`, token-only spacing, `Breadcrumbs`.
- `src/components/layout/site-header.tsx` + `src/content/foundation-content.ts`
  — `primaryNav` gates unavailable destinations with `available: false`.
- `src/content/programs.ts`, `src/lib/programs/repository.ts` — staging module ⇄
  Supabase read pattern; `null` means "system of record unreadable".
- `src/components/ui/badge.tsx`, `card.tsx`, `button.tsx` — REUSE targets.
- `src/app/globals.css` — `--hsh-*` tokens and `hsh-*` type utilities.
- `supabase/migrations/` — no calendar table exists; none is added.
- `tests/e2e/*.spec.ts` — Playwright + axe + screenshot conventions.

## 6. Files expected

New:
- `src/content/calendar.ts` — approved calendar inventory as typed data
  (`CalendarEntry` with `title`, `publishedDetail`, `start`/`end` as explicit
  ISO dates **only when the source publishes day + year**, `termRange` entries
  for month-level ranges, `qaNote` for QA-002, `source`).
- `src/app/calendar/page.tsx` — page shell, intro, notes rail, programs panel,
  guidance band. Statically rendered, no `revalidate` (same reasoning already
  recorded in `src/app/programs/page.tsx`).
- `src/components/calendar/calendar-view.tsx` — client component: month
  navigation (Previous / Today / Next), Month/List toggle, month grid, list.
- `src/components/calendar/month-grid.tsx`, `event-list.tsx` — presentation.
- `tests/e2e/calendar.spec.ts` — render, navigation, axe, ARIA snapshot,
  screenshots at 1440 / 768 / 375.

Changed:
- `src/content/foundation-content.ts` — Calendar `available: true`.
- `src/components/layout/site-header.tsx` — only if the "Section pages open
  later in this review" mobile notice needs its wording adjusted.

No schema, migration, environment, or dependency change.

## 7. Design and interaction requirements

- Month grid is a real `<table>` with a `<caption>`, `scope="col"` weekday
  headers, and dates as cells; days carrying an event announce the event by
  name, not by a coloured dot alone (§10, DO-DONT "Trust states").
- Today is marked with both a visual treatment **and** text (`aria-current="date"`
  plus a visually hidden "Today").
- Month/List toggle: `role="radiogroup"` with two radios, or Base UI Toggle
  Group; keyboard-operable, 44 px targets, visible focus using `--hsh-focus`.
- Below `lg`, the grid collapses to the list view (§8 table-to-card behaviour);
  the toggle stays available. The notes rail moves below the calendar.
- Month navigation updates a live region announcing the new month.
- All colour, type, spacing, radius, elevation from `--hsh-*` tokens; icons
  Lucide at `strokeWidth={1.75}`.
- Reduced-motion respected; no motion is required for meaning.

## 8. Security, privacy, data handling

Public route, published content only. No authentication, no cookies, no
`cookies()` call, no personal data, no analytics. Program reads go through the
existing anonymous client (`listPublishedPrograms`), which is RLS-restricted to
published rows. `null` from that read renders the existing `ProgramDataError`
state rather than staging content. Nothing new is logged.

## 9. Rollback

Additive. Reverting means deleting the new files and flipping Calendar back to
`available: false`; no data or schema state to unwind.

## 10. Checks to run

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`,
`npm run build`, `npx playwright test tests/e2e/calendar.spec.ts` (render,
keyboard, axe, ARIA snapshot, 1440/768/375 screenshots), plus manual review of
the rendered page against the proposed image and the approved tokens.

## 11. Manual test steps (WSL/Ubuntu bash)

```bash
npm run dev
```
1. Open http://localhost:3000/calendar — August 2026 shows Fall Preview Day
   (Aug 3), Ready Set Prep begins (Aug 4), Art Lab begins (Aug 22), and Summer
   Break spanning the month.
2. Press Next — September 2026 shows Haven Days Enrichment begins (Sep 1), Summer
   Break ending Sep 7, Art Lab ending Sep 26. Press Today to return.
3. Navigate to a month with no published entries and confirm the empty state
   offers Request Guidance rather than a dead end.
4. Confirm the term-range list shows "August 2026–May 2026" verbatim with its
   under-review note.
5. Tab through: month controls → view toggle → grid → programs panel → guidance.
   Focus is always visible.
6. Resize to 375 px: the grid becomes the list, nothing scrolls horizontally.
7. Confirm Calendar is active in the header on desktop and in the mobile menu.

## 12. Assumptions and open gaps

- A-1: The calendar inventory is complete for the Foundation Review. No entry is
  added from any other source.
- A-2: QA-002 remains unresolved; the page shows the anomaly rather than a fix.
- GAP: A Supabase-backed calendar entity does not exist and is not requested.
  If administrators must publish calendar entries, that is a separate MPS/MTS
  step.
- Owner action still required: answer QA-002. MDS-REF-010 is already
  canonical; its associated minor-version bump remains an MDS governance
  action.

## 13. As built (2026-08-28)

Implemented as specified, with three refinements made during implementation:

- **D-C7** — the "Published term ranges" section sits in the left column under
  the calendar rather than full width. The programs panel is much taller than
  the month grid, and leaving that column empty read as a gap; the dated
  content now reads top to bottom in one column.
- **D-C8** — a long range is named on the grid where it starts, where it ends,
  and once at the opening of the month, marked "continues". Repeating "Summer
  Break" in all 74 of its cells buried the days that actually mark something.
- **D-C9** — the month grid and the list are never both in the DOM. The `lg`
  breakpoint is read as state (`useSyncExternalStore` over `matchMedia`), so a
  screen-reader user hears the month once. Rendering both and hiding one with
  `lg:hidden` duplicated every entry.

One accessibility defect was found and fixed during verification: out-of-month
day numbers used Neutral 400, which is 2.48:1 on the elevated surface and fails
AA. They now use `--hsh-text-muted`.

Checks run and their real results are recorded in the completion report.

## 14. Reference promotion (2026-08-28)

The owner approved the public calendar as official MDS and directed promotion.
Recorded as MDS-CHG-008:

- `public-calendar-proposed.png` moved to
  `mds/references/assets/public-calendar-reference.png`;
- registered as **MDS-REF-010** in `mds/references/REFERENCE-INDEX.md`, with the
  three content inferences (category chips, May 2026 dot, "Upcoming" ordering)
  recorded so the reference is authoritative for the shell and not for content;
- added to `mds/MDS-PROJECT-STATE.yaml` as MDS-REF-010 and MDS-UI-REF-005, and
  to DESIGN-SYSTEM.md §11;
- removed from `mds/references/proposed/README.md`.

Two governance items are left for the owner: DESIGN-SYSTEM.md §13 makes a
reference addition a minor release, and the v1.0 → v1.1 bump is an MDS
governance action not applied here; and QA-002 remains open, so Ready Set Prep
dates are unchanged and still render as published.
