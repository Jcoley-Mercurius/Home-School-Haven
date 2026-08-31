# Educator Assigned-Program Workspace

**Slice type:** UI and application integration. No schema change, no new RLS policy, no RLS widening.
**Branch:** `feat/educator-assigned-workspace`
**Prepared:** 2026-08-31

---

## 0. Branch base — decision required before implementation

The requested commands branched from `main`. `main` (23c0b8d) does **not** contain
the educator assignment and roster authorization boundary this slice depends on.
That work is commit **9aebead** ("Let an administrator see families and assign
educators") on `feat/admin-family-educator-operations`, which is unmerged.

Specifically, `main` has no `EDUCATOR_ROSTER_COLUMNS`, no
`students_select_assigned_educator` policy, no migration
`20260831000000_admin_family_educator_assignment_operations.sql`, and a seed in
which the sample educator holds no confirmed enrollment — so MPS-ACC-028 is not
satisfiable there at all.

`feat/educator-assigned-workspace` has therefore been reset onto **9aebead** so
the prerequisite is present. Two ways to land this:

* **(A, recommended)** Merge `feat/admin-family-educator-operations` to `main`
  first, then rebase this branch onto the merge. This slice's PR then shows only
  educator-workspace changes.
* **(B)** Keep this branch stacked on 9aebead and merge in order.

No implementation begins until this is confirmed.

---

## 1. Goal

Give an authenticated, assigned educator a read-only workspace over the programs
they hold, using the approved MDS educator navigation and the assignment
boundary that already exists in the database.

## 2. Non-goals

Course Builder, lesson authoring, resource upload, announcement publishing,
schedule creation, capacity or waitlist operations, attendance, cancellation or
transfer policy, notifications, roster editing, any student or family mutation,
any new educator-visible student field, any migration, any RLS change.

## 3. Active versions

MPS v1.0 · MDS v1.1 (state file; DESIGN-SYSTEM header) · MTS v1.0.
This is MTS IMPLEMENTATION-PLAN **Phase 4**, educator half.

## 4. Requirements traceability

| ID | How this slice satisfies it |
|---|---|
| MPS-REQ-004 | Every read is scoped to the viewer's own assignments, server-derived; unassigned programs 404. |
| MPS-REQ-005 | Reads only existing sanitized seed rows. No fixture invented, `is_sample` unchanged. |
| MPS-REQ-017 | Roster is *presented*, never managed. No assignment or enrollment write exists on any educator route. |
| MPS-REQ-018 | The slice is this requirement: assigned programs, schedule, roster with approved fields, resources, program-scoped announcements — and nothing else. |
| MPS-REQ-019 | Read half only. Content state (published / draft) is shown; no create, publish, replace, or remove. |
| MPS-REQ-020 | Program identity, published schedule, educator, availability and publication state are read from `public.programs` — the same rows the public and admin surfaces read. No second copy. |
| MPS-REQ-021 | Every section renders loading, empty, unavailable, and failed distinctly, each with a stated recovery. |
| MPS-REQ-023 | 264 px sidebar / 72 px rail / mobile header + bottom bar; tables become labeled cards; 44 px targets; WCAG 2.2 AA. |
| MPS-REQ-024 | Read-only slice writes no history because it makes no material change. Assignment history already exists via `educator_assignments_audit`. |
| MPS-ACC-004 | Private-beta sample-data banner on every educator page, as the family and admin areas carry. |
| MPS-ACC-005 | e2e: signed-out, parent, and unassigned-viewer denials; pgTAP already proves the database half. |
| MPS-ACC-028 | Confirmed roster derived through `partitionRoster`; `enrollments_one_per_student_program` guarantees exactly once; only `EDUCATOR_ROSTER_COLUMNS` is selected. |
| MPS-ACC-029 | e2e: program 0004 (assigned) renders; 0002/0005 (unassigned) 404 on direct URL. |
| MPS-ACC-030 | Announcements and resources render their current published/draft state; family denial already covered by the family suite. |
| MPS-ACC-031 | Program state (publication, availability) shown consistently with `/programs` and `/admin/programs`; each state carries text, never colour alone. |
| MPS-ACC-032 | Four-viewport screenshots, ARIA snapshot, axe run, and written manual steps. |

## 5. What already exists and is reused, not rebuilt

**Database — nothing to add.** Every policy this slice needs is in place and
pgTAP-tested:
`programs_select_assigned_educator`, `enrollments_select_assigned_educator`,
`announcements_select_assigned_educator`, `learning_resources_select_assigned_educator`,
`students_select_assigned_educator`, `educator_assignments_select_own`.

**Components:** `PortalShell` (the whole responsive mechanism), `SkipLink`,
`Breadcrumbs`, `EnrollmentStateBadge`, `PublicationBadge`, `AvailabilityBadge`,
`SectionError`, `EmptyState`, `ReviewDataBanner`, `SampleNote`, `ListSkeleton`,
`Alert`, `TextLink`, `Card`.

**Server:** `requireRole`, `getViewer`, `createClient`, `isSupabaseConfigured`,
`partitionRoster`, `EDUCATOR_ROSTER_COLUMNS`, the `AdminRead<T>` / `SectionState<T>`
result shapes.

**Not reused:** `RosterSection` and `getProgramRoster` (`lib/admin/`). Both select
`families(name)` and are administrator-facing by their own module contract. An
educator gets neither the family name nor any second student column — see §7.

## 6. Routes and files

**New routes** (all under the existing `(portal)` group):

| Route | Purpose |
|---|---|
| `/educator` | Overview — replaces the current placeholder page |
| `/educator/programs` | Assigned Programs list |
| `/educator/programs/[programId]` | Assigned-program detail (summary, schedule, roster, announcements, resources) |
| `/educator/schedule` | Assignment-scoped published schedule |
| `/educator/rosters` | Confirmed rosters across assigned programs |
| `/educator/announcements` | Announcements across assigned programs |
| `/educator/resources` | Resources across assigned programs |

**New files:**

- `src/lib/educator/assignments.ts` — the one authorized read of the viewer's own
  assignment set and the program facts on it.
- `src/lib/educator/roster.ts` — the educator roster read. Selects
  `EDUCATOR_ROSTER_COLUMNS` and nothing else.
- `src/lib/educator/content.ts` — announcement and resource reads, assignment-scoped.
- `src/lib/educator/workspace-state.ts` — pure shaping/summary helpers, unit-testable
  without a database (mirrors `family/dashboard-state.ts`).
- `src/components/layout/educator-portal-shell.tsx` — destination list only; the
  mechanism stays in `portal-shell.tsx`.
- `src/components/educator/` — `program-list.tsx`, `program-summary.tsx`,
  `schedule-section.tsx`, `roster-section.tsx`, `announcement-list.tsx`,
  `resource-list.tsx`, `overview-cards.tsx`.
- `tests/educator-workspace.test.mts` — pure-function unit tests.
- `tests/e2e/educator-workspace.spec.ts` (+ snapshots).

**Changed files:**

- `src/app/(portal)/educator/page.tsx` — placeholder replaced.
- `tests/e2e/authorization.spec.ts` — new educator routes added to `PROTECTED`.
- `src/components/layout/portal-nav.tsx` — the educator `area` becomes unused once
  the shell lands; left in place for `family`/`admin` legacy use, no behavioural change.

**Unchanged, deliberately:** `supabase/migrations/**`, `supabase/seed.sql`,
`src/lib/admin/**`, every family and admin route.

## 7. `EDUCATOR_ROSTER_COLUMNS` — exact use

The canonical constant is `src/lib/admin/roster-state.ts:51`:

```ts
const EDUCATOR_ROSTER_COLUMNS = ["preferred_name"] as const
```

`src/lib/educator/roster.ts` imports it and builds its PostgREST select from it —
it declares no second field list. Because PostgREST needs one unbroken literal for
type inference, the module asserts the constant against the literal at compile
time rather than concatenating at runtime:

```ts
import { EDUCATOR_ROSTER_COLUMNS } from "@/lib/admin/roster-state"

// prettier-ignore
const STUDENT_COLUMNS = "preferred_name"
// Compile-time guard: widening the allowlist without widening this select, or
// vice versa, fails typecheck rather than silently disagreeing.
const _assert: `${(typeof EDUCATOR_ROSTER_COLUMNS)[number]}` = STUDENT_COLUMNS
```

The full select is `id,state,state_changed_at,students(preferred_name)`.
**No `families(name)`.** The admin roster shows the family name; an educator does
not get it. Checklist §9 (GAP-ADMIN-014) has not confirmed which student or family
fields an educator may see, and a family name is educator-visible family data, so
it stays out until answered. This is stricter than the RLS policy, which grants
whole rows — the policy is the coarse control, the select is the narrow one.

The educator `RosterEntry` type has no `familyName` field, so the excluded data is
not merely unrendered: it is never fetched, never mapped, and cannot be serialized
into the RSC payload. Validated by inspecting the response body (§13.9).

`partitionRoster` is reused for the confirmed/not-confirmed split, so "confirmed"
means the same explicit equality on both surfaces.

## 8. Data flow and authorization boundaries

```
request
  → requireRole("educator", <path>)        signed out → /sign-in?redirectTo=…
                                           wrong role → notFound()
  → getViewer()                            userId from verified JWT claims
  → listAssignedPrograms(viewer.userId)    .eq("educator_user_id", viewer.userId)
  → allowed program-id set
  → every downstream read filtered .in("program_id", allowed)
  → RLS independently refuses anything outside the assignment
```

Three points:

1. **`educator_user_id` is never accepted from the browser.** It comes from
   `getViewer()`, i.e. from `getClaims()`, which verifies the signature. No route
   reads an educator id, program id, or assignment id from a body or search param
   as an identity.
2. **A route `programId` is untrusted and treated as such.** UUID shape is checked
   before any query (the `/admin/programs/[programId]` DEFECT-PE3 precedent);
   anything not in the viewer's own assignment set is `notFound()` — the same
   response an id that never existed gets, so a prober learns nothing.
3. **Removing an assignment revokes on the next request.** Nothing caches
   assignment in a session, cookie, or JWT claim; the filter and the policy both
   re-evaluate per statement. Educator pages are already `force-dynamic` via the
   portal layout.

Administrators reaching `/educator` (guards permit it, ACT-004/006) see their own
assignment set, which is normally empty — an honest "no assigned programs", not a
back door into every program.

Service-role credentials are not used anywhere in this slice; all reads go through
the publishable-key server client, so RLS is genuinely in force.

## 9. Schedule — what exists, honestly

**There is no schedule table.** Schedule is published text on `public.programs`:
`published_schedule`, `published_dates`, `published_duration`,
`published_session_length`, `enrollment_window`. `NULL` means the source does not
publish it (QA-005).

So `/educator/schedule` shows the published schedule facts for assigned programs
and nothing more. No date is computed, no session is generated, no "upcoming" is
inferred — most published ranges carry no year and cannot be ordered in time (the
MDS-REF-010 finding). Where a program publishes no schedule, the section says so
explicitly rather than rendering a blank.

Recorded as a deviation, consistent with family deviation D-FD1.

## 10. Announcements and resources

Both tables exist with educator select policies, so these are **real reads, not
placeholder empty states**.

The educator policies (unlike the family ones) do not filter on `published`, so an
educator sees drafts for their own programs. That is presented, not hidden: MDS
`announcement` variants include `educator_draft` (MDS-PROJECT-STATE.yaml:439), so a
draft renders with an explicit "Draft — not visible to families" state. MPS-REQ-019
requires a visible content state; showing a draft as if published, or silently
dropping it, would both fail that.

Read-only. No create, publish, replace, remove, or upload — `announcements` and
`learning_resources` hold no client write policy or grant, so there is no write to
expose.

## 11. Navigation

MDS `navigation.specification.educator`:
`Overview, Assigned Programs, Schedule, Rosters, Announcements, Resources`.

All six are built by this slice, so unlike the admin shell there is no missing
destination and no D-AO3 equivalent.

Mobile bottom bar (max five): Overview, Assigned Programs, Schedule, Rosters,
Account. Announcements and Resources take the shell's existing "More" row —
the same choice the family shell makes, and for the same reason: both are one tap
from their Overview cards, so what is deferred is a duplicate path, not meaning.

Account is appended beyond the MDS six, matching the family and admin shells. A
portal needs an exit from the page you are on. Recorded as deviation **D-EW1**,
identical in kind to the existing shells.

## 12. States

| State | Where | Treatment |
|---|---|---|
| Loading | list and roster sections | `Suspense` + `ListSkeleton` |
| No assigned programs | Overview, all six pages | `EmptyState`: an administrator makes assignments |
| Assigned program, no schedule published | Schedule, detail | explicit "no published schedule", not a blank |
| Empty confirmed roster | Rosters, detail | `EmptyState`, with the unconfirmed count stated separately |
| No announcements / no resources | those pages, detail | `EmptyState` |
| Recoverable query failure | per section | `SectionError`, `role="status"`, rest of page still renders |
| Supabase unconfigured | per section | distinct "setup state, not emptiness" wording |
| Expired session | any route | guard redirects to `/sign-in?redirectTo=…` |
| Forbidden / unassigned program | `/educator/programs/[id]` | `notFound()` from the server |
| Assignment removed after prior access | any route | next request 404s / empties; no sign-out needed |
| Program not found | `/educator/programs/[id]` | `notFound()`, indistinguishable from forbidden |
| Partial optional data | roster, program facts | unresolved join reported, row still listed |
| Mobile / narrow | all | tables → labeled cards |

## 13. Test plan

**Unit** (`npm run test:unit`) — `tests/educator-workspace.test.mts`: assignment-set
derivation, the confirmed/not-confirmed split for an educator, schedule-facts
shaping including all-null, and the `EDUCATOR_ROSTER_COLUMNS` compile-time guard.

**pgTAP** (`npm run db:test`) — existing `80_admin_family_educator_roster.test.sql`
already proves the boundary, including assignment removal inside one transaction.
No new SQL test unless a gap surfaces during implementation.

**e2e** (`npm run test:e2e`) — `tests/e2e/educator-workspace.spec.ts`:

1. assigned educator reaches `/educator` and every destination;
2. only assigned programs listed (0004, 00ff present; 0002, 0005 absent);
3. `GET /educator/programs/<unassigned id>` → 404 via request context;
4. malformed and non-existent ids → 404; no search-param or body bypass;
5. assignment removed → access revoked on the next request;
6. parent, signed-out, and no-role viewers denied every educator route;
7. `/admin*` still denied to the educator;
8. roster select is exactly `EDUCATOR_ROSTER_COLUMNS`;
9. **payload privacy**: the raw response body for every educator route contains
   none of `Grade 3`, `Grade 6`, `Sample Family A`, `guardian_relationship`,
   `Parent` as a relationship value, or any state note;
10. the one confirmed student appears exactly once on program 0004's roster;
11. the `payment_pending` student is not under a confirmed heading;
12. empty and failure states legible;
13. keyboard: skip link → nav → main, visible focus, `aria-current`;
14. four viewports (wide 1440, desktop 1280, tablet 768, mobile 390) screenshots
    + ARIA snapshot + `@axe-core/playwright` on each page;
15. `git diff --stat` shows no migration, seed, or RLS change.

**Also run:** `npm run format:check`, `npm run lint`, `npm run typecheck`,
`npm run build`, `npm run db:types:check`.

## 14. Manual verification (WSL/Ubuntu bash)

```bash
npm run db:start && npm run db:reset
npm run dev
```

1. Sign in `sample.educator@example.com` / `SampleFoundationReview2026`.
2. Overview: two assigned programs, one confirmed roster member, sample banner.
3. Assigned Programs: 0004 published, 00ff draft. No publish, price, capacity,
   enrollment, or family control anywhere.
4. Open 0004: summary, published schedule, roster, announcements (one published,
   one marked draft), one resource.
5. Roster: `Sample Student A2` once under Confirmed. `Sample Student A1`
   (payment_pending) not under Confirmed. No family name, no grade anywhere.
6. DevTools → Network → the document response for each educator page: search for
   `Grade`, `Sample Family`, `guardian`. Zero hits.
7. Paste `/educator/programs/10000000-0000-4000-8000-000000000002` → 404.
8. In another session as `sample.admin@example.com`, unassign the educator from
   0004; reload the educator's roster page without signing out → access gone.
9. Sign in as `sample.parent.one@example.com`, visit `/educator` → 404.
10. Resize to 390 px: bottom bar of five, More row with Announcements and
    Resources, roster as labeled cards, every target ≥ 44 px.
11. Keyboard-only pass on Overview and one program detail.

## 15. Risks, gaps, assumptions

**Risks**

* R1 — Widening the roster select later is the one change that would breach the
  privacy constraint. Mitigated by the compile-time guard in §7 and the payload
  assertion in §13.9, so a widening breaks a test rather than shipping quietly.
* R2 — Draft announcements are visible to educators by policy. Presented with an
  explicit draft state (§10). If the owner intends educators to see published
  content only, that is a one-line filter change, not a redesign.
* R3 — Screenshot baselines are new; a first run writes them and must be reviewed
  against MDS-REF-005/007/009 before being trusted.

**Gaps**

* GAP-ADMIN-014 / checklist §9 — which student fields an educator may see is
  unanswered. This slice does not answer it; it ships `preferred_name` alone.
* No schedule model exists (§9). Whether the Foundation Release needs structured
  sessions is an MPS question, not one this slice may decide.
* MDS has no canonical educator-workspace reference at Foundation horizon.
  MDS-REF-008 is the future Course Builder and grants no behaviour, so composition
  follows MDS-REF-009's operations shell and the written `layout` and `navigation`
  specification. Recorded as **MDS-GAP-EW1**.

**Assumptions**

* A1 — Educator surfaces scope to the *viewer's own* assignments, so an
  administrator visiting `/educator` sees an empty workspace rather than
  everything. Stated because it is a deliberate narrowing, not an oversight.
* A2 — The family name is not educator-visible roster data in this release (§7).
* A3 — No new sanitized fixture is needed; the existing seed already covers every
  required state.

**Deviations to record:** D-EW1 (Account appended to educator navigation),
D-EW2 (published schedule text rather than structured sessions, per D-FD1).

---

# 16. Implementation record — what changed from this plan, and why

Approved as written on 2026-08-31, option A (merge first). Four things the plan
got wrong, all discovered by inspecting the merged code rather than the commit
the plan was written against.

## 16.1 The roster boundary is a view, not a `students` policy

The plan was written against **9aebead**. The CodeRabbit round (**b51c69b**,
merged as #15) replaced `students_select_assigned_educator` with
`public.educator_roster_students` — a `security_barrier` view selecting
`program_id` and `preferred_name`, joined through `educator_assignments` on
`(select auth.uid())` and filtered to `state = 'confirmed'`.

The change is a strict improvement and the plan's §7 was reasoning about a
control that no longer exists. RLS grants rows, not columns, so an educator
policy on `public.students` exposed every column of a matched row and left the
narrowing entirely to the application select. The view moves the narrowing into
the database: `public.students` now carries **no** educator policy at all, so
grade level, guardian relationship, and the affirmation bookkeeping are
unreadable to an educator by any query, composed here or by hand against
PostgREST.

Found the honest way: the first e2e run rendered "Student not available" for
every roster row, and a direct PostgREST probe as the seeded educator returned
`students -> []`.

The application select survives as the second control, and is not redundant — a
view can gain a column in a later migration, and a query asking for `*` would
start returning it. `EDUCATOR_ROSTER_SELECT` is now `"preferred_name"`, bound to
`EDUCATOR_ROSTER_COLUMNS` in both directions at compile time. Both directions
were verified by deliberately breaking them (§17).

## 16.2 The unconfirmed roster is counts, not names

Consequence of 16.1, and the plan did not anticipate it. The view exposes
confirmed children only, so an educator cannot read the name behind an
unconfirmed record at all. The surface therefore shows the unconfirmed side as a
per-state count with no name.

This is better than what was planned, and it is MPS-RUL-003 enforced in the
schema rather than in a component: a family whose place is unsettled has an
arrangement with Home School Haven that is not an educator's business. It is
also the one place the educator roster reads differently from the administrator
roster, which names both groups — an administrator is accountable for the
unsettled record and an educator is not.

## 16.3 `partitionRoster` is not reused, and `admin/roster-state.ts` is untouched

The plan intended to share the confirmed/not-confirmed split. With the view, the
confirmed set arrives already filtered by the database, so there is nothing to
partition — the split would have been re-deriving a fact the query guarantees.

A generic-over-entry-shape version of `partitionRoster` was written and then
reverted: `src/lib/admin/roster-state.ts` is byte-identical to `main`. The
confirmed rule is still stated exactly once on the educator side, in
`summarizeUnconfirmed()`, as an explicit inequality against `confirmed` rather
than an exclusion list, for the reason `admin/roster-state.ts` gives at length.

## 16.4 The educator holds the seeded draft program

`10000000-…-00ff` is "Sample Unpublished Draft (test fixture)" and the sample
educator IS assigned to it. The plan's test list had it among the programs that
must NOT appear. It is listed, with its `Draft` state — an educator assigned to
a program families cannot see needs to know they hold it. Its empty roster also
gave the empty-state cases a target with no data change.

## 16.5 Generated types were stale

`database.types.ts` had no `Views` entry, so `educator_roster_students` was not
typed. The declaration was spliced in from `supabase gen types --local`; nothing
else in the file changed.

`npm run db:types:check` FAILS, and not because of this slice: it regenerates
from the **linked remote** project, which has not had the merged migrations
pushed to it, so it reports the committed file as ahead. Diffed against the
local schema the committed file now matches exactly except for the do-not-edit
header and `__InternalSupabase`. See "Needs your attention".

---

# 17. Checks actually run

| Check | Result |
|---|---|
| `npm run format:check` | pass |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run test:unit` | pass — 144 tests, 0 failures |
| `npm run build` | pass — all 7 educator routes emit as `ƒ` (dynamic) |
| `npm run db:test` | pass — 10 files, 252 assertions |
| `npx playwright test educator-workspace` | pass — 40/40 |
| `npm run db:types:check` | FAIL — stale linked remote, see 16.5 |

**Allowlist guard, verified by breaking it deliberately.** Adding `grade_level`
to `EDUCATOR_ROSTER_COLUMNS` alone → `TS2741: Property 'grade_level' is missing`.
Adding it to the select side alone → `TS2353: Object literal may only specify
known properties`. Both restored; typecheck clean.

**Payload privacy.** Every educator route's raw response body asserted to
contain none of `Sample Student A1` (the unconfirmed child), `Grade 3`,
`Grade 6`, `Grade 1`, `grade_level`, `guardian_relationship`, `Sample Family A`,
`Sample Family B`, or the administrator's state note — and asserted to contain
`Sample Student A2`, so the check cannot pass by rendering nothing.

# 18. Defects found

* **DEFECT-EW1 (fixed here, mine).** The educator roster read went through
  `public.students`, which carries no educator policy. Every roster row rendered
  "Student not available". Rewritten onto `educator_roster_students`.
* **DEFECT-EW2 (fixed here, mine).** "Recent announcements" led with the draft,
  because a draft has no `published_at` and the sort put nulls first. Published
  content now leads; drafts trail.
* **DEFECT-EW3 (pre-existing, NOT fixed here).** `hsh-heading-sm` is not a
  defined utility in `globals.css`. Headings using it fall back to browser
  defaults and render LARGER than their `hsh-h4` parent, inverting the
  hierarchy. It is used in `src/components/admin/roster-section.tsx:228,249` and
  `src/components/admin/family-drawer.tsx:101,135,185,224`. The educator
  components use the `hsh-label` role instead. Not fixed in the administrator
  components because doing so would change their approved visual baselines,
  which is outside this slice.

# 19. Full-suite result, and what the other failures are

`npx playwright test` (whole suite) reported 426 passed and 12 failed. None of
the 12 is in this slice, and each was checked against a clean `main` with this
work stashed rather than assumed:

| Failing test | Verdict |
|---|---|
| `programs.spec.ts` visual baselines ×8 | Pre-existing. Fail identically on clean `main`. |
| `about.spec.ts` ARIA snapshot | Pre-existing. Fails on clean `main`. |
| `admin-overview.spec.ts` structural ARIA snapshot | Pre-existing. Fails on clean `main`. |
| `admin-educators.spec.ts` "a parent is refused" | Pre-existing. Fails on clean `main`. |
| `admin-enrollments.spec.ts` signed-out redirect | Flaky. Passes in isolation on clean `main` AND with this slice applied. |

The clean-`main` control run also failed a large `admin-programs.spec.ts` block
that did not fail in the slice run, which points at ordering or timing in an
18-minute single-worker run rather than at any of these being real regressions.
Recorded as **RISK-EW4**: the suite is not currently green on `main`, so
"the full suite passes" is not available as a release signal until the
pre-existing baselines and the two ARIA snapshots are refreshed and the
`admin-educators` denial test is diagnosed. That work is not this slice's.

Verified green with this slice applied, after `npm run db:reset`:

    npx playwright test educator-workspace authorization   → 63 passed

# 20. Post-review follow-ups

## 20.1 `db:types:check` now passes

The migrations were pushed to the linked project on 2026-08-31. Re-run:
`OK: src/lib/supabase/database.types.ts matches the database schema.` The
`educator_roster_students` declaration spliced in at 16.5 is exactly what the
remote generates, so the last outstanding check on this slice is closed.

## 20.2 DEFECT-EW3 — approved as a separate change, and kept separate

Owner approved defining `hsh-heading-sm` and fixing the administrator roster and
drawer, updating only the baselines that change.

**One file: `src/app/globals.css`.** `hsh-heading-sm` was already the class the
administrator components asked for, so the fix is the missing definition rather
than a component edit — `admin/roster-section.tsx` and `admin/family-drawer.tsx`
are untouched.

It is **not a new type role**, which matters because that file states "Roles are
the approved set; do not add a role without an MDS change". The approved scale
stops at Heading 4, so a heading ELEMENT nested below an `hsh-h4` has no smaller
heading role available; the alias resolves to the approved **Label** role and is
declared as one rule with `.hsh-label` so the two cannot drift into a real
second role. No new scale step, no MDS change required.

**The educator components deliberately do NOT use the alias.** They name
`hsh-label` directly. Identical declarations, so identical rendering — but it
leaves this slice with no dependency on a change that may merge separately or
later. An alignment to the alias afterwards is cosmetic and optional.

**No baseline needed updating, and that is itself a finding.** Both affected
call sites are unphotographed: `admin-programs` baselines capture
`/admin/programs` (the list), not `/admin/programs/[programId]` where the roster
lives, and `admin-families` baselines capture the list with the drawer closed.
That absence of coverage is why the defect survived review in the first place.
Verified manually instead, at 1280×900 signed in as the sample administrator:
the drawer's "Parents and guardians" / "Students" / "Enrollments" and the
roster's "Confirmed (1)" / "Not on the roster (1)" now render at the Label role,
correctly subordinate to their `hsh-h4` parents rather than larger than them.

Recorded as **GAP-EW5**: the administrator program-detail page and the family
drawer have no screenshot baseline. Adding them would have caught DEFECT-EW3 and
would catch the next one. Not added here — the owner scoped this change to
updating baselines, not creating them.

## 20.3 Pre-existing `main` failures stay out of scope

Per owner instruction, the `programs.spec.ts` visual baselines were not retaken
and the other pre-existing failures in §19 were not touched.

## 20.4 Confirmed by the owner

* Educators see drafts, labelled "Draft — families cannot see this yet"
  (resolves RISK-EW2).
* An administrator on `/educator` sees an empty workspace (confirms A1).

## 20.5 Environment note

The local Supabase stack failed mid-session — `supabase db reset` reported
`supabase_storage_… container is not ready: unhealthy`, and one run left the
database with no `public.programs` at all. WSL2 has 5.7 GB total RAM and the
stack, the Next production build, and Chromium together exhaust it. Recovered
with `supabase stop --no-backup && supabase start` after freeing memory. Two
e2e runs failed for this reason alone and were re-run; no result in this
document comes from a degraded stack.

# 21. Final check results

Re-run after all of the above, on a healthy stack:

| Check | Result |
|---|---|
| `npm run format:check` | pass |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run test:unit` | pass — 144 tests |
| `npm run build` | pass |
| `npm run db:test` | pass — 252 assertions |
| `npm run db:types:check` | **pass** |
| `playwright test admin-programs admin-families admin-educators educator-workspace` | **131 passed, 0 failed** |
| `playwright test educator-workspace authorization` | 63 passed ×4 consecutive runs |

# 22. File map, by change

**Change 1 — educator assigned-program workspace**

    src/app/(portal)/educator/**                     (7 routes)
    src/components/educator/**                       (5 components)
    src/components/layout/educator-portal-shell.tsx
    src/lib/educator/**                              (4 modules)
    src/lib/supabase/database.types.ts               (view declaration)
    tests/educator-workspace.test.mts
    tests/e2e/educator-workspace.spec.ts + snapshots
    tests/e2e/authorization.spec.ts                  (educator routes added)
    prompts/educator-assigned-workspace.md

**Change 2 — DEFECT-EW3, independently mergeable**

    src/app/globals.css

## 21.1 One intermittent failure, characterised rather than dismissed

`authorization.spec.ts:114 "a parent reaches the family area and nothing else"`
failed once, in one paired run. It then passed twice in isolation and in **four
consecutive** `educator-workspace authorization` runs — one failure in five.

It is not a test this slice wrote or altered. `git diff` on that file shows only
additions: five educator routes appended to `PROTECTED`, `.first()` added to the
educator test's "Art Lab" locator (the educator Overview now renders that name
more than once, so the bare locator became a strict-mode violation), four
administrator routes appended to an existing denial loop, and one new test. The
body of the test at line 114 is untouched.

The failing assertion is a `toBeVisible()` on family dashboard content, which is
the shape of a timeout rather than a denial defect — and this session's stack was
memory-starved enough to kill containers outright (§20.5). Recorded as
**RISK-EW6** rather than called flaky and forgotten: the error text was lost to a
truncated pipe on the one run that failed, so the cause is inferred, not proven.
If it recurs, capture the full reporter output before diagnosing.
