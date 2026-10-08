# Implementation prompt — Slice 2.5: Registration policy and design readiness

Branch: `feat/registration-readiness`, created from `origin/release/foundation-preview` at
`0098e25` (the PR #28 merge commit, verified present). Requested 2026-09-19. The PR targets
`release/foundation-preview`. The agent applies nothing to a hosted project and does not touch
Vercel.

## 1. Goal and scope

Turn the owner decisions of 2026-09-19 into enforceable database rules, a narrow educator
safety-data boundary, document-versioning mechanics, and a written MDS registration pattern.
When this slice is done, the registration UI slice can begin without an open policy or design
question it would otherwise have to guess at.

**In scope:** two additive migrations; a replacement body for `submit_family_registration` (same
signature); new admin, owner, family, and educator RPCs; structured attendance configuration; TS
contract updates; pgTAP and unit tests; MPS, MDS, and MTS records; and an AGENTS.md boundary line.

**Out of scope:** any registration UI, route, page, or server action; email; internal payment
processing; lifting any sample-only lock; publishing any document; legal, waiver, handbook, Code of
Conduct, media-release, or retention wording beyond the decisions quoted in §2; an automatic
deletion job; any hosted migration, reset, or Vercel change.

## 2. Recorded decisions (instruction of 2026-09-19) and where each lands

| # | Decision | MPS record | Enforced by |
|---|---|---|---|
| 1 | Required: guardian phone; ≥1 emergency contact; ≥1 approved pickup; explicit Yes/No for allergies, medical needs, and accommodation needs; details required only after Yes | DEC-026 | submit function and table CHECKs (§5.1) |
| 2 | Sensitive-data access matrix (§6); educators get only allergy, emergency contacts, and pickup persons for assigned children | DEC-027 | RLS unchanged plus `educator_child_safety` RPC (§5.5) |
| 3 | STEP UP skips checkout, goes to an admin review queue; five outcomes; verified leads to ordinary enrollment review, never auto-enrollment | DEC-028 (supersedes the "does not change the enrollment evaluation" clause of DEC-025) | §5.3, §5.4 |
| 4 | Any newly published document version requires fresh acceptance; draft edits do not | DEC-029, MPS-RUL-009 clarified | §5.6 |
| 5 | Neutral media-permission question, distinct from signature | DEC-030 | MDS pattern; existing `photo_video_permission` boolean |
| 6 | Sensitive data may remain at least 30 days after the child leaves; not a deletion deadline | DEC-031 | Documentation and table comments only (§5.8) |
| 7 | Structured attendance days, validated on the server | DEC-032 | §5.2 |
| — | MDS-GAP-010 resolved at the specification level | MDS-DEC-023, MDS v1.2 | §8 |

Every decision is recorded as made by the user acting as product-definition collaborator.
**None is recorded as Samantha's sign-off.** Real-family activation stays blocked (EXC-002,
GAP-005, GAP-014, GAP-016 narrowed but not closed).

## 3. Applicable IDs

- **MPS:** MPS-REQ-001/002/003/004/005/006/012/013/014/017/018/021/024; MPS-RUL-003/004/006/
  007/008/009/010; MPS-ACC-002/003/005/006/018/019/021/022/023/028/029; MPS-WFL-002/003/006;
  DEC-025; EXC-002; GAP-005, GAP-010, GAP-014, GAP-015, GAP-016; checklist §6, §7, §8, §9, §11.
- **MDS:** `patterns.forms`, `components.consent_state`, `components.enrollment_state`,
  `components.payment_handoff`, `patterns.custom.consent`, `patterns.custom.enrollment_handoff`,
  `patterns.error`, `patterns.loading`, `patterns.empty`; DESIGN-SYSTEM §6 trust-state rules, §8
  responsive, §10 accessibility, §13 change control; MDS-GAP-010.
- **MTS:** SECURITY-ARCHITECTURE mandatory controls; MTS-DEC-003/013 (link-only checkout, manual
  reconciliation); MTS-CHG-010/011; DEFECT-FF1 (grants after DDL).

## 4. Repository evidence inspected

