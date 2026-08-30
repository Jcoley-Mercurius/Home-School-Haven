# Implementation prompt — Family Dashboard (MDS-REF-007)

**Branch:** `feat/family-dashboard`
**Prepared:** 2026-08-29
**Status:** awaiting owner approval
**Phase:** MTS IMPLEMENTATION-PLAN Phase 3 — "family dashboard"

---

## 1. Goal and scope

Build the authenticated family dashboard at `/family` for parents and
guardians, matching MDS-REF-007's shell, hierarchy, and trust-state treatment,
consuming only the authenticated family's authorized information.

### In scope

1. **Family portal shell** — 264 px desktop sidebar, 72 px tablet rail, mobile
   header plus a five-destination bottom navigation, with the approved family
   destination set.
2. **Family and student context** — family name derived from the session, and
   the parent-controlled student selector when more than one authorized student
   profile exists.
3. **Welcome and next recommended action** — one truthful action derived only
   from authoritative application state.
4. **Enrollment summary** — authorized enrollment records rendered through an
   approved enrollment-state component with exact trust language.
5. **Upcoming schedule** — published, verified program schedule facts only.
6. **Announcements** — scoped to the family's own enrolled programs.
7. **Resources** — published, program-scoped learning resources.
8. **Supporting data layer** — new `enrollments`, `announcements`, and
   `learning_resources` tables with deny-by-default RLS, least-privilege
   grants, audit triggers, and sanitized seed rows.
9. **Family list routes** — `/family/schedule`, `/family/announcements`,
   `/family/resources`, and `/family/household`, so no navigation destination
   is a dead link.
10. **Tests** — pgTAP RLS, Playwright end-to-end with axe, keyboard, four
    viewport screenshots and an ARIA snapshot, and unit tests for the pure
    state-mapping functions.
11. **Documentation reconciliation** — clear the three stale
    "repository reconciliation pending" statements (§10).

### Explicitly out of scope in this branch

- Self-service enrollment creation, eligibility evaluation, and checkout
  handoff (MPS-REQ-012/013 — the conversion journey). Enrollment rows in this
  slice arrive from the sanitized seed only; no client role can write one.
- Educator and administrator authoring of announcements or resources
  (MPS-REQ-019 — Phase 4). No client write path exists in this slice.
- Independent student accounts or any student session.
- Course Builder, course authoring, internal payment processing.
- Automated scholarship, discount, refund, cancellation, credit, or transfer
  behaviour.
- Private Storage file resources and signed URLs. Resources in this slice are
  published links only (§5.6).
- Educator and administrator portal shells. `PortalNav` stays as-is for
  `/educator` and `/admin`.
- Any change to the approved consent, child-data, retention, or deletion
  posture.

---

## 2. Applicable approved IDs

| System | IDs |
|---|---|
| Requirements | MPS-REQ-004, MPS-REQ-005, MPS-REQ-014, MPS-REQ-015, MPS-REQ-018, MPS-REQ-019, MPS-REQ-020, MPS-REQ-021, MPS-REQ-023, MPS-REQ-024 |
| Rules | MPS-RUL-003, MPS-RUL-004, MPS-RUL-005, MPS-RUL-006, MPS-RUL-007, MPS-RUL-010 |
| Workflows | MPS-WFL-007 (primary), MPS-WFL-003 (state vocabulary), MPS-WFL-006 (content scoping) |
| Acceptance | MPS-ACC-004, MPS-ACC-005, MPS-ACC-022, MPS-ACC-024, MPS-ACC-025, MPS-ACC-030, MPS-ACC-031 |
| Exception | EXC-001 (sanitized private beta while GAP-005 and GAP-010 are open) |
| MDS | MDS-REF-007 (canonical), MDS-REF-004 (trust states), MDS-REF-005 (shell), `page_shells.family_dashboard`, `patterns.dashboard`, `components.enrollment_state`, `components.family_student_selector`, `components.schedule_item`, `components.announcement`, `components.navigation.specification.family`, `layout.sidebar`, `responsive.rules`, `accessibility` |
| MTS | IMPLEMENTATION-PLAN Phase 3, SECURITY-ARCHITECTURE (deny by default, least privilege, server-derived identity), TECHNOLOGY-BLUEPRINT (Supabase as system of record for enrollment, announcements, and learning resources) |

---

## 3. Repository evidence inspected

