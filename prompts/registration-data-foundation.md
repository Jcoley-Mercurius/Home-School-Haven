# Implementation prompt — Slice 2: Registration policy and data foundation

Branch: `feat/registration-data-foundation`, created from `chore/preview-fixture-refresh` at
`9d27d68`. That commit is `origin/release/foundation-preview` (`d507f47`, the merged Slice 1
result, PRs #26 and #27) plus one MTS state-record commit. Requested 2026-09-18.
Nothing is merged, pushed, or applied to a hosted project by the agent.

## 1. Goal and scope

Build the smallest coherent, versioned, secure **database and server contract** for a future
one-step family registration that covers several children at once. This slice covers the backend,
security, and canonical state. **It does not build the registration UI.**

In scope:

1. restricted registration tables for the submission, children, health, contacts (guardian,
   emergency, pickup), program selections with attendance days, document versions, acceptance
   evidence, and STEP UP requests;
2. one atomic `security definer` mutation, `public.submit_family_registration(uuid, jsonb)`, with
   idempotency and duplicate protection;
3. deny-by-default RLS: family ownership plus administrator read, no educator access, nothing for
   `anon`;
4. sample-only enforcement at the constraint level on every new table;
5. a `server-only` TypeScript contract module (zod payload schema, types, and an RPC wrapper) with
   no route, page, server action, or form that reaches it;
6. pgTAP and unit tests, plus MPS, MDS, and MTS state updates.

**Out of scope:** registration UI, public signup (`[auth].enable_signup = false` stays),
email, checkout links, real-family activation, any legal, waiver, consent, refund, cancellation,
scholarship, medical, or media-release text, educator roster expansion, roster export, admin
mutation of registration records, STEP UP verification decisions, and any hosted deploy or
migration.

## 2. Ratified decisions (owner instruction of 2026-09-18) and how they are recorded

| Decision | Recorded as |
|---|---|
| Family accounts remain invite-only; no public signup | Unchanged (DEC-022) |
| Sensitive registration infrastructure may be built, but all new data stays enforceably sample-only | **MPS EXC-002**, scoped to REL-BETA-001. MPS-RUL-006 is **not** rewritten. It still governs what may be *collected from real families*, and EXC-002 permits only sample-only *infrastructure*. |
| Real-family activation stays blocked pending legal wording, retention and deletion, staff access, and production security verification | GAP-005 unchanged; new **GAP-014** (legal document text and approval) |
| STEP UP is a pending administrative-verification workflow. It is not payment, not a discount, and not confirmed enrollment. | **MPS DEC-025**; new **GAP-015** (STEP UP verification outcomes and their effect on checkout, which fall under GAP-010) |
| No invented legal or policy language | MPS-RUL-010, enforced by the document-approval lock in §5.4 |

## 3. Applicable IDs

- **MPS:** MPS-REQ-001, 002, 003, 004, 005, 006, 012, 014, 018, 021, 024;
  MPS-RUL-004, 006, 007, 008, 009, 010; MPS-ACC-002, 003, 004, 005, 006, 018, 022, 023, 028;
  MPS-WFL-002, MPS-WFL-003, MPS-WFL-004; DEC-017, DEC-022; GAP-005, GAP-010; EXC-001;
  checklist §6, §7, §8, §9, §11.
- **MDS:** `components.consent_state` (policy name and version, acceptance state, unresolved
  language stays blocked), `components.enrollment_state`, `page_patterns.consent`,
  `page_patterns.enrollment_handoff`, `forms`, MDS-DO-004. No UI is built, so no visual state
  changes. New **MDS-GAP-010** records the presentation states the future UI will need and MDS
  has not yet defined: the STEP UP pending-verification state, signature versus acknowledgment
  within `consent_state`, and the conditional allergy disclosure.
- **MTS:** SECURITY-ARCHITECTURE mandatory controls (server-derived identity, deny by default,
  least privilege, no sensitive values in logs, URLs, or fixtures, attributable history, retry
  safety); MTS-ARCHITECTURE-ADDENDUM (Supabase is the single system of record); MTS-QA Gates 2
  and 3.

## 4. Repository evidence inspected

- `supabase/migrations/*` (21 files). Relevant: `20260827212014` (roles, `private.is_admin`,
  `private.is_family_member`), `20260827212020` (append-only `audit_events`), `20260828010906` (bulk
  revoke; later tables must grant after their own DDL), `20260829120000` and `20260829140000`
  (`students`: `check (is_sample)`, `demo-unapproved-v0`, the lesson that a grant must come after
  all DDL), `20260829170000` (`enrollments`, `enrollment_state`, sample-only, audit trigger),
  `20260831000000` and `20260902000000` (`educator_roster_students` and `educator_session_roster`,
  the only educator paths to a child), `20260903000000` (`family_request_enrollment`, the
  MPS-REQ-012 evaluation), `20260916000000` (offering types).
- `supabase/seed.sql`: sample parents A–D, educator, admin; families A and B; guarded by
  `hsh_seed_environment in ('local','preview')`.
- `supabase/tests/database/*.test.sql` (18 pgTAP files; the pattern is `set local role` plus
  `request.jwt.claims`).
- `src/lib/enrollment/repository.ts`, `src/lib/family/validation.ts` (zod, the unit-test
  pattern), `src/lib/supabase/{server,types,database.types}.ts`, `tests/*.test.mts`
  (`node --test`).
- `package.json`: `db:types` and `db:types:check` both run `supabase gen types --linked`, against
  the hosted project (§11.1).
- `supabase/config.toml`: `[auth].enable_signup = false`; `private` is not an exposed schema.

## 5. Data model

A new migration, `supabase/migrations/20260918120000_family_registration_foundation.sql`. The
migration is additive. It changes one existing function body (§5.7) without changing that
function's behavior.

### 5.1 No second authority

- **Family:** always derived from `auth.uid()` through `family_members`. No table stores a family
  the caller supplied.
- **Student:** a child entry either references an existing `students.id` in the caller's family,
  or creates one through the same rules as `add_student_to_own_family` (preferred name, grade,
  guardian relationship; the case-insensitive name match is reused rather than duplicated).
  `students` gains **no** columns.
- **Program:** selections reference `programs.id`. Program, class, club, and tutoring are all
  `programs.offering_type`, so one foreign key covers them all.
- **Enrollment:** each selection creates its enrollment through the **same evaluation**
  `family_request_enrollment` uses, and stores `enrollment_id`. A selection has **no state of its
  own**. `enrollments.state` stays the one authority (MPS-REQ-014).

### 5.2 New types

- `registration_contact_kind`: `guardian`, `emergency`, `pickup`
- `attendance_day`: `monday` … `sunday`
- `registration_document_kind`: `liability_waiver`, `code_of_conduct`, `parent_handbook`
- `document_version_status`: `draft`, `approved`, `retired`
- `document_acceptance_method`: `signature`, `acknowledgment`
- `step_up_verification_state`: `pending_verification` **only**. Verified and declined outcomes,
  and what they change, are GAP-015/GAP-010 decisions. A later migration adds them with owner
  approval.

### 5.3 Tables

Each table has `is_sample boolean not null default true` plus `check (is_sample)`, and each table
has `created_at`.

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `registration_submissions` | One attributable submission | `family_id` → families (cascade), `submitted_by` → auth.users, `idempotency_key uuid`, `request_fingerprint text` (sha256 hex of the canonical payload), `authority_affirmation_version` = `'demo-unapproved-v0'` (CHECK), `submitted_at`. `unique (submitted_by, idempotency_key)`. |
| `registration_children` | One child in one submission | `registration_id`, `student_id` → students (cascade), `created_student boolean`, `photo_video_permission boolean not null`. `unique (registration_id, student_id)`, `unique (id, registration_id)`. Trigger: the student's family equals the submission's family. |
| `registration_child_health` | **Restricted.** Allergy, medical, accommodation | PK `registration_child_id`, `registration_id` (composite FK to children), `has_allergies boolean not null`, `allergy_details text`, `medical_information text`, `accommodation_information text`. `check (has_allergies = (allergy_details is not null))`. Lengths 1–1000. |
| `registration_contacts` | Guardian, emergency, and approved pickup people | `registration_id`, `contact_kind`, `full_name` (1–120), `relationship` (1–40; required for emergency and pickup), `phone` (7–32, `^[0-9+().\- ]+$`), `email` (guardian only, optional, ≤254), `is_submitter boolean`. Partial unique: one submitter row per registration, and the submitter must be a `guardian`. |
| `registration_selections` | A child's program choice | `registration_child_id`, `registration_id`, `program_id`, `enrollment_id` → enrollments (**unique**, cascade), `attendance_days attendance_day[] not null default '{}'` (distinct values, at most 7). `unique (registration_child_id, program_id)`. Trigger: the enrollment's student and program match the child and program. |
| `registration_document_versions` | A versioned legal document record | `document_kind`, `version_label` (1–40), `title` (1–160), `status`, `content_reference text` (nullable pointer to the approved source; **no body text is stored**), `content_sha256` (nullable, 64 hex), `approved_at`, `approved_by`. `unique (document_kind, version_label)`, `unique (id, document_kind)`, a partial unique index so each kind has at most one non-retired version, `check ((status = 'approved') = (approved_at is not null))`, and **`registration_document_versions_approval_locked check (status <> 'approved')`** (§5.4). |
| `registration_document_acceptances` | Acceptance evidence | `registration_id`, `document_version_id` plus `document_kind` (composite FK to versions, so the kind cannot disagree with the version), `acceptance_method`, `signer_user_id` → auth.users, `typed_signature` (1–120, nullable), `accepted_at`, `document_status_at_acceptance`. `unique (registration_id, document_kind)`. CHECK: `parent_handbook` ⇒ `acknowledgment` with a null signature, and `liability_waiver`/`code_of_conduct` ⇒ `signature` with a non-null signature. Trigger: `signer_user_id` equals the submission's `submitted_by`. |
| `registration_acceptance_children` | Children each acceptance covers | `(acceptance_id, registration_child_id)` PK; composite FKs keep both rows in the same registration. |
| `registration_step_up_requests` | STEP UP selection and reference | PK `registration_child_id`, `registration_id`, `reference text` (nullable, 1–64, **restricted**), `verification_state step_up_verification_state not null default 'pending_verification'`. No price, payment, discount, or enrollment column. |

**Immutability:** a `before update` trigger on every evidence table (submissions, children, health,
contacts, selections, acceptances, acceptance children, STEP UP) raises. Evidence is written once
by the function. `delete` is not blocked, because family and student removal cascades and deletion
policy is checklist §11 (unresolved). That gap is recorded rather than decided.

### 5.4 Placeholder documents can never qualify

- The `registration_document_versions_approval_locked` CHECK means **no approved version can be
  stored** until a future migration, carrying owner-approved text (GAP-014), drops it. This is the
  same enforceable pattern as `students_affirmation_unapproved`.
- Each acceptance snapshots `document_status_at_acceptance`, so evidence shows it was given
  against a draft.
- `public.registration_policy_satisfied(registration_id uuid) returns boolean` (security invoker,
  RLS applies) is true only if all three kinds were accepted against a version whose status is
  `approved`. Today it is **always false**. That is the hook a later eligibility check must use,
  and the tests prove it.
- `seed.sql` (local and preview only) inserts three **sample draft** versions titled, for example,
  "Sample liability waiver — draft, not approved", with `content_reference` null and **no body**.
  No legal text is written anywhere.

### 5.5 Roles and RLS (deny by default)

Grants are placed **after all DDL** in the migration (the DEFECT-FF1 lesson).
`authenticated` gets `SELECT` only. `anon` gets nothing. No client role gets
INSERT/UPDATE/DELETE on any new table.

A `private.can_read_registration(registration_id)` security-definer helper returns
`is_family_member(submission.family_id) or is_admin()`. `private` is not exposed.

| Data | anon | parent (own family) | parent (other family) | educator | admin/owner |
|---|---|---|---|---|---|
| submissions, children, selections | — | read | — | — | read |
| health (allergy, medical, accommodation) | — | read | — | — | read* |
| contacts (guardian, emergency, pickup) | — | read | — | — | read* |
| acceptances and covered children | — | read | — | — | read |
| STEP UP requests | — | read | — | — | read |
| document versions (non-retired) | — | read | read | — | read (all) |
| any write | — | only via `submit_family_registration` | — | — | none in this slice |
| `educator_roster_students` / `educator_session_roster` | unchanged: confirmed students, preferred name only, **no join to any registration table** |

\* Admin read of health and contacts is the default proposed here, and approval confirms or
changes it (§11.2). With sample data it lets the owner walkthrough demonstrate the administrative
view. Staff-access policy for real families remains an activation blocker (checklist §9).

### 5.6 The mutation contract: `public.submit_family_registration(idempotency_key uuid, payload jsonb)`

`security definer`, `set search_path = ''`. EXECUTE is granted to `authenticated` only.

It returns a table of `(outcome text, registration_id uuid, blocker_child_index int,
blocker_program_id uuid)`.

**Order of operations:**

1. `auth.uid()` must be present. The caller must have the `parent` role and belong to a family.
   Otherwise it raises `42501`. The family comes from the membership, never from the payload.
2. **Idempotency first.** If `(caller, key)` exists: when the fingerprint matches, the outcome is
   `replayed` and the original `registration_id` is returned. When it differs, the outcome is
   `idempotency_conflict`. Nothing is written in either case.
3. **Shape validation** runs in SQL on every field, including types, lengths, the allergy rule,
   and required keys. Unknown keys are refused. Failures raise `22023` with a **path-only**
   message such as `invalid registration payload: children[1].allergy_details`. **No value is ever
   echoed.** Limits: 1–10 children, 1–10 selections per child, ≤2 guardian contacts (exactly one
   submitter), ≤4 emergency contacts, ≤6 pickup persons. Whether emergency contacts or pickup
   persons are *required* is checklist §7, so the contract allows zero.
4. `authority_affirmed` must be `true`, or the outcome is `blocked_authority` (MPS-RUL-008).
5. **Documents:** the payload names the version id it showed for each of the three kinds. Each
   must be the current non-retired version of that kind. If it is not, the outcome is
   `blocked_document_version_stale`. If no current version exists, the outcome is
   `blocked_documents_unavailable`. The waiver and Code of Conduct require a typed signature.
   The handbook must **not** carry one; it is an acknowledgment flag.
6. **Atomic body** in one sub-block: insert the submission (a concurrent same-key race hits the
   unique index, then gets `replayed`), resolve or create each student, then write health,
   contacts, and STEP UP rows. Selections are processed **sorted by `program_id`**, so concurrent
   submissions lock program rows in a consistent order (deadlock safety). Each selection calls
   the shared enrollment core (§5.7). Any `blocked_unavailable`, `blocked_closed`,
   `blocked_full`, or `duplicate` result raises a private exception, which rolls back **every**
   row in the sub-block. The function then returns `blocked_<reason>` with the child index and
   program id. Next come the acceptances (signer = caller, `accepted_at = now()`, covering every
   child in the submission) and one audit event.
7. On success the outcome is `submitted`.

**Duplicate protection beyond the key:** a new idempotency key with the same children and
programs finds the existing enrollment and is refused as `blocked_duplicate`, with no rows
written. Students are matched by the existing family and name rule, so a child is never created
twice.

**STEP UP never implies payment or confirmation:** STEP UP rows are written with
`pending_verification` only, and the enrollment evaluation does not read STEP UP at all. An
enrollment's state is exactly what it would be without STEP UP (`approval_pending`, `started`, or
`waitlisted`). The core cannot write `confirmed`, `payment_pending`, `payment_failed`, or
`canceled`.