- `supabase/migrations/20260918120000_family_registration_foundation.sql` (all 1,475 lines): nine
  tables, the approval lock, the single-value STEP UP enum, `submit_family_registration`,
  `private.request_enrollment_core`, the immutability triggers, and RLS.
- `20260916000000_public_offering_model.sql`: the nine verified programs and their free-text
  `published_schedule`.
- `20260829170000` (`enrollment_state`); `20260830090000` (`enrollment_transition_allowed`, where
  `approval_pending → confirmed` is the ordinary admin review); `20260831000000` and
  `20260902000000` (the educator roster views, confirmed-only, which expose `preferred_name` and
  `enrollment_id`); `20260827212017` (`educator_assignments`, `private.is_assigned_educator`);
  `20260827212014` (`has_role`, `is_admin` = admin or owner).
- `src/lib/enrollment/eligibility.ts:154`: `mayOfferCheckout` is true for **`started` only**.
  `src/lib/family/dashboard-state.ts:99` also treats `started` as "checkout was started".
- `src/lib/registration/{contract,repository}.ts`, `tests/registration-contract.test.mts`,
  `supabase/tests/database/160_family_registration_foundation.test.sql`, and `supabase/seed.sql`
  (the three sample draft documents; the educator is assigned to Tutoring `…000c` and the draft
  `…00ff`).
- MPS, MDS, and MTS state; the policy checklist; SECURITY-ARCHITECTURE; and AGENTS.md §11–12.
- A repository-wide search for waiver, handbook, and Code of Conduct sources found **no document
  text, file, hash, or approval record**.

## 5. Data and server changes

Two migrations. Neither edits `20260918120000`.

- `20260919120000_step_up_review_states.sql` contains only
  `alter type public.step_up_verification_state add value …` for `needs_information`, `verified`,
  `declined`, and `canceled`. It is separate because a new enum value cannot be used in the
  transaction that adds it.
- `20260919120100_registration_readiness.sql` contains everything below. Grants come last
  (DEFECT-FF1).

### 5.1 Required information (decision 1)

- `registration_child_health` gains `has_medical_needs boolean not null` and
  `has_accommodation_needs boolean not null`, with
  `check (has_medical_needs = (medical_information is not null))` and the accommodation
  equivalent. The allergy CHECK already exists. `NOT NULL` without a default **fails the migration
  if any health row exists**, rather than inferring "No" from a blank (§11 risk 1).
- Payload: children require `has_medical_needs` and `has_accommodation_needs` (booleans; an
  absent key or a `null` is refused). `medical_information` and `accommodation_information` are
  required after Yes and refused after No. `emergency_contacts` and `pickup_persons` change from
  a minimum of 0 to a minimum of **1**. Guardian phone is already required by the payload and by
  `registration_contacts_phone_required`, and a test pins it.
- Failures stay path-only `22023` errors raised before any write.

### 5.2 Attendance days (decision 7)

New normalized configuration. `programs.published_schedule` stays the display text. The new
tables are the structured rule the server validates against, and the drift risk between them is
recorded in §11.

```
attendance_selection_mode enum: fixed | family_selects
program_attendance_rules (program_id PK → programs cascade, selection_mode, updated_at, updated_by,
                          unique (program_id, selection_mode))
program_attendance_days  (program_id → rules cascade, day attendance_day, PK (program_id, day))
program_attendance_plans (program_id, selection_mode CHECK = 'family_selects',
                          days_per_week smallint 1–7, PK (program_id, days_per_week),
                          FK (program_id, selection_mode) → rules)
```

The composite FK means plans can exist only on a `family_selects` rule. These tables hold public
program facts (not sample data), are readable by anyone who can read the program (RLS through
`programs`), and have no client write grant.

**Seeded in the migration** for the verified programs (`insert … select … where exists`):

| Program | Mode | Days | Plans |
|---|---|---|---|
| Haven Days `…0002` | family_selects | Tue, Wed, Thu | 1, 2, 3 |
| Tutoring `…000c` | family_selects | Tue, Wed, Thu | none (any 1–3 of the available days) |
| Ready Set Prep `…0009` | fixed | Tue, Thu | — |
| Ready Set Learn `…000a` | fixed | Tue, Thu | — |
| Ready Set Sensory `…000b` | fixed | Wed | — |
| Sewing `…0005` | fixed | Wed | — |
| Crochet `…000e` | fixed | Mon | — |
| Gardening `…0006` | fixed | Thu | — |
| Monthly Clubs `…000d` | fixed | Thu | — |