| Area | Finding |
|---|---|
| Stack | Next.js 16.3.3 App Router, React 19.2.8, TypeScript 5, Tailwind v4 CSS-first, `@base-ui/react` 1.7, `lucide-react` 1.34 |
| Token layer | `src/app/globals.css` holds the full `--hsh-*` block plus `.hsh-*` type/container classes. No new token is needed. |
| Portal shell | `src/app/(portal)/layout.tsx` renders the **public** `SiteHeader`/`SiteFooter`; `src/components/layout/portal-nav.tsx` renders a single-destination context bar and records its own MDS gap: "the full sidebar is built when the destinations exist." That gap closes here. |
| Family page | `src/app/(portal)/family/page.tsx` is the family *foundation*, and states in comment that enrollments, schedule, announcements, and resources are deferred because the records do not exist. |
| Auth | `src/lib/auth/session.ts` derives identity from `getClaims()` and roles from `public.user_roles`; `src/lib/auth/guards.ts` gives redirect-to-sign-in and `notFound()` denial. Reused unchanged. |
| Family data | `src/lib/family/repository.ts` derives the family from the session, accepts no family id, and lets RLS filter. Its `FamilyState` discriminated union (`unavailable` / `failed` / `incomplete` / `ready`) is the pattern every new repository follows. |
| Schema | `families`, `family_members`, `students`, `programs`, `educator_assignments`, `profiles`, `user_roles`, `audit_events`. **No enrollment, announcement, resource, or schedule table exists.** |
| RLS helpers | `private.is_family_member(uuid)`, `private.is_admin()` exist and are used by the students policies. |
| Grants | `20260828010906` bulk-revokes and re-grants a hardcoded table list; `20260829140000` exists because `students` was omitted from it. **Any new table must repeat that lesson** (§5.8). |
| Seed | `supabase/seed.sql` refuses to run unless `app.environment` is `local` or `preview`; two families, four parents, three sample students, one educator with one published assignment. |
| Tests | pgTAP under `supabase/tests/database/`, Playwright with a console guard, axe at four viewports, committed screenshot and ARIA baselines, `node --test` unit tests. |
| Release gate | `scripts/check-demo-placeholders.mjs` blocks a production build while `public/placeholder/` art exists. Unchanged by this work. |

---

## 4. The blocking question this plan answers

MPS-REQ-015 and MDS-REF-007 both require enrollments, schedule, announcements,
and resources. None of those records exist, and the previous slice deferred the
dashboard for exactly that reason.

Building the dashboard therefore requires new schema. That is authorized:
MTS Phase 3 names "pending enrollment/payment states, and the family
dashboard"; TECHNOLOGY-BLUEPRINT names Supabase as the Foundation Release
system of record for "enrollment, announcements, and learning resources";
MPS-REQ-015 is an approved Must requirement; and EXC-001 permits it with
sample or sanitized data.

GAP-010 blocks **automated financial-policy outcomes**, not the existence of an
enrollment record. This slice creates no financial decision: it reads a state
an authorized human set, and says exactly what that state means.

**This plan therefore proposes new tables. That is the decision needing owner
approval.**

---

## 5. Design decisions and rationale

### 5.1 The enrollment state vocabulary, and who owns it

Two approved vocabularies exist and they are not the same list:

- MPS-WFL-003 `states`: `started, approval_pending, payment_pending,
  waitlisted, confirmed, payment_failed, canceled, blocked`
- MDS `components.enrollment_state.variants`: `open, limited_spaces, waitlist,
  pending_review, awaiting_external_payment, payment_pending_verification,
  enrolled, not_confirmed, closed, cancelled`

Resolved by subject authority, not by picking one: **MPS owns the state, MDS
owns its presentation.** The database enum is the MPS list verbatim. A single
mapping table in `src/components/family/enrollment-state.tsx` turns each stored
state into the MDS variant, icon, label, and sentence:

| Stored state (MPS) | MDS variant | Family-visible label | Sentence |
|---|---|---|---|
| `started` | `awaiting_external_payment` | Awaiting checkout | Checkout was started on Home School Haven's payment provider. Enrollment is not confirmed. |
| `approval_pending` | `pending_review` | Pending review | Your request was received. Home School Haven is reviewing it. |
| `payment_pending` | `payment_pending_verification` | Payment verification pending | We are verifying your payment. **Enrollment is not yet confirmed.** |
| `waitlisted` | `waitlist` | Waitlisted | You are on the waitlist. A waitlist place is not enrollment. |
| `confirmed` | `enrolled` | Enrolled | Home School Haven has confirmed this enrollment. |
| `payment_failed` | `not_confirmed` | Not confirmed | Payment did not complete. Enrollment is not confirmed. |
| `canceled` | `cancelled` | Cancelled | This enrollment was cancelled. |
| `blocked` | `not_confirmed` | Not confirmed | Something needs Home School Haven's attention before this can proceed. |

Only `confirmed` renders success styling and the word "Enrolled". Every tone is
paired with an icon and an explicit label; none carries meaning by colour
alone. `payment_pending` states non-confirmation in its own sentence rather
than relying on the reader to infer it, which is what DO-DONT "Trust states"
and the user's brief both require.

### 5.2 Schedule: published facts only, and no invented dates

MDS-REF-007 shows a "Today's Schedule — Sample Class · 10:00 AM" card. The
`programs` table publishes `published_schedule` as free text
("Tuesdays and Thursdays") and no dated sessions, because the source publishes
none. Import rule 3 and DO-DONT forbid inventing a date, a time, or a location.

**Decision:** no `schedule_items` table and no fabricated times. The Schedule
section lists each program the family holds a non-cancelled enrollment in,
showing `published_schedule` verbatim, or "Contact for details" when it is
`NULL`, plus one sentence saying dated sessions have not been published. When
the family holds no non-cancelled enrollment, the approved no-schedule state
renders.

