# Implementation prompt — Administrator Operations Foundation (MDS-REF-009)

**Branch:** `feat/admin-operations-foundation`
**Slice:** Administrator portal shell + read-only operational overview
**Phase:** MTS IMPLEMENTATION-PLAN Phase 4 (administrator operations, first slice)
**Prepared:** 2026-08-29
**Status:** Awaiting approval — no production code written

---

## 1. Goal and slice boundary

Establish the secure administrator portal foundation and a **read-only**
operational overview for the Foundation Release. Every number, state, and
attention item on the page comes from an authoritative database query the
administrator is already authorized to run. Nothing on this page mutates
anything.

### In scope

1. Server-enforced administrator access on every `/admin` route (already
   present as `requireAdmin`; extended to the new sub-route surface).
2. The approved administrator operations shell from MDS-REF-009 — 264 px
   desktop sidebar, 72 px tablet rail, 60 px mobile header with bottom
   navigation, 64 px portal top bar, 1440 px operations content width.
3. Role-specific administrator navigation limited to destinations that
   actually exist.
4. Read-only operational overview: attention hierarchy, program operational
   summary, enrollment operational summary, family summary,
   educator-assignment summary, recent operational activity.
5. Loading, empty, partial, error, forbidden, and unauthenticated states.
6. Responsive table-to-record-card transformation for the program table.
7. WCAG 2.2 AA behavior throughout.

### Explicitly out of scope in this branch

- Any program, enrollment, family, educator, schedule, communication, report,
  or settings **mutation**. No CRUD.
- Enrollment approval, payment confirmation, consent approval, scholarship,
  refund, cancellation, credit, transfer.
- Administrator provisioning or role assignment UI.
- Detail drawers, filters, sorting, pagination (MDS
  `page_shells.admin_operations` names them; they belong to the per-destination
  slices that follow).
- Educator workspace expansion, Course Builder, real-family activation.
- Any change to existing family or educator authorization or RLS.

---

## 2. Active system versions

| System | Version | Status |
|---|---|---|
| MPS | v1.0 (REL-BETA-001) | Approved functional baseline — policy-blocked by GAP-005, GAP-010; EXC-001 permits sanitized review |
| MDS | v1.0 approved and locked (`MDS-PROJECT-STATE.yaml` records `mds_version: v1.1`, `current_gate: implementation_readiness`) | Approved |
| MTS | v1.0 fully approved | Approved |

---

## 3. Requirements and acceptance criteria implemented

| ID | How this slice satisfies it |
|---|---|
| MPS-REQ-004 | Administrator pages and data are refused to public visitors, parents, educators, and role-less accounts, in the server guard and independently in RLS. |
| MPS-REQ-005 / MPS-RUL-007 | Every record surfaced is `is_sample`-constrained sample data, and the page says so in the MDS-REF-009 private-beta band. |
| MPS-REQ-008 / MPS-REQ-020 | Program identity, publication state, educator assignment, and registration path are read from `public.programs` — the same authoritative rows the public catalog and family dashboard read. |
| MPS-REQ-014 | Enrollment counts are read from the one authoritative `public.enrollments.state`; the administrator sees the same state the family sees. |
| MPS-REQ-016 (read half) | Program lifecycle **state** is displayed with prior material state attributable through `audit_events`. Transitions themselves are the next slice. |
| MPS-REQ-017 (read half) | Educator-assignment reach is displayed. Assignment management is the next slice. |
| MPS-REQ-021 | Every section has an observable submitted/pending/failed/empty state and a safe recovery action. |
| MPS-REQ-023 | Phone, tablet, desktop, and wide compositions; WCAG 2.2 AA. |
| MPS-REQ-024 | Recent operational activity renders `public.audit_events`, the append-only attributable history. |
| MPS-RUL-004 | The page records and displays status; it decides and issues nothing. |
| MPS-RUL-005 | Owner-authority framing states that only an administrator or Samantha publishes program, price, availability, registration, or cancellation changes. |
| MPS-ACC-004 | Sample-data provenance is visible on the surface, not only in a comment. |
| MPS-ACC-005 | Cross-role denial is proven by pgTAP and by Playwright. |
| MPS-ACC-022 | Family and administrator read one consistent authoritative enrollment state. |
| MPS-ACC-026 | New state appears consistently; prior material state remains attributable. |
| MPS-ACC-031 | Public, family, and administrative views show consistent current program information. |

MDS: `page_shells.admin_operations`, `custom.admin_operations`,
`navigation.specification.admin`, `layout.header.portal_desktop`,
`layout.sidebar`, `layout.max_content_width.operations_wide`,
`components.table`, `components.enrollment_state`, `components.skeleton`,
`responsive.rules.*`, MDS-REF-009 approved rule "Adopt the displayed
administrator operations shell, attention hierarchy, program table, quick
actions, and owner-authority framing".

---

## 4. Resources inspected

