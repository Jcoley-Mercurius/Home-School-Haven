# Implementation Prompt — Foundation Public Home Page

**Status:** Awaiting owner approval
**Date:** 2026-08-27
**References:** MDS-REF-006 `homepage-reference.png`, MDS-REF-005 `navigation-blueprint.png`,
MDS-REF-003 `design-foundations.png`

## Goal and scope

Replace the create-next-app boilerplate at `src/app/page.tsx` with the approved
public home page, built entirely on the MDS token layer and the foundation
components. No `zinc-*`, no `dark:`, no hardcoded hex — every value resolves to
an MDS token.

In scope:

- `src/app/page.tsx` — the home composition.
- `src/components/layout/site-header.tsx` — 72 px sticky public desktop header;
  60 px mobile header with a menu panel (MDS-REF-005 §4).
- `src/components/layout/site-footer.tsx` — public footer with verified contact
  facts.
- `src/components/program/program-card.tsx` — catalog/featured program card.
- `src/content/foundation-content.ts` — typed, sourced content module holding
  only facts from `mps/BETA-CONTENT-IMPORT-INVENTORY.md`, each entry carrying its
  import status.
- Delete the boilerplate SVGs in `public/` that the new page stops using.

Out of scope: the Programs, Calendar, About, Resources, and Contact pages; the
program catalog and detail pages; authentication; Supabase; checkout; any
authenticated surface.

## Applicable approved sources

- `mps/REQUIREMENTS-RULES.md` — MPS-REQ-007 (verified public pages explaining
  purpose, values, location, contact paths, programs, educators), MPS-REQ-009
  (registration / guidance / visit / assistance paths), MPS-REQ-020 (consistent
  published identity), MPS-REQ-023 (responsive + accessible)
- `mps/ACCEPTANCE-CRITERIA.md` — MPS-ACC-007, MPS-ACC-008
- `mps/BETA-CONTENT-IMPORT-INVENTORY.md` — the only permitted content source,
  including import rules 1–7 and flags QA-001 … QA-006
- `mds/specification/DESIGN-SYSTEM.md` §7 (public home shell: editorial hero,
  value band, featured programs, process, community story, guidance CTA, footer),
  §8 responsive behavior, §10 accessibility
- `mds/specification/DO-DONT.md`, `PRINCIPLES.md`
- MDS-REF-006 for composition; MDS-REF-005 §4 for navigation behavior

## Repository evidence inspected

- `src/app/page.tsx` is create-next-app boilerplate: `bg-zinc-50`, `dark:bg-black`,
  `text-zinc-600`, `dark:invert`, Next.js logos — all bypassing the token layer.
- Foundation layer landed 2026-08-27: `src/app/globals.css` token layer and type
  roles; `src/components/ui/` Button, Card, TextLink, Field, Input, Textarea,
  Select, Checkbox, RadioGroup; Lora/Manrope loaded in `src/app/layout.tsx`.
- `public/` holds only create-next-app SVGs plus `brand/home-school-haven-logo.png`.
- No Supabase client, no `.env*`, no data layer exists yet.
- Root layout renders `min-h-full flex flex-col`, so a header/main/footer column
  composes without further layout changes.

## Content — approved facts only

Header navigation (MDS-REF-006): Programs · Calendar · About · Resources ·
Contact, with Sign In and a Request Guidance primary action.

Hero eyebrow: "Christ-centered homeschool community · Cape Coral" — supported by
the inventory's Positioning and Faith identity rows.

Value band (inventory "Values", verbatim): Creativity over conformity ·
Curiosity over perfection · Character over performance · Community over
competition.

Featured programs — the three the reference shows, with inventory facts and
nothing more:

| Program | Published detail | Unset fields |
|---|---|---|
| Art Lab | August 22–September 26, 2026 | Contact for details |
| Haven Days Enrichment | September 2026–June 2027 | Contact for details |
| Harvest Explorers | August 20–September 24 · six weeks · $180 for all six weeks | Contact for details |