**Recorded as deviation D-FD1** from MDS-REF-007's dated-time card. Written MDS
state outranks generated imagery, and MPS-REQ-020 requires consistency with the
authoritative published program facts.

### 5.3 The student selector, and the student id in the URL

The selector is a `<form method="GET">` containing the existing MDS `Select`
plus a visible submit control, so it is fully keyboard operable, works without
JavaScript, and needs no client state. Selection travels as
`/family?student=<uuid>`.

The server **validates** that id against the RLS-returned student list for the
authenticated family and silently falls back to the first student when it does
not match. An id from another family therefore selects nothing and reveals
nothing — the same shape as `remove_student_from_own_family`. The id is never
an authorization input; the family is always derived from the session.

Weighed against "do not place private family or student data in URLs": a
random UUID carries no name, grade, or relationship, and it is the only value
that makes a server-rendered, no-JS, shareable-within-the-session selector
work. Analytics runs on public routes only and never sees it. **Flagged for the
owner as a reversible decision** — the alternative is a signed cookie, at the
cost of a non-linkable, non-back-button-safe selector.

Changing the selection changes dashboard context only. It creates no session,
no credential, and no student identity of any kind.

### 5.4 Announcement and resource scoping

An announcement is visible to a family when it is `published` **and** the
family holds a non-`canceled` enrollment in its program. A resource follows the
same rule. Both are enforced in RLS through a `private.` helper, not in a query
the application could forget to write — the same reasoning that keeps
`getFamilyState()` free of `.eq()` filters.

No announcement is addressed to a family directly in this slice: a
family-targeted announcement is a communications feature (MPS-FEA-009, Phase 4)
and adding the column now would ship an unreachable, untested access path.

### 5.5 Section-level failure, not page-level

Each section reads through its own repository function returning its own
discriminated state. A failed announcements read renders a recoverable error
inside the announcements card while enrollments still render — that is the
"partial data" state the brief requires. An empty read and a failed read never
look the same, following the precedent already set in `family/page.tsx`.

### 5.6 Resources are links, not files

MTS reserves private Supabase Storage with scoped signed URLs for protected
files. Implementing upload authorization, type and size validation, and signed
access is a slice of its own. This slice stores a published `url` and renders
`rel="noopener noreferrer"` external links with an explicit off-platform
indication. No file leaves Storage because none enters it.

### 5.7 The sample-data constraints carry forward

Every new table carries `is_sample boolean not null default true` with
`check (is_sample)`, exactly as `students` does. While GAP-005 and GAP-010 are
open, a non-sample enrollment, announcement, or resource **cannot be stored at
all**. MPS-RUL-007 as a constraint rather than as a promise. The
"PRIVATE BETA · SAMPLE DATA" band from MDS-REF-007 states the same thing on the
page, following the precedent set by `/resources` and the family page.

### 5.8 Grants must be repaired in the same migration

`20260828010906_foundation_least_privilege_grants.sql` revokes all on every
table in `public` and re-grants a hardcoded list. It runs *before* any new
table exists, so the new tables' grants must live in the new migration, after
their DDL, and `00_setup.test.sql` must assert them — which is precisely what
DEFECT-FF1 taught. `anon` receives nothing on any of the three tables.

### 5.9 Route map

| Destination | Route | Status |
|---|---|---|
| Overview | `/family` | new dashboard (replaces current page content) |
| Programs | `/programs` | existing public catalog |
| Schedule | `/family/schedule` | new list route |
| Announcements | `/family/announcements` | new list route |
| Resources | `/family/resources` | new list route |
| Family | `/family/household` | existing family/student management, moved |
| Account | `/account` | existing |

Mobile bottom navigation carries five: **Overview, Programs, Schedule, Family,
Account**. Announcements and Resources move into the mobile More menu, and both
remain reachable from their Overview cards, so no required trust or privacy
meaning is hidden — only a duplicate navigation path is deferred.

`/family/setup` and `/family/students/new` stay where they are. Moving the
management page to `/family/household` updates `family-setup.spec.ts` and its
four screenshot baselines.

---

## 6. Expected changes

### Migration — `supabase/migrations/<ts>_family_dashboard_records.sql`

```
create type public.enrollment_state as enum
  ('started','approval_pending','payment_pending','waitlisted',
   'confirmed','payment_failed','canceled','blocked');

create table public.enrollments (
  id, family_id -> families, student_id -> students, program_id -> programs,
  state public.enrollment_state not null default 'started',
  state_changed_at, is_sample (check), created_at, updated_at,
  unique (student_id, program_id)          -- MPS-REQ-014 no duplicate enrollment
);

create table public.announcements (
  id, program_id -> programs, title, body,
  published boolean not null default false, published_at,
  is_sample (check), created_at, updated_at
);

create table public.learning_resources (
  id, program_id -> programs, title, description, url,
  published boolean not null default false,
  is_sample (check), created_at, updated_at
);

private.family_has_enrollment_in(program_id uuid) returns boolean  -- stable, security definer
```