**Audit** (`audit_events`, `entity_type = 'registration'`, `action = 'submitted'`) stores only
counts, not values: `child_count`, `created_student_count`, `selection_count`, `contact_counts`
by kind, `step_up_count`, `document_version_ids`, and `is_sample`. The existing student and
enrollment triggers add their own value-free events. There are **no** names, phones, emails,
health text, signatures, STEP UP references, or fingerprints.

### 5.7 Shared enrollment core (refactor without behavior change)

The body of `family_request_enrollment` after its authorization and affirmation checks, meaning
the program lock, publication and closed checks, duplicate check, capacity and waitlist, and
confirmation mode, moves into `private.request_enrollment_core(caller, family, student, program)`.
`family_request_enrollment` keeps its signature, authorization, and affirmation checks and calls
the core. The existing 39 assertions in `110_family_conversion_journey.test.sql` must pass
unchanged. That proves the refactor. The alternative, a second copy of the eligibility rules
inside the registration function, would drift.

### 5.8 TypeScript contract (no UI)

- `src/lib/registration/contract.ts`: pure. It holds the zod schema mirroring §5.6 (camelCase to
  snake_case mapping), payload types, limits, `AFFIRMATION_VERSION` reuse, outcome parsing, and
  `describeRegistrationError()`, which returns only fixed sentences and never includes input.
