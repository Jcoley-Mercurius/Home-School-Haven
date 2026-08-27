# Implementation Prompt — Public Program-Conversion Vertical Slice

**Branch:** `feat/program-conversion-journey`
**Prepared:** 2026-08-27
**Phase:** MTS `IMPLEMENTATION-PLAN.md` Phase 2 — Public discovery (partial)
**Status:** Approved for execution by Josh Coley, 2026-08-27 (see §9 decisions)

---

## 1. Goal and scope

Deliver the public program-conversion journey for the Foundation Review:

1. a reusable program-detail experience at `/programs/[slug]`;
2. every home-page and catalog program card connected to it;
3. verified program facts and explicit availability states;
4. a Request Guidance flow;
5. the approved external-checkout handoff, presented so it can never read as
   payment or enrollment confirmation.

**In scope:** public routes only (`/`, `/programs`, `/programs/[slug]`,
`/guidance`), the content module that stages approved website content, the
shared MDS components those screens need, and their tests.

**Out of scope:** Supabase (not installed; Phase 1 backend work is unstarted),
authentication, family/educator/admin routes, enrollment records, roster,
capacity or waitlist mechanics, payment reconciliation, analytics, and the
catalog filter rail (see §7 deviation D-2).

---

## 2. Applicable approved IDs

| Source | IDs |
|---|---|
| Requirements | MPS-REQ-007, 008, 009, 010, 013, 020, 021, 023 |
| Rules | MPS-RUL-004, MPS-RUL-005 (display only), MPS-RUL-010 |
| Workflow | MPS-WFL-001 program discovery and conversion |
| Acceptance | MPS-ACC-007, 008, 009, 010, 011, 012, 014, 021, 031 |
| Content | BETA-CONTENT-IMPORT-INVENTORY import rules 1–5, 7; QA-001, QA-004, QA-005, QA-006 |
| Design | DESIGN-SYSTEM.md §2–§10; §6 program card / enrollment state / payment handoff / trust-state rules; §7 catalog + program-detail shells; §8 responsive; §10 accessibility |
| Design refs | MDS-REF-004 §3 program discovery, §5 trust states, status badge system; MDS-REF-005 §2 program catalog + program detail, §5 responsive transformations, §6 content hierarchy and interaction states; MDS-REF-006 featured cards |
| Technology | MTS Phase 2; SECURITY-ARCHITECTURE "Payments and notifications"; INTEGRATION-MANIFEST "External checkout", "Integration rules" |

---

## 3. Repository evidence inspected

- `package.json` — Next.js 16.3.3, React 19.2.8, TypeScript 5, Tailwind v4,
  `@base-ui/react` 1.7, `lucide-react` 1.34, `zod` 4.4.3, Playwright 1.62 +
  `@axe-core/playwright` 4.13. Scripts: `dev`, `build` (with `prebuild` demo
  gate), `lint`, `typecheck`, `test:e2e`, `test:unit`, `format:check`.
- `src/app/page.tsx` — home page; hero, value band, three featured
  `ProgramCard`s, guidance CTA, community story.
- `src/app/programs/page.tsx`, `src/app/guidance/page.tsx` — both documented in
  code as deliberate **stubs** pending this work.
- `src/components/program/program-card.tsx` — single horizontal featured card.
- `src/components/ui/` — button, card, checkbox, field, input, radio-group,
  select, text-link, textarea. **No badge/status component exists.**
- `src/content/foundation-content.ts` — the approved staging module. Holds only
  3 of the 8 programs in the import inventory; `Program.href` points at a
  fragment on the stub catalog. No availability, checkout, audience, location,
  educator, or session-length fields exist.
- `src/app/globals.css` — complete `--hsh-*` token layer, `.hsh-*` type/
  container classes, focus ring, 44 px targets, reduced-motion block.
- `tests/e2e/home.spec.ts` — asserts `View Details` href is `/programs#art-lab`
  and that home body text contains no "register"/"checkout".
- `tests/e2e/stub-routes.spec.ts` — asserts `/guidance` contains **no** form,
  input, textarea or select, and that `/programs` contains no "checkout" or
  "waitlist" text. Both assertions are superseded by this work and must be
  rewritten, not deleted.
- `scripts/check-demo-placeholders.mjs` — production build gate on placeholder
  imagery. Only 3 program placeholder images exist; new programs have none.
- No `supabase` dependency, no `src/lib/supabase*`, no migrations, no `.env*`,
  no server actions anywhere in the repository.

---

## 4. Missing facts — reported, never invented

