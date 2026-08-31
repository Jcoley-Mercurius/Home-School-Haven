# HSH-SLICE-ADM-03 — Admin Family, Educator, Assignment, and Roster Operations

**Branch:** `feat/admin-family-educator-operations`
**Base:** `2853e89` (`feat/admin-program-enrollment-operations`, PR #14, **open**)
**Prepared:** 2026-08-30 · Status: **awaiting approval — no production code written**

---

## 0. Base-branch conflict (resolved by owner, recorded here)

The requested base was `main`. `main` does **not** contain `2853e89`, the
Admin Program & Enrollment Operations slice this one builds on. PR #14 is open
and under CodeRabbit review. Building on `main` would require re-creating the
enrollment transition table, the SECURITY DEFINER admin write path, the
`alert`/`dialog` primitives, `lib/admin/*`, the seed environment row, and
`scripts/db-reset.mjs` — duplicate sources of truth this slice is explicitly
forbidden to create.

**Decision (owner, 2026-08-30):** stack on `feat/admin-program-enrollment-operations`.

**Risk:** CodeRabbit changes to PR #14 land under this branch. This branch is
rebased onto `main` after #14 merges, before its own PR opens. Any ADM-02 file
this slice touches (`lib/admin/filters.ts`, `lib/admin/validation.ts`,
`admin-portal-shell.tsx`, `supabase/seed.sql`) is a rebase-conflict candidate
and is listed in §7.

---

## 1. Goal and vertical-slice boundary

Give an authorized administrator **read-only** operational visibility into
sanitized families and educators, the **one approved write** this slice adds
(program↔educator assignment), and **one authoritative program roster derived
from enrollment state**. Establish and test — in the database, with no UI — the
assignment-scoped access boundary the later Educator Assigned-Program Workspace
depends on.

**In:** family directory + detail, educator directory + detail, assign/unassign
an educator, program roster derived from `public.enrollments`, the
restricted `educator_roster_students` access boundary, attributable history.

**Out:** every family and student mutation; educator invitation, activation,
suspension, promotion, deletion; manual roster add/remove/transfer/export;
attendance; the educator portal UI; announcements/resources authoring.

**Active versions:** MPS v1.0 · MDS v1.0 (state file reads v1.1 for the spec
document; component and token authority unchanged) · MTS v1.0.

---

## 2. Requirements, rules, workflows, acceptance criteria

| ID | How this slice satisfies it |
|---|---|
| MPS-REQ-004 | Public denied at every new surface; **unassigned** educator denied private student/family data — enforced by RLS, proven by pgTAP, not by hidden UI. |
| MPS-REQ-005 | Every record read is `is_sample`/`demo-unapproved-v0`. No new field collects anything. |
| MPS-REQ-017 | Administrators manage educator assignments and see accurate rosters; educators gain **no** organization-level control. This is the slice's core requirement. |
| MPS-REQ-020 | The roster is derived from `public.enrollments` — the same authoritative row the family dashboard and `/admin/enrollments` render. No second roster store. |
| MPS-REQ-021 | Loading / empty / no-results / partial / failed / forbidden / duplicate / stale / success states on every surface; each names a recovery action. |
| MPS-REQ-023 | Mobile, tablet, desktop, wide; WCAG 2.2 AA; axe; ARIA snapshots; keyboard and focus tests. |
| MPS-REQ-024 | Assignment and unassignment are attributable via the **existing** `educator_assignments_audit` trigger → `public.audit_events`. |
| MPS-RUL-003 | No communication capability is added. Assistance requests and sensitive family matters are not surfaced. |
| MPS-RUL-006 | Family and roster surfaces show `preferred_name`, `grade_level`, `guardian_relationship` — the three columns that exist. No field is added. |
| MPS-RUL-007 | Sample-only enforced by `students_sample_only` / `enrollments_sample_only` check constraints already in place. |
| MPS-ACC-004 | Manual review step in §14; the check constraints make it enforceable rather than asserted. |
| MPS-ACC-005 | pgTAP: `anon` reads zero from families/students/enrollments/assignments; unassigned educator reads zero students. |
| MPS-ACC-028 | Roster derivation returns each **confirmed** enrollment exactly once (guaranteed by `enrollments_one_per_student_program`); assigned educator sees `preferred_name` only. |
| MPS-ACC-031 | An assignment change is reflected on `/admin`, `/admin/programs`, and the program detail page in the same request cycle via `revalidatePath`. |
| MPS-ACC-032 | Attributable history for every assignment change; sanitized screenshots at four viewports. |
| MPS-WFL-005 | "Add … educator" step of program administration. |
| MPS-WFL-006 | `assigned` and `reassigned` states; the "Attempted unassigned-program access" failure path is the pgTAP boundary. |
| MDS-REF-009 | `page_shells.admin_operations` = "program/enrollment/**family/educator** navigation; filters; tables; detail drawers". `components.table` variant **`roster`** is approved and first used here. |

---

## 3. Authority matrices

`Implement` = approved authority exists. `Defer` = approved but blocked on an
absent capability. `Block` = no approved authority; reported as a gap.

### 3.1 Family operations

| Operation | Authorized actor | Approved basis | Fields | Audit | Disposition |
|---|---|---|---|---|---|
| List families | ACT-004, ACT-006 | MPS-REQ-017 (rosters/enrollments require reaching the family); `families_select_admin` exists | `families.name`, counts | read | **Implement** |
| Search / filter families | ACT-004, ACT-006 | MPS-REQ-021 usable operational surface | name substring | read | **Implement — client-side only.** A family name never enters a URL, history, or referrer (`lib/admin/filters.ts` URL-privacy rule). Filter state lives in `useState`. |
| View family detail | ACT-004, ACT-006 | MPS-REQ-017 | name, created | read | **Implement** (drawer; no id in the URL) |
| View guardian membership | ACT-004, ACT-006 | `family_members_select_admin`, `profiles_select_admin` | `member_role`, `display_name` | read | **Implement.** Guardian **email is not read** — it lives in `auth.users` and needs service-role reach this surface does not require. |
| View minimum student context | ACT-004, ACT-006 | MPS-REQ-017; MPS-RUL-006 | `preferred_name`, `grade_level`, `guardian_relationship` | read | **Implement.** These are the only columns that exist. |
| View family enrollments | ACT-004, ACT-006 | MPS-REQ-017, MPS-REQ-020 | state, program, changed-at | read | **Implement** — reuses `EnrollmentStateBadge`; links to `/admin/enrollments`. |
| Access consent evidence | ACT-004, ACT-006 | **MPS-ACC-003** — "an authorized administrator can see the accepted policy version and acceptance time" | `affirmation_version`, `affirmed_at` | read | **Implement, labelled honestly.** The check constraint pins the version to `demo-unapproved-v0`; the panel says *no approved consent language exists yet* (MPS GAP-005) rather than presenting a demo string as consent. |
| Edit family identity | — | None. ACT-001 controls the family account; checklist §11 (who may approve corrections) unanswered | — | — | **Block — GAP-ADMIN-009** |
| Edit student profile | — | Same; MPS-RUL-006/008 | — | — | **Block — GAP-ADMIN-009** |
| Create / remove family membership | — | ACT-007 requires *parent* invitation; no approved admin path | — | — | **Block — GAP-ADMIN-010** |
| Delete a family or student | — | Checklist §11 deletion/retention unanswered; `remove_student_from_own_family` is parent-scoped by design | — | — | **Block — GAP-ADMIN-011** |

General administrator status does **not** authorize editing or deleting
parent-controlled information. No family surface in this slice renders a
control that mutates a family or student row.

### 3.2 Educator operations

| Operation | Authorized actor | Approved basis | Fields | Audit | Disposition |
|---|---|---|---|---|---|
| List educators | ACT-004, ACT-006 | MPS-REQ-017; `user_roles_select_admin` + `profiles_select_admin` | `display_name`, assignment count | read | **Implement.** Derived from `user_roles.role = 'educator'` ⋈ `profiles`. **No new table.** |
| View educator detail | ACT-004, ACT-006 | MPS-REQ-017 | name, assignments, assignment history | read | **Implement** (drawer) |
| Auth-account linkage status | ACT-004, ACT-006 | MPS-REQ-017 | whether a `profiles` row exists for the grant | read | **Implement** as *"account linked / role granted without a profile row"*. It is the honest linkage signal available without service-role reach. |
| Assign educator → program | ACT-004, ACT-006 | **MPS-REQ-017** verbatim; MPS-WFL-005 `main_path` "Add … educator"; MPS-WFL-006 trigger | educator id, program id | **yes** (existing trigger) | **Implement** |
| Prevent duplicate active assignment | — | MPS-REQ-014 retry-safety principle | — | — | **Implement** — the composite primary key already forbids it; the function returns `unchanged` rather than raising. |
| Remove assignment | ACT-004, ACT-006 | MPS-REQ-017; MPS-WFL-006 alternate path "Educator reassigned", recovery "let an administrator correct assignment" | — | **yes** | **Implement** |
| Reassign a program | ACT-004, ACT-006 | Same | — | yes | **Implement as remove + assign.** The schema permits several educators per program (composite PK, not a unique program), so no atomic "reassign" verb is invented; two attributable events tell the truth about what happened. |
| Grant organization-wide authority | — | ACT-003 restriction: "cannot issue organization-wide communication without administrative authority" | — | — | **Block.** No capability is created. |
| Promote educator → administrator | — | ACT-006 "controls administrator access"; MPS-GAP-ADMIN-001 (provisioning undefined), MPS-GAP-ADMIN-002 (`owner` never granted) | — | — | **Block.** `user_roles` keeps **no** client write policy and no write grant. Self-service promotion is never created. |
| Invite an educator | — | No approved invitation workflow; Resend transactional slice not built | — | — | **Defer — GAP-ADMIN-012**, dependency for the transactional-notifications slice. |
| Activate / suspend an educator | — | Checklist **§9** "confirm how access changes when an educator is reassigned or leaves" **unanswered** | — | — | **Block — GAP-ADMIN-013.** No `status` column is added. Removing assignments is the approved lever and it takes effect immediately (§9). |
| Delete an educator account | — | Checklist §11 unanswered | — | — | **Block — GAP-ADMIN-011** |
| Create an educator operational record | — | No approved fields exist (checklist §9 does not define them) | — | — | **Block — GAP-ADMIN-013.** Inventing a `bio`, `title`, or `specialty` column would invent published facts. |

Educator **public profile** information (none is published in this release) and
educator **private account** information stay distinct: this slice reads
`profiles.display_name` and role grants, and reads no credential, token, email,
or `raw_user_meta_data` anywhere.

### 3.3 Roster operations

| Operation | Authorized actor | Approved basis | Fields | Audit | Disposition |
|---|---|---|---|---|---|
| View program roster | ACT-004, ACT-006 | MPS-REQ-017, **MPS-ACC-028** | student preferred name, grade, family, state-changed-at | read | **Implement** |
| Confirmed enrollment on the roster | ACT-004, ACT-006, assigned ACT-003 | MPS-ACC-028 "appears exactly once in the correct program" | — | read | **Implement.** `state = 'confirmed'`, deduped structurally by `enrollments_one_per_student_program`. |
| Pending / payment-pending shown **separately** | ACT-004, ACT-006 | MPS-WFL-003 "confirmed roster only when justified"; MDS `enrollment_state` "`payment_pending_verification` … enrollment not yet confirmed" | state | read | **Implement** as a distinct, separately-headed "Not on the roster" section — never merged, never styled as success. |
| Waitlisted shown separately | ACT-004, ACT-006 | MPS-RUL-002; MDS `waitlist` "do not imply enrollment" | state | read | **Implement**, same section, own subheading. |
| Assigned educator views roster | ACT-003 (assigned only) | MPS-REQ-018, MPS-ACC-028 | **`preferred_name` only** | read | **Implement as a database boundary + pgTAP only. No educator UI.** Checklist §9 "confirm which student and family fields educators may see" is unanswered, so the policy exposes the single field without which a roster is not a roster, and nothing more (**GAP-ADMIN-014**). |
| Add a student manually | — | **MPS-RUL-008** — parent authority affirmation is required and an administrator cannot give it | — | — | **Block** |
| Remove a student manually | — | Same; `canceled` via `/admin/enrollments` is the approved lever | — | — | **Block** |
| Move a student between programs | — | Transfers are a financial policy outcome — MPS-RUL-004, MPS GAP-010 | — | — | **Block** |
| Export a roster | — | Checklist §9 "confirm who may export, download, or print family or roster information" **unanswered** | — | — | **Block — GAP-ADMIN-015.** No CSV, print stylesheet, or download control. |
| View attendance | — | MPS-FEA-011 is Should-priority, later slice | — | — | **Out of scope** |
| View consent state on the roster | ACT-004, ACT-006 | MPS-ACC-003 | affirmation version/time | read | **Implement** as the family-detail panel only, not per roster row. |
| View private student fields | — | None exist and none are added | — | — | **Block by absence** |

---

## 4. Repository evidence inspected

`supabase/migrations/*` (all ten), `supabase/seed.sql`,
`supabase/seeds/00_local_environment.sql`, `supabase/tests/database/*` (nine
pgTAP files), `supabase/config.toml`, `src/lib/admin/*`, `src/lib/auth/*`,
`src/lib/enrollment/repository.ts`, `src/lib/family/*`,
`src/components/admin/*`, `src/components/ui/*`,
`src/components/layout/admin-portal-shell.tsx`,
`src/components/enrollment/enrollment-state.tsx`,
`src/components/family/section-states.tsx`, `src/app/(portal)/**`,
`tests/*.test.mts`, `tests/e2e/*`, `playwright.config.ts`, `package.json`,
`prompts/admin-*.md`, MPS/MDS/MTS artifacts listed in §2.

### Classification

**KEEP — reused unchanged, not re-created**

`public.educator_assignments` (composite PK is the duplicate guard),
`private.is_assigned_educator`, `public.record_educator_assignment_audit` +
`educator_assignments_audit` trigger, `public.audit_events`,
`public.enrollments` + `public.enrollment_state` + its three SELECT policies,
`enrollments_one_per_student_program`, `public.students`, `public.families`,
`public.family_members`, `public.user_roles`, `public.profiles`,
`private.is_admin` / `is_family_member` / `has_role`, `requireAdmin`,
`AdminPortalShell` / `PortalShell`, `Dialog`, `Alert`, `Badge`, `Button`,
`Field`, `ListSkeleton`, `SectionError` / `EmptyState` / `ReviewDataBanner`,
`EnrollmentStateBadge`, `Breadcrumbs`, `AdminRead<T>`, `MutationResult`,
`describeActivity`, the e2e `consoleGuard` fixture, `scripts/db-reset.mjs`.

**EXTEND**

| Target | Change | Why not new |
|---|---|---|
| `src/lib/admin/filters.ts` | add roster/educator-directory param parsing | one parser module already owns untrusted query values |
| `src/lib/admin/validation.ts` | add `assignmentSchema` (two uuids + note) | one zod module already owns admin input |
| `src/components/layout/admin-portal-shell.tsx` | add **Families** and **Educators** destinations | narrows deviation **D-AO3** from five missing destinations to three |
| educator roster student access | **add** restricted `educator_roster_students` view | exposes only program scope and preferred name; **weakens no family policy** |
| `public.educator_assignments` privileges | revoke `insert, delete` from `authenticated`; route writes through SECURITY DEFINER functions | matches the ADM-02 §11 option-A precedent that removed program write verbs |
| `src/lib/admin/repository.ts` | reuse `AdminRead`; no change to `getAdminOverview` | overview already counts assignments |
| `supabase/seed.sql` | one confirmed enrollment inside an educator-assigned program | see §13 — MPS-ACC-028 is **currently undemonstrable** |
| `describeActivity` | verify `educator_assignment` phrasing covers `assigned`/`unassigned` | the entity type already exists |

**REPLACE** — the direct `insert`/`delete` grant on `public.educator_assignments`
is replaced by `admin_assign_educator` / `admin_unassign_educator`. Data is
untouched; only the write path changes.

**DEPRECATE / UNKNOWN** — none.

**No duplicate source of truth is created.** No families table, no educators
table, no assignments table, no roster table, no enrollment mirror.

---

## 5. Schema and migration changes

One migration: `supabase/migrations/20260831000000_admin_family_educator_assignment_operations.sql`,
following the header/rollback-comment convention of `20260830090000`.

**No new table. No new column. No new type.**

1. `private.educator_has_role(uuid) → boolean` — SECURITY DEFINER, empty
   `search_path`, `revoke all from public`. Confirms the target holds the
   `educator` grant without exposing `user_roles` to a broader read.
2. `public.admin_assign_educator(educator_id uuid, program_id uuid, note text)
   → text`. In order: `private.is_admin()` else `42501`; note 1–400 chars else
   `22023`; `select … for update` on the program else `P0002`; target holds the
   `educator` role else `23514`; program is not `archived` else `23514`; insert
   `on conflict do nothing`; return `'unchanged'` when the row already existed
   (idempotent — a double-click writes nothing and creates no second audit
   row), `'assigned'` otherwise.
3. `public.admin_unassign_educator(educator_id uuid, program_id uuid, note text)
   → text`. Same authorization and note rules; `delete … returning`; returns
   `'unchanged'` when no row matched. Reported identically to a non-existent
   record so a manipulated id learns nothing.
4. `revoke insert, delete on public.educator_assignments from authenticated;`
   The two admin INSERT/DELETE **policies stay** — a policy without a privilege
   grants nothing, and leaving them documents the intended reach and keeps a
   future re-grant safe. This mirrors `20260830090000` line 524 exactly.
5. Create the security-barrier view `public.educator_roster_students` from
   `students`, confirmed `enrollments`, and the current user's
   `educator_assignments`; expose only `program_id` and `preferred_name`, revoke
   all access from `public`/`anon`, and grant SELECT to `authenticated`. Do not
   add an educator SELECT policy to `public.students`: RLS cannot restrict
   columns, and every application role maps to the same database role. A pending
   or waitlisted child is **not** disclosed. Removing the assignment removes the
   view row on the next request — no sign-out required (§9).

**Constraints/indexes:** none added. The composite PK already prevents duplicate
assignments; `educator_assignments_program_idx` and
`enrollments_program_id_idx` already serve every query path this slice
introduces. No speculative index.

**Rollback** (recorded in the migration header, per convention):

```sql
drop view if exists public.educator_roster_students;
grant insert, delete on public.educator_assignments to authenticated;
drop function if exists public.admin_unassign_educator(uuid, uuid, text);
drop function if exists public.admin_assign_educator(uuid, uuid, text);
drop function if exists private.educator_has_role(uuid);
```

Forward-only and incremental: it creates and revokes, and drops nothing that
holds data. Existing assignment rows survive untouched.

---

## 6. Authorization, RLS, and server behavior

Every mutation, in order — matching `admin_set_enrollment_state`:

1. `requireAdmin()` in the server action (redirect / `notFound()`).
2. `private.is_admin()` inside the SECURITY DEFINER function, re-checked
   against the verified JWT.
3. Zod-validate both uuids and the note server-side.
4. Validate the educator holds the `educator` grant.
5. Validate the program exists and is not archived, under `for update`.
6. Validate current assignment state; enforce PK uniqueness.
7. Mutate.
8. Attributable history via the existing trigger.
9. Return `assigned` / `unassigned` / `unchanged` / `notFound` / `forbidden`.
10. `revalidatePath` on `/admin`, `/admin/programs`, `/admin/programs/[id]`,
    `/admin/educators`.

Nothing narrows a read by a client-supplied role, family, program, educator, or
student scope. **No service-role client is introduced anywhere in this slice** —
every read runs under the publishable key with RLS genuinely in force.

Required rules and where each is proven: public denial → pgTAP `anon` blocks;
parent isolation → `20_rls_family` unchanged + new cross-family assertions;
parent denied educator administration → pgTAP `42501` on both new functions;
unassigned-educator denial → new `educator_roster_students` negative
tests; assigned-educator access → positive test, `preferred_name` only; removed
assignment revokes → delete-then-read in one pgTAP transaction; manipulated ids
→ `notFound` parity tests; deny-by-default → `db:advisors`.

`user_roles` gains no write policy and no write grant. Editable Supabase user
metadata is read nowhere.

---

## 7. Files expected to change

**New**

```
supabase/migrations/20260831000000_admin_family_educator_assignment_operations.sql
supabase/tests/database/80_admin_family_educator_roster.test.sql
src/lib/admin/families.ts          list + detail reads
src/lib/admin/educators.ts         directory + detail reads
src/lib/admin/assignments.ts       the two writes
src/lib/admin/roster.ts            the single roster derivation
src/app/(portal)/admin/families/page.tsx
src/app/(portal)/admin/educators/page.tsx
src/app/(portal)/admin/educators/actions.ts
src/app/(portal)/admin/educators/form-state.ts
src/components/admin/family-list.tsx
src/components/admin/family-drawer.tsx
src/components/admin/educator-list.tsx
src/components/admin/educator-drawer.tsx
src/components/admin/assignment-controls.tsx
src/components/admin/directory-search.tsx     client-side, URL-free
src/components/admin/roster-section.tsx
tests/admin-roster.test.mts        pure roster-derivation unit tests
tests/e2e/admin-families.spec.ts
tests/e2e/admin-educators.spec.ts
```

**Modified** (all four are ADM-02 files — rebase-conflict candidates)

```
src/components/layout/admin-portal-shell.tsx   + Families, Educators
src/lib/admin/filters.ts                       + directory param parsing
src/lib/admin/validation.ts                    + assignmentSchema
supabase/seed.sql                              + one confirmed enrollment (§13)
src/app/(portal)/admin/programs/[programId]/page.tsx   + roster section
src/lib/supabase/database.types.ts             regenerated (npm run db:types)
tests/e2e/admin-overview.spec.ts-snapshots/*   sidebar gains two items
tests/e2e/admin-programs.spec.ts-snapshots/*   program detail gains a roster
```

The roster lives on the **existing** `/admin/programs/[programId]` page rather
than a new route: a program id is an operational fact already in that URL, and a
second roster route would be a second place to keep a roster correct.

---

## 8. Validation and audit

Zod: both uuids via the existing `recordId`; note via the existing `stateNote`
(1–400). Rejected input never reaches the database. The database re-applies both
rules, so a request bypassing the action meets the same refusal.

Audit — the **existing** `educator_assignments_audit` trigger already writes
`entity_type='educator_assignment'`, `entity_id=program_id`,
`action='assigned'|'unassigned'`, `changed_fields={"educator_user_id": …}`,
`actor_user_id=auth.uid()`, `occurred_at=now()`. It fires from inside a
SECURITY DEFINER function, and `auth.uid()` resolves from the JWT GUC rather
than the executing role — the same mechanism `record_program_audit` relies on in
ADM-02. **A pgTAP assertion pins that attribution rather than assuming it.**

No competing event system is created. **No family or student data enters an
audit payload** — the payload carries a user id and a program id and nothing
else. The administrator's note is stored in neither the audit nor the assignment
row: `educator_assignments` has no note column, and adding one for a rule no
approved requirement states would be a speculative field. The note is required
so the administrator states a reason before acting, and is recorded in the
action result; **that it is not persisted is a deviation, D-FE2 (§16).**

Blocked family mutations produce no audit rows because they produce no writes.

---

## 9. Data classification, privacy, idempotency, recovery

High-sensitivity: `students.preferred_name`, `grade_level`,
`guardian_relationship`, `families.name`, enrollment state. Medium:
`profiles.display_name`. Not read at all: email, credentials, tokens,
`raw_user_meta_data`, `auth.users` — no service-role path exists here.

**No identifier and no name reaches a URL.** Family and educator detail open in
drawers from data the list already holds; directory search is `useState`, never
a query parameter; mutations carry ids in POST bodies. Nothing new appears in
history, referrers, logs, screenshots, or analytics (analytics runs on public
routes only and these are authenticated).

Idempotency: `on conflict do nothing` + `'unchanged'` on assign; zero-row delete
→ `'unchanged'` on unassign. A double-click, a double-tap, or two open tabs
write nothing twice and create no second audit row.

Concurrency: `select … for update` on the program row serializes two
administrators; the second reads the first's result. Assignment carries no
`updated_at`, so there is no staleness token — the operation is a set-membership
toggle whose outcome is identical whichever order two administrators act in, and
`unchanged` reports it honestly. **Stale-conflict handling therefore takes the
form of an accurate `unchanged` result rather than a `40001` refusal**, which
differs from the enrollment path; this is stated in §16 as D-FE1.

Access revocation: removal takes effect on the **next authorized request**.
`private.is_assigned_educator` and both new policies evaluate
`educator_assignments` per statement; nothing is cached in a session, a cookie,
or a JWT claim. A pgTAP test deletes an assignment and re-reads in the same
transaction.

Recovery: the rollback in §5. An assignment removed in error is re-added by the
same administrator; the audit trail retains both events, so history is not
rewritten.

---

## 10. Design

REUSE → COMPOSE → EXTEND → CREATE.

**Reused unchanged:** admin sidebar / tablet rail / mobile header + bottom bar,
`hsh-container hsh-container-operations`, `Breadcrumbs`, `Alert`, `Dialog` (the
approved detail-drawer mechanism), `Badge`, `Button`, `Field`, `ListSkeleton`,
`EmptyState` / `SectionError` / `ReviewDataBanner`, `EnrollmentStateBadge`,
MDS tokens for every colour, space, radius, and motion value.

**Composed:** family and educator directories as `components.table` variant
`standard`; the roster as `components.table` variant **`roster`** — approved,
first implementation. Assignment controls compose `select` + `textarea` +
`dialog`, all approved.

**Created:** nothing that is a new reusable visual convention. `directory-search`
is `components.search` (variants compact/full/filtered, states empty/typing/
results/no_results — all approved) wired to local state instead of the URL.

Desktop/wide: sidebar preserved, 1440 px cap, semantic `<table>` with
`<caption>`, `<th scope="col">`, and a row header per record. Tablet 640–1023:
72 px rail with accessible labels; tables retained while column meaning
survives. Mobile: labeled record cards per `components.table.specification.responsive`
("transform to labeled rows or cards … never force unreadable horizontal
compression"); every card keeps its authorization, roster, enrollment, and
consent label — none is hidden to save space; 44×44 px targets, ≥8 px action
separation.

Lora for page headings, Manrope for operational UI. Every status carries an icon
**and** an explicit text label; colour is never the only carrier. Written MDS
rules and tokens outrank the generated reference.

---

## 11. Required experience states

Loading (streamed `Suspense` + `ListSkeleton`); empty family directory; empty
educator directory; no search results; family with no students; family with no
enrollments; educator with no assignments; program with no educator; program
with several educators; empty confirmed roster (with a separate non-confirmed
section still populated — the state that most needs to read correctly); pending
/ waitlisted / payment-pending separated; partial data (unresolved join rendered
as an explicit "not available", never a blank cell); recoverable query failure
(`SectionError`, "nothing has changed"); validation failure; duplicate
assignment (`unchanged`, not an error); concurrent assignment; unauthorized
access (`notFound()`); unassigned-educator denial (pgTAP); removed-assignment
denial (pgTAP); expired session (redirect carrying the destination); successful
mutation (announced); failed mutation with the drawer and its entered note
preserved.

---

## 12. Accessibility

Semantic landmarks and one `<h1>` per page; `<table>` with `<caption>` and
`<th scope="col">`/`scope="row"`; mobile cards as definition-style labeled
pairs; keyboard operation of navigation, search, drawers, dialogs, and forms;
the approved visible focus treatment; Base UI focus trap and focus return;
accessible names on every icon-only control; error summary plus field-level
messages; `aria-live` announcement of mutation results; explicit status text +
icon; logical focus order; `prefers-reduced-motion` honoured by the existing
dialog transitions; approved contrast; 44×44 px targets; no hover-only
information.

---

## 13. Docker and automated test plan

The local stack is running (12 `supabase_*` containers verified 2026-08-30).

```bash
npm run db:reset          # scripts/db-reset.mjs — verifies the seed landed
npm run db:test           # pgTAP, all ten files
npm run db:advisors       # security findings must be clean
npm run db:types:check
npm run typecheck && npm run lint && npm run format:check
npm run test:unit
npm run build
npm run test:e2e          # one worker; must reach a terminal result
```

**Seed change — MPS-ACC-028 is currently undemonstrable.** The educator is
assigned to programs `…004` (Art Lab) and `…0ff` (draft). The only `confirmed`
enrollment is in `…002` (Haven Days), which the educator is **not** assigned to;
`…004` holds only a `payment_pending` row. So no confirmed enrollment exists in
any educator-assigned program and the roster boundary has nothing to prove. One
sanitized confirmed enrollment is added for Sample Student A2 in `…004`,
alongside the existing `payment_pending` row for A1 — which also gives the
roster page its confirmed-and-non-confirmed split in one screen. `is_sample`
stays true; no new student, family, or field.

**pgTAP `80_admin_family_educator_roster.test.sql`** — planned assertions:
`anon` reads zero from families / students / enrollments / educator_assignments;
parent A reads no family B student; parent cannot execute either new function
(`42501`); educator cannot execute either (`42501`); educator cannot self-assign
(privilege now revoked as well as policy-denied); admin assign succeeds; repeat
assign returns `unchanged` and writes **one** audit row, not two; assign to a
non-educator raises `23514`; assign to an archived program raises `23514`;
assign with an empty note raises `22023`; assign with a bad id returns `P0002`;
unassign succeeds and audits; repeat unassign returns `unchanged`; audit
`actor_user_id` equals the acting admin (attribution through SECURITY DEFINER);
assigned educator reads exactly the confirmed roster student's `preferred_name`;
assigned educator reads **zero** pending/waitlisted students; unassigned
educator reads zero students; after delete, the same educator reads zero in the
same transaction; confirmed enrollment appears exactly once per program.

**Unit** (`tests/admin-roster.test.mts`): roster derivation is a pure function
over rows — confirmed-only membership, exactly-once, non-confirmed
partitioning, unresolved-join partiality, empty and all-pending inputs.

**E2E**: admin reaches both directories; parent and educator get 404 at both
paths by direct URL; assign and unassign round-trip with the result announced;
duplicate assignment reads as `unchanged`; roster shows confirmed separately
from pending/waitlisted; axe on both new pages and the program detail page;
keyboard-only drawer open/operate/close with focus return; ARIA snapshots;
sanitized screenshots at mobile / tablet / desktop / wide.

**Known pre-existing failure, untouched:** nine e2e visual baselines in
about/programs fail from a Chromium 1228→1234 upgrade after those baselines were
captured on 2026-08-28. Not regenerated here — they are public MDS references
and belong to whoever re-approves them. They will be reported as pre-existing,
not as passing.

---

## 14. Exact manual test steps (WSL/Ubuntu bash)

```bash
npm run db:reset && npm run build && npm run start
```

1. Sign in as `sample.admin@example.com`. `/admin` → sidebar now lists Overview,
   Programs, Enrollments, **Families**, **Educators**, Account.
2. `/admin/families` — directory renders; type a partial name; confirm results
   narrow **and the address bar does not change**; clear it; type nonsense →
   the no-results state.
3. Open a family drawer — guardian, students, enrollments, and the consent
   panel stating that no approved consent language exists. Confirm **no edit or
   delete control exists anywhere**. Escape closes it; focus returns to the row.
4. `/admin/educators` — Sample Educator with two assignments; open the drawer;
   read the assignment history.
5. Assign the educator to a program they do not hold. Confirm the success
   announcement, then `/admin` → Recent activity shows the attributed event.
6. Submit the same assignment again → "already assigned", no second activity row.
7. Remove the assignment; confirm the dialog names the consequence; confirm the
   activity row.
8. `/admin/programs/<id>` — roster lists the confirmed student once; the
   pending/waitlisted section is separately headed and carries no success
   styling.
9. Resize to 375 / 768 / 1280 / 1600 px. Confirm the mobile record cards keep
   every label, the tablet rail keeps its labels, and targets stay ≥44 px.
10. Tab through both pages with no mouse. Confirm visible focus, drawer trap,
    and focus return.
11. Sign out. Visit `/admin/families` and `/admin/educators` directly → sign-in
    carrying the destination.
12. Sign in as `sample.parent.a@example.com`, visit both directly → 404.
13. Sign in as `sample.educator@example.com`, visit both directly → 404.
14. **Privacy review:** grep the built output, the server log, and every new
    screenshot for `Sample Student`, `Sample Family`, and any uuid in a URL.

---

## 15. Gaps reported, not filled

| ID | Statement | Owner |
|---|---|---|
| GAP-ADMIN-009 | No approved workflow for an administrator to correct family or student information a parent controls (checklist §11) | MPS |
| GAP-ADMIN-010 | No approved administrator path to create or remove family membership; ACT-007 is parent-invited only | MPS |
| GAP-ADMIN-011 | No approved deletion, retention, or anonymization behavior for family, student, or educator records (checklist §11) | MPS |
| GAP-ADMIN-012 | No approved educator invitation workflow; no transactional-email capability exists. Dependency for the notifications slice. | MPS + MTS |
| GAP-ADMIN-013 | Checklist §9 does not define educator operational fields, activation/suspension, or what happens when an educator leaves | MPS |
| GAP-ADMIN-014 | Checklist §9 does not confirm which student and family fields an educator may see. `preferred_name` is exposed as the minimum that makes a roster a roster; every other field stays denied. | MPS |
| GAP-ADMIN-015 | Checklist §9 does not confirm who may export, download, or print roster or family information. No export exists. | MPS |
| GAP-ADMIN-001/002/003/004/005/006/007/008 (carried) | Unchanged from ADM-02 | MPS |
| MDS-GAP-ADMIN-003 (carried) | No approved "destination not yet available" navigation pattern | MDS |

---

## 16. Deviations and exceptions

| ID | Deviation | Why | Exit |
|---|---|---|---|
| D-FE1 | Assignment mutations carry no concurrency token; a stale submission returns `unchanged` rather than `40001` | Assignment is set membership with no material prior state to flatten; both orderings reach the same result, and `unchanged` states it truthfully. An `updated_at` column added only to raise a conflict would be a speculative field. | Revisit if assignment ever carries attributes |
| D-FE2 | The required note is not persisted | `educator_assignments` has no note column and no approved requirement asks for one. The note forces a stated reason before acting; MPS-REQ-024 requires actor, operation, record, states, and time — all recorded — not a rationale. | An approved note requirement adds the column |
| D-AO3 (narrowed) | Sidebar lists six of nine MDS admin destinations | Schedule, Communications, and Reports are unbuilt; MDS-GAP-ADMIN-003 leaves no approved unavailable-destination pattern | Each joins in its own slice |
| D-FE3 | No educator portal UI despite the roster boundary being built and tested | Explicitly out of scope; the boundary is the dependency the later workspace needs | Educator Assigned-Program Workspace slice |

---

## 17. Findings during implementation

Four things the plan did not anticipate, each recorded because each changed the work.

**F-1 — the e2e suite was running against the REMOTE review project, not Docker.**
`.env.local` pointed at `uedgcwoxyhtirsihvrnf.supabase.co`. Both e2e suites gate
their `db:reset` on `NEXT_PUBLIC_SUPABASE_URL` containing `127.0.0.1`, so with a
remote URL the fixture rebuild silently never ran, and the remote project holds
no enrollments at all — the roster rendered `Confirmed (0)` against correct local
data. `.env.local` now points at the local stack (original saved to the session
scratchpad as `env.local.backup`). **This predates this slice** and means any
earlier "e2e passing" result on this branch's base was measured against a
different database than the one the suites believe they are resetting.

**F-2 — the family drawer had a serious axe violation, caused by its read-only
design.** "Scrollable region must have keyboard access": it is the only modal in
the product with no focusable content — no button, link, or field — so a
keyboard user could open it and not scroll it. Fixed with `tabIndex={0}` and a
label on `DialogBody` at that one call site. No other dialog needs it.

**F-3 — five existing pgTAP assertions encoded facts this slice changes.** Each
was updated to the new truth rather than worked around: `30_` now asserts the
educator's DELETE is refused at the privilege layer (42501) rather than affecting
zero rows; `40_` assigns through `admin_assign_educator` instead of a direct
INSERT; `25_` and `60_` assert an educator reads exactly one student rather than
none; `50_` and `60_` carry the new enrollment count.

**F-4 — `scripts/db-reset.mjs` hard-codes the expected enrollment count.** It
verifies the seed landed by counting rows, so the new confirmed enrollment made
it report failure. Updated 4 → 5.

**F-6 — three defects the new tests found, two of them pre-existing.**
(a) `src/components/ui/select.tsx` gave `SelectPrimitive.Positioner` no
z-index while `DialogPopup` is `z-50`. Both portal to the body, so outside a
dialog it never mattered; inside one the select popup rendered BENEATH the
dialog and every click on an option landed on the dialog instead. The control
looked operable and was not, by mouse — keyboard selection still worked, which
is why it survived until a test clicked an option. The educator drawer is the
product's first select-inside-a-dialog. Fixed with `z-60`.
(b) `program-form.tsx`'s Summary textarea had no accessible name at all (axe
`label`, critical). `Input` is a registered Base UI primitive and
self-associates; `Textarea` is a raw element that Base UI's `Field` does not
register — the trap `contact-form.tsx` already documents. Nothing had run axe
against the program DETAIL page before this slice added one.
(c) The family drawer is the only modal with no focusable content, so its
scrollable body was unreachable by keyboard (axe `scrollable-region-focusable`,
serious). Fixed with `tabIndex`/`aria-label` at that one call site.

**F-7 — `--update-snapshots` damages the overview ARIA baseline.** It rewrites
the timestamp matcher from `/Aug \d+, \d+, \d+:\d+ AM UTC/` to the literal hour
of capture (`5:\d+ AM`, then `1:\d+ PM`), which would fail in any other hour.
The two legitimate content edits to that file were applied by hand instead, and
every regenerated snapshot was diffed before being kept.

**F-8 — two e2e failures are pre-existing and were proven so, not assumed.**
`admin-overview` "matches the structural ARIA snapshot" fails on nine
`- text: ""` nodes where the Review link now renders `- text: Review`. Verified
by `git stash`-ing this slice entirely, reseeding to the four-enrollment
fixture, rebuilding, and reproducing the identical failure on clean HEAD.
`password-recovery` "a parent recovers a password" fails only after repeated
runs: `supabase/config.toml` sets `[auth.rate_limit] email_sent = 2` per hour,
and the suite needs one. It passed earlier the same day and fails once the
budget is spent. Neither is touched here.

**F-5 — `db:types:check` now reports drift, correctly.** It compares the
committed types against the *linked* project, which does not have this
migration. The committed file matches the local database. Resolving this needs
`supabase db push` against the review project, which is owner-coordinated
external configuration (AGENTS.md §9) and was not done.

---

## 17. Assumptions

1. Several educators may be assigned to one program (composite PK, not unique
   per program). Assignment is additive; reassignment is remove + assign.
2. An administrator may assign any account holding the `educator` grant to any
   non-archived program. No eligibility rule beyond the role grant is approved.
3. `profiles.display_name` is the educator's operational identity. No email is
   read anywhere in this slice.
4. Assignment to a **draft** program is permitted — the seed already does it,
   and MPS-WFL-005 places "add … educator" before "publish".
