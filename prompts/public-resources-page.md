# Implementation prompt — Public resources page

Target visual: `mds/references/proposed/public-resources-proposed.png`
Requested by owner, 2026-08-28. Branch: `feat/public-resources`.

## 0. Authority notice (read first)

`mds/references/proposed/README.md` marks this image **Proposed — not approved,
not canonical**, with no MDS-REF ID. It has no design authority. This prompt
treats it as *layout intent* only. Authority for every visual decision remains
`mds/specification/DESIGN-SYSTEM.md`, `mds/tokens/`, and the canonical
references (MDS-REF-004 components, MDS-REF-005 shell/grid, MDS-REF-006 public
hierarchy, MDS-REF-010 public page precedent).

Approving this prompt authorizes building the page. It does **not** promote the
image into `mds/references/assets/` or the reference index — that stays an MDS
governance action for the owner, as it was for MDS-REF-010.

## 1. The product problem this page raises (read before approving)

This is not the About page. About drew copy the owner could simply adopt as
their own words. This image draws a **public resource library**: a search field
over a corpus, four category cards that promise category destinations, and five
resource entries with kinds (GUIDE / LINK / DOWNLOAD).

Two facts from the approved systems:

1. **No public resource library is approved product scope.** Every "learning
   resource" in MPS is private and program-scoped: MPS-REQ-015 (a *parent's*
   dashboard), MPS-REQ-018 (an *educator's* assigned programs), MPS-REQ-019
   (educators and administrators publish them), MPS-ACC-029 / MPS-ACC-030
   (unauthorized families are denied). MTS matches — CAPABILITY-MATRIX
   "Learning-resource files → Private Supabase Storage, signed/scoped access";
   TECHNOLOGY-BLUEPRINT §5 "Private resources remain in private buckets".
   Nothing in MPS approves a public, unauthenticated resource library.

2. **No public resource content exists.** `mps/BETA-CONTENT-IMPORT-INVENTORY.md`
   has no resources row. The image knows this: every entry it draws is literally
   titled "Sample resource: …". Publishing five invented documents as real
   Home School Haven guidance would violate MPS-REQ-020 / MPS-REQ-021 and
   MPS-ACC-009 / MPS-ACC-010 (never present invented state; published facts
   only) — the exact rule that keeps unpublished prices and capacities off the
   program pages.

One part of the image *is* squarely inside approved scope, and it is the part
that matters most: the **"Resources for enrolled families"** band. Private,
program-specific materials living behind the family account is precisely
MPS-REQ-015 and the private-storage posture. So is the "Looking for something
specific?" band, which is the approved MPS-REQ-009 guidance pathway.

### Recommended resolution (what this prompt builds)

Build the full composition, and make the sample entries **visibly and
programmatically sample data** rather than dressing them as published resources:

- Every entry keeps its drawn "Sample resource:" title verbatim — the image's
  own honesty is preserved, not sanded off.
- The section carries a visible, non-colour-dependent notice: these are layout
  placeholders for owner review, not published Home School Haven resources.
  This is the same convention already used for demo photography
  (`public/placeholder/README.md`) and for the header's "not yet available in
  this review" wording.
- The search field is **real**: it filters the entries actually on the page,
  client-side. It does not imply a larger corpus, return fabricated results, or
  post anywhere.
- The four category cards become **in-page filters**, not links to category
  routes that do not exist. This follows the standing owner decision of
  2026-08-27 that the review contains no broken links.

Alternatives the owner may prefer instead, either of which is a smaller change
to this prompt:

- **B — Omit the sample grid.** Ship hero, search, categories, the enrolled-
  families band and the guidance band, with an honest empty state where the
  entries are, until real resources exist. Loses the composition's middle.
- **C — Defer the page.** Leave Resources `available: false` until approved
  public resource content exists. Nothing is built.

## 2. Goal and scope

Ship `/resources` as a public, statically rendered page composed of: a resources
hero with the find-a-resource panel, four category cards, a filterable list of
clearly-marked sample entries, the enrolled-families sign-in band, and the
guidance band. Make Resources a live destination in the primary navigation and
footer.

Out of scope: any real resource corpus; any Supabase table, bucket, migration,
or read; any file download; any category route; any authenticated surface; any
upload or publishing UI (that is MPS-REQ-019, a later phase); server-side
search; analytics.

## 3. Applicable IDs

- MPS-REQ-007 / MPS-REQ-008 (public discovery of published content),
  MPS-REQ-009 (Request Guidance pathway), MPS-REQ-015 (private family
  resources — referenced by the sign-in band, not implemented here),
  MPS-REQ-020 / MPS-REQ-021 (consistency; never present invented state),
  MPS-ACC-009 / MPS-ACC-010 (published facts only).
- `mps/BETA-CONTENT-IMPORT-INVENTORY.md` import rules 1, 3, 7.
- DESIGN-SYSTEM.md §2 colour, §3 type roles, §4 spacing/shape/elevation,
  §5 iconography (Lucide, 1.75 px, no generated imagery), §6 component contract
  (card, input, button, text link, badge), §7 containers/shells, §8 responsive
  behaviour, §10 accessibility.
- MTS: no new integration; static public route, no data read, no storage access.

## 4. Content truth

| Group | Source | Use |
|---|---|---|
| Hero, panel label, category names and descriptions, band copy | Owner-approved image copy, if the owner approves as they did for About | Rendered verbatim |
| The five entries | **Sample data**, marked as such in the module, the UI, and the tests | Layout demonstration only |
| Guidance / Sign In destinations | Inventory "Primary public conversion paths" | Existing `guidanceHref`, `/sign-in` |

`src/content/resources.ts` tags every entry `source: "sample-placeholder"` and
every owner string `source: "owner-approved-resources-reference"`, mirroring the
two-provenance pattern already established in `src/content/about.ts`. No price,
schedule, capacity, educator, enrollment state, or partner name appears.

Deviations from the image, each with its reason:

- **D-R1 — The decorative botanical illustrations are omitted** (beside the
  search panel and behind the guidance band). No such asset exists and
  DESIGN-SYSTEM.md §5 forbids generating one. The established Lucide leaf mark
  carries the role, as it does on About (D-A5).
- **D-R2 — The footer is the existing approved `SiteFooter`.** The image draws
  a different footer composition — five columns, a "Get Updates" action, a
  decorative heart-and-vine rule. That footer is a separate approved-design
  change, not part of this page (same reasoning as D-A7 and D-C5).
- **D-R3 — Category cards filter in place instead of linking to category
  routes.** No category pages exist or are approved; a dead "Explore resources
  →" link would be the broken link the owner ruled out on 2026-08-27. The
  affordance keeps its drawn label and becomes a real, announced filter.
- **D-R4 — "View all resources →" clears the active filter** rather than
  linking to an index route that does not exist. Same reasoning.
- **D-R5 — The entries are marked as review placeholders.** §1 above.
- **D-R6 — A breadcrumb trail (Home / Resources) is added,** which the image
  does not draw. Every other public page carries one and `public-shell.spec.ts`
  pins the shell (same reasoning as D-A12).
- **D-R7 — "Learn more about access" points at `/sign-in`,** the only approved
  destination that explains Foundation Release account provisioning. No new
  access-policy page is written.

## 5. Repository evidence inspected

- `src/app/about/page.tsx`, `src/content/about.ts`,
  `prompts/public-about-page.md` — the proposed-image precedent, the two-
  provenance content pattern, and the deviation-recording convention.
- `src/app/calendar/page.tsx`, `src/components/calendar/calendar-view.tsx` —
  the established public client-interaction pattern: a small `"use client"`
  component under a static page, `useState` only, no data read.
- `src/app/programs/page.tsx` — static public route with no `revalidate`.
- `src/content/foundation-content.ts` — `primaryNav` (Resources currently
  `available: false`), `guidanceHref`, `accountNav`.
- `src/components/layout/{site-header,site-footer,breadcrumbs,skip-link}.tsx` —
  availability gating that flips when the route exists.
- `src/components/ui/{card,button,input,text-link,badge}.tsx` — REUSE targets.
  `Input` is the `@base-ui/react` input at 44 px with the Coral 700 focus ring.
- `src/app/globals.css` — `--hsh-*` tokens and `hsh-*` type utilities.
- `tests/e2e/about.spec.ts`, `public-shell.spec.ts` — Playwright + axe +
  ARIA-snapshot + screenshot conventions and the viewport set.
- `package.json` — check commands (§10).

## 6. Files expected

New:
- `src/content/resources.ts` — `resourcesHero`, `resourceCategories`,
  `sampleResources`, `enrolledFamiliesBand`, `resourcesGuidanceBand`; a
  `ResourceKind` union (`guide | link | download`); a `source` tag on every
  entry.
- `src/app/resources/page.tsx` — static page: shell, hero, categories, library,
  the two bands.
- `src/components/public/resource-library.tsx` — `"use client"`; the search
  field, the category filter state, the filtered grid, and the empty state.
- `tests/e2e/resources.spec.ts` — render, headings, axe, ARIA snapshot,
  keyboard, target size, filter and search behaviour, the placeholder notice,
  screenshots at 1440 / 1280 / 768 / 390.

Changed:
- `src/content/foundation-content.ts` — Resources `available: true`.
- Existing screenshot baselines for pages whose header/footer now show one more
  live nav item (home, about, calendar, programs, guidance, sign-in), re-recorded
  and diffed to confirm the nav item is the only change.

No schema, migration, environment, dependency, or configuration change.

## 7. Design and interaction requirements

- One `h1`; sections use `h2` with `aria-labelledby`; entries are `h3`-titled
  cards in a list.
- All colour, type, spacing, radius, elevation from `--hsh-*` tokens; icons
  Lucide at `strokeWidth={1.75}`; category and kind marks reuse the existing
  glyph surface/ink token pairs (forest / gold / coral) already used on home,
  programs, and about.
- Hero: two columns from `lg` — copy left, the find-a-resource panel right as a
  raised card; stacked below `lg`.
- Categories: 4-up from `lg`, 2-up at `sm`, 1-up below.
- Library: 5 entries; wraps from 5-up down through 3-up and 2-up to 1-up. The
  kind label is a `Badge` with a visible word, never colour alone
  (DESIGN-SYSTEM.md §10, DO-DONT.md "Trust states").
- Bands: two columns from `lg`, stacked below.
- Search input: labelled (visible "Find a resource" label, not placeholder-only),
  `type="search"`, filters on input, results count announced through a polite
  live region, empty state when nothing matches.
- Category filter: pressed state exposed with `aria-pressed`, and reflected by
  more than colour.
- 44 px minimum interactive targets; visible focus using `--hsh-focus`; reduced
  motion respected; no meaning carried by colour alone; no horizontal scroll at
  any viewport.

## 8. Security, privacy, data handling

Public route, no authentication, no cookies, no `cookies()` call, no Supabase
read, no storage access, no signed URL, no personal or child data, no analytics,
no network request of any kind. Search runs entirely in the browser over a
module constant and is never sent anywhere, so no query text is logged or put in
a URL. The sign-in band links to the existing `/sign-in` route and asserts
nothing about any family's enrollment. Nothing new is logged.

## 9. Rollback

Additive. Reverting means deleting the three new source files and the spec,
flipping Resources back to `available: false`, and restoring the re-recorded
baselines. No data or schema state to unwind.

## 10. Checks to run

`npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run test:unit`, `npm run build`, then
`npx playwright test tests/e2e/resources.spec.ts tests/e2e/public-shell.spec.ts
tests/e2e/home.spec.ts tests/e2e/about.spec.ts` (the nav flip touches every
public baseline), and manual review of the rendered page against the proposed
image and the approved tokens at 1440 / 1280 / 768 / 390.

## 11. Manual test steps (WSL/Ubuntu bash)

```bash
npm run dev
```
1. Open http://localhost:3000/resources — hero with the search panel, four
   category cards, the entry grid, the enrolled-families band, and the guidance
   band render in that order.
2. Confirm the placeholder notice is visible above the entries and that every
   entry title begins "Sample resource:".
3. Type "planning" in the search field — the grid narrows, the result count is
   announced, and clearing the field restores all five.
4. Type "xyzzy" — the empty state appears and explains how to clear the search.
5. Activate "Getting Started" — the grid filters to that category, the card
   shows a pressed state, and "View all resources" clears it.
6. Tab through: skip link → header → search → category cards → entries → band
   actions. Focus is always visible; nothing is reachable only by pointer.
7. Confirm "Sign In" reaches `/sign-in` and both guidance actions reach
   `/guidance` and `/contact`'s stand-in (guidance, until Contact ships).
8. Resize to 768 and 390 px: sections stack, nothing scrolls horizontally, all
   targets stay ≥ 44 px.
9. Confirm Resources is active in the desktop header, in the mobile menu, and
   links from the footer.
10. With `prefers-reduced-motion: reduce` set, confirm no filter transition
    animates.

## 12. Assumptions and open gaps

A-1, A-2, and A-3 were confirmed by the owner and are now decisions, recorded
below. Nothing in §12 remains an assumption.

### Owner decisions, 2026-08-28

1. **The public resource library is demo-only and is *not* approved MPS scope.**
   The sample entries stay labelled as samples. They must not be replaced with
   invented "real" resources. Replacing them still requires an MPS requirement,
   acceptance criteria, and an import-inventory row first — and this decision
   says that work has not been authorized, not merely that it has not happened.
2. **`public-resources-proposed.png` is not promoted** into
   `mds/references/assets/` or the reference index until the owner says so. It
   stays in `mds/references/proposed/` with no MDS-REF ID, and it remains layout
   intent rather than design authority.
3. **"Contact Us" keeps pointing at `/guidance`** until `/contact` exists.
4. **D-R3 stands: category cards filter in place.** Category routes are not
   wanted.
5. The image's copy is Home School Haven's own words, as it was for About
   ("keep image copy").

### Still open

- Whether a public resource library ever becomes approved product scope. Until
  it does, decision 1 governs, and this page is a review artifact rather than a
  content surface.
- Whether the reference is eventually promoted (decision 2).

## 13. As built (2026-08-28)

Owner decisions taken at approval: resolution **A** from §1 (the composition
ships with visibly-marked sample entries) and **"keep image copy"** for the
page's wording, matching the About precedent.

Implemented as specified, with three refinements made while comparing the render
with the reference:

- **D-R8 — Kind marks and tones follow the kind, not the grid position.** The
  reference alternates the glyphs decoratively; two guides carry different
  marks. Tying mark, word, and action wording to the kind means all three say
  the same thing.
- **D-R9 — The kind label is a label, not a `Badge`.** It was first built with
  the `Badge` component. `Badge` is documented as the MDS §6 *status* indicator,
  and a content type is not a status: a guide rendered in the `open` tone reads
  as an enrollment state. It is now the uppercase `hsh-label` treatment the
  reference actually draws, which carries the word either way.
- **D-R10 — Entry titles are body size, not `hsh-h4`; band headings are `h4`
  size, not `h3`.** Five entries share the approved 1200 px public container, so
  `hsh-h4` titles wrapped to four lines and the band headings to three. The
  reference sets both at reading size. Both remain `h3` / `h2` in the outline.

The lone decorative leaf first placed in the guidance band was removed rather
than kept: on About the leaf sits inside the quote card and has a role, but
floating beside a band it was noise, and D-R1 already says the botanical
illustrations are omitted.

Checks run and their real results are recorded in the completion report. The
public visual baselines for home, about, calendar, programs, guidance, and
sign-in were re-recorded; the diff was inspected first and confirmed the only
change is the Resources nav item, now a live link in the header and footer
rather than dimmed text.