RLS, deny by default:

- `enrollments_select_own_family` — `private.is_family_member(family_id)`
- `enrollments_select_admin`, `enrollments_select_assigned_educator`
  (educator sees rows for assigned programs only — MPS-REQ-018/MPS-ACC-028)
- `announcements_select_enrolled_family` / `learning_resources_select_enrolled_family`
  — `published and private.family_has_enrollment_in(program_id)`
- admin select policies for both
- **no INSERT, UPDATE, or DELETE policy for any client role on any of the three
  tables, and nothing at all for `anon`**

Audit triggers on `enrollments` state change, writing to `public.audit_events`
(MPS-REQ-024). Grants: `select` to `authenticated` only, per §5.8. Rollback
block in the header comment as every existing migration carries.

### Application

- `src/lib/enrollment/repository.ts` — `getEnrollments()`, session-derived,
  no id arguments, discriminated result.
- `src/lib/family/announcements.ts`, `src/lib/family/resources.ts` — same shape.
- `src/lib/family/dashboard.ts` — `selectStudent()` validation and
  `nextAction()` derivation, both pure and unit-tested.
- `src/components/layout/family-portal-shell.tsx` — sidebar, tablet rail,
  mobile header, bottom navigation, More menu, skip link target, safe-area
  padding, `aria-current="page"`.
- `src/components/family/enrollment-state.tsx` — §5.1 mapping over the existing
  `Badge`.
- `src/components/family/student-selector.tsx`,
  `src/components/family/next-action-card.tsx`,
  `src/components/family/enrollments-card.tsx`,
  `src/components/family/schedule-card.tsx`,
  `src/components/family/announcements-card.tsx`,
  `src/components/family/resources-card.tsx`,
  `src/components/family/review-data-banner.tsx`,
  `src/components/family/section-error.tsx`,
  `src/components/family/empty-state.tsx`
  — all composed from the existing `Card`, `Badge`, `Button`, `Select`.
- `src/app/(portal)/family/page.tsx` — the dashboard.
- `src/app/(portal)/family/loading.tsx` — the skeleton.
- `src/app/(portal)/family/household/page.tsx` — the moved management page.
- `src/app/(portal)/family/schedule|announcements|resources/page.tsx` — lists.
- No new token, no new colour, no new radius, no new type role.

### Seed

Sample enrollments for Family A (one `payment_pending`, one `confirmed`) and
Family B (one `waitlisted`), so both the pending-verification treatment
MDS-REF-007 is named for and the cross-family denial are demonstrable. Two
published announcements and two published resources on Family A's programs, one
unpublished of each to prove the `published` filter, and one on a
Family-B-only program to prove cross-family denial.

### Tests

- `supabase/tests/database/50_rls_family_dashboard.test.sql` — parent A reads
  own enrollments; parent A reads zero of family B's; unpublished announcement
  invisible; announcement for a non-enrolled program invisible; educator reads
  assigned-program enrollments only; `anon` reads nothing; no client write
  privilege on any of the three tables.
- `00_setup.test.sql` — assert the three new grants (§5.8).
- `tests/e2e/family-dashboard.spec.ts` — signed-out redirect; educator gets 404;
  authenticated parent renders; student selection changes context; an invalid
  `?student=` falls back without error or disclosure; no-family redirect to
  setup; no-students empty state; pending-verification language present;
  keyboard traversal of sidebar and selector; axe at four viewports;
  screenshots at 375/768/1280/1440; ARIA snapshot.
- `tests/family-dashboard.test.mts` — `nextAction()` priority order and
  `selectStudent()` validation.

---

## 7. Security, privacy, and data handling

- Family derived from the authenticated server session on every request; no
  family id is ever accepted from a caller.
- The student id from the URL is validated against RLS-returned rows and is
  never an authorization input.
- Deny by default: three new tables, read-only to clients, nothing to `anon`.
- No service-role key in any client path; no new client-side Supabase call.
- No student name, grade, family name, enrollment state, or identifier in any
  log, error message, analytics call, or URL beyond the opaque student UUID
  documented in §5.3.
- `force-dynamic` on every new route: authorization is decided per request.
- No PostHog on any of these routes.
- Sample-only constraints on all three tables while GAP-005 and GAP-010 remain
  open.
- Audit history for enrollment state changes (MPS-REQ-024).

---

## 8. Responsive and accessibility requirements

- Desktop 1024–1439 and wide 1440+: 264 px sidebar, 12-column dashboard grid at
  24 px gap, 1280 px portal container.
- Tablet 640–1023: 72 px navigation rail with accessible labels, 8-column grid
  at 20 px gap, operational information preserved rather than compressed.
- Mobile 0–639: 60 px header, one prioritized feed, five-destination bottom
  navigation, safe-area inset padding, 44×44 px minimum targets with 8 px
  separation.