**Approved artifacts:** `AGENTS.md`, `CLAUDE.md`;
`mps/REQUIREMENTS-RULES.md`, `mps/ACCEPTANCE-CRITERIA.md`,
`mps/WORKFLOW-CATALOG.md`, `mps/USER-ROLE-MODEL.md`,
`mps/SCOPE-RELEASE-PLAN.md`, `mps/MPS-PROJECT-STATE.yaml` (gap register);
`mds/MDS-PROJECT-STATE.yaml` (navigation, layout, responsive, components,
page_shells, references), `mds/specification/DO-DONT.md`,
`mds/references/REFERENCE-INDEX.md`,
`mds/references/assets/admin-dashboard-reference.png` (MDS-REF-009, read
visually); `mts/IMPLEMENTATION-PLAN.md`.

**Repository:**
`middleware.ts`, `src/lib/supabase/middleware.ts`, `src/lib/auth/session.ts`,
`src/lib/auth/guards.ts`, `src/lib/supabase/server.ts`, `src/lib/env.ts`;
`src/app/(portal)/layout.tsx`, `src/app/(portal)/admin/page.tsx`,
`src/app/(portal)/educator/page.tsx`, `src/app/(portal)/family/page.tsx`;
`src/components/layout/family-portal-shell.tsx`,
`src/components/layout/portal-nav.tsx`,
`src/components/family/section-states.tsx`,
`src/components/family/dashboard-skeleton.tsx`,
`src/components/family/enrollment-state.tsx`,
`src/components/family/dashboard-cards.tsx`,
`src/components/ui/{badge,card,button,text-link}.tsx`;
`src/lib/family/repository.ts`, `src/lib/enrollment/repository.ts`,
`src/lib/programs/repository.ts`;
`src/app/globals.css` (tokens, `.hsh-container-operations`);
all eight migrations in `supabase/migrations/`, `supabase/seed.sql`,
`supabase/README.md`, all six pgTAP suites in `supabase/tests/database/`;
`playwright.config.ts`, `tests/e2e/fixtures.ts`,
`tests/e2e/authorization.spec.ts`, `package.json`.

---

## 5. Findings — the eight determinations required before planning

### 5.1 How administrator identity is assigned and verified

Identity comes from `supabase.auth.getClaims()` in `src/lib/auth/session.ts`,
which verifies the JWT signature. `getSession()` is deliberately never used for
an authorization decision. Roles are then read from `public.user_roles` for
that verified `sub`. `isAdmin()` is true for `admin` **or** `owner`.

`requireAdmin(returnTo)` in `src/lib/auth/guards.ts` redirects an
unauthenticated viewer to `/sign-in?redirectTo=…` (via `safeReturnTo`, which
refuses off-site targets) and answers `notFound()` — a 404, not a 403 — to a
signed-in viewer without the role, so the existence of the administrator area
is not confirmed to the wrong person.

**Assignment** is a database operation only: `supabase/README.md` §"Granting a
role" documents `insert into public.user_roles …` executed against the
database. The seed grants `admin` to `sample.admin@example.com`. No `owner`
grant exists anywhere in the repository.

### 5.2 Is the role from an authoritative server-managed source?

Yes. `public.user_roles` is a Postgres table with RLS enabled and **no INSERT,
UPDATE, or DELETE policy for any client role**, plus no write privilege granted
to `anon` or `authenticated`. `20260827212014` states the reasoning explicitly:
authorization data is never in `auth.users.raw_user_meta_data`. The seed sets
`raw_app_meta_data` to provider information only and `raw_user_meta_data` to
`{}`. `private.is_admin()` is `SECURITY DEFINER`, `search_path = ''`, lives in
the unexposed `private` schema, and reads `auth.uid()` itself.

### 5.3 Can any role value be changed by the browser or an authenticated user?

No, on three independent layers:

1. **Privilege** — `20260828010906` revokes ALL on every `public` table then
   re-grants `select` only on `user_roles`. `00_setup.test.sql` asserts that
   `anon` and `PUBLIC` hold no write privilege anywhere and reach exactly one
   table.
2. **Policy** — `user_roles` has select-only policies. `40_rls_admin_and_audit.test.sql`
   proves even an administrator gets `42501` attempting to grant `owner`.
3. **Server** — no code path reads a role from a request body, header, cookie,
   or query string. `getViewer()` is the only role source and it is
   `server-only`.

`auth.users.raw_user_meta_data` is editable by the user and is read nowhere.

### 5.4 Which operational data already exists

| Entity | Table | Administrator reach |
|---|---|---|
| Programs, all publication states | `public.programs` | `programs_select_admin` |
| Educator assignments | `public.educator_assignments` | `educator_assignments_select_admin` |
| Families | `public.families` | `families_select_admin` |
| Family membership | `public.family_members` | `family_members_select_admin` |
| Students (sample) | `public.students` | `students_select_admin` |
| Enrollments (sample) | `public.enrollments` | `enrollments_select_admin` |
| Announcements, learning resources (sample) | `public.announcements`, `public.learning_resources` | `*_select_admin` |
| Role grants | `public.user_roles` | `user_roles_select_admin` |
| Profiles | `public.profiles` | `profiles_select_admin` |
| Attributable history | `public.audit_events` | `audit_events_select_admin` |

**Does not exist:** consent records, schedule entities, communications,
reports, settings, inquiry/assistance records
(`src/lib/contact/recorder.ts` returns `unavailable` by design), payment
records of any kind, program capacity.

### 5.5 Which overview metrics can be derived truthfully

Every metric below is a `count`/`group by` over the tables above, run as the
administrator with RLS applied. No metric is estimated, inferred, or seeded for
appearance.