Archived programs get no rule.

**Validation in `submit_family_registration`**, before any write. Selections gain an optional
`plan_days_per_week`.

- A published program with no rule gets the new outcome **`blocked_attendance_unconfigured`**
  (with the child index and program id), and nothing is written. An unpublished program still
  reaches the existing `blocked_unavailable`.
- `fixed`: `attendance_days` must be absent or empty, and `plan_days_per_week` absent. Otherwise
  `22023` at `…attendance_days`. The stored selection snapshots the configured days as evidence.
- `family_selects` with plans: `plan_days_per_week` must be one of the configured plans, and the
  days must be unique, each available, and exactly that many.
- `family_selects` without plans: no plan; 1…n unique available days.
- `registration_selections` gains `plan_days_per_week smallint` (CHECK 1–7).

**Admin door:** `public.admin_set_program_attendance(target_program, mode, days, plan_counts)`.
Admin only. It locks the program row, replaces the configuration atomically, validates (at least
one day; plans only for `family_selects`; each plan ≤ the day count; no duplicates), returns
`updated` or `unchanged`, and audits `entity_type='program', action='attendance_configured'`
with the mode, days, and plans. No UI.

### 5.3 STEP UP skips checkout (decision 3)

This is the schema conflict. Today a STEP UP child in an **instant-confirmation** program (for
example Gardening) gets `started`, and `started` is exactly the state that offers GoDaddy checkout
(`mayOfferCheckout`). DEC-025 made that deliberate ("does not change the enrollment evaluation").
Decision 3 requires skipping checkout.

**Proposed:** a STEP UP selection resolves to **`approval_pending`** where it would otherwise have
been `started`. `approval_pending` is the existing "request received; administrative review
pending" state. It offers no checkout, and its ordinary exit is the admin's
`approval_pending → confirmed` review. `waitlisted` and every `blocked_*` outcome are unchanged.
STEP UP never produces `confirmed` or `payment_pending`.

Mechanism: `private.request_enrollment_core` gains a fifth parameter, `require_review boolean`,
and is dropped and recreated. `family_request_enrollment` passes `false` and its behavior is
unchanged (`110_…` still passes untouched). DEC-025's evaluation clause is superseded by DEC-028.

### 5.4 STEP UP review queue and transitions (decision 3)

- The enum becomes `pending_verification, needs_information, verified, declined, canceled`. A test
  pins the exact set, so no `paid`, `confirmed`, or `enrolled` value can exist.
- `registration_step_up_requests` gains `state_changed_at timestamptz not null default now()` and
  `state_changed_by uuid` (→ auth.users, restrict). Its blanket immutability trigger is replaced by
  a guard that allows **only** those three columns to change, and only along an allowed
  transition, so even a definer path cannot move it any other way.
- Allowed transitions:

| From | To |
|---|---|
| pending_verification | needs_information, verified, declined, canceled |
| needs_information | pending_verification, verified, declined, canceled |
| verified | canceled |
| declined | — (terminal) |
| canceled | — (terminal) |

- `public.admin_set_step_up_state(target_registration_child, expected_state, next_state)`: admin
  or owner only (`42501` otherwise, identical for a nonexistent id). It uses `select … for update`.
  - `current = next` returns `unchanged`, the idempotent retry, with no write and no audit.
  - `current ≠ expected` raises `40001`, a stale view.
  - A disallowed transition raises `23514`.
  - Otherwise it updates and writes one audit event
    (`entity_type='registration_step_up', entity_id=registration_child_id`, from, to, and
    `registration_id`, **never the reference**).
  - It **never reads or writes `enrollments`**.
- **Review queue:** `public.admin_step_up_review_queue()` returns `setof` rows (admin only) with
  the registration child id, registration id, student preferred name, family id, state,
  `state_changed_at`, submitted time, and each selection's program id and enrollment state. The
  STEP UP reference is included for administrators only, because the matrix grants them the full
  record. The queue is ordered by the oldest non-terminal item first.

