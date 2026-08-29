# Implementation prompt — Parent-Controlled Family Foundation

**Branch:** `feat/family-foundation`
**Status:** Approved by the owner on 2026-08-29, with the student-profile
decision recorded in §3.
**Phase:** MTS IMPLEMENTATION-PLAN Phase 3 (Identity and family experience), first slice.

---

## 1. Goal and scope

Let an authenticated, provisioned parent establish exactly one family account,
resume an incomplete setup safely, and see their family — with ownership derived
entirely from the authenticated server session and enforced independently by RLS.

### In scope

- A `/family/setup` experience for a signed-in parent with no family yet.
- A server action that creates one family and one `primary_guardian` membership
  atomically and idempotently.
- Database-level guarantee that one adult belongs to at most one family.
- Write authorization for family creation, expressed in the database, not only
  in the server action.
- `/family` becoming state-aware: `family_incomplete` → setup, `family_ready` →
  the existing family view; loading, validation, error, recovery, and success states.
- RLS, cross-family, idempotency, unauthenticated, and role-boundary tests.
- Accessibility and responsive validation at the approved viewports.

### Explicitly out of scope in this branch

- The family dashboard (MPS-REQ-015, MDS-REF-007) — the user excluded it.
- Secondary-guardian invitation (WFL-002 alternate path, "when enabled").
- Self-service account creation and email verification (`enable_signup = false`;
  Resend custom SMTP is not configured).
- Student-profile editing, correction, and retention behaviour (checklist §11).
- Guardian-relationship *permissions* — the field is recorded, it grants nothing.

---

## 2. Applicable approved IDs

| Source | IDs |
|---|---|
| Requirements | MPS-REQ-011 (create one family account, resume incomplete setup), MPS-REQ-004 (no private family data to public visitors or unassigned educators), MPS-REQ-021 (observable state and recovery), MPS-REQ-023 (responsive + accessibility) |
| Rules | MPS-RUL-005 (privileged operations stay authorized), MPS-RUL-007 (sanitized data only), MPS-RUL-010 (no invented policy language) |
| Workflow | MPS-WFL-002 states `verified`, `family_incomplete`, `family_ready`, `blocked`; recovery = "safe completion later" |
| Acceptance | MPS-ACC-015 (one family account, parent can continue setup), MPS-ACC-016 (no duplicate family; recovery path offered), MPS-ACC-017 (incomplete setup resumable), MPS-ACC-005 (no private family data leaks), MPS-ACC-032 (responsive/accessible) |
| MDS | `patterns.forms`, `patterns.authentication`, `patterns.empty`, `patterns.error`, `patterns.loading`; DESIGN-SYSTEM lines 128 (state coverage), 103 (Manrope for forms), 220–222 (keyboard, semantics, announcement); MDS-REF-005 navigation blueprint for the portal shell |
| MTS | TECHNOLOGY-BLUEPRINT "Authorization"; SECURITY-ARCHITECTURE "Deny by default and apply least privilege"; IMPLEMENTATION-PLAN Phase 3 |

---

## 3. Owner decision — demo student profiles (recorded deviation)

I raised this as a blocking policy gap. **The owner decided on 2026-08-29 to
build demo student profiles anyway**, alongside the family foundation. That
decision is theirs to make; this section records what it overrides, what I am
building under it, and what I am still refusing to invent.

### What remains unapproved

- `SAMANTHA-POLICY-CONFIRMATION-CHECKLIST.md` §7 (student-profile information)
  is entirely unchecked. Its candidate field list is a question put to Samantha,
  not an approved answer.
- Checklist §6 (parent authority, enrollment consent, waivers) is unchecked.
- GAP-005 is `open_activation_blocker`.
- MPS-RUL-006 (approved minimum fields only), MPS-RUL-008 (approved consent
  before profile creation), MPS-RUL-010 (no agent may invent policy language).
- `supabase/tests/database/00_setup.test.sql` asserts `hasnt_table('students')`
  with the comment "If one of these appears, the policy question was answered
  somewhere other than the MPS." That tripwire fires here, by design, and is
  rewritten rather than deleted (§6).

### How the build stays honest under that decision