- `src/lib/registration/repository.ts`: `import "server-only"`. It exposes
  `submitFamilyRegistration(input, idempotencyKey)`, which validates and then calls the RPC through
  the cookie-bound server client (never the secret key), and maps the result. It does not log.
  Nothing imports it yet, and no route, page, or server action exposes it.
- `src/lib/supabase/database.types.ts`: regenerated from the **local** stack (§11.1).

## 6. Security, privacy, and data handling

- Identity, role, and family come from `auth.uid()`. Client-supplied family ids, roles, states,
  payment status, verification state, and admin flags have nowhere to go. The payload schema
  rejects unknown keys.
- A forged `student_id` from another family, and one that never existed, get the identical
  `42501` response (no membership oracle, matching `family_request_enrollment`).
- Sensitive values stay out of audit payloads, error messages, URLs (the RPC body is POST), logs,
  and analytics (none on authenticated routes). Fixtures use obviously fake values (`Sample …`,
  `555-0100`).
- The educator paths are unchanged. Tests assert that the educator reads zero rows from every new
  table and that both roster views keep their existing column lists.
- Sample-only is enforced in four places: `check (is_sample)` on every table, the affirmation
  version CHECK, the document approval lock, and STEP UP limited to `pending_verification`. All
  three written locks must be removed by an owner-approved migration before real data can exist.