### 5.5 Educator safety subset (decision 2)

`public.educator_child_safety(target_program uuid)`, security definer, stable,
`search_path = ''`.

- The caller must hold `educator` **and** `private.is_assigned_educator(target_program)`.
  Otherwise, including for an unassigned or nonexistent program, it raises `42501`, identically.
  There is no enumeration oracle.
- It returns one row per **confirmed** enrollment in that program, the same narrowing as both
  roster views (MPS-RUL-003).
- Columns: `enrollment_id`, `preferred_name` (both already exposed by `educator_session_roster`),
  `safety_on_file boolean`, `has_allergies`, `allergy_details`, `emergency_contacts jsonb`
  ([{full_name, relationship, phone}]), `pickup_persons jsonb` ([{full_name, relationship,
  phone}]), and `recorded_at`.
- The source is the child's **most recent** registration submission, so an educator never sees
  superseded allergy data. It does not have to be the submission that selected this program.
- Never returned: guardian contacts, medical, accommodation, photo/video permission, signatures,
  acceptances, STEP UP rows, references, student id, family id, or payment state.
- **No RLS policy is added for educators on any `registration_*` table.** EXECUTE goes to
  `authenticated` only.

### 5.6 Document versioning and reacceptance (decision 4)

- The one-non-retired index is replaced by **at most one `approved` and at most one `draft`** per
  kind, so a new version can be drafted while the current one stays published.
- A new `private.presented_document_version(kind)` returns the approved version if one exists,
  and otherwise the draft (today, always the draft). Submission's stale check and the parent RLS
  policy both use it, so a draft in preparation is never shown to parents once an approved version
  exists.
- A guard trigger on versions:
  - `kind` and `id` never change.
  - Drafts may be edited (title, label, reference, hash) or move to `approved` or `retired`.
  - An approved version may only move to `retired`.
  - A retired version is frozen.
- Acceptances gain `document_sha256_at_acceptance text` (a snapshot). A later draft edit therefore
  cannot change what the evidence says was accepted.
- `registration_policy_satisfied(reg)` is redefined: true iff, for all three kinds, the
  registration has an acceptance of the **currently approved** version, made while it was approved.
  Publishing v2 retires v1, so v1 acceptances stop counting. That is the reacceptance trigger. It
  stays always false while the lock stands.
- `public.registration_documents_requiring_acceptance(reg)` (invoker; RLS applies) returns each
  kind whose presented version the registration has not accepted. It feeds `consent_state
  renewal_required`.
- `public.renew_registration_documents(target_registration, documents jsonb)` lets a
  **parent-role member of the registration's family** accept the presented version of one to three
  kinds. The body follows the same shape as submission (signature for the waiver and Code of
  Conduct, acknowledgment for the handbook). It covers every child of that registration and
  returns `renewed`, `already_current` (an idempotent retry, keyed by version), or
  `blocked_document_version_stale`. It writes one value-free audit event.
  - The acceptance uniqueness changes from `(registration_id, document_kind)` to
    `(registration_id, document_version_id)`.
  - The signer trigger changes from "the submitter" to "a parent in the registration's family".
    For the original submission those are the same person.
- `public.owner_publish_registration_document(target_version)`: **owner role only**
  (MPS-RUL-010, Samantha as content owner). The version must be a draft with `content_reference`
  and `content_sha256` both present. The function retires the current approved version, approves
  this one, and audits. While `registration_document_versions_approval_locked` stands, it returns
  **`blocked_approval_locked`** and writes nothing.
- **The lock is not lifted.** No approved source, content, hash, or approval evidence exists in the
  repository for any document, including the Liability Waiver (§12).

### 5.7 Media permission (decision 5)

No schema change. `registration_children.photo_video_permission boolean not null` is already a
required explicit choice, stored apart from signatures and acknowledgments. Only its column
comment is updated to cite DEC-030. The question text lives in the MDS pattern, marked
not-yet-approved for real families.

### 5.8 Retention (decision 6)

