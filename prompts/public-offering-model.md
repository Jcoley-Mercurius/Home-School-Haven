# Implementation prompt — Closeout Slice 1: Public offering model and factual content

Branch: `feat/public-offering-model`, created from `origin/release/foundation-preview`
at `7e62d99` (keeps the three deployed preview commits on top of `main` at `1fcbdfc`).
Requested 2026-09-16. Not merged or pushed to `main`.

## 1. Goal and scope

Bring every public surface in line with Samantha's evidence of 2026-09-14:

1. replace the organization address everywhere with **1329 Hibiscus Drive, Cape Coral, FL 33909**;
2. add the smallest offering taxonomy that separates **Haven Days**, **Ready Set programs**,
   **individual classes** (the ones that rotate), **tutoring**, and **monthly clubs**;
3. publish the verified offerings (§3) and archive the offerings the new evidence does not support;
4. update the catalog, program detail, home featured programs, contact program list, and calendar,
   using only the date precision the evidence actually gives;
5. prove the calendar works at phone, tablet, and desktop widths, and fix any mobile defect found;
6. update MPS, MDS, and MTS state and traceability for what this slice touches.

**Out of scope:** registration, sensitive child fields, consent, STEP UP handling, checkout URLs,
roster expansion, transactional email, filters or search (catalog deviation D-2 stands),
calendar category chips, and any change to invite-only, legal, payment, privacy, or data policy.

## 2. Applicable IDs

- MPS-REQ-007, MPS-REQ-008, MPS-REQ-016, MPS-REQ-020, MPS-REQ-023, MPS-REQ-024;
  MPS-ACC-007, 008, 009, 010, 026, 027, 031; MPS-RUL-005, MPS-RUL-010.
- Inventory import rules 1, 3, 7; QA-001, QA-002, QA-005, QA-006. DEC-020, EXC-001, GAP-012.
- MDS: DESIGN-SYSTEM §6 program card (`content_order` includes age/grade when verified) and badge,
  §7 catalog / program detail / public calendar shells, §8 responsive (3/2/1 grid, table→list below
  1024 px), §10 accessibility. MDS-REF-005, MDS-REF-006, MDS-REF-010.
- MTS: Supabase is the system of record for programs (MTS-ARCHITECTURE-ADDENDUM); deny-by-default RLS;
  writes only through authorized functions; attributable history (`record_program_audit`).

## 3. Content truth

The evidence documents themselves (the flyer and the email of 2026-09-14) are **not in the repository**.
The facts below are taken from the Slice 1 instruction of 2026-09-16, and that instruction is recorded
as the source. Wording is normalized for presentation only.

| Slug | Group | Ages / grades | Schedule | Dates | Duration | Price | Registration / notes |
|---|---|---|---|---|---|---|---|
| `haven-days-enrichment` → name **Haven Days** | haven_days | — | Tuesday, Wednesday, Thursday · 9:00 AM–1:30 PM | September–June | — | One day $280/month · Two days $550/month · Three days $795/month | — |
| `ready-set-prep` (new) | ready_set | Ages 3–4 | Tuesday and Thursday · 9:15–11:30 AM | August–May | — | $80/week | Prep + Learn combined: $140/week |
| `ready-set-learn` (new) | ready_set | Ages 4–5 | Tuesday and Thursday · 11:45 AM–2:00 PM | August–May | — | $80/week | Prep + Learn combined: $140/week |
| `ready-set-sensory` (new) | ready_set | Ages 3–5 | Wednesday · 9:30–11:30 AM | — | — | $45/week | — |
| `sewing` | individual_class | — | Wednesday · 4:45–6:15 PM | — | Eight weeks | $45/week | $20 non-refundable deposit for weekly payments; no deposit when paying in full |
| `crochet` (new) | individual_class | — | Mondays in November · 2:00–4:00 PM | November | Four weeks | $250, materials included | Summary: beginner class; no experience required; weekly take-home project |
| `gardening` | individual_class | Ages 5+ | Thursday · 2:15–3:15 PM | October–June; no class the final week of October | — | **unpublished** | — |
| `tutoring` (new) | tutoring | Kindergarten and above | Tuesday, Wednesday, Thursday | — | — | $65/hour or $40/half-hour | Summary: academic skill building, homework help, and test preparation |
| `monthly-clubs` (new) | monthly_club | — | Thursday · 4:30–6:30 PM | — | — | $100/month or $30 drop-in | Summary: the first club is Lego |