## 7. Responsive and accessibility

No UI is built in this slice. The future registration UI inherits MDS `forms`, `consent_state`,
and `enrollment_state`, plus MDS-GAP-010.

## 8. Tests

**pgTAP: new `160_family_registration_foundation.test.sql`**

- privileges: `anon` has nothing on any new table or function; `authenticated` has SELECT only; no
  client role has INSERT, UPDATE, or DELETE; EXECUTE on the submit function goes to
  `authenticated` only;
- anonymous: cannot read or execute;
- cross-family: parent B reads zero of parent A's rows in every table; parent B referencing
  A's student gets `42501`; a nonexistent student gets the identical `42501`; a payload carrying
  `family_id`, `role`, `state`, `verification_state`, or `payment_state` keys is refused;
- educator: zero rows in every new table; cannot execute the submit function (not a parent); the
  roster view column lists are unchanged;
- admin: reads every registration table; cannot insert, update, or delete any of them; cannot
  submit a registration (not a parent);
- atomicity: a two-child submission whose second selection targets a full, no-waitlist program
  returns `blocked_full` with `blocker_child_index = 1`, and the row counts of submissions,
  children, students, health, contacts, selections, enrollments, acceptances, and STEP UP are
  unchanged;
- idempotency: the same key and payload returns `replayed` with the same id and identical row
  counts; the same key with a different payload returns `idempotency_conflict` with nothing
  written; a new key with the same children and programs returns `blocked_duplicate`;