- **Programs** — total; by `publication_state` (published / draft / archived).
- **Enrollments** — total; by `state`, using the same eight-value
  `enrollment_state` enum and the same MDS presentation mapping the family
  dashboard uses.
- **Families** — family count; student-profile count. Aggregate only.
- **Educators** — accounts holding the `educator` role; assignment count;
  published programs with no assignment.
- **Attention** — see §5.9.
- **Recent activity** — `audit_events` rows: time, entity type, action.

**Cannot be derived and will not be shown:** capacity or seats remaining
(no column, and MPS-RUL-002 makes it program-specific and unconfirmed),
revenue or payment totals (no payment records exist; MPS-REQ-013 and
DO-DONT forbid deriving payment truth), consent acceptance counts
(no consent entity), and anything about schedule, communications, or reports.

### 5.6 Which admin actions are approved for the Foundation Release

MPS-REQ-016 (program lifecycle), MPS-REQ-017 (educator assignment, enrollment
state, rosters), MPS-REQ-019 (announcements and resources), and MPS-REQ-024
(attributable history) are approved. **None of them is implemented**, and this
slice implements none of them — it is read-only by its own boundary. The RLS
write policies they will use already exist and are already tested, so those
actions add a UI, not a new trust boundary.

Consequence for the reference: MDS-REF-009's four quick actions — *New Program
Draft*, *Import Website Content*, *Review Enrollments*, *Manage Educators* —
and the *Review* / *View* buttons in its program table all lead to workflows
that do not exist. Rendering them would create dead links and imply an
unfinished workflow is available, which this slice's own brief forbids. They
are **omitted and recorded as deviations** (§9).

### 5.7 Which navigation destinations are already implemented

MDS `navigation.specification.admin` lists nine: Overview, Programs,
Enrollments, Families, Educators, Schedule, Communications, Reports, Settings.

Implemented today: **Overview** only (`/admin`). `/account` exists as a shared
portal destination. `/programs` exists but is the **public** catalog showing
published rows only — it is not the administrator Programs destination and
linking to it from the administrator sidebar would misrepresent it.

The repository already holds a precedent for this exact situation:
`portal-nav.tsx` records the owner decision of 2026-08-27 that "only the
destinations that exist are listed", because linking to unbuilt destinations
produces broken links. No approved disabled/unavailable navigation pattern
exists in the MDS component set. Per the brief, the eight unbuilt destinations
are therefore **kept outside the active navigation** and reported as later
slices (§9, §12).

### 5.8 Missing authorization or product-policy decisions

**MPS-GAP-ADMIN-001 — administrator provisioning is undefined (reported, not
invented).** MPS-REQ-016/017 and ACT-004 say administrators are "individually
assigned" delegated actors, but no approved MPS requirement, workflow, or
acceptance criterion defines *who* grants an administrator role, *through what
authorized workflow*, or *what evidence is retained*. The database is
deliberately built so this cannot happen through any client path. Today it is a
manual database operation documented in `supabase/README.md`. **This slice
builds no provisioning UI and no self-service promotion.** It is reported to
MPS for a decision.

**MPS-GAP-ADMIN-002 — the `owner` role is defined but never granted.**
`app_role` includes `owner` and `isAdmin()` accepts it, but no account holds
it and no MPS requirement distinguishes owner-only from delegated-administrator
authority in the Foundation Release. This slice therefore treats administrator
reach as read-only and never grants a delegated administrator owner-level
authority — the owner-authority framing states the boundary in words, which is
the most the approved state supports.

**MDS-GAP-ADMIN-003 — no approved "destination not yet available" navigation
pattern.** See §5.7.

Neither gap blocks this slice: an administrator already exists in the sanitized
review environment, and the slice is read-only.

### 5.9 Attention hierarchy — the six categories, mapped to authoritative data

| MDS-REF-009 category | Authoritative source | In this slice |
|---|---|---|
| Payment pending verification | `enrollments.state = 'payment_pending'` | **Yes** |
| Enrollment pending review | `enrollments.state in ('approval_pending','started')` | **Yes** |
| Consent required / unavailable / blocked | `students.affirmation_version = 'demo-unapproved-v0'` — a check-constrained fact meaning no approved consent language has been accepted, plus `enrollments.state = 'blocked'` | **Yes** |
| Missing educator assignment | published `programs` with no `educator_assignments` row | **Yes** |
| Content review required | `programs.import_status = 'import-title-review-detail'` — the content-QA flag set during the approved import (MPS-GAP-012) | **Yes** |
| Incomplete program information | published `programs` with `published_price`, `published_schedule`, or `published_dates` NULL — stated as *"the source does not publish this"*, never as an inferred deficiency | **Yes** |

Each item is informational: a count, a plain sentence, an icon, and an explicit
label. No item carries an action that changes a record. `payment_pending` says
in its own sentence that enrollment is not confirmed, reusing the existing
`ENROLLMENT_STATE` mapping so the administrator and the family read the same
words.

---

## 6. Existing components and utilities to reuse