1. **Demo-only, enforced by the database.** `public.students` carries
   `is_sample boolean not null default true` with `check (is_sample)`. While
   GAP-005 is open, a non-sample student row is not merely discouraged — it
   cannot be stored. MPS-RUL-007 becomes a constraint instead of a convention.
2. **Fewest fields, not the candidate list.** Built: preferred name, grade
   level, guardian relationship. **Deliberately not built:** legal name, date of
   birth or age, allergies, medical needs, accommodations, emergency contacts,
   authorized pickup, photos. MPS-RUL-006 names the sensitive group explicitly,
   and legal name and DOB are the two strongest identifiers of a minor — none of
   them are needed to demonstrate the boundary.
3. **The affirmation is marked unapproved in the data.** MPS-RUL-010 forbids
   inventing waiver or consent language, so none is written. What ships is a
   plain operational affirmation that the adult is this student's parent or
   guardian, stored per MPS-REQ-003 as `affirmation_version` +
   `affirmed_at` — with `check (affirmation_version = 'demo-unapproved-v0')`.
   No row can claim that Samantha-approved language was accepted, because no
   such version string is storable.
4. **Visible in the UI.** The student area carries a standing notice that these
   are sample records for the Foundation Review, in the same manner the
   `/resources` demo surface was approved on 2026-08-28.
5. **Correction, retention, and deletion policy is still not invented.** A
   parent may add and remove a demo student. There is no editing flow, no
   retention rule, and no export — those are checklist §11.

### Deviation to report

**D-FF1:** student profiles implemented while MPS GAP-005 is open, under an
owner decision of 2026-08-29 rather than under approved MPS state. Field set and
affirmation text are implementation choices, not approved policy, and must be
re-derived from Samantha's checklist §6 and §7 answers before real-family
activation. The `is_sample` and `affirmation_version` constraints are what keep
this reversible.

## 4. Repository evidence inspected

| File | What it establishes |
|---|---|
| `supabase/migrations/20260827212014_foundation_roles_and_identity.sql` | `families`, `family_members` (PK `(family_id, user_id)`, `member_role` enum), `private.is_family_member()`, `handle_new_user()` grants no role |
| `supabase/migrations/20260827212023_foundation_rls_policies.sql` | `families`/`family_members` are **SELECT-only** for clients; comment: "No write policies: family creation … are MTS Phase 3 workflows" |
| `supabase/migrations/20260828010906_foundation_least_privilege_grants.sql` | explicit grant model; new privileges must be granted, not assumed |
| `src/lib/auth/session.ts` | identity from `getClaims()` (verified JWT), roles from `public.user_roles`, never from metadata; `cache()`-memoised |
| `src/lib/auth/guards.ts` | `requireViewer` → `/sign-in?redirectTo=`; `requireRole` → `notFound()` for wrong role |
| `src/app/(portal)/layout.tsx` | layout performs **no** authorization; `export const dynamic = "force-dynamic"` |
| `src/app/(portal)/family/page.tsx` | already renders the "no family linked" empty state; queries all families and lets RLS filter |
| `src/lib/supabase/server.ts` | publishable key only; **no service-role code path exists in the repo** |
| `src/app/(auth)/sign-in/{actions,form-state}.ts` | server-action conventions: zod schema, discriminated `status`, `fieldErrors`, echoed values, nothing logged |
| `src/components/auth/sign-in-form.tsx` | `useActionState`, `noValidate`, `role="status" aria-live="assertive"` sr-only announcer keyed on status, MDS token classes, Lucide `strokeWidth={1.75}` |
| `supabase/config.toml` | `enable_signup = false` — accounts are provisioned |
| `supabase/seed.sql` | sample parents A/B already hold the `parent` role and pre-made families A/B |
| `supabase/tests/database/20_rls_family.test.sql` | pgTAP conventions: `set local request.jwt.claims`, positive + negative assertions |
| `tests/e2e/authorization.spec.ts`, `tests/e2e/fixtures.ts` | e2e auth/role-boundary conventions |

---

## 5. Design decisions and their rationale

### 5.1 Creation goes through a SECURITY DEFINER RPC, not RLS INSERT policies