- allergy: `has_allergies = false` with details is refused; `true` without details is refused; a
  direct insert (as `postgres`) violating the CHECK fails;
- the handbook acknowledgment carries no signature; a handbook entry carrying a signature is
  refused; the waiver or Code of Conduct without a signature is refused;
- the Code of Conduct acceptance has `signer_user_id` = the submitting parent, and the signer
  trigger refuses any other user;
- acceptance rows keep `document_version_id`, `document_status_at_acceptance = 'draft'`, and a
  non-null `accepted_at`, and cover every child;
- drafts never qualify: inserting an `approved` version fails; `registration_policy_satisfied`
  is false after a full submission; a retired or stale version id gives
  `blocked_document_version_stale`;
- STEP UP: the row is `pending_verification`; the enum has exactly one value; enrollment states
  created alongside are in (`approval_pending`, `started`, `waitlisted`) and match an identical
  submission without STEP UP;
- audit: the registration event exists with the actor, and `changed_fields::text` contains none
  of the submitted names, phones, emails, allergy, medical, or accommodation text, the typed
  signatures, or the STEP UP reference;
- sample-only: inserting `is_sample = false` fails on every new table, and the update-immutability
  triggers raise;
- `110_family_conversion_journey.test.sql` passes unchanged (proof of the refactor), and
  `00_setup.test.sql` is extended if its grant inventory lists tables.