**REUSE unchanged:** `requireAdmin`, `getViewer`, `isAdmin`, `createClient`,
`isSupabaseConfigured`, `SectionState<T>` (from `src/lib/enrollment/repository.ts`),
`ENROLLMENT_STATE` + `EnrollmentStateBadge`, `Badge`, `Card` family,
`Button`, `TextLink`, `SkipLink`, `SignOutButton`,
`SectionError`, `EmptyState`, `ReviewDataBanner`, `SampleNote`,
`.hsh-container-operations` and every `--hsh-*` token.

**COMPOSE:** a shared portal shell. `family-portal-shell.tsx` already
implements the exact MDS three-composition behavior (264 px sidebar / 72 px
rail / 60 px header + ≤5 bottom destinations, safe-area padding, 44 px targets,
distinct `<nav>` landmarks). Rather than copying 300 lines, extract the
mechanism into `src/components/layout/portal-shell.tsx` parameterised by
destination list, navigation accessible name, home href, and brand panel;
`FamilyPortalShell` becomes a thin wrapper whose rendered output is byte-for-byte
unchanged, and `AdminPortalShell` is a second wrapper. This is the REUSE→COMPOSE
step, and the family e2e suite is the regression check.

**EXTEND:** `Badge` gains no new variant — the existing `neutral / open /
limited / waitlist / pending / success / info` tones cover every operational
state here.

**CREATE (new conventions, recorded as MDS-conformant compositions, not new
design language):** an operational stat row, an attention list item, and the
responsive operational table → labeled record card. All three are drawn
directly from MDS-REF-009 and `components.table.specification.responsive`.

---

## 7. Files expected to change

### New

| Path | Purpose |
|---|---|
| `src/components/layout/portal-shell.tsx` | Shared MDS portal shell mechanism (sidebar / rail / mobile header + bottom nav). |
| `src/components/layout/admin-portal-shell.tsx` | Administrator destinations, "Administration" nav label, `/admin` home. |
| `src/lib/admin/repository.ts` | `server-only`. All authorized administrator reads: program operations rows, program/enrollment/family/educator summaries, attention items, recent activity. Each returns a `SectionState`-shaped result. |
| `src/lib/admin/attention.ts` | Pure derivation of attention items from already-fetched rows, unit-testable without a database. |
| `src/components/admin/overview-cards.tsx` | Attention panel, operational summary tiles, owner-authority band. |
| `src/components/admin/program-operations-table.tsx` | Desktop table + mobile labeled record cards. |
| `src/components/admin/recent-activity.tsx` | `audit_events` list with plain-language action phrasing. |
| `src/components/admin/overview-skeleton.tsx` | Suspense fallback reserving the overview grid. |
| `tests/admin-attention.test.mts` | Unit tests for `attention.ts` and the activity phrasing map. |
| `tests/e2e/admin-overview.spec.ts` | Overview rendering, states, responsive transformation, axe, keyboard, ARIA snapshot, sanitized screenshots. |
| `supabase/tests/database/60_rls_admin_overview.test.sql` | pgTAP for the exact reads this page performs, per role. |

### Modified

| Path | Change |
|---|---|
| `src/app/(portal)/admin/page.tsx` | Rebuilt as the MDS-REF-009 operations overview inside `AdminPortalShell`. |
| `src/components/layout/family-portal-shell.tsx` | Becomes a thin wrapper over `portal-shell.tsx`; **no visual or behavioral change**. |
| `tests/e2e/authorization.spec.ts` | Extend the admin case: role-less account denial, direct-URL denial, post-revocation denial. |
| `supabase/README.md` | Document the administrator overview reads and the two MPS gaps. |
| `prompts/admin-operations-foundation.md` | Implementation record appended after execution. |

### Not modified

`middleware.ts`, `src/lib/auth/*`, `src/lib/supabase/*`,
`src/app/(portal)/layout.tsx`, every family and educator route,
`src/components/family/*` (reused, not edited), `src/lib/family/*`,
`src/lib/enrollment/*`.

---

## 8. Schema, RLS, and migrations

**No migration is required and none will be added.** Every read this slice
performs is already permitted by an existing `*_select_admin` policy with an
existing `grant select`. Verified table by table in §5.4.

**No existing policy is weakened.** Family isolation, educator scoping, and the
append-only audit table are untouched; the pgTAP suites that prove them are
re-run unchanged.

The only new database artifact is a **test** file
(`60_rls_admin_overview.test.sql`), which runs inside a rolled-back
transaction.

Rollback for the whole slice is therefore `git revert` — no data migration to
reverse, no destructive statement anywhere.

---

## 9. Deviations from MDS-REF-009, and why