Documentation and table comments only. No column, job, or trigger is added. A DELETE cascade from
`students` and `families` still exists. Whether early deletion must be *prevented*, the maximum
period, the clock-start event, holds, surviving audit records, and the deletion authority all stay
open in GAP-016.

### 5.9 TypeScript

- `contract.ts`:
  - Adds `hasMedicalNeeds` and `hasAccommodationNeeds`, with details conditional as for allergies.
  - Requires at least one emergency contact and at least one pickup person.
  - Adds `planDaysPerWeek` to selections, and `blocked_attendance_unconfigured` to the outcomes.
  - Exports `STEP_UP_STATES`.
  - The mapping stays omission-based, so fingerprints remain stable.
- `repository.ts` is unchanged apart from the types.
- `database.types.ts` is regenerated **locally** (`npm run db:types:local`).

## 6. Final access matrix

| Data | anon | parent own family | parent other family | assigned educator (confirmed child, via RPC) | unassigned educator | admin / owner |
|---|---|---|---|---|---|---|
| submission, children, selections | — | read | — | — | — | read |
| guardian contacts (parent phone) | — | read | — | — | — | read |
| emergency contacts | — | read | — | name, relationship, phone | — | read |
| pickup persons | — | read | — | name, relationship, phone | — | read |
| allergy Yes/No + details | — | read | — | read | — | read |
| medical / accommodation | — | read | — | — | — | read |
| photo/video permission | — | read | — | — | — | read |
| acceptances, signatures | — | read | — | — | — | read |
| STEP UP state and reference | — | read | — | — | — | read; state change via RPC |
| document versions | — | presented version only | presented only | — | — | all; publish = owner only |
| attendance configuration | published programs | yes | yes | yes | yes | all; write via RPC |
| any direct table write | — | — | — | — | — | — |

## 7. Security, privacy, and data handling

- Identity, role, family, and assignment all come from `auth.uid()`.
- No new RPC accepts a family id, role, enrollment state, or payment state.
- Errors are path-only, and no audit event carries a name, phone, health text, signature, or
  reference.
- New `security definer` functions pin `search_path = ''`, revoke from PUBLIC, and grant EXECUTE
  to `authenticated` only.
- Sample-only locks all remain: `check (is_sample)`, `demo-unapproved-v0`, and the approval lock.
  STEP UP gains states but stays sample-only by table constraint.
- `db:advisors --local` is compared with the Slice 2 baseline.

## 8. MDS-GAP-010: registration pattern (specification only)

`mds/specification/DESIGN-SYSTEM.md` gets a new **§9.1 Family registration pattern**:

- One route and one atomic submission, laid out in the family-first section order from the
  request, with steps 1–8.
- Collapsible child cards and an "Add another child" action. A collapsed card shows a summary and
  its error count.
- Conditional details appear only after Yes. They are announced, linked through
  `aria-controls`/`aria-expanded`, and retained if toggled away but not submitted.
- Attendance: a fixed day renders as text, never as a control. Haven Days shows the plan choice
  and then that many day checkboxes. Tutoring shows the available-day checkboxes.
- Signature and acknowledgment are separate controls within `consent_state`, with version shown.
- The media question uses the exact approved wording and a neutral radio pair. Neither option is
  preselected.
- STEP UP versus external checkout: the handoff notice appears only for non-STEP-UP children.
- A new `step_up_review_state` presentation reuses the `enrollment_state` badge and inline panel
  sizes, with five variants whose meaning is fixed and whose labels are working labels.
- Behavior on submit failure: preserve all values, show an error summary, focus the first invalid
  section, open the collapsed card, and let `idempotency_key` reuse make retry safe.
- Loading, empty (no children yet), and blocked outcomes.
- Responsive rules at 4/8/12 columns: single column below 768 px, with the review summary moving
  from the side rail to the end.
- Keyboard use, 44 px targets, visible focus, and live-region announcements.

It is recorded as **MDS-DEC-023**, MDS-CHG-012, and a **minor version v1.2** (a backward-compatible
pattern addition, §13). `consent_state` gains an `acceptance_method: [signature, acknowledgment]`
specification. MDS-GAP-010 is **resolved at the specification level**. It carries a note that no
canonical visual reference exists yet and that rendered MDS validation is due in the UI slice. The
REFERENCE-INDEX and the MDS-IMPLEMENTATION required-pattern list are updated to match.