An RLS `INSERT` policy on `family_members` that let a user insert their own
`user_id` would let them insert themselves into **any** family id they can
guess — a cross-family write hole. The two inserts are also not atomic from the
client, so a crash between them would leave an orphan family.

Instead: `public.create_family_for_current_user(family_name text) returns uuid`,
`security definer`, `set search_path = ''`, `EXECUTE` revoked from `PUBLIC` and
granted to `authenticated` only. It:

1. reads `auth.uid()` itself and raises if null;
2. requires the caller to already hold the `parent` role
   (`private.has_role('parent')`) — see §5.3;
3. returns the existing family id if the caller already has a membership
   (idempotent, no error);
4. otherwise inserts the family and the `primary_guardian` membership in one
   statement pair inside the function's single transaction.

`families` and `family_members` gain **no** client INSERT/UPDATE/DELETE policy.
Deny-by-default is preserved; the RPC is the only door, and it decides for
itself who the caller is.

### 5.2 One family per adult, enforced by the database

`create unique index family_members_one_family_per_user on public.family_members (user_id);`

This is the idempotency backstop. A double-submit, a refresh, or two concurrent
requests cannot produce two families: the second either short-circuits at step 3
or is refused by the unique index, and the action maps a unique violation to the
same success path (re-read the existing family). Correctness does not depend on
the check-then-insert race in step 3.

### 5.3 The RPC requires the `parent` role; it does not grant one

Granting a role as a side effect of a self-service action would contradict the
identity migration's stated rule ("role assignment is an authorized operation,
never a side effect of signing up") and MPS-RUL-005. A provisioned account
without the `parent` role already gets `notFound()` from `requireRole`, which is
the approved denial. Family setup therefore sits *behind* the existing role gate
rather than around it.

### 5.4 Audit history

Family creation is a material family-record change. `audit_events` and its
SECURITY DEFINER trigger pattern already exist
(`20260827212020_foundation_audit_history.sql`); the RPC will record the
creation through that existing mechanism, attributed to `auth.uid()`, with **no
family name or child data in the payload beyond the family id** (AGENTS.md §11:
no child/family data in logs). Exact shape to follow the existing trigger's
conventions on inspection during implementation.

### 5.5 The only field collected is a family name

A family display name is not child data and not policy. It is the minimum needed
to make the account legible to its own parent and to an administrator. No
guardian relationship, no consent checkbox, no child field, no phone, no address
— each of those is an open checklist item.

---

## 6. Expected changes

### Migration — `supabase/migrations/<ts>_family_setup.sql`

- unique index `family_members (user_id)`;
- `public.create_family_for_current_user(text) returns uuid` as specified in §5.1;
- `revoke all … from public` / `grant execute … to authenticated`;
- audit recording per §5.4;
- a `-- rollback:` block matching the existing migrations' convention
  (`drop function`, `drop index`).

No new table. No change to `families`/`family_members` columns. No new client
write policy.

### Application

| Path | Change |
|---|---|
| `src/lib/family/repository.ts` | new — `getFamilyForViewer()`, `createFamilyForViewer(name)` wrapping the RPC; `server-only` |
| `src/app/(portal)/family/setup/page.tsx` | new — guarded by `requireRole("parent", "/family/setup")`; redirects to `/family` if a family already exists |
| `src/app/(portal)/family/setup/actions.ts` | new — `"use server"`, zod-validated, returns a discriminated state, redirects on success |
| `src/app/(portal)/family/setup/form-state.ts` | new — `idle \| invalid \| unavailable \| failed \| forbidden` |
| `src/components/family/family-setup-form.tsx` | new — client component following `sign-in-form.tsx` conventions exactly |
| `src/app/(portal)/family/page.tsx` | edit — `family_incomplete` state links to `/family/setup`; keep the existing GAP-005 explanation |
| `middleware.ts` | no change — `/family/:path*` already matched |

### Tests