| # | Missing fact | Evidence | Handling in this slice |
|---|---|---|---|
| F-1 | **Program-specific checkout URLs.** MPS-REQ-013 and the inventory approve "the current program-specific `pay.homeschoolhaven.org` links", but no actual URL is recorded in any approved artifact or in the repository (`grep -ri "pay.homeschoolhaven"` returns only those two prose mentions). | `mps/REQUIREMENTS-RULES.md:13`, `mps/BETA-CONTENT-IMPORT-INVENTORY.md:87` | `Program.checkoutUrl: string \| null`, `null` for every program. The handoff component is built and wired; with a `null` URL it renders a truthful "registration link not yet recorded" state plus guidance/phone paths. **No URL is guessed or constructed.** Owner supplies them. |
| F-2 | **Availability / capacity for every program.** Nothing published. MDS-REF-004's Open / Limited Spaces / Waitlist badges are explicitly marked `SAMPLE DATA`. | Import rule 3; QA-005 | Full availability state vocabulary implemented; every program's state is `unknown`, rendered as an explicit "Availability is not published — contact for details" badge. No program is shown as Open. |
| F-3 | **Program descriptions, ages/grades, format, location, educator, enrollment window.** Not in the inventory. MDS-REF-005 shows the literal placeholder "Approved program description appears here." | QA-005; REFERENCE-INDEX "do not infer literal truth from generated microcopy" | Fields exist and are `null`; the verified-facts panel renders "Contact for details" per row. No description is written. |
| F-4 | **Etiquette Series dates** (Sept 11–Oct 2) and **Gardening session length** (two hours) have unproven source associations. | QA-001; import rule 7 | Stored in a separate `unverifiedDetails` field that is **never rendered publicly**, with the flag recorded in code comments. |
| F-5 | **Summer Series / Seasonal School Photos** are marked "Import *if included in the beta catalog*" — inclusion is undecided. | Inventory "Additional published offerings" | Excluded from the catalog pending an owner decision (§9 Q3). |
| F-6 | **Published email address.** None in the inventory (QA-004-adjacent). | Inventory contact table | No email shown; phone and address only. Directly constrains the guidance flow (§9 Q1). |
| F-7 | **Imagery for 5 of 8 programs.** Only 3 placeholder files exist. | `public/placeholder/` | `image: PlaceholderImage \| null`; cards and detail pages render a token-only botanical panel when `null`. Required by MDS-QA Gate 3 "missing images do not break layouts". |

---

## 5. Assumptions

