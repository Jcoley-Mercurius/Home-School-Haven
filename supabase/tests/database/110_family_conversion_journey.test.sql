-- Foundation Release — the family-side conversion journey
-- (MPS-REQ-012, MPS-REQ-013, MPS-REQ-014, MPS-RUL-001, MPS-RUL-002,
--  MPS-RUL-008, MPS-RUL-010; MPS-ACC-002, 018, 019, 020, 021, 022, 023)
--
-- WHAT THIS FILE IS FOR
--
-- `src/app/(portal)/family/enroll/*` decides what a parent is OFFERED. This
-- file decides what the database does when asked directly — by a forged
-- PostgREST request, by a future refactor that drops a guard, or by anyone with
-- an authenticated session. Every eligibility rule MPS-REQ-012 names is
-- asserted here, because this is the layer that holds when no page is involved.
--
-- Six things are proven:
--
--   1. `public.enrollments` still has no client write privilege. The function
--      is the only door, and it did not quietly open a second one.
--   2. The function refuses a caller who is not a parent of the student — and
--      says nothing about whether that student exists.
--   3. Guardian authority is required before anything is recorded (MPS-RUL-008,
--      MPS-ACC-002), and no row is written when it is missing (MPS-ACC-018).
--   4. Each MPS-WFL-003 path resolves to its approved state: approval-required
--      to `approval_pending` (MPS-ACC-019), full-with-waitlist to `waitlisted`
--      (MPS-ACC-020), eligible-and-instant to `started` (MPS-ACC-021),
--      full-without-waitlist to a refusal.
--   5. A retry creates no second row and no second registration (MPS-REQ-014,
--      MPS-ACC-023).
--   6. The function CANNOT produce `confirmed`, `payment_pending`,
--      `payment_failed`, or `canceled` on any path. Those stay administrator
--      decisions, and a parent action must never reach them.
--
-- And one policy rule: no row it writes may claim approved consent language was
-- accepted (MPS-RUL-010, MPS GAP-005).

begin;
create extension if not exists pgtap with schema extensions;

select plan(39);

\set parent_a  '20000000-0000-4000-8000-00000000000a'
\set parent_b  '20000000-0000-4000-8000-00000000000b'
\set educator  '20000000-0000-4000-8000-00000000000e'
\set admin     '20000000-0000-4000-8000-000000000ad0'

\set student_a1 '40000000-0000-4000-8000-000000000001'
\set student_a2 '40000000-0000-4000-8000-000000000002'
\set student_b1 '40000000-0000-4000-8000-000000000003'

-- administrator_approval, no capacity — the MPS-ACC-019 target.
\set p_approval  '10000000-0000-4000-8000-000000000001'
-- instant, no capacity — the MPS-ACC-021 target.
\set p_instant   '10000000-0000-4000-8000-000000000006'
-- instant, capacity 1 taken, waitlist ON — the MPS-ACC-020 target.
\set p_waitlist  '10000000-0000-4000-8000-000000000008'
-- instant, capacity 1 taken, waitlist OFF — full without waitlist.
\set p_full      '10000000-0000-4000-8000-000000000003'
-- Never published.
\set p_draft     '10000000-0000-4000-8000-0000000000ff'


-- ===========================================================================
-- 1. PRIVILEGES — the table stayed shut
-- ===========================================================================
-- The whole design rests on this: a parent reaches the function or nothing. If
-- a future migration grants INSERT here, every rule below becomes bypassable
-- and these assertions are what says so.

select ok(
  not has_table_privilege('authenticated', 'public.enrollments', 'INSERT'),
  'authenticated holds no INSERT on enrollments'
);
select ok(
  not has_table_privilege('authenticated', 'public.enrollments', 'UPDATE'),
  'authenticated holds no UPDATE on enrollments'
);
select ok(
  not has_table_privilege('anon', 'public.enrollments', 'INSERT'),
  'anon holds no INSERT on enrollments'
);
select ok(
  not has_function_privilege(
    'anon', 'public.family_request_enrollment(uuid, uuid, boolean)', 'EXECUTE'),
  'anon cannot execute family_request_enrollment'
);

-- MPS-RUL-001: two modes, and exactly two. A third would be a policy nobody
-- approved.
select is(
  (select count(*)::int from pg_enum e
     join pg_type t on t.oid = e.enumtypid
    where t.typname = 'program_confirmation_mode'),
  2,
  'program_confirmation_mode has exactly the two approved values'
);
select is(
  (select confirmation_mode::text from public.programs
    where slug = 'ready-set-prep-and-learn'),
  'administrator_approval',
  'an unconfigured program defaults to administrator approval'
);