| Path | Covers |
|---|---|
| `supabase/tests/database/20_rls_family.test.sql` (extend) or new `25_family_setup.test.sql` | RPC creates one family + membership; second call returns the same id and creates nothing (idempotency); direct `insert into families` is refused; direct `insert into family_members` into family B is refused; a non-parent caller is refused; an anonymous caller is refused; parent A still cannot see family B |
| `tests/e2e/family-setup.spec.ts` (new) | signed-out → redirected to `/sign-in?redirectTo=/family/setup`; educator → 404; parent with no family sees setup; submit → `/family` shows the family; **double submit produces one family**; validation, error, and success states; axe scan; keyboard-only completion; screenshots at mobile/tablet/desktop/wide |
| `tests/e2e/authorization.spec.ts` (extend) | `/family/setup` added to the protected-route matrix |
| `tests/family-name.test.mts` (new) | the pure validation schema |

### Seed

Add a sanitized third parent (`sample.parent.three@example.com`, `parent` role,
**no family**) so the `family_incomplete` path is testable without mutating the
existing A/B fixtures. Names stay `Sample …` on `example.com` per the seed's
stated rules.

---

## 7. Security, privacy, and data handling

- Identity from `getClaims()` only; the family id is never accepted from the client.
- No service-role credential is introduced; the repo's zero-service-role posture holds.
- The RPC is `security definer` with an empty `search_path`, `EXECUTE` revoked
  from `PUBLIC`, and it re-derives `auth.uid()` rather than trusting an argument.
- No family name, email, or user id in logs, error messages, URLs, analytics, or
  screenshots. Error copy names the state, never the data.
- No analytics on this route (authenticated area).
- Hidden UI is never the control: every denial is a guard plus an RLS/RPC refusal.

## 8. Responsive and accessibility requirements

- Manrope for the form (DESIGN-SYSTEM line 103); MDS tokens only, no ad-hoc values.
- 44 px minimum interaction targets; visible focus; full keyboard operation.
- Server-side validation with `noValidate`; errors associated via `FieldError`
  and announced through the sr-only `role="status" aria-live="assertive"`
  announcer keyed on status, matching `sign-in-form.tsx`.
- Loading state from `useActionState`'s `pending`; success announced after redirect.
- Screenshot comparison at the project's configured mobile, tablet, desktop, and
  wide viewports; axe-core clean; ARIA snapshot for the form.

## 9. Rollback

The migration's `-- rollback:` block drops the function and the unique index;
no data is destroyed and no existing column changes. Application changes are
additive apart from the `/family` edit. Reverting the branch restores the
current behaviour exactly.

## 10. Assumptions

1. A parent reaching `/family/setup` already holds the `parent` role (§5.3).
2. A family display name is not policy-governed content (§5.5).
3. One family per adult is correct for the Foundation Release — supported by
   MPS-REQ-011 "one family account" and MPS-ACC-016.