**Left unknown on purpose:** every year on these offerings; Sewing's start date; Crochet's exact dates,
age, capacity, and deadline; the first club's month and year; Sensory's month range; every capacity,
educator, location, enrollment window, and checkout URL. **Gardening's price stays NULL**: the flyer
says $35/week and the email says $35 drop-in. The conflict goes into `unverified_details`, which is
never rendered, and becomes new flag QA-007.

**Archived, not deleted** (`publication_state = 'archived'`, which already exists and already keeps
rows out of anonymous RLS): `ready-set-prep-and-learn`, `etiquette-series`, `art-lab`,
`harvest-explorers`, `history-explorers`. Every audit history row is kept. Summer Series and School
Photos were never imported, so nothing changes for them.

**Superseded:** QA-002. The owner evidence gives Ready Set as "August–May" with no year, so the
anomalous "August 2026–May 2026" stops being shown publicly. No year is supplied in its place.

**Dated calendar entries** from the 2026-08-26 capture are not contradicted, so they stay: Summer Break,
Fall Preview Day, "Ready Set Prep begins" (link moves to `ready-set-prep`), and "Haven Days
Enrichment begins" (the published title is kept; the link label becomes Haven Days). The Art Lab dated
range is removed along with the offering.

## 4. Design (MDS): reuse and compose only

- **Catalog `/programs`:** the hidden "Program results" heading is replaced by one visible `h2` for each
  group, in a fixed order: Haven Days, Ready Set programs, Individual classes, Tutoring, Monthly clubs.
  A group with no published programs is not rendered. Each group uses the existing 3/2/1 card grid.
  No filter rail (D-2 unchanged) and no chips.
- **Program card:** `publishedFacts` gains `audience`, placed after schedule and before price, which is
  the MDS `content_order`. No new visual convention.
- **Program detail:** the eyebrow changes from "Program" to the group's singular label, for example
  "Ready Set program". The facts panel is unchanged. "About this program" shows the verified summary when
  there is one and keeps the current "not published yet" sentence when there isn't.
- **Home:** the three featured slugs become `haven-days-enrichment`, `ready-set-prep`, and `sewing`,
  one from each of the three largest groups. Two of the current three are archived, so this is a
  presentation choice, recorded as such.
- **Calendar:** the month grid, list transformation, notes rail, program panel, and guidance band are
  unchanged. "Published term ranges" becomes **"Weekly schedules and seasons"**. It is derived from
  published programs, not from a second copy of the facts, and shows one card per offering with a
  published schedule or month range: name, schedule text, and season text. That keeps MPS-REQ-020
  consistency and uses the existing term-range card styling. The right panel lists published programs
  that have a schedule or dates. Nothing without a day and a year is plotted.
- **Mobile calendar:** checked at 390, 768, 1024, and 1440 px with Playwright screenshots. Any defect found
  (overflow, header wrapping, target size, list/grid mismatch) is fixed with existing tokens and recorded.

## 5. Architecture (MTS)

New migration `supabase/migrations/20260916000000_public_offering_model.sql`:

1. `create type public.offering_type as enum ('haven_days','ready_set','individual_class','tutoring','monthly_club')`,
   plus a nullable `programs.offering_type` column. It is nullable because an administrator's new draft has no
   classification yet. Defaulting it would invent one.
2. Constraint `programs_published_has_offering_type`: a `published` row must have an offering type.
   `admin_set_program_publication` checks the same thing first and returns a refusal an administrator can
   act on, the same pattern as the existing summary precondition.