- WCAG 2.2 AA: `<nav>`/`<main>`/`<section>` landmarks with accessible names, one
  `h1` and ordered headings, keyboard-operable navigation and selector, the
  approved 2 px Coral 700 focus ring at 2 px offset, accessible names on every
  icon-only control, `aria-live` on the loading and error regions, status
  conveyed by icon **and** text, contrast verified for the dark sidebar,
  `prefers-reduced-motion` honoured by the existing global rule.

---

## 9. Rollback

Every migration carries its `drop policy` / `drop function` / `drop table` /
`drop type` rollback block in the header, in reverse dependency order. The
application is additive apart from the `/family` → `/family/household` move,
which reverts with the branch. No data migration is destructive; no existing
table is altered.

---

## 10. Documentation reconciliation

Three statements say repository reconciliation is pending. It completed on
2026-08-27 and `mds/implementation/MDS-IMPLEMENTATION.md` records the real
versions, paths, and commands; six features have shipped against it. Update, in
place, without creating another AGENTS.md:

- `mds/MDS-HANDOFF-INDEX.md:18`
- `mds/MDS-PROJECT-STATE.yaml:898` (`agents_md.status`)
- `mds/implementation/MDS-IMPLEMENTATION.md:109`

---

## 11. Assumptions

1. New schema for enrollments, announcements, and resources is authorized under
   MTS Phase 3 and EXC-001 (§4). **This is the assumption most in need of
   confirmation.**
2. Sanitized enrollment records seeded by an authorized operator are an
   acceptable stand-in for the conversion journey in this slice.
3. `/family/household` is an acceptable home for the existing family and student
   management page.
4. The opaque student UUID in the URL is acceptable (§5.3).
5. Deviation D-FD1 (no invented schedule times) is acceptable (§5.2).

---