## 11. Checks to run

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`,
`npm run db:reset`, `npm run db:test`, `npm run db:advisors`,
`npm run db:types:check`, `npm run test:e2e`, `npm run build`.
Results reported verbatim, including any that cannot run in this environment.

## 12. External setup required from the owner

- Samantha's checklist §6 and §7 answers before any student-profile work.
- Nothing else; this slice needs no new service, key, or paid plan.

---

# Implementation record (2026-08-29)

## Deviations

**D-FF1 — student profiles built while MPS GAP-005 is open.** Recorded in §3.
Owner decision of 2026-08-29. Field set (preferred name, grade level, guardian
relationship) and the affirmation sentence are implementation choices, not
approved policy. Constrained by `students_sample_only` and
`students_affirmation_unapproved` so the boundary is enforceable and reversible.

**D-FF2 — `00_setup.test.sql` tripwire rewritten.** That file asserted
`hasnt_table('public','students')` with the comment "If one of these appears,
the policy question was answered somewhere other than the MPS." It fired
correctly. It is replaced with two assertions that the sample-only and
unapproved-affirmation constraints are still attached, rather than deleted.
`consents` and `enrollments` remain asserted absent.

**D-FF3 — the parent role is required, never granted.** Family setup sits behind
the existing `parent` role gate. Granting a role as a side effect of a
self-service action would contradict the identity migration's stated rule and
MPS-RUL-005. A provisioned adult with no role still gets `notFound()`, which
means **the owner must grant `parent` to a new account before that account can
finish setup**. Self-service account creation is still absent
(`enable_signup = false`), so this matches how accounts reach the review today.

## MDS gap recorded for review

There is no canonical MDS reference for a family setup form or a student
profile form. MDS-REF-007 is the family *dashboard*, which this branch
deliberately does not build. Both new pages are composed from the approved
`patterns.forms` state set and the `patterns.authentication` precedent already
implemented in `sign-in-form.tsx` — same announcer, same error panels, same
Field/Input/Button primitives, same token usage. No new visual convention was
introduced. If the owner wants a canonical reference for these surfaces, that is
an MDS governance action.

## Checks actually run

See the completion report. Docker is unavailable in this environment, so the
pgTAP suite could not be executed; the linked Supabase project does not yet have
this migration, so the credentialed browser tests cannot pass until it does.
Both are reported as not-run rather than as passed.


---

# Post-deployment inspection (2026-08-29)

The owner deployed and ran the suite. Inspection of the live review project
found the schema correct, one defect of mine, and one deployment step that did
not take effect.

## Verified correct

* `supabase migration list --linked` shows `20260829120000` applied.
* `npm run db:types` regenerated `database.types.ts` **byte-identical** to the
  hand-written version, confirming table, columns, foreign key, and all three
  function signatures. `npm run db:types:check` now passes — it had been failing
  before this branch on a PostgREST version string, and that drift is resolved.
* Anonymous callers are refused `students` and `families` (42501).
* Parent one sees only Sample Family A; parent two only Sample Family B.
* The educator has no family and no student access.
* `grant execute` on all three functions applied and the functions are callable.

## DEFECT-FF1 — `students` SELECT grant not in effect (fixed)

Every signed-in parent and the administrator received
`42501 permission denied for table students`, so `/family` showed a load error
instead of children. RLS was correct throughout; the table was simply
unreachable. Repaired by `20260829140000_students_grant_repair.sql`, with a
regression assertion added to `00_setup.test.sql`. Root cause and why the fix
is not "add students to the least-privilege migration" are documented in that
migration's header.

## DEFECT-FF2 — the seed never ran

`psql "$DB_URL" -f supabase/seed.sql` did not take effect against this project.
Evidence, read through an administrator session:

| Expected after seeding | Found |
|---|---|
| 5 profiles incl. Sample Parent Three | 4 — no third parent |
| 5 role grants | 4 |
| 3 student rows | 0 student audit events, so no insert ever occurred |

Everything present dates from the seeding done before this branch. `$DB_URL` was
most likely unset — there is no local Postgres server in this workspace, so a
bare `psql` would have failed to connect rather than written anywhere.

Consequence: the `family_incomplete` path has no account to exercise, so those
tests cannot pass yet.

## The test run was not clean

184 passed, but 77 test-result directories were written, i.e. 77 failures. The
majority are 30-second timeouts under load — axe `page.evaluate` timeouts and
`ERR_ABORTED` navigations — spread across pre-existing specs (about, home,
contact, calendar, programs, resources) that this branch does not touch. They
are an environment/concurrency problem, not a regression. The family-setup
failures are genuine and explained by DEFECT-FF1 and DEFECT-FF2.

Re-run with `--workers=1` after applying the repair and the seed.


---

# Second deployment inspection (2026-08-29, 245/276)

## DEFECT-FF1 is fixed and verified

`20260829140000_students_grant_repair.sql` is applied. Read through live
sessions: every parent and the administrator can now reach `students`, and
`anon` is still refused (42501). The boundary is intact — the repair restored
reachability only.

## DEFECT-FF2 still open — the seed has still not run

Unchanged from the previous inspection:

* `sample.parent.three@example.com` — sign-in still refused, so the account does
  not exist.
* `students` is now readable and is **empty** for every account, including the
  administrator.

Eight of the sixteen remaining failures are this and nothing else: the tests
that sign in as parent three spend 30 seconds failing to authenticate.

## Three defects of mine in the tests, not the application

**DEFECT-FF3 — stale assertion in `authorization.spec.ts`.** That test asserted
the family `h1` reads "Your family". This branch changed the page to title
itself with the family's own name once setup is complete, and I did not update
the assertion. Fixed, and strengthened: it now asserts "Sample Family A", which
makes the same line carry both the heading check and the ownership check.

**DEFECT-FF4 — ambiguous checkbox selector.** Base UI renders a visible
`span[role=checkbox]` alongside an `aria-hidden` input that carries the value to
the form, and both are associated with the label, so `getByLabel` matched two
elements and threw a strict-mode violation. Fixed to target the role, which is
what a person and a screen reader actually operate. Not an application defect —
the hidden input is `aria-hidden` and `tabindex="-1"`, so assistive technology
sees exactly one checkbox.

**DEFECT-FF5 — apostrophe mismatch in an assertion.** The test expected
"this student’s" with a typographic apostrophe; the message in `validation.ts`
uses a straight one, which matches the repository convention (no `.ts` file
contains a curly apostrophe; JSX uses `&rsquo;`). **The feature was working** —
the failure snapshot shows the checkbox marked `[invalid]` and the error text
rendered. Only the assertion was wrong. It now matches on the clause with no
apostrophe in it, so it cannot drift on typography again.

## Visual baselines deleted deliberately

The run recorded four `family-ready-*` baselines. They were captured against a
database with **no students**, so they show an empty roster and would have
locked in the unseeded state as correct. Deleted. They must be recorded after
the seed lands.

**DEFECT-FF6 — row locators counted each student twice.** `/family` prints each
student's name twice in a row: once as the label and once inside its
"Remove <name>" button. `getByText("Sample Student A4")` therefore returned 2
for a single profile, and the idempotency test read that as a duplicate.

**The idempotency guarantee was never broken.** The failure snapshot shows one
`listitem` containing both the label and its remove button — one profile after
two identical submissions, exactly as designed. The assertions now count rows
(`getByRole("listitem").filter(...)`), which is what "a student appears once"
actually means, and the same latent flaw was fixed in the cross-family
visibility test before it could bite once the seed lands.


---

# Third inspection — root cause found, database suite finally run (2026-08-29)

The owner supplied a database connection string, which made both the real cause
of DEFECT-FF2 and the entire pgTAP suite reachable for the first time.

## DEFECT-FF2 root cause — the seed was not re-runnable

`psql -v ON_ERROR_STOP=1 -f supabase/seed.sql` failed at line 134:

    ERROR: duplicate key value violates unique constraint "programs_pkey"

`insert into public.programs` had no `on conflict` clause, while **every other
insert in the file had one**. Against an already-seeded database the file
therefore died at the programs block, and everything after it — sample accounts,
role grants, families, students, educator assignments — never ran. A re-seed
looked like it had worked while adding nothing, which is exactly the behaviour
observed twice.

Fixed by adding `on conflict (id) do nothing`, matching the rest of the file.
`do nothing` rather than `do update`: this file seeds fixtures, and silently
rewriting published program content on an unrelated re-seed would be a surprise.

Re-run result: `psql exit: 0`, and the database now holds 5 profiles, 5 role
grants, 2 families, 3 students (all `is_sample`, all `demo-unapproved-v0`),
2 memberships.

## The pgTAP suite now runs — 80/80

The test files wrap everything in `begin … rollback`, including their own
`create extension`, so running them against the review project leaves no trace.
Verified: row counts and the draft's publication state are identical afterwards.

| File | Assertions |
|---|---|
| `00_setup` | 16 |
| `10_rls_programs` | 14 |
| `20_rls_family` | 9 |
| `25_family_setup` | **25** |
| `30_rls_educator` | 7 |
| `40_rls_admin_and_audit` | 9 |
| **Total** | **80 passing, 0 failing, 0 errors** |

`25_family_setup` covers the whole slice at the database layer: one family per
adult, repeat calls returning the same family, duplicate student submissions
returning the existing profile, cross-family read and write denial, the
`is_sample` and affirmation-version constraints refusing bad rows, the absent
sensitive columns, non-parent and anonymous refusal.

## Three defects the suite exposed the moment it could run

**DEFECT-FF7 (mine).** `40_rls_admin_and_audit` asserted the administrator sees
4 profiles and 4 role grants. Adding `sample.parent.three@example.com` made both
5. Updated, with the reason recorded in the file.

**DEFECT-FF8 (pre-existing).** `10_rls_programs` asserted `anon` reads zero rows
from `families`, `family_members`, `user_roles`, and `audit_events`. Since
`20260828010906` revoked every privilege `anon` held on those tables, the query
is refused outright (42501) rather than filtered to zero rows, so the assertion
raised and aborted the file. The denial got *stronger* and the test never caught
up. Now `throws_ok(..., '42501', ...)`.

**DEFECT-FF9 (pre-existing).** Three assertions across `10_rls_programs` and
`30_rls_educator` wrapped a data-modifying CTE inside a subquery expression:

    ERROR: WITH clause containing a data-modifying statement must be at the
           top level

Those three assertions could never have executed. Rewritten as top-level
statements followed by a check of what actually landed. The parent-cannot-
publish check now drops back to the owner before asserting, because a parent
cannot see the draft at all and "invisible" would have passed whether or not the
write landed.

FF8 and FF9 are outside this slice. They were invisible because Docker is
unavailable in this workspace and the suite had never been executed against
anything. They are test-only changes and can be backed out independently if the
owner would rather keep this branch narrow.

## DEFECT-FF10 — the end-to-end suite consumed its own fixture

`sample.parent.three@example.com` was shared by every test needing a
family-less parent, *including* the one that completes setup. Completing setup
consumes the fixture, so whichever family-less test ran afterwards found a
family already there and timed out on a form it would never see. Six tests
failed this way, and four of them wrote screenshot baselines of the redirected
`/family` page rather than the setup page they were named for. Those four
baselines have been deleted.

It was also broken *across* runs: a re-seed could not undo it, because
`on conflict do nothing` cannot remove a row nothing conflicts with.

Two fixes, because there were two problems:

1. **A second fixture account.** `sample.parent.four@example.com` is now the
   only account that completes setup; parent three is reserved for the tests
   that must stay family-less. The dependency on test ordering is gone.
2. **The seed restores the fixture.** It now deletes any family belonging to
   either family-less parent, so re-seeding returns them to
   `family_incomplete` instead of inheriting whatever the last run left.
   Verified: after re-seeding, the test-created family is gone and both parents
   are family-less again.

`40_rls_admin_and_audit` counts moved from 5 to 6 to match, and the suite still
reports 80 passing, 0 failing.


## MDS visual comparison — first real evidence

Baselines are recorded and reviewed at 390 / 768 / 1280 / 1440.

Verified against DESIGN-SYSTEM.md: Lora for the page and section headings,
Manrope for the form and all UI, Forest 600 primary buttons, card surfaces with
the approved border and radius, the information colour on the demo notice,
44 px controls, visible focus. No hardcoded colour or spacing values — every
token used in the new files was checked against `globals.css`, which caught one
bypass (`--hsh-information`, which does not exist; the token is `--hsh-info`).

Two things this comparison does **not** establish:

1. **There is still no canonical reference for these two pages.** MDS-REF-007 is
   the family *dashboard*, which this branch deliberately does not build, so
   Gate 2 of `mds/qa/MDS-QA.md` cannot be run against a reference. What was
   compared is the written specification, not an approved image.
2. **Open composition question for the owner.** The student rows span the full
   container width while the headings, notice, and copy are constrained to
   reading width, which leaves a large empty right-hand column at 1280 and 1440.
   That follows the written spec but was never drawn. It is recorded as a
   question rather than silently treated as approved.


## The suite requires a re-seed between runs (documented, not fixed)

Completing family setup is deliberately one-way: there is no "delete my family"
path, because family deletion is retention policy and MPS GAP-005 has not
settled it. The test that completes setup therefore leaves
`sample.parent.four@example.com` with a family, and it fails on the next run
until the fixture is restored.

This is the repository's existing workflow — `npm run db:reset` before
`npm run test:e2e` locally — and the seed now performs the restore against a
deployed database too. Recorded in the spec header rather than worked around,
because the alternative would be adding a family-deletion path that policy does
not authorise.