3. `admin_update_program_facts` is dropped and recreated with one more argument, `program_offering_type`.
   Nothing else in its body changes. The admin program form gets an "Offering type" select that reuses the
   existing confirmation-mode select pattern. This keeps MPS-REQ-016 intact: without it, a new draft could
   never be published.
4. `record_program_audit` adds `offering_type` and `summary` to its material fields (MPS-REQ-024).
5. **Content reconciliation, idempotent:** the nine current offerings are upserted with fixed ids
   (`…0002`, `…0005`, `…0006` kept; new `…0009` through `…000e`), `on conflict (id) do update`. The five stale
   rows are set to `archived` by id, which does nothing on an empty table. The first `supabase db push`
   applies it to the hosted project; locally it runs before `seed.sql`.

`supabase/seed.sql`: stops inserting the three surviving rows (the migration owns them) and inserts the
five stale rows as `archived`. **Sample operational fixtures are re-pointed off archived programs by role
(option A, §11):**

| Fixture role | From | To |
|---|---|---|
| Educator assignment, capacity 12 + waitlist, payment_pending + confirmed, three sessions, announcements, resources, attendance | Art Lab `…0004` | Tutoring `…000c` |
| approval_pending enrollment | Harvest Explorers `…0007` | Crochet `…000e` |
| Full, waitlist on (instant) | History Explorers `…0008` | Monthly Clubs `…000d` |
| Full, waitlist off (instant) | Etiquette Series `…0003` | Ready Set Sensory `…000b` |

Session titles stay "Sample session — <program> meeting". The Haven Days session drops the
leftover "Nature Explorers" name.

App code: `Program` gains `offeringType`. `map-program-row`, the repository `SELECT_COLUMNS`,
`database.types.ts` (regenerated locally, then `db:types:check`), the staging module
`src/content/programs.ts` (mirrors the nine published rows and backs the contact program list),
`src/content/calendar.ts`, and `foundation-content.ts` (address) all change. A new pure module,
`src/lib/programs/offering-groups.ts`, holds group order, labels, and `groupPrograms()`.

## 6. Security, privacy, data

No new data collection. Anonymous RLS is unchanged, and archived rows remain invisible to anonymous
readers. The new column is not sensitive. Admin writes still go only through `security definer`
functions guarded by `private.is_admin()`. Sample data stays sanitized. No secrets, no hosted mutation by
the agent, and no URL carries new data.

## 7. Accessibility and responsiveness

Group headings keep the page's heading order (h1 → h2 group → h3 card). Offering state never relies on
colour. Targets are at least 44 px. The page never scrolls horizontally at 390 / 768 / 1024 / 1440. axe is
clean on `/programs`, `/programs/[slug]`, `/calendar`, `/contact`, and `/`.

## 8. Tests

- **Unit (`node --test`):** `tests/offering-model.test.mts` covers group order and labels, `groupPrograms`
  (empty groups dropped, Haven Days separate from classes), every verified price and schedule string, no
  four-digit year in any new offering's facts, Gardening `publishedPrice === null` with the conflict kept
  only in `unverifiedDetails`, archived slugs absent from the staging catalog, the address, and calendar
  entries that plot nothing without day and year. `tests/program-mapping.test.mts` gains `offering_type`.
- **pgTAP:** new `150_public_offering_model.test.sql` covers the enum, the constraint, the publish refusal
  without a type, anonymous readers seeing nine published offerings and no archived slug, and the audit
  trail including `offering_type`. Existing tests move with the fixture ids from §5.
- **Playwright:** `programs.spec.ts` (grouping headings, verified facts, Gardening shows "Contact for
  details" for price, removed offerings 404 and are absent from the catalog), `calendar.spec.ts` (season
  cards, no year invented, mobile list at 390 px and tablet at 768 px, no horizontal scroll), `contact`
  and `public-shell` (new address, old address absent), `home.spec.ts` (featured). Fixture-name updates
  land in the authenticated specs. ARIA and screenshot baselines are regenerated only for the affected
  pages, and each diff is reviewed before it is accepted.

