# Implementation prompt — Public about page

Target visual: `mds/references/proposed/public-about-proposed.png`
Requested by owner, 2026-08-28. Branch: `feat/public-about`.

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

## 1. Goal and scope

Ship `/about` as a public, statically rendered page: an about hero, the approved
values band, an approach section, a faith-and-character panel, a community
section, and the guidance pathway. Make About a live destination in the primary navigation and footer.

Out of scope: a founder long-form story page, partner or collaborator records
(QA-004 — no verified source), testimonials, new photography, any Supabase
schema change, any authenticated surface.

## 2. Applicable IDs

- MPS-REQ-007 / MPS-REQ-008 (public discovery of published content),
  MPS-REQ-009 (Request Guidance pathway), MPS-REQ-020 / MPS-REQ-021
  (consistency; never present invented state), MPS-ACC-009 / MPS-ACC-010
  (published facts only).
- `mps/BETA-CONTENT-IMPORT-INVENTORY.md` import rules 1, 3, 7; QA-004, QA-005.
- DESIGN-SYSTEM.md §2 colour, §3 type roles, §4 spacing/shape/elevation,
  §5 iconography (Lucide, 1.75 px, no generated imagery), §6 component
  contract, §7 containers/shells, §8 responsive behaviour, §10 accessibility.
- MTS: no new integration; static public route, no data read.

## 3. Content truth — the whole point of this page

Two provenances, both approved, both recorded in `src/content/about.ts`:

| Source | Use on the page |
|---|---|
| Inventory — Values | Values band (verbatim, order preserved) |
| Inventory — Primary public conversion paths | Explore Programs / Request Guidance |
| Owner-approved image copy (see §4) | Hero heading, mission and summary paragraphs, approach items, faith panel and Matthew 5:16 quote, community cards |

Nothing outside these two sources appears on the page. No published price,
schedule, capacity, educator assignment, enrollment state, or partner name is
introduced, and no biography is written for any named person.

## 4. Owner content decision (2026-08-28)

Approval answer: **"Approved, but keep image copy."** The owner directed that
the copy drawn in the proposed image is reproduced verbatim and is treated as
**owner-supplied approved content**, not as an inventory import. This resolves
what would otherwise be import-rule-3 violations, and it is recorded here so the
provenance of every string on the page stays traceable.

Owner-supplied strings (source: the proposed image, approved by the owner on
2026-08-28):

- the h1 "A haven for curious learners and connected families";
- the hero mission paragraph "Our mission is simple: to cultivate calm,
  confident, and compassionate learners through creativity, curiosity, and
  connection.", and the hero summary as drawn;
- the two "Our approach" items and their descriptions;
- the "Faith expressed through character" paragraph and the Matthew 5:16 quote
  card;
- the four "Meet our community" cards — Educators, Mentors, Families, Community
  — and their descriptions, and the section's supporting line.

`src/content/about.ts` marks each of these `source: "owner-approved (proposed
about reference, 2026-08-28)"`, distinct from the `source: "beta-content-import
-inventory"` rows, so a later content review can tell them apart. The Values
band still renders the inventory `values` array verbatim.

Deviations that remain, each with its reason:

- **D-A5 — The decorative botanical illustration is omitted.** No such asset
  exists and DESIGN-SYSTEM.md §5 forbids generating one. The faith panel uses
  the established Lucide leaf/sprig treatment already used on the home page.
- **D-A6 — The community cards use token-based icon marks, not photographs.**
  The image draws generic avatar glyphs; no approved photography exists, so each
  card uses the existing value-mark icon treatment.
- **D-A7 — The footer is the existing approved `SiteFooter`.** The image shows a
  different footer composition; the implemented footer is approved and is not
  redesigned here (same reasoning as D-C5 on the calendar).
- **D-A8 — The hero photo is the existing demo placeholder** (`hero.jpg`) with
  the established "Placeholder photo — demo only" alt text. No new imagery is
  generated or cropped.
- **D-A9 — The published people roster is not added.** The image shows role
  cards rather than named people, and the owner approved the image copy; the
  four published educators stay unused here rather than being merged into a
  composition that was not approved for them.

## 5. Repository evidence inspected

- `src/app/page.tsx` — public hero, values band, guidance band, community story
  composition and its token usage; the `valueMarks` array this page reuses.
- `src/app/calendar/page.tsx`, `src/app/programs/page.tsx` — public shell
  pattern: `SkipLink` + `SiteHeader` + `main#main` + `SiteFooter`,
  `hsh-container hsh-container-public`, static render with no `revalidate`.
- `src/content/foundation-content.ts` — `values`, `positioning`, `heroImage`,
  `primaryNav` (`About` currently `available: false`), `guidanceHref`.
- `src/components/layout/site-header.tsx`, `site-footer.tsx` — availability
  gating that flips when the route exists.
- `src/components/ui/{card,button,text-link}.tsx` — REUSE targets.
- `src/app/globals.css` — `--hsh-*` tokens and `hsh-*` type utilities.
- `public/placeholder/README.md`, `scripts/check-demo-placeholders.mjs` —
  placeholder alt-text and prebuild rules the page must satisfy.