- A-1: The content module remains the approved staging step for imported
  content (AGENTS.md §5 and the module's own header). This slice does **not**
  introduce a second data store; the `Program` type is shaped so a Supabase row
  can replace it without changing any component contract.
- A-2: The featured card variant's rendered markup is preserved exactly, apart
  from its `href`, so existing home-page visual baselines stay valid.
- A-3: "Verified program facts" means *published-and-sourced*; no field is shown
  unless the import inventory publishes it.
- A-4: The detail action rail follows MDS-REF-005 §2 (View availability /
  Request Guidance / Contact Us) with the checkout handoff added below it as the
  MDS-REF-004 §5 trust-state pattern, not as a bare button.

---

## 6. Expected files

### Content
- `src/content/programs.ts` **(new)** — the 8 published programs with the full
  `Program` type, `AvailabilityState`, per-field source attribution, and the
  `unverifiedDetails` quarantine. Exports `programs`, `featuredSlugs`,
  `getProgram(slug)`, `relatedPrograms(slug)`.
- `src/content/foundation-content.ts` **(modified)** — `Program`/`featuredPrograms`
  re-exported from `programs.ts`; contact/nav/positioning content unchanged.

### Components
- `src/components/ui/badge.tsx` **(new)** — MDS §6 / MDS-REF-004 status badge:
  icon + label, tones neutral/open/limited/waitlist/pending/info. Never colour
  alone.
- `src/components/program/availability-badge.tsx` **(new)**
- `src/components/program/program-card.tsx` **(modified)** — adds
  `variant="featured" | "catalog" | "compact"`; featured markup unchanged;
  null-image fallback; links to `/programs/{slug}`.
- `src/components/program/verified-facts.tsx` **(new)** — `<dl>` of published
  facts; unpublished rows render "Contact for details".
- `src/components/program/checkout-handoff.tsx` **(new)** — external-checkout
  notice, live and unavailable states.
- `src/components/program/program-action-rail.tsx` **(new)** — sticky ≥1024 px,
  inline priority panel below (MDS §8, MDS-REF-005 §5).
- `src/components/layout/breadcrumbs.tsx` **(new)** — `<nav aria-label="Breadcrumb">`.
- `src/components/guidance/guidance-form.tsx` **(new, pending §9 Q1)**

### Routes
- `src/app/programs/page.tsx` **(rewritten)** — catalog; 3/2/1 grid; guidance
  pathway; empty state with a contact path (MPS-ACC-010).
- `src/app/programs/[slug]/page.tsx` **(new)** — `generateStaticParams`,
  `generateMetadata`, `notFound()` on unknown slug, breadcrumb, identity,
  verified facts, action rail, checkout handoff, related programs.
- `src/app/guidance/page.tsx` **(rewritten, pending §9 Q1)**
- `src/app/guidance/actions.ts` **(new, pending §9 Q1)** — server action;
  `zod` validation at the server boundary.

### Docs
- `mds/implementation/MDS-IMPLEMENTATION.md` — the two "Not installed" rows for
  accessibility and visual-comparison tooling are stale; Playwright, axe, and
  screenshot baselines now exist. The manifest instructs maintaining this table.

**No schema, migration, or environment-variable change.** None is needed and
none is authorized by an approved implementation step yet.

---

## 7. Trust, security, privacy, and known deviations

Non-negotiable output rules:

- The words "confirmed", "enrolled", "your spot is reserved", or any success
  claim must not appear anywhere in the checkout path.
- The handoff states, in visible text: registration and payment happen on an
  external Home School Haven checkout page; continuing there is **not** payment
  or enrollment confirmation; a place is confirmed only after Home School Haven
  verifies it (DO-DONT "Trust states"; SECURITY-ARCHITECTURE "Payments and
  notifications"; MPS-REQ-013).
- The external link uses `target="_blank" rel="noopener noreferrer"`, carries an
  accessible name saying it opens externally, and passes **no** query parameters
  — no identifiers, no contact data in URLs (INTEGRATION-MANIFEST integration
  rules).
- No child or family data is collected, stored, or logged by this slice. If the
  guidance form is approved (§9 Q1), its submitted values are validated
  server-side and never written to logs, analytics, URLs, or fixtures.
- No `NEXT_PUBLIC_*` secret, no service-role path, no client-trusted state.

Deviations to record in the completion report:

- **D-1 (gap, MPS/content):** the checkout handoff cannot be exercised because
  F-1 is unrecorded. The approved behavior is implemented; only the URL is
  absent.
- **D-2 (deviation, MDS):** MDS-REF-005 §2 shows a catalog filter rail over
  Program / Format / Schedule / Availability. Three of those four facts are
  unpublished for every program (F-2, F-3). Building the rail would require
  inventing filter values, which import rule 3 forbids. The rail is deferred and
  the catalog ships without filters or search until those facts are published.
- **D-3 (observation):** MDS-REF-005 §2 shows a "View Availability" primary
  action on program detail. With F-2 unresolved there is no availability screen
  to open; the rail shows the explicit unknown-availability state in place of
  that action.

---

## 8. Responsive and accessibility requirements

- Breakpoints 0–639 / 640–1023 / 1024–1439 / 1440+; catalog grid 1/2/3/3.
- Detail action rail: sticky side rail ≥1024 px; inline priority panel below,
  positioned above long-form content so trust meaning is never demoted.
- 44×44 px minimum targets, ≥8 px separation; body copy stays 16 px.
- One `<h1>` per page; `<nav aria-label="Breadcrumb">`; facts as a `<dl>`;
  status conveyed by icon **and** text, never colour alone.
- Form (if approved): `Field`-associated labels, descriptions, and errors;
  `aria-live` status region for submitting / error / outcome; entered data
  preserved on error (MDS-QA manual scenario 8).
- `prefers-reduced-motion` respected; no horizontal scroll at any viewport.
- WCAG 2.2 AA verified with `@axe-core/playwright` at all four viewports.

---

## 9. Owner decisions — recorded 2026-08-27

**D-Q1 — Request Guidance: full form, real destination to follow.** Build the
complete accessible form and its server action now, with submission routed
through a single `recordGuidanceRequest` boundary. That boundary has no
configured destination in this repository (no Supabase, no Resend, no published
recipient). Until one is provisioned it returns a truthful *not recorded*
outcome with the published phone path, and the page says so before the visitor
types. It never claims a false confirmation (MPS-ACC-014). Wiring the real
destination later is a one-file change.

**D-Q2 — Checkout URLs: not available.** `checkoutUrl` is `null` for every
program. The handoff is built and renders its truthful unavailable state. F-1
stays open for the owner.

**D-Q3 — Catalog scope: the 8 published programs.** Summer Series and Seasonal
School Photos are excluded pending an owner decision (F-5).

### Original questions

**Q1 — Request Guidance submission destination.** MPS-REQ-009 approves the
guidance path and MPS-REQ-010 requires each inquiry to be recorded once with
type, contact, time, state, and an authorized administrative owner. This
repository has **no** Supabase client, no Resend configuration, and no published
recipient address (F-6). Writing contact details to runtime logs is prohibited
by SECURITY-ARCHITECTURE. So there is currently nowhere authorized for a
submission to go, and claiming "request received" would be a false confirmation
(MPS-ACC-014 forbids exactly that).

**Q2 — Do the program-specific checkout URLs exist to be supplied now (F-1)?**

**Q3 — Catalog scope: 8 published programs, or also Summer Series and Seasonal
School Photos (F-5)?**

---

## 10. Checks to run

```bash
npm run typecheck                 # tsc --noEmit
npm run lint                      # eslint flat config
npm run format:check              # prettier
npm run test:unit                 # node --test tests/*.test.mjs (release gate)
npm run build                     # production build incl. prebuild demo gate
npm run test:e2e                  # Playwright: axe, keyboard, responsive, visual
```

New spec `tests/e2e/programs.spec.ts` must cover: axe at 4 viewports on catalog
and detail; one `h1`; breadcrumb semantics; keyboard path home → card → detail →
guidance; 3/2/1 grid; sticky-rail → inline-panel transformation; the exact
checkout trust language; absence of any invented fact; a long program title and
a missing image without layout break; unknown slug → 404; no horizontal scroll.
`home.spec.ts` and `stub-routes.spec.ts` are updated for the new hrefs and the
now-permitted checkout/guidance language, keeping every trust assertion.

## 11. Manual test steps (WSL/Ubuntu bash)

```bash
npm run dev   # http://localhost:3000
```

1. Home → click "View Details" on each of the 3 featured cards → each lands on
   its own detail page, not a fragment.
2. `/programs` → all approved programs listed; every card links to its detail
   page; each shows "Contact for details" where facts are unpublished.
3. Any detail page → verify the availability badge reads as *not published*, the
   checkout block states it is not payment or enrollment confirmation, and the
   registration action is the truthful unavailable state (F-1).
4. Keyboard only: Tab from the skip link through breadcrumb, facts, rail,
   guidance CTA. Focus is visible at every stop.
5. Resize to 390 / 768 / 1280 / 1440: rail moves inline below 1024 px; no
   horizontal scroll; targets stay ≥44 px.
6. `/programs/not-a-real-program` → 404.
7. Guidance flow per the §9 Q1 decision: submit empty, submit invalid, submit
   valid; confirm errors are announced, entered data survives, and no state
   claims a false confirmation.
8. macOS/Windows "reduce motion" on → no motion required for meaning.

## 12. Rollback

Additive and branch-isolated. `git checkout main` reverts everything; no
migration, no external configuration, no deployed side effect. The only modified
existing files are the two stub routes, the content module, the featured card,
and their tests — all restorable by branch revert.

## 13. External setup still required

- Owner supplies the program-specific `pay.homeschoolhaven.org` checkout URLs.
- Owner decides the guidance-request destination (§9 Q1) — likely Supabase
  Phase 1 plus Resend, both unbuilt.
- Owner decides Summer Series / Seasonal Photos catalog inclusion.
- Released photography for programs lacking imagery.

---

## 14. Implementation record — 2026-08-27

Built as approved. Notes on what changed against the plan:

- **D-4 (observation, MDS):** links that sit inside a sentence (the phone number
  in the registration and empty-state paragraphs) are no longer inflated to a
  44 px line box. MDS §8's target rule governs controls; WCAG 2.2 SC 2.5.8
  exempts inline links, and inflating them visibly broke the line rhythm of the
  trust paragraph on the program detail page. Standalone actions — including
  every standalone phone action — keep the 44 px target. Marked
  `data-inline-link` so the target test can exempt exactly these.
- **D-5 (defect found and fixed in review):** the first build stacked the
  detail action rail below the long-form content on mobile, contradicting
  MDS §8 and DO-DONT.md. The layout now places it between the program identity
  and the verified-facts panel at every width below 1024 px, and the responsive
  test asserts that ordering rather than mere presence.
- `emptyGuidanceFormState` lives in `src/app/guidance/form-state.ts`, not in the
  `"use server"` action module: a server-action module may only export async
  functions, and a constant exported from one arrives `undefined` on the client.
- `<select>` and `<textarea>` are not registered Base UI Field parts, so those
  two fields carry explicit `id` / `htmlFor` / `aria-describedby`. Without it,
  axe reported unlabelled form controls.
- The `server-only` package is not a dependency, so the recorder boundary is
  documented rather than compiler-enforced. Adding the package was outside the
  approved scope.