| # | Deviation | Reason | Resolution |
|---|---|---|---|
| D-AO1 | **Quick Actions panel omitted.** | All four actions lead to workflows that do not exist. The brief: "If no approved quick actions are currently functional, present the overview without them and report the dependency." | Restored in the slice that implements program drafting, enrollment review, and educator management. |
| D-AO2 | **Program table's NEXT ACTION column (Review / View buttons and chevrons) omitted.** | Every target is a nonexistent route. A button that navigates nowhere implies an available workflow. | Restored with the program detail slice. |
| D-AO3 | **Sidebar lists Overview and Account only; the other eight administrator destinations are absent.** | They are unbuilt, and no approved unavailable-destination pattern exists (MDS-GAP-ADMIN-003). Follows the owner decision of 2026-08-27 already recorded in `portal-nav.tsx`. | Each destination joins the sidebar in its own slice. |
| D-AO4 | **Program thumbnail images in the table are rendered only where `programs.image_*` is fully populated**, otherwise a quiet glyph. | `programs_image_complete_check` allows NULL imagery, and `image_is_placeholder` marks demo art. Inventing a thumbnail is not available. | Resolves with approved photography. |
| D-AO5 | **"Good morning" time-of-day greeting replaced with a fixed page heading.** | Server-rendered time-of-day is wrong for any viewer outside the server's timezone, and a client-side greeting would hydrate differently than it rendered. The reference's editorial warmth is preserved in the Lora heading and subheading. | Reconcile with MDS if the owner wants the greeting. |
| D-AO6 | **Recent Activity shows entity type + action + time, not a prose sentence naming a program.** | `audit_events.changed_fields` holds enum labels by design and the row deliberately carries no family, student, or program name. Joining back to `programs` for a name is deferred rather than guessed. | Program-name resolution can be added once the program detail destination exists. |

Deviations D-AO1 through D-AO3 are direct consequences of the slice boundary
the brief set, not design disagreements.

---

## 10. Security and privacy

- Every `/admin` route calls `requireAdmin()` before it queries anything; the
  `(portal)` layout deliberately performs no authorization, so a layout change
  cannot open a route. `export const dynamic = "force-dynamic"` keeps
  authorization per-request.
- Denial style is unchanged: redirect for unauthenticated, `notFound()` (404)
  for wrong-role.
- RLS is the independent second control. No query in `src/lib/admin/repository.ts`
  filters by a client-supplied value; the administrator's reach comes from
  `private.is_admin()` in the database.
- **No service-role key anywhere.** `src/lib/env.ts` exposes the publishable
  key only; the anonymous/server clients are the same ones every other route
  uses. No client component receives a Supabase credential.
- **Aggregate over identity.** The overview reads `count` and `state`, not
  names. No student name, family name, parent email, or enrollment note
  reaches the page. The program table shows program fields only. `students` is
  read for a count and for the `affirmation_version` attention signal — never
  for a name.
- No identifier appears in a URL. The overview takes no route or query
  parameter at all, which removes an entire validation surface; if a future
  filter is added it will be validated against RLS-filtered rows the way
  `selectStudent()` already does.
- User-facing errors are plain language with a recovery action. No Postgres
  error code, message, constraint name, stack trace, or internal identifier is
  rendered. Errors are not logged with row contents.
- Screenshots and ARIA snapshots capture only `Sample …` fixtures on
  `example.com`; `npm run check:demo-assets` guards demo placeholders.
- Role revocation: because the role is read per request from `user_roles` and
  never cached in a cookie or token claim, deleting the grant denies the very
  next request. This is asserted by a test rather than assumed.

---

## 11. Responsive and accessibility requirements

**Compositions** (MDS breakpoints: mobile 0–639, tablet 640–1023, desktop
1024–1439, wide 1440+):

- **Desktop / wide** — 264 px Forest 700 sidebar, 64 px top bar, content in
  `.hsh-container-operations` (1440 px), 12-column grid, 24 px gutters,
  32 px page gutters.
- **Tablet** — 72 px rail with `sr-only` labels (accessible name preserved,
  never hover-only), 8-column composition, 20 px gaps, 24 px gutters.
- **Mobile** — no sidebar; 60 px header; bottom navigation capped at five
  destinations with safe-area padding; 4-column grid, 16 px gutters; the
  program table becomes labeled record cards, each field carrying its own
  visible label so no column meaning is lost.

**Accessibility:**

- `SkipLink` (already in the portal layout) → `<main id="main">`.
- One `<h1>`; sections use `<h2>` with `aria-labelledby`; no level skipped.
- Sidebar, rail, and bottom bar are separate `<nav>` landmarks with distinct
  accessible names.
- The desktop table is a real `<table>` with `<th scope="col">` and
  `<th scope="row">` for the program name.
- Every status pairs an icon **and** an explicit text label — never color alone.
- Loading announced via the existing `role="status"` skeleton pattern; section
  failures use `role="status"` (not `alert`) so a partial failure does not
  queue interruptions.
- 44×44 px minimum targets; ≥8 px between adjacent actions.
- Visible `--hsh-focus` focus ring; logical focus order; keyboard-operable
  navigation.
- Reduced motion honored by the existing global rule in `globals.css`.
- Contrast: reuse only approved token pairs already measured for AA.

---

## 12. Required experience states

| State | How it is produced |
|---|---|
| Initial loading skeleton | `<Suspense>` inside the page, after the guard resolves — so `notFound()` can still set the status (the `loading.tsx` lesson from the family dashboard). |
| Successful overview | Seeded sanitized data. |
| No operational records | Empty-database run; each section renders `EmptyState`. |
| No items requiring attention | Attention panel renders a calm "Nothing needs attention" state, not an empty box. |
| Partial data availability | Independent reads; one failure renders `SectionError` in that card while the rest render. |
| Recoverable query failure | Plain-language message + refresh guidance. No internal detail. |
| Unauthorized role | 404 for parent, educator, and role-less accounts. |
| Unauthenticated | Redirect to `/sign-in?redirectTo=/admin`. |
| Expired session | Same redirect; verified by clearing auth cookies mid-session. |
| Direct URL access by non-admin | `page.request.get()` status assertion, no navigation. |
| Empty table / record card | Explicit empty row state in both compositions. |
| Responsive table→card | Verified at 375 px. |
| Unavailable later-slice destinations | Absent from navigation; the page states in words which operations are not part of this review. |