## 12. Checks to run

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test:unit
npm run db:start && npm run db:reset
npm run db:test
npm run db:advisors
npm run db:types && npm run db:types:check
npm run build
npm run test:e2e
```

Plus manual verification of every required state, keyboard traversal at the
four viewports, and side-by-side comparison against
`mds/references/assets/family-dashboard-reference.png`.

## 13. External setup required from the owner

None. The local Supabase stack and the sanitized seed cover everything. The
private preview needs `npm run db:reset` with `app.environment` set to
`preview` for the new seed rows to appear.

---

# Implementation record (2026-08-29)

Approved as written by Josh Coley on 2026-08-29, then implemented on
`feat/family-dashboard`.

## What changed

**Schema** — `supabase/migrations/20260829170000_family_dashboard_records.sql`
adds `public.enrollment_state` (the MPS-WFL-003 list verbatim), `enrollments`,
`announcements`, and `learning_resources`; the
`private.family_has_enrollment_in()` scoping helper; an enrollment audit trigger
writing to `audit_events`; a trigger asserting an enrollment's `family_id`
matches its student's; SELECT-only grants for `authenticated`; and nine SELECT
policies. No INSERT, UPDATE, or DELETE policy or privilege exists for any client
role on any of the three tables, and `anon` holds nothing.

**Application** — `src/lib/family/dashboard-state.ts` (pure `selectStudent` and
`nextAction`), `src/lib/enrollment/repository.ts`, `src/lib/family/content.ts`,
`src/components/family/{enrollment-state,section-states,student-selector,dashboard-cards}.tsx`,
`src/components/layout/family-portal-shell.tsx`, the `/family` dashboard, its
`loading.tsx` skeleton, and the `/family/schedule`, `/family/announcements`,
`/family/resources`, and `/family/household` routes. `Badge` gains a `success`
tone. `(portal)/layout.tsx` now renders only the skip link, so each area owns
its own chrome; the educator, admin, and family-setup pages render
`SiteHeader`/`SiteFooter` themselves.

**Seed** — four sample enrollments (one payment-pending, one confirmed, one
approval-pending on family A; one waitlisted on family B), four announcements,
and four resources, including one unpublished and one family-B-only of each so
both halves of the scoping rule are independently testable.

## Deviations

**D-FD1 — no dated schedule sessions.** MDS-REF-007 draws "Today's Schedule —
Sample Class · 10:00 AM". No dated session exists in the authoritative data;
`programs` publishes free text such as "Tuesdays and Thursdays" and nothing
more, because the source publishes nothing more. Import rule 3 and DO-DONT
forbid inventing a date, time, or location, and written MDS state outranks
generated imagery. The Schedule card shows published text verbatim, "Contact for
details" where the source is silent, and one sentence saying dated sessions have
not been published. **Needs Samantha's awareness as a visible difference from
the approved reference.**

**D-FD2 — no time-of-day greeting.** MDS-REF-007's page heading is "Good
morning". Rendering that on the server means guessing the reader's timezone from
the server's, so the heading is "Family Overview" — the same words the reference
puts in its top bar. Minor, and reversible if the owner prefers the greeting.

**D-FD3 — assistance routes to the existing contact path.** MDS-REF-007's "Need
help?" card offers "Request Assistance" and "Visit our Help Center". No help
centre exists and inventing one would be a fabricated destination, so the card
carries the single assistance action and points at `/contact`.

**D-FD5 — the page title is in the body, not the top bar.** MDS-REF-007 puts
"Family Overview" in the 64 px top bar and "Good morning" in the body as the
page heading. With D-FD2 removing the greeting, "Family Overview" became the
`h1`, and repeating it in the top bar would be the same words twice on one
screen. The top bar carries the signed-in adult's name, which the reference
also shows. Reverting D-FD2 reverts this with it.

**D-FD6 — no program thumbnails on enrollment rows.** MDS-REF-007 draws a photo
beside each enrollment. The only program imagery in the repository is generated
placeholder art under `public/placeholder/`, which
`scripts/check-demo-placeholders.mjs` blocks from production and which depicts
subjects who are not real students. Referencing it from a new surface would add
to what has to be removed before launch, for decoration. Rows are text-only
until approved photography exists.

**D-FD7 — one sample marker, not one per card.** MDS-REF-007 puts a "SAMPLE
DATA" chip on every card. The page carries the private-beta band once, at the
top, plus a sentence on the Schedule card explaining what is not published.
DO-DONT warns against overusing badges and pills, and six chips saying the same
thing on one screen is what that warns about. Easy to change if the owner wants
the per-card marker.

**D-FD4 — the student id travels in the URL.** `?student=<uuid>`, validated
server-side against the RLS-returned list, falling back silently. Recorded in
§5.3 as a reversible decision.

## Tripwire that fired, and why it was replaced

`supabase/tests/database/00_setup.test.sql` asserted
`hasnt_table('public', 'enrollments')` with the note "MPS GAP-010 leaves
financial policy unconfirmed". It fired exactly as designed. The answer recorded
in the test file: GAP-010 blocks automated financial *decisions*, not the
existence of a record whose state an authorized human set; MTS Phase 3 names the
family dashboard; EXC-001 permits it with sanitized data; and the owner approved
it on 2026-08-29. The assertion is replaced rather than deleted, by six that
guard what it guarded — the three tables are sample-only by CHECK, the three
grants exist, and no client role can write any of them.

## MDS gap closed

`portal-nav.tsx` recorded on 2026-08-27 that the 264 px sidebar, 72 px rail, and
five-destination mobile bottom navigation could not be built because only one
destination existed per role. They exist for the family area now, and
`family-portal-shell.tsx` implements all three compositions. The educator and
administrator areas keep the context bar until their own shells are built.

## Generated types

`src/lib/supabase/database.types.ts` is marked DO NOT EDIT BY HAND, and the
three new tables plus the `enrollment_state` enum were added to it by hand,
because regenerating requires the migration to be applied to the linked project
and that is an owner-coordinated action. Run `npm run db:types` after the
migration lands; `npm run db:types:check` will confirm no drift.

## Four defects this work introduced, found by the tests and fixed

**DEFECT-FD1 — `loading.tsx` silently downgraded denial from 404 to 200.**
A route-level `loading.tsx` at `/family` makes Next stream the response: the
`200` and the loading shell go out before the page body runs, so `notFound()`
in the guard could no longer set the status. `/family` answered **200** to an
educator instead of 404. No family data leaked — the streamed body was still
the not-found page and the guard runs before any query — but "a wrong-role
visitor is not told the route exists" stopped being true, and it silently broke
the status-code contract every denial test in the repository relies on.
`authorization.spec.ts` caught it.

Fixed by deleting the route-level `loading.tsx` and making the skeleton a
`<Suspense>` fallback inside the page, wrapping only the four section reads.
The guard and the family read now resolve before anything streams, so the
status is decided first, and the loading state is still there. The reasoning is
recorded in the header of `src/components/family/dashboard-skeleton.tsx` so the
next person does not reintroduce it.

**DEFECT-FD2 — the family portal lost its sign-out.** `SignOutButton` lived in
`PortalNav`, which the family area no longer renders, so a parent on any family
page had no way to sign out except by navigating to `/account`. Fixed by
putting it in the shell's context bar and mobile header, which is also what
MDS-REF-007 draws. `authorization.spec.ts` caught this one too.

**DEFECT-FD3 — the mobile bottom bar covered the last thing on the page.** The
sticky navigation had no content clearance, so "Add A Student" sat underneath
it on the household page at 390 px. Fixed with a mobile-only `pb-[124px]` on
the shell's content wrapper. Verified at a real 390x844 viewport scrolled to the
bottom: the button's box ends at y=494 and the bar starts at y=734.

**DEFECT-FD4 — the tablet rail stacked above the content instead of beside it.**
The shell's outer container was `flex-col lg:flex-row`, so between 640 px and
1023 px the 72 px rail became a full-width band across the top with the page
below it. MDS `layout.sidebar` specifies a rail at tablet, not a stacked band.
Fixed by moving the direction switch to `sm:flex-row`, which is where the rail
itself appears. Verified at 768x1024: rail on the left, content beside it,
current destination marked.

Note when reading the mobile baseline: a `fullPage` screenshot paints a
`position: sticky` element at its static position, so the bar appears
mid-page with content after it. That is a Playwright capture artifact, not the
rendered layout — the viewport-height check above is the one that describes what
a parent sees.

## Checks actually run

| Check | Result |
|---|---|
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** |
| `npm run format:check` | **Pass** |
| `npm run test:unit` | **Pass** — 53 tests, 0 failures, including 12 new ones for `selectStudent` and `nextAction` |
| `npm run build` | **Pass** — all seven family routes render dynamically (`ƒ`), none prerendered |
| `npm run db:start` / `db:reset` / `db:test` / `db:advisors` | **NOT RUN.** Docker is not available in this WSL environment (`docker: command not found`, no `/var/run/docker.sock`), so the local Supabase stack cannot start. The migration and the pgTAP suite are **unverified against a running Postgres.** |
| `npm run db:types` / `db:types:check` | **NOT RUN.** Regenerating requires the migration to be applied to the linked project, which is an owner-coordinated action. The types were added by hand; see above. |
| `npx playwright test` (full suite, 305 tests) | **274 passed, 25 failed, 6 skipped.** Every failure is accounted for below; none is an unexplained regression. |

### The 25 failures, by cause

| Count | Cause |
|---|---|
| 10 | Data-dependent dashboard tests. The three new tables do not exist on the configured Supabase project, so every enrollment, announcement, and resource read returns its `failed` state and the cards render their recoverable error — which is itself evidence the failure state works. |
| 5 | Dashboard screenshot and ARIA baselines, deliberately absent (see below). |
| 8 | `programs.spec.ts` visual baselines. **Pre-existing** — verified by stashing this branch entirely, rebuilding, and re-running: they fail identically on a clean tree (a 30 px height drift, 1280x2313 expected vs 1280x2343 received). |
| 1 | `about.spec.ts` ARIA snapshot. **Pre-existing** — an uppercase eyebrow now reflected in the accessible name, in a file this branch does not touch. |
| 1 | `family-setup.spec.ts` "completes setup" — the `sample.parent.four@example.com` fixture was consumed by an earlier run, exactly as that file's own header documents. Needs a re-seed, not a fix. |

`authorization.spec.ts` passes in full, including the five new family routes
added to its protected-route matrix.

### What passed on the dashboard spec without the tables

Signed-out redirect and `redirectTo` preservation for all five family routes;
educator denial (404) on all five; the no-family redirect to setup; the family
name and private-beta band; unpublished content absent; the seven approved
destinations present and none 404ing; `aria-current` on the current
destination; the five-destination mobile bottom bar with Announcements and
Resources still reachable in More; 44 px mobile targets; and **axe with the
`wcag2a/2aa/21a/21aa/22aa` tag set on all five routes, zero violations**.

### What could not be verified, and needs a re-run

Everything that needs rows: the payment-pending trust language, "only confirmed
is called enrolled", the waitlist language, icon-and-label on every state, the
cross-family read denial in the browser, and student selection including the
three fallback cases. The unit tests cover the selection logic directly and
pass; the browser half is unproven.

Screenshot and ARIA baselines for the dashboard were **deleted rather than
committed**: the only captures available were taken with every section in its
error state, and a baseline of a broken page is worse than no baseline. Run
`npx playwright test tests/e2e/family-dashboard.spec.ts --update-snapshots`
once the migration and seed are applied.

## What the owner needs to do

1. Apply `20260829170000_family_dashboard_records.sql` and the updated seed to a
   local stack or the private preview.
2. Re-run `npm run db:test`, `npm run db:advisors`, and
   `npm run test:e2e -- tests/e2e/family-dashboard.spec.ts`.
3. Run `npm run db:types` and commit the regenerated types.
4. Generate the dashboard baselines with `--update-snapshots`.
5. Re-seed before re-running `family-setup.spec.ts`: its "completes setup" test
   consumes the `sample.parent.four@example.com` fixture, as its own header
   documents.

## Visual comparison against MDS-REF-007

Compared at 390, 768, 1280, and 1440 px. The dashboard itself could only be
compared with every section in its error state (no tables on the configured
project), so the rows below describe the **shell**, which is fully verifiable,
and the dashboard body only where the composition is independent of data.

| Aspect | Result |
|---|---|
| Composition | Matches. Dark Forest 700 sidebar with the canonical logo on a warm-ivory panel; seven destinations in the approved order; quiet brand panel at the foot; 64 px context bar; three-column card grid; assistance card last. |
| Sidebar | Matches. 264 px expanded, Forest 600 pill on the current destination, Forest 100 labels, white on selected. |
| Alignment | Matches. Content sits in the 1280 px portal container with the approved 32/24/16 px gutters. |
| Spacing | Matches the approved scale throughout; no value outside the 4 px scale is used. |
| Typography | Matches. Lora for the `h1` and every card title, Manrope for navigation, labels, body, and controls. No operational passage is set in Lora. |
| Colour | Matches, all from tokens. One extension: `Badge` gains a `success` tone, Success `#2F6B4F` on Forest 100, measured 4.91:1 — AA for its 14 px semibold label. |
| Borders and radius | Matches. 14 px cards, 10 px controls, 999 px badges, 1 px neutral borders, card elevation only where the reference shows it. |
| Density | Matches at desktop. |
| Responsive | Desktop 264 px sidebar; tablet 72 px rail (after DEFECT-FD4); mobile 60 px header, one prioritized feed, five-destination bottom bar with More. |
| Deviations | D-FD1 through D-FD7 above. |