- `tests/e2e/*.spec.ts` — Playwright + axe + ARIA-snapshot + screenshot
  conventions and viewport set.

## 6. Files expected

New:
- `src/content/about.ts` — typed approved content: `aboutHero`, `approachItems`,
  `faithPanel` (including the Matthew 5:16 quote), `communityGroups`, each with a
  `source` note distinguishing owner-approved copy from inventory rows.
- `src/app/about/page.tsx` — static page; hero, values band, approach + faith
  two-column, community section, guidance band.
- `src/components/public/value-band.tsx` — the values band lifted out of
  `src/app/page.tsx` so both pages render one implementation (REUSE before
  CREATE).
- `tests/e2e/about.spec.ts` — render, headings, axe, ARIA snapshot, keyboard,
  target size, screenshots at 1440 / 768 / 375.

Changed:
- `src/content/foundation-content.ts` — About `available: true`.
- `src/app/page.tsx` — import the extracted value band (no visual change).

No schema, migration, environment, dependency, or configuration change.

## 7. Design and interaction requirements

- One `h1`; sections use `h2` with `aria-labelledby`; community people are a
  list of `h3`-titled cards.
- All colour, type, spacing, radius, elevation from `--hsh-*` tokens; icons
  Lucide at `strokeWidth={1.75}`; initial marks use the existing value-mark
  surface/ink token pairs.
- Hero: two-column from `lg`, stacked below, matching the home hero's bleed
  treatment only if it does not create horizontal scroll; otherwise the inset
  rounded panel.
- Approach / faith: two columns from `lg` with the divider rule from the image
  rendered as a token border; stacked below `lg`.
- Community: 4-up from `lg`, 2-up at `sm`, 1-up below.
- Guidance band reuses the existing home/calendar band pattern with both
  approved actions.
- 44 px minimum interactive targets; visible focus using `--hsh-focus`;
  reduced motion respected; no meaning carried by colour alone.

## 8. Security, privacy, data handling

Public route, published content only. No authentication, no cookies, no
`cookies()` call, no Supabase read, no personal or child data, no analytics.
The named people are already published on the current public website; no
contact details, photographs, or private information are added. Nothing new is
logged.

## 9. Rollback

Additive. Reverting means deleting the new files, restoring the values band
into `src/app/page.tsx`, and flipping About back to `available: false`. No data
or schema state to unwind.

## 10. Checks to run

`npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run test:unit`, `npm run build`, `npx playwright test tests/e2e/about.spec.ts`
plus `tests/e2e/home.spec.ts` and `public-shell.spec.ts` (the nav flip and the
extracted band touch both), and manual review of the rendered page against the
proposed image and the approved tokens at 1440 / 768 / 375.

## 11. Manual test steps (WSL/Ubuntu bash)

```bash
npm run dev
```
1. Open http://localhost:3000/about — hero, values band, approach, faith panel,
   community, guidance band render in that order.
2. Confirm every value string matches the home page exactly.
3. Confirm the four community cards, the approach items, and the faith panel
   including the Matthew 5:16 quote read exactly as the approved image draws
   them.
4. Tab through: skip link → header → hero actions → community cards → guidance
   actions. Focus is always visible.
5. Resize to 768 and 375 px: sections stack, nothing scrolls horizontally, all
   targets stay ≥ 44 px.
6. Confirm About is active in the desktop header, in the mobile menu, and links
   from the footer.

## 12. Assumptions and open gaps

- A-1: The owner's approval of the image copy covers every string it draws, and
  those strings may be shown publicly as Home School Haven's own words.
- A-2: The Matthew 5:16 wording in the image is the intended wording. It is
  rendered as drawn, attributed to Matthew 5:16, with no translation named.
- Owner action still required:
  1. decide whether to promote `public-about-proposed.png` into the canonical
     MDS reference set;
  2. confirm the Bible translation for the Matthew 5:16 quote if attribution
     must name one;
  3. supply approved photography to replace the demo placeholder hero;
  4. QA-004 — collaborator/partner names remain unverified and are omitted.

## 13. As built (2026-08-28)

Implemented as specified, with two refinements made while comparing the render
with the proposed image, and one shell convention added:

- **D-A10 — The hero photo is an inset rounded panel at every viewport, not the
  home page's full bleed.** The proposed image draws it inset within the
  container. It was first built with the home hero's `lg` bleed; side by side,
  a second full-bleed hero made About read as another home page, and it did not
  match the image.
- **D-A11 — The community card glyph is the single-person mark**, matching the
  glyph the image draws on all four cards.
- **D-A12 — A breadcrumb trail (Home / About) was added**, which the image does
  not draw. Every other public page carries one and `public-shell.spec.ts` pins
  the shell; omitting it here would make About the one public page without a
  way back up.

The values band was extracted to `src/components/public/value-band.tsx` and the
home page now renders it. The home visual baselines were re-recorded, and the
diff confirmed the band is pixel-identical — the only change is the About nav
item, which is now a live link rather than dimmed text. The same one-item change
re-recorded the sign-in, calendar, guidance, and programs baselines.

Checks run and their real results are recorded in the completion report.