---

## 13. Engineering checks to run

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run build
npm run db:start && npm run db:reset
npm run db:test                     # all seven pgTAP suites
npm run db:advisors
npm run db:types:check
npm run test:e2e                    # full suite, not only the new spec
```

Authorization matrix asserted (pgTAP + Playwright):

| Actor | `/admin` | Overview data |
|---|---|---|
| Signed out | 302 → `/sign-in?redirectTo=/admin` | none |
| Parent | 404 | none |
| Educator | 404 | none |
| Authenticated, no role grant | 404 | none |
| `user_metadata` claiming `role: admin` | 404 | none |
| Administrator | 200 | authorized reads |
| Administrator after role deletion | 404 on the next request | none |

Plus: existing family isolation suites re-run unchanged; `anon` reaches
nothing; no write privilege appears anywhere new.

---

## 14. Visual comparison method

Compare the rendered page against `mds/references/assets/admin-dashboard-reference.png`
at 1440×900 (wide), 1280×800 (desktop), 768×1024 (tablet), and 375×812
(mobile), checking in order: overall operations shell; sidebar width (264 px)
and top-bar height (64 px); content width (1440 px cap) and grid; private-beta
band; owner-authority framing; attention hierarchy and its semantic tones;
operational summary composition; program table structure and density;
typography roles (Lora headings, Manrope everywhere operational); token colors;
spacing rhythm; borders, radii, shadows; and each responsive transformation.

Evidence: Playwright screenshots committed under
`tests/e2e/admin-overview.spec.ts-snapshots/`, all sanitized. An ARIA snapshot
pins the landmark and heading structure.

---

## 15. Exact manual test steps (WSL/Ubuntu bash)

```bash
cd ~/home-school-haven
npm run db:start
npm run db:reset            # applies migrations + sanitized seed
npm run dev
```

1. **Unauthenticated** — open `http://localhost:3000/admin`. Expect a redirect
   to `/sign-in?redirectTo=%2Fadmin`.
2. **Administrator** — sign in as `sample.admin@example.com` /
   `SampleFoundationReview2026`. Expect `/admin`, the sidebar, the private-beta
   band, the owner-authority framing, and populated summaries.
3. **Truthfulness** — confirm the enrollment counts equal the seeded rows
   (1 payment_pending, 1 confirmed, 1 approval_pending, 1 waitlisted) and that
   `payment_pending` is described as *not confirmed*.
4. **Attention** — confirm each listed item corresponds to a real row, and that
   no item offers an action that changes a record.
5. **Recent activity** — confirm entries come from `audit_events` and name no
   family, student, or price.
6. **Parent denial** — sign out, sign in as `sample.parent.one@example.com`,
   navigate directly to `/admin`. Expect 404, and confirm the family dashboard
   still works.
7. **Educator denial** — same with `sample.educator@example.com`.
8. **Role revocation** — as administrator, in a second terminal:
   `psql "$DB_URL" -c "delete from public.user_roles where role='admin';"`
   then refresh `/admin`. Expect 404 on the next request. Restore with
   `npm run db:reset`.
9. **Responsive** — at 1440, 1280, 768, and 375 px confirm the four
   compositions and the table→card transformation.
10. **Keyboard** — from the skip link, tab through the sidebar, the table, and
    every link; confirm visible focus, logical order, and no keyboard trap.
11. **Empty state** — truncate the sample tables in a scratch database and
    confirm each section reads "nothing here", not "something failed".

---

## 16. Assumptions

1. `admin` and `owner` carry identical reach in this read-only slice
   (`isAdmin()` already treats them as one). MPS-GAP-ADMIN-002 is reported.
2. `students.affirmation_version = 'demo-unapproved-v0'` is an honest
   "consent not yet approved" operational signal, because the check constraint
   makes any other value unstorable today.
3. `programs.import_status = 'import-title-review-detail'` is an authoritative
   content-review flag from the approved import (MPS-GAP-012), not an inference.
4. A NULL `published_*` field means "the source does not publish this" and is
   presented in those words — never as a program defect.
5. Extracting the shared portal shell is in scope as reuse, not as unrelated
   refactoring, and the family suite is the proof of no regression.

---

## 17. External setup required from the owner