### Not yet compared

The trust-state treatment MDS-REF-007 exists to show — the gold "Your next
step" panel carrying the payment warning, the badge row on each enrollment, and
the relative weight of the three top cards with real content in them. That
comparison needs the migration applied, and it is the single most valuable thing
to look at once it is.


---

# Post-migration verification (2026-08-29)

The owner applied `20260829170000_family_dashboard_records.sql` to the linked
Supabase project. Re-running the checks that were previously blocked:

## `npm run db:types` and `db:types:check` — PASS

Regenerated from the linked project. The hand-written declarations added while
the migration was unapplied **matched the real schema exactly** — the
regeneration removed nothing and changed nothing, and `db:types:check` reports
"matches the database schema". The file is now genuinely generated rather than
hand-maintained.

## `supabase db advisors --linked --type all --level info` — RAN, 40 findings

No ERROR-level findings. Of the 40, eleven touch objects this branch added:

| Finding | Assessment |
|---|---|
| `anon_/authenticated_security_definer_function_executable` on `record_enrollment_audit()` and `enforce_enrollment_family_matches_student()` | **Not actionable, and verified empirically.** PostgREST does not expose functions that `return trigger`. A POST to `/rest/v1/rpc/record_enrollment_audit` with the anon key answers `404 PGRST202`, and so does the pre-existing `record_student_audit`. The advisor flags the EXECUTE privilege, not a reachable endpoint. Every trigger function in the project is flagged the same way — `handle_new_user`, `record_student_audit`, `record_program_audit`, `record_educator_assignment_audit` — so this is a pre-existing project-wide pattern, not something this branch introduced. |
| `multiple_permissive_policies` on all three new tables | **Accepted.** Each table has three SELECT policies (own family / assigned educator / admin) that Postgres ORs together, costing one extra evaluation per row. Collapsing them into one policy with an OR chain would make the boundary materially harder to read and audit, and `public.programs` already carries four separate SELECT policies for the same reason. Consistent with precedent; revisit only if enrollment volume makes it measurable. |
| `unused_index` on the four new indexes | **Expected.** They have never been used because no query has run against a populated table yet. Re-check after the seed and some real traffic. |
| `unindexed_foreign_keys` (3, INFO) | None are on the new tables. Pre-existing. |
| `auth_leaked_password_protection` (WARN) | Pre-existing Auth configuration, unrelated to this branch. Worth the owner's attention separately: it is a one-switch hardening in the Supabase dashboard. |