-- ===========================================================================
-- 2. AUTHORIZATION — not this student's parent
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

-- A direct insert, even by a parent enrolling their own child in a real
-- program. The privilege is gone; the policy never gets consulted.
select throws_ok(
  format(
    $$ insert into public.enrollments (family_id, student_id, program_id)
       select family_id, %L, %L from public.students where id = %L $$,
    :'student_a1', :'p_instant', :'student_a1'),
  '42501',
  null,
  'a parent cannot insert an enrollment directly through the Data API'
);

-- Family B's child. This raises rather than returning an outcome: a refusal
-- that named the reason would confirm the student exists.
select throws_ok(
  format($$ select * from public.family_request_enrollment(%L, %L, true) $$,
         :'student_b1', :'p_instant'),
  '42501',
  null,
  'a parent cannot register another family''s student'
);

-- A student id that never existed produces the SAME refusal. The two must be
-- indistinguishable, or the error message becomes a membership oracle.
select throws_ok(
  format($$ select * from public.family_request_enrollment(%L, %L, true) $$,
         '40000000-0000-4000-8000-0000000000ff', :'p_instant'),
  '42501',
  null,
  'a nonexistent student is refused identically to another family''s student'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok(
  format($$ select * from public.family_request_enrollment(%L, %L, true) $$,
         :'student_a1', :'p_instant'),
  '42501',
  null,
  'an educator cannot register a student'
);


-- ===========================================================================
-- 3. GUARDIAN AUTHORITY — MPS-RUL-008, MPS-ACC-002, MPS-ACC-018
-- ===========================================================================
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select outcome from public.family_request_enrollment(
     :'student_a2', :'p_instant', false)),
  'blocked_authority',
  'a registration without guardian authority is blocked'
);
select is(
  (select count(*)::int from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_instant'),
  0,
  'a blocked registration records nothing at all'
);
-- A NULL affirmation is not an affirmation. `is not true` is the check, so a
-- missing argument cannot slip through as anything but a refusal.
select is(
  (select outcome from public.family_request_enrollment(
     :'student_a2', :'p_instant', null)),
  'blocked_authority',
  'a null affirmation is treated as no affirmation'
);


-- ===========================================================================
-- 4. PROGRAM STATE — nothing unpublished is registerable
-- ===========================================================================
select is(
  (select outcome from public.family_request_enrollment(
     :'student_a2', :'p_draft', true)),
  'blocked_unavailable',
  'a draft program cannot be registered for'
);
select is(
  (select count(*)::int from public.enrollments where program_id = :'p_draft'),
  0,
  'a refused draft registration records nothing'
);


-- ===========================================================================
-- 5. MPS-ACC-019 — approval-required becomes approval_pending, not confirmed
-- ===========================================================================
select is(
  (select outcome from public.family_request_enrollment(
     :'student_a2', :'p_approval', true)),
  'approval_pending',
  'a valid registration for an approval-required program is approval_pending'
);
select is(
  (select state::text from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_approval'),
  'approval_pending',
  'the stored state is approval_pending, never confirmed and never paid'
);
select is(
  (select count(*)::int from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_approval'
      and state in ('confirmed', 'payment_pending')),
  0,
  'no approval-required registration is confirmed or marked paid'
);

-- MPS-REQ-003 and MPS-RUL-010: an affirmation is recorded, with its version and
-- its time, and the version says it is unapproved because it is.
select is(
  (select authority_affirmation_version from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_approval'),
  'demo-unapproved-v0',
  'the recorded affirmation version claims no approved consent language'
);
select ok(
  (select authority_affirmed_at is not null from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_approval'),
  'the affirmation carries an acceptance time (MPS-REQ-003)'
);
select is(
  (select requested_by::text from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_approval'),
  :'parent_a',
  'the registration is attributable to the parent who made it (MPS-REQ-024)'
);

-- MPS-REQ-024's assertion for this insert lives in §11, as an administrator:
-- `audit_events` is readable by administrators, not by families, which is
-- itself the boundary working.


-- ===========================================================================
-- 6. MPS-ACC-023 — a retry creates nothing
-- ===========================================================================
select is(
  (select outcome from public.family_request_enrollment(
     :'student_a2', :'p_approval', true)),
  'duplicate',
  'a repeated registration reports the existing one'
);
select is(
  (select count(*)::int from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_approval'),
  1,
  'a repeated registration creates no second row'
);
select is(
  (select state from public.family_request_enrollment(
     :'student_a2', :'p_approval', true))::text,
  'approval_pending',
  'the duplicate outcome carries the existing state, not a new one'
);


-- ===========================================================================
-- 7. MPS-ACC-020 — full with waitlist, and no payment collected
-- ===========================================================================
select is(
  (select outcome from public.family_request_enrollment(
     :'student_a2', :'p_waitlist', true)),
  'waitlisted',
  'a full waitlist-enabled program yields a waitlisted enrollment'
);
select is(
  (select state::text from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_waitlist'),
  'waitlisted',
  'the stored state is waitlisted'
);
select is(
  (select count(*)::int from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_waitlist'
      and state in ('payment_pending', 'confirmed', 'started')),
  0,
  'a waitlist placement collects no payment and starts no checkout'
);


-- ===========================================================================
-- 8. Full without a waitlist — MPS-WFL-003 alternate path
-- ===========================================================================
select is(
  (select outcome from public.family_request_enrollment(
     :'student_a2', :'p_full', true)),
  'blocked_full',
  'a full program without a waitlist refuses rather than inventing one'
);
select is(
  (select count(*)::int from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_full'),
  0,
  'a full-without-waitlist refusal records nothing'
);


-- ===========================================================================
-- 9. MPS-ACC-021 — eligible and instant reaches `started`, and only that
-- ===========================================================================
select is(
  (select outcome from public.family_request_enrollment(
     :'student_a2', :'p_instant', true)),
  'started',
  'an eligible registration for an instant-confirmation program is started'
);
select is(
  (select state::text from public.enrollments
    where student_id = :'student_a2' and program_id = :'p_instant'),
  'started',
  'the stored state is started — payment is pending nothing and confirms nothing'
);

-- The rule the whole release rests on. Across every path exercised above, this
-- function has produced no state that could be read as payment or as
-- confirmation.
select is(
  (select count(*)::int from public.enrollments
    where requested_by = :'parent_a'
      and state in ('confirmed', 'payment_pending', 'payment_failed', 'canceled')),
  0,
  'no parent-created enrollment is confirmed, paid, failed, or canceled'
);


-- ===========================================================================
-- 10. CAPACITY IS NOT ZERO — a program with no established capacity is not full
-- ===========================================================================
-- MPS-RUL-002: NULL capacity means "not established", which is a different
-- claim from "no places". Treating it as zero would close every program Home
-- School Haven has not measured.
select ok(
  (select capacity is null from public.programs where id = :'p_instant'),
  'the instant-confirmation fixture has no established capacity'
);
select is(
  (select outcome from public.family_request_enrollment(
     :'student_a1', :'p_instant', true)),
  'started',
  'a program with no established capacity is never treated as full'
);


-- ===========================================================================
-- 11. CONFIRMATION MODE IS ADMINISTRATOR-ONLY (MPS-RUL-005)
-- ===========================================================================
select throws_ok(
  format($$ update public.programs set confirmation_mode = 'instant'
             where id = %L $$, :'p_approval'),
  '42501',
  null,
  'a parent cannot change how a program confirms registrations'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';
select lives_ok(
  format(
    $$ select public.admin_update_program_facts(
         %L, (select updated_at from public.programs where id = %L),
         'Ready Set Prep & Learn', '', '', '', '', '', '', '', '', '', '',
         'unknown', '', 'instant') $$,
    :'p_approval', :'p_approval'),
  'an administrator can set a program''s confirmation mode'
);
select is(
  (select confirmation_mode::text from public.programs where id = :'p_approval'),
  'instant',
  'the confirmation mode was stored'
);
-- MPS-REQ-024: the family's own registration reached the audit trail. Asserted
-- here because only an administrator may read `audit_events`.
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'enrollment' and action = 'created'
      and entity_id = (select id from public.enrollments
                        where student_id = :'student_a2'
                          and program_id = :'p_approval')),
  1,
  'a family registration is recorded in attributable history'
);
-- MPS-REQ-024 names it material, so the change is in the history.
select ok(
  (select count(*) > 0 from public.audit_events
    where entity_type = 'program' and entity_id = :'p_approval'
      and changed_fields ? 'confirmation_mode'),
  'a confirmation-mode change is recorded in attributable history'
);

select * from finish();
rollback;