None to execute this slice locally. For the private preview, an administrator
role grant must exist on the linked project (`supabase/README.md` §"Granting a
role"). Two decisions are requested but do not block:
MPS-GAP-ADMIN-001 (administrator provisioning workflow) and
MPS-GAP-ADMIN-002 (owner vs. delegated-administrator authority).

---

## 18. Recommended next admin slices

1. **Programs destination** — program list with filters and a read-only detail
   view; restores D-AO2's next-action column as real navigation.
2. **Program lifecycle actions** (MPS-REQ-016) — draft, publish, reschedule,
   cancel, archive; restores the *New Program Draft* quick action.
3. **Enrollments destination** (MPS-REQ-017) — authorized manual reconciliation
   with attributable history; restores *Review Enrollments*.
4. **Educators destination** (MPS-REQ-017) — assignment management; restores
   *Manage Educators*.
5. **Families destination** — aggregate-first, minimum-necessary disclosure.

---

# Implementation record (2026-08-29)

Branch `feat/admin-operations-foundation`. Approved before implementation.

## What changed

### New

| Path | What it is |
|---|---|
| `src/components/layout/portal-shell.tsx` | The shared MDS portal shell: 264 px sidebar, 72 px rail, 60 px mobile header, ≤5-destination bottom bar, safe-area padding, distinct `<nav>` landmarks. Extracted verbatim from the family shell and parameterised. |
| `src/components/layout/admin-portal-shell.tsx` | Administrator destinations, landmark names, and brand panel. |
| `src/lib/admin/repository.ts` | `server-only`. The seven authorized reads and their per-section states. |
| `src/lib/admin/attention.ts` | Pure attention derivation. No Supabase import, so it is directly testable. |
| `src/lib/admin/activity.ts` | Pure audit-row phrasing, with the fallback that stops an unmapped database string reaching a screen. |
| `src/components/admin/overview-cards.tsx` | Summary tiles, attention panel, owner-authority band. |
| `src/components/admin/program-operations-table.tsx` | Desktop table + mobile labeled record cards. |
| `src/components/admin/recent-activity.tsx` | Attributable history list. |
| `src/components/admin/overview-skeleton.tsx` | Suspense fallback. |
| `tests/admin-attention.test.mts` | 12 unit tests over the attention derivation and activity phrasing. |
| `tests/e2e/admin-overview.spec.ts` | Rendering, trust language, privacy, read-only, axe, keyboard, table→card, content width, ARIA snapshot, four visual baselines, and the denial matrix. |
| `supabase/tests/database/60_rls_admin_overview.test.sql` | 23 pgTAP assertions: the page's seven reads run as five different callers. |

### Modified

- `src/app/(portal)/admin/page.tsx` — rebuilt as the MDS-REF-009 overview.
- `src/components/layout/family-portal-shell.tsx` — now a thin wrapper; rendered markup unchanged.
- `tests/e2e/authorization.spec.ts` — added the post-session-invalidation admin denial case.
- `supabase/README.md` — documented the overview's reads, both MPS gaps, and corrected a stale "not modelled" row that still claimed `enrollments` did not exist.

### Deliberately unchanged

`middleware.ts`, `src/lib/auth/*`, `src/lib/supabase/*`, `src/app/(portal)/layout.tsx`, every family and educator route, `src/lib/family/*`, `src/lib/enrollment/*`, and every migration. **No migration was added and no RLS policy was created, altered, or weakened.**

## Three implementation decisions worth recording

### 1. The PostgREST select string must be one literal

`supabase.from("programs").select("a,b," + "c")` typechecks as `GenericStringError` on every column: PostgREST infers the row type from the literal, and a runtime-built string defeats it. The concatenation was there for line length. It is now a single long literal with a comment saying why it must stay one.

### 2. `describeActivity` had to leave the repository

The Node test runner does not resolve the `@/` alias, and `repository.ts` is `server-only` with runtime `@/` imports — so nothing inside it is importable by a plain unit test. `attention.ts` survives only because its single import is `import type`, which is erased. The activity phrasing moved to `src/lib/admin/activity.ts` so its fallback — the control that stops an unmapped entity type reaching an operator's screen — is actually tested rather than assumed.

### 3. Attention reports partiality instead of disappearing

`deriveAttention` returns `incomplete: true` when a source could not be read, and the panel renders that as an explicit "some checks could not run" message. Without it, a failed enrollment read would have produced a short list that renders identically to "nothing needs attention" — the same empty-versus-failed confusion the family dashboard's `SectionState` exists to prevent, one level up.

## Deviations, as implemented

D-AO1 through D-AO6 are implemented exactly as §9 describes. Each is recorded in the header of the file that carries it, so the reason travels with the code rather than only with this document.

## Defects this work introduced, found by the tests and fixed

### DEFECT-AO1 — functions crossed the server/client boundary (HTTP 500)

Extracting `PortalShell` made it a Client Component, but the destination lists
stayed in `family-portal-shell.tsx` and `admin-portal-shell.tsx`, which had lost
their `"use client"` directive in the refactor. Those lists hold Lucide icon
*components*, and a function cannot be passed to a Client Component as a prop.

`/admin` returned **500** with "Functions cannot be passed directly to Client
Components", and so did `/family` — the extraction broke the family portal too.
The pre-existing `authorization.spec.ts` case "a parent reaches the family area
and nothing else" is what caught it, which is exactly the regression check §16
assumption 5 relied on.

Fixed by restoring `"use client"` on both wrapper modules, which puts the
destination list on the same side that consumes it. The page still passes only
`viewerLabel` and `children`, both serializable. Server error count on a full
page load went from 22 to 0.

### DEFECT-AO2 — the audit phrasing map was missing three real entity types

`create_family_for_current_user` emits `family:created` and the `students`
trigger emits `student:created` / `student:deleted`. None was in
`ACTIVITY_PHRASES`, so every recent-activity row on the seeded environment
degraded to the fallback and an administrator saw eight identical lines reading
"Operational change recorded".

The fallback did its job — no raw database string reached the screen — but the
card carried no information. Fixed by mapping the three pairs, with a test
pinning them and a second test asserting no phrasing introduces a name.

### DEFECT-AO3 — strict-mode locators, from rendering each row twice

The program table renders every row twice (desktop table, mobile record cards)
with CSS choosing which displays. Only one is in the accessibility tree, but
both are in the DOM, so an unscoped text locator matches twice. This broke a
**pre-existing** assertion in `authorization.spec.ts`. Both locators are now
scoped — the table for the draft assertion, `<dt>` for the card labels — with
the reason recorded at each site.

## Checks actually run

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run format:check` | pass |
| `npm run test:unit` | 67 pass, 0 fail (14 in the new suite) |
| `npm run build` | pass |
| `admin-overview.spec.ts` + `authorization.spec.ts` | 40 pass, 2 fail — both the fixture gap below |
| `npm run db:test` (pgTAP) | **NOT RUN** — see below |
| `npm run db:advisors`, `npm run db:types:check` | **NOT RUN** — same reason |

### What could not be verified here, and why

**pgTAP did not run.** `npm run db:test` needs the local stack and Docker is not
installed in this environment. The README's psql fallback needs a database
password; the linked project's `.temp/pooler-url` carries none and prompts. So
`supabase/tests/database/60_rls_admin_overview.test.sql` — 23 assertions running
the page's seven reads as an administrator, a parent, an educator, a role-less
account, and a caller whose JWT metadata falsely claims `admin` — **is written
and unexecuted**. It must pass before this branch merges.

**The linked review project has no enrollment rows.** The Enrollments tile reads
`All records: 0`, and the attention list contains no enrollment-derived item.
The `enrollments`, `announcements`, and `learning_resources` fixtures the family
dashboard slice added were never seeded there. Two admin assertions and five
pre-existing `family-dashboard.spec.ts` trust-state assertions therefore fail.
Those tests are correct and were left untouched: the data is absent, not wrong.
Resolve with `npm run db:start && npm run db:reset` against a local stack, or by
re-seeding the review project.

**The full 331-test suite could not be completed** against the remote project:
public pages that query programs pay an internet round trip, `/about` measured
23.5 s, and at the default 8 workers most specs time out. The targeted runs above
used `--workers=2` against a pre-built server.

## Gaps found in existing data, reported not fixed

**No program carries a checkout URL.** `supabase/seed.sql` never populates
`programs.checkout_url` — the column appears in no insert statement — so every
row on the overview correctly reads "No checkout link published". MPS-REQ-013's
approved program-specific `pay.homeschoolhaven.org` links are recorded in
`mps/BETA-CONTENT-IMPORT-INVENTORY.md` but are not in the seed. Surfacing this
is the overview working; populating it is a content task for a later slice and
needs the owner's confirmation of each link.

### DEFECT-AO4 — consent language compressed on mobile

The attention row put the count badge beside the text at every width. At 390 px
that squeezed the sentence to one or two words per line, and the worst-affected
sentence was the consent one — precisely the language DO-DONT names: "Do not
compress help, validation, consent, payment, or privacy language."

Found by reading the captured mobile screenshot, not by a failing assertion. No
test was red; the page was simply wrong to read. The badge now stacks below the
text under 640 px and sits beside it from `sm` up. Full-page mobile height fell
from 6836 px to 5920 px.

## Final verification state

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run format:check` | pass |
| `npm run test:unit` | **67 pass, 0 fail** |
| `npm run build` | pass, compiled successfully |
| `admin-overview.spec.ts` + `authorization.spec.ts` (`--workers=2`) | **40 pass, 2 fail** — both the enrollment-fixture gap |
| Server errors across a full page load | **0** |
| Visual baselines | 4 viewports captured and re-verified |
| ARIA snapshot | captured and re-verified |
| pgTAP | **NOT RUN** — no Docker, no database password |

The two failures are `never presents payment activity as confirmed payment` and
`uses the same enrollment vocabulary the family sees`. Both assert on enrollment
records the linked review project does not contain. They were left failing
rather than weakened.

`tests/e2e/family-dashboard.spec.ts-snapshots/` was generated during diagnosis
and then deleted: baselines captured against a database missing its enrollment
fixtures would have committed a wrong reference for someone else's slice.

## Visual comparison against MDS-REF-009

Compared at 1440, 1280, 768, and 390 px.

Matching: Forest 700 sidebar with the canonical logo on its own ivory panel and
the brand panel beneath; 64 px top bar; private-beta band; Lora display heading
with Manrope supporting copy; four-tile summary row; program table with
thumbnail, publication, educator, and registration-path columns; attention list
with warning / blocked / information semantics, each pairing an icon with an
explicit label; recent-activity list; owner-authority band; two-column
attention-plus-activity composition; 1440 px operations content cap; 72 px
tablet rail with accessible labels; mobile record cards.

Deviating, as approved in §9: no Quick Actions panel (D-AO1), no NEXT ACTION
column (D-AO2), two sidebar destinations rather than nine (D-AO3), glyph instead
of a thumbnail where the source publishes no imagery (D-AO4), fixed heading
rather than a time-of-day greeting (D-AO5), and activity entries without a
program name (D-AO6).