## 9. Responsive and accessibility

No UI is built. §8 carries the requirements forward to the registration UI slice.

## 10. Tests

**Update `160_…`**:

- Payload builders gain the medical and accommodation answers.
- The main fixture uses a Haven Days plan in place of free days on Ready Set Prep.
- The STEP UP child's enrollment now asserts `approval_pending`.
- Uniqueness assertions are renamed.
- All existing intents are kept.

**New `170_registration_readiness.test.sql`**:

- **Required information:**
  - guardian phone, and 0 emergency or 0 pickup contacts, are refused;
  - a missing or `null` allergy, medical, or accommodation answer is refused;
  - Yes without details is refused, and No with details is refused;
  - No without details is accepted;
  - a direct CHECK violation fails.
- **Atomic rollback:** a two-child payload whose second child fails validation leaves every row
  count unchanged.
- **Access:**
  - parent isolation holds;
  - admin reads everything;
  - the assigned educator gets only the subset columns, for confirmed children only, from the
    latest registration;
  - an unassigned educator, a nonexistent program, a parent, and anon get an identical denial;
  - the educator reads zero rows from every `registration_*` table, and the function's result
    column list is pinned.
- **STEP UP:**
  - each allowed transition succeeds and is audited;
  - each forbidden one fails;
  - a same-state retry returns `unchanged`, and a stale `expected_state` raises `40001`;
  - a parent or educator gets `42501`;
  - enrollment state is byte-identical before and after `verified`;
  - the enum is exactly five values;
  - a direct UPDATE of any other column fails;
  - the audit event carries no reference;
  - an instant program with STEP UP gives `approval_pending`, and the same program without it gives
    `started`;
  - the queue is admin only.
- **Attendance:**
  - Haven Days with 1, 2, or 3 days and the matching plan passes;
  - a plan/count mismatch, a duplicate day, Monday, or no plan fails;
  - Tutoring with a subset passes and Friday fails;
  - a fixed program with any days fails, and with none passes and snapshots the configured days;
  - an unconfigured published program gives `blocked_attendance_unconfigured`;
  - the admin RPC validates, audits, and is admin only;
  - anon can read the configuration of published programs only.

**New `180_registration_document_versions.test.sql`**:

- With the lock present, `owner_publish` returns `blocked_approval_locked`, writes nothing, and is
  owner only.
- Drafts stay presented, `registration_policy_satisfied` stays false, and renewal against the
  current draft works and is idempotent.
- Then, **inside this file's rolled-back transaction only**, the lock is dropped to exercise the
  mechanics:
  - publish v1 (satisfied after acceptance);
  - edit draft v2 (still satisfied; the sha snapshot is unchanged);
  - publish v2 (v1 retired, not satisfied; requiring-acceptance lists the kind);
  - renew (satisfied again);
  - an approved version is not editable;
  - parents see only the presented version;
  - the signer must be a family parent;
  - the audit carries no signature.
- A final assertion confirms that `170` and `160` each independently see the lock (that proves the
  drop never escaped its transaction).

**Unit:** `tests/registration-contract.test.mts` covers the new answers and conditionals, the
contact minimums, `planDaysPerWeek`, the new outcome, and `STEP_UP_STATES`.

## 11. Assumptions and risks

1. **Health rows:** `NOT NULL` fails the migration if any `registration_child_health` row exists.
   Local resets have none. The hosted project has had no document versions since the Slice 2 push
   (MTS-CHG-010), so no submission can have been made there. If one exists, the push fails loudly
   rather than inventing a "No".
2. **Ready Set Prep and Ready Set Learn** are mapped as **fixed Tuesday + Thursday** because their
   published schedule is "Tuesday and Thursday" at a weekly price. If families may attend one day
   only, this needs business input (see the approval question).
3. `programs.published_schedule` (text) and the new structured days can drift. The admin RPC does
   not rewrite the text. This is recorded as an MTS risk, and the admin UI slice should edit both
   together.
4. Educator safety data is limited to confirmed children, matching the rosters. A child in
   `approval_pending` who attends a trial would not appear. That is an open operational question
   routed to checklist §9.