Per import rule 3 and QA-005, every field the source does not publish stays
unset and renders as "Contact for details". No age, grade, capacity, educator,
location, or enrollment window is invented.

Footer facts: 2930 Del Prado Boulevard South, Suite D, Cape Coral, Florida;
239-347-9356 (the Contact-page number — QA-003 records a conflicting number in
the privacy footer, so the module will carry a `needsConfirmation` note).

Educators are named in the inventory but the home page will not list them; that
belongs to the About page.

## Trust rules applied

- No "Register", "Enroll", or "Pay" action appears on the home page. Program
  cards carry "View Details" only, exactly as MDS-REF-006 shows.
- No checkout link is rendered anywhere on this page.
- No availability, capacity, or enrollment state is claimed for any program.
- Prices appear only where the source publishes one ($180 for Harvest Explorers).

## Composition

Sticky 72 px header → editorial hero → value band → "Find the right experience
for your child" featured programs → "Not sure where to begin?" guidance CTA →
"A community that grows together" story → footer. Container: public standard
1200 px, gutters 32/24/16 px.

Responsive: program grid 3 → 2 → 1 columns; hero stacks below 1024 px; the
desktop nav becomes a 60 px mobile header with a menu panel listing every
destination plus the Explore Programs action (MDS-REF-005 §4). No meaning is
removed to simplify mobile.

## Assumptions, gaps, and open decisions

1. **Hero imagery — unresolved.** MDS-REF-006 shows generated photography of
   children. `DESIGN-SYSTEM.md` §5 and `DO-DONT.md` forbid presenting generated
   people as real students or as approved production photography, and no
   licensed photo exists in the repository. Recommendation: ship a warm
   botanical/editorial hero on ivory with a reserved image region, and record a
   blocker for Samantha to supply approved photography with model releases.
2. **Nav destinations that do not exist yet.** Programs, Calendar, About,
   Resources, Contact, and Sign In have no routes. Options in the approval
   question below.
3. **Content lives in a typed module, not Supabase.** No Supabase client or
   environment exists in this repository yet. `src/content/foundation-content.ts`
   is an explicit staging step, marked in-file as the seed for the eventual
   Supabase-backed program administration (AGENTS.md §5). It is not a second
   database and introduces no dependency.
4. Sample or generated decorative botanical shapes are CSS/SVG only, `aria-hidden`.

## Security, privacy, and data handling

Public, unauthenticated, static content. No family, student, or enrollment data.
No secrets, no analytics (PostHog is not enabled in this repository). No child
data of any kind.

## Responsive and accessibility

Landmarks (`header`/`nav`/`main`/`footer`), one `h1`, ordered headings, skip
link to `main`, keyboard-operable mobile menu with focus trap and Escape,
`aria-expanded` on the toggle, 44 px targets with 8 px separation, visible 2 px
Coral 700 focus ring, meaningful alt text with empty alt on decoration, and
16 px body copy. Verified at 390 / 768 / 1280 / 1440 px.

## Rollback

`git checkout -- src/app/page.tsx public/` plus deleting the new files. No data,
schema, or configuration is touched.

## Checks to run

- `npx tsc --noEmit`, `npm run lint`, `npm run build`
- Rendered screenshots at 390 / 768 / 1280 / 1440 px compared against
  MDS-REF-006 and MDS-REF-005 §4
- Manual: keyboard path through header → menu → hero actions → cards → footer;
  Escape closes the menu; focus returns to the toggle; reduced-motion honored
- Grep the diff for `zinc`, `dark:`, and raw hex to prove no token bypass
- Not runnable — not installed: Playwright, `@axe-core/playwright`, ARIA
  snapshots, screenshot-diff baselines

## External setup required from the owner

- Approved photography for the hero and story sections (item 1).
- QA-003: confirm the correct public phone number before public launch.
- QA-002: confirm the Ready Set Prep end year before the Calendar page is built.