**Unit: new `tests/registration-contract.test.mts`**

Schema accept and refuse cases, the allergy conditional, unknown-key refusal, the camel-to-snake
mapping, limits, the handbook refusing a signature, outcome parsing, and
`describeRegistrationError` never containing input values.

## 9. Checks (local stack only)

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`,
`npm run db:reset`, `npm run db:test`, the types check (§11.1), `npm run build`, and
`npm run db:advisors` (local). No e2e sweep: no UI or route changes (standing preference). Never
`--linked`, `db push`, a remote `--db-url`, or hosted credentials.

## 10. Rollback

The migration header carries the rollback: drop the submit function,
`registration_policy_satisfied`, the private helpers and triggers, the nine tables in dependency
order, and the six types; then restore `family_request_enrollment` verbatim from
`20260903000000_family_conversion_journey.sql` and drop `private.request_enrollment_core`. There is
no hosted data to preserve. The migration is unapplied anywhere but local, so nothing destructive
touches existing records. Enrollments created by registrations are ordinary sample enrollments,
and they are deleted with their sample students on a reset. Code rollback means reverting the
branch.

## 11. Decisions requested with this approval

1. **Database types check.** `npm run db:types` and `db:types:check` generate from the
   **linked hosted** project. That conflicts with "local only; never hosted credentials", and it
   would report drift anyway because the hosted project will not have this migration. Proposed:
   add a `--local` mode to both scripts (`npm run db:types -- --local`,
   `npm run db:types:check -- --local`), which use `supabase gen types --local`; use only that
   mode in this slice; and leave the linked default untouched for the owner's post-push check.
2. **Administrator read of health and contacts** (sample data): proposed **read-only**, as in
   §5.5. The alternative is family-only reach, with admins seeing only the submission envelope,
   selections, acceptance evidence, and STEP UP state until the staff-access policy exists.

## 12. Remaining policy blockers (recorded, not decided)

Legal text and approval for all three documents (GAP-014); the media-release language behind the
photo and video Yes/No (checklist §8); whether emergency contacts and pickup persons are required
(§7); purpose, viewers, retention, and deletion for each sensitive field (§7, §11); staff access
(§9); STEP UP verification outcomes and their effect on checkout (GAP-015, GAP-010); validation
of attendance days against a program's published days (the schedule is free text today); and the
renewal rules for a new document version (MPS-RUL-009).

## 13. Manual verification steps (WSL bash)

```bash
npm run db:reset
npm run db:test
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select document_kind, status from public.registration_document_versions;"
# expect three rows, all draft
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "insert into public.registration_document_versions (document_kind, version_label, title, status, approved_at) values ('parent_handbook','x','x','approved',now());"
# expect: violates check constraint registration_document_versions_approval_locked
```

## 14. Implementation notes (2026-09-18)

Approved as written, with both §11 decisions taken as recommended: the local types mode and
administrator read-only access.

- **Types script naming:** the local generator is `npm run db:types:local`, a separate script,
  rather than `npm run db:types -- --local`. `db:types` is a shell pipeline, so a trailing `--local`
  would reach `apply-db-types.mjs`, not the CLI. The check is `npm run db:types:check -- --local`,
  as proposed.
- **Template drift:** local CLI v2.111.0 omits `__InternalSupabase.PostgrestVersion` and
  parenthesizes five generic helpers differently from the hosted generator. The committed file is
  the local output, and `typecheck` passes. After the owner pushes, `npm run db:types` (linked)
  restores the hosted template.
- **Payload shape:** documents are keyed by kind (`liability_waiver`, `code_of_conduct`,
  `parent_handbook`). The handbook object allows only `version_id` and `acknowledged`, so a
  handbook "signature" is refused as an unknown field. STEP UP is `{selected, reference?}`.
- **Delete behavior:** `submitted_by`, `signer_user_id`, and `approved_by` are
  `on delete restrict`. Deleting an auth user who has submitted a registration is refused rather
  than silently erasing evidence. The only app path that deletes users (invitation cleanup)
  deletes accounts that never accepted, so they never reach a registration. Deletion policy stays
  GAP-016.
- **Blocked submissions are not recorded:** a `blocked_*` outcome rolls back the submission
  itself, so the same idempotency key can be retried once the blocker clears.