## 12. Evidence missing (reported, not guessed)

| Document | Approved source in repo | Content / sha256 | Approval authority recorded | Approval evidence |
|---|---|---|---|---|
| Liability Waiver | no | no | Samantha named as content owner; no sign-off | none |
| Code of Conduct | no | no | none | none |
| Parent Handbook | no | no | none | none |
| Media-release language (checklist §8) | question wording decided (DEC-030) | — | no legal/content-owner approval | none |

The approval lock, `demo-unapproved-v0`, and `check (is_sample)` therefore all stay.

## 13. Checks (local stack only)

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`,
`npm run db:reset`, `npm run db:test`, `npm run db:types:local` then
`npm run db:types:check -- --local`, `npm run build`, and `npm run db:advisors` (the script
already passes `--local`).

There is no e2e sweep, because no UI or route changes (standing preference). The agent never uses
`--linked`, `db push`, a remote URL, or a Vercel command.

## 14. Rollback

**Code:** revert the PR.

**Database** (both migrations are local-only until the owner pushes; the second migration's
header carries the exact statements), in this order:

1. Drop the new RPCs and helpers.
2. Restore `submit_family_registration`, `registration_policy_satisfied`, and both
   `request_enrollment_core` and `family_request_enrollment` verbatim from `20260918120000`.
3. Restore the one-non-retired index, the acceptance uniqueness, the signer trigger, and the
   blanket STEP UP immutability trigger.
4. Drop the added columns and the three attendance tables and their enum.

**Enum values cannot be dropped in place.** A full rollback of
`step_up_verification_state` means recreating the type. That is safe only while no row uses the
new values, and that holds everywhere today.

## 15. Manual verification (WSL bash)

```bash
npm run db:reset && npm run db:test
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select p.name, r.selection_mode, array_agg(d.day order by d.day) from public.program_attendance_rules r join public.programs p on p.id=r.program_id join public.program_attendance_days d using (program_id) group by 1,2 order by 1;"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select enum_range(null::public.step_up_verification_state);"
# expect exactly: pending_verification, needs_information, verified, declined, canceled
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select conname from pg_constraint where conname='registration_document_versions_approval_locked';"
# expect one row: the lock stands
```

## 16. External setup for the owner (after merge)

- `supabase db push --linked` for the two migrations.
- `npm run db:types` (linked) to restore the hosted template.
- Re-seed the preview if hosted sample documents are wanted.

The agent does none of these.

## 17. Implementation notes (2026-09-19)

The prompt was approved as written, with all three approval questions answered as recommended:

- STEP UP resolves to `approval_pending`.
- Ready Set Prep and Ready Set Learn are fixed Tuesday and Thursday.

Deviations and findings during implementation:

- **Acceptance uniqueness is `(registration_id, document_version_id, document_status_at_acceptance)`**, not
  `(registration_id, document_version_id)` as §5.6 said. A draft the family accepted can later be published as
  that same version, and the draft-time acceptance must neither stand in for nor block acceptance of the published
  text. `renew_registration_documents` and `registration_documents_requiring_acceptance` compare the status too.
  `180_…` proves it ("acceptances made while the versions were drafts do not count once they are published").
- **`registration_document_versions_approval_paired` was replaced** by `…_approval_recorded`, which keeps a retired
  version's approval time. The Slice 2 check required `approved_at` to be null for any non-approved status, so
  retiring a published version would have had to erase when it was approved. The first run of the `180_…` mechanics
  test caught this. The old constraint is restored by rollback.
- The acceptance uniqueness constraint's real name is `registration_document_accepta_registration_id_document_kind_key`
  (identifier truncation). The migration drops it by that name.
- `00_setup.test.sql`'s anon-surface inventory now lists the three `program_attendance_*` tables. They are public
  facts of published programs, read through `programs` RLS.
- The MDS pattern uses MDS's own breakpoint for the review rail (it becomes inline below 1024 px, as the detail
  action rail does), not the 768 px written loosely in §8 of this prompt.
- There is no educator-safety fixture in `seed.sql`. The pgTAP files build their own, so the hosted preview gains no
  sample registration data from this slice.