## 9. Checks

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run db:reset`,
`npm run db:test`, `npm run db:types:check`, `npm run build`, and the affected Playwright specs (a full e2e
sweep only if time allows, per the standing preference to run it once before handoff).

## 10. Rollback

Revert the branch. For the database, the migration header carries a rollback that restores the previous
`admin_update_program_facts` and `admin_set_program_publication` bodies, drops the constraint, column, and
type, and sets the five archived rows back to `published`. Content upserts are rolled back by restoring
the prior row values recorded in `audit_events`.

## 11. Owner decisions requested with this approval

- **Fixture strategy:** option A, above, re-points sample fixtures to current offerings. That touches about
  20 test files and several baselines, but no reviewer ever sees "Art Lab" again. Option B leaves the
  fixtures on archived programs: less churn, but family, educator, and admin demos keep showing archived
  names, and the full-program and waitlist targets stop working because archived programs cannot be
  registered for.
- **Hosted project:** the agent will not run `supabase db push` against `uedgcwoxyhtirsihvrnf`. After review,
  the owner runs `supabase db push --linked`. Hosted sample fixtures still point at Art Lab and the other
  archived rows until someone deliberately refreshes the preview fixtures, which is recorded as a follow-up.

## 12. Manual test steps (WSL bash)

```bash
npm run db:reset && npm run build && npx next start -p 3100
# /programs       five group headings in order; no Art Lab, Etiquette, Harvest, History
# /programs/gardening   Price reads "Contact for details"
# /programs/art-lab     404
# /calendar at 390 px   list view, weekly schedules and seasons, no sideways scroll
# /contact and footer   1329 Hibiscus Drive, Cape Coral, FL 33909
```

## 13. Implementation notes (2026-09-16/17)

Approved with option A (fixtures re-pointed) and a draft PR into `release/foundation-preview`.

- **Taxonomy module:** `src/lib/programs/offering-groups.ts`. Group headings and eyebrow labels live there and nowhere else.
- **Footer disclaimer, a forced copy correction:** "the three program card images are placeholder art" became false once Art Lab and Harvest Explorers were archived. It now names the Haven Days program image, the only published placeholder left. Nothing else in the footer changed.
- **Admin slug hint** changed from `art-lab` to `sewing` so the archived slug is not suggested.
- **Unit-test import path:** `foundation-content.ts` now re-exports from `./programs.ts` with the extension, following `src/lib/schedule/sessions.ts`, so `node --test` can load it.
- **Local build hazard found, not a code defect:** `.next/cache/fetch-cache` held program-session reads from builds on 2026-09-02 and 2026-09-03. After `db:reset`, a plain `npm run build` served the old "Art Lab" sessions on `/calendar`. Clearing `.next/cache/fetch-cache` before building fixed it. Anyone verifying locally after a reset should clear it too.
- **Calendar at 390, 768, 1024, and 1440 px:** no horizontal scroll, list transformation intact, and month navigation stays inside the viewport (new Playwright checks). No mobile defect found.
- **Desktop observation, not fixed:** at 1280 px a day cell is narrower than some words in a chip ("continues", "Enrichment"), so the word runs into the chip edge. This predates the slice. Both `overflow-wrap` variants break words mid-word, which is a visual change MDS has not approved, so it was reverted and is routed to MDS.
- **Pre-existing visual baseline drift:** the About and Contact composition screenshots were captured on 2026-08-28 and 2026-09-01, before the photography, footer, and About content work of 2026-09-02 to 2026-09-05. Their height mismatch is not caused by this slice. They were not rebaselined here.
- **Keyboard journey assertion:** expected `/contact` while the action rail has linked to `/contact?program=<slug>` since before this slice. The assertion was corrected.