## `npm run db:test` — STILL BLOCKED

`supabase test db` requires Docker even with `--linked`: it runs `pg_prove` in a
container, and the CLI fails with `LegacyDockerRunError` before it connects.
Docker is still absent from this environment. `psql` is installed, but
`supabase/.temp/pooler-url` carries no password, so the suite cannot be driven
directly either.

**`supabase/tests/database/50_rls_family_dashboard.test.sql` and the six new
assertions in `00_setup.test.sql` remain unexecuted.** They are the only proof
that the cross-family, unpublished-content, educator-scope, and no-write-path
boundaries hold in the database. This is the largest outstanding gap.

## Dashboard baselines — STILL BLOCKED, because the seed is not applied

The tables exist and the reads now **succeed**, which is itself new information:
the embedded selects in `getFamilyEnrollments`, `getFamilyAnnouncements`, and
`getFamilyResources` are valid against the real schema, and every card renders
its *empty* state rather than its error state. Before the migration they all
returned `failed`.

But every table is empty, so the trust-state tests still have nothing to assert
against: 19 passed, 15 failed, and the failures are the same data-dependent set
plus the five absent baselines. Generating baselines now would capture a
dashboard with "No registrations yet" in every card — a baseline of an empty
page, which is exactly as misleading as the error-state one deleted earlier.
The snapshot directory is left absent again.


## DEFECT-FD5 — the student selector displayed a raw UUID (fixed)

Found by looking at the running dashboard rather than by a test. The trigger
read `40000000-0000-4000-8000-000000000001` instead of "Sample Student A1": Base
UI's `Select.Value` renders the selected *value*, and the value is the student
id, so a database identifier appeared in place of a parent's own child's name.

Fixed by passing `items` to `Select.Root`, which is how Base UI maps a value to
its label. Verified: the trigger now reads "Sample Student A1".

Worth noting how it escaped: the selector renders whether or not enrollments
exist, but the test that would have caught it — "a parent can change which of
their own children is in view" — asserts on enrollment content, so it was
failing for the unseeded-data reason and masking this. The lesson is that the
blocked tests are not only unverified, they are actively hiding things, and the
seed matters more than the failure list suggested.
