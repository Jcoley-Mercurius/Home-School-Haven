-- Foundation Release — authorized administrator program and enrollment writes
-- (MPS-REQ-016, MPS-REQ-017, MPS-REQ-020, MPS-REQ-024;
--  MPS-RUL-004, MPS-RUL-005; MPS-ACC-026, MPS-ACC-027)
--
-- WHAT THIS FILE IS FOR
--
-- `src/lib/admin/*` and the server actions in `src/app/(portal)/admin/*` decide
-- what an administrator is *offered*. This file decides what the database will
-- actually do when asked directly — by a forged request, by a future refactor
-- that forgets a guard, or by anyone with an authenticated session and a
-- PostgREST client. Every rule the product depends on is asserted here, because
-- this is the layer that holds when no application code is involved.
--
-- Four things are proven:
--
--   1. No client role can write `programs` or `enrollments` through the table
--      at all. After `20260830090000`, the only write path is a function.
--   2. Those functions refuse every caller who is not an administrator —
--      including a caller whose editable JWT metadata claims to be one.
--   3. The approved transition tables are enforced in SQL, not only in the UI.
--      Every refusal in §8 of `prompts/admin-program-enrollment-operations.md`
--      is asserted, not assumed.
--   4. Concurrency and idempotency behave: a stale token is refused, and a
--      repeat submission writes nothing and records nothing.
--
-- And one privacy rule: `state_note` is administrator free text and must never
-- reach `audit_events`, which records enum labels only.

begin;
create extension if not exists pgtap with schema extensions;

select plan(61);

\set admin    '20000000-0000-4000-8000-000000000ad0'
\set parent_a '20000000-0000-4000-8000-00000000000a'
\set educator '20000000-0000-4000-8000-00000000000e'
\set norole   '20000000-0000-4000-8000-0000000000f0'

-- The draft the educator is assigned to. Assignment grants read, never write.
\set draft    '10000000-0000-4000-8000-0000000000ff'
\set art_lab  '10000000-0000-4000-8000-000000000004'

-- Seed enrollments, by state.
\set e_paypending '50000000-0000-4000-8000-000000000001'
\set e_confirmed  '50000000-0000-4000-8000-000000000002'
\set e_approval   '50000000-0000-4000-8000-000000000003'
\set e_waitlisted '50000000-0000-4000-8000-000000000004'


-- ===========================================================================
-- 1. PRIVILEGES — no client role holds a write verb on either table
-- ===========================================================================
-- The `programs` grants are the ones this migration removed. If a future
-- migration re-grants them, the transition rules below become bypassable and
-- these four assertions are what says so.

select ok(
  not has_table_privilege('authenticated', 'public.programs', 'INSERT'),
  'authenticated holds no INSERT on programs'
);
select ok(
  not has_table_privilege('authenticated', 'public.programs', 'UPDATE'),
  'authenticated holds no UPDATE on programs'
);
select ok(
  not has_table_privilege('authenticated', 'public.programs', 'DELETE'),
  'authenticated holds no DELETE on programs'
);
select ok(
  not has_table_privilege('anon', 'public.programs', 'UPDATE'),
  'anon holds no UPDATE on programs'
);
select ok(
  not has_table_privilege('authenticated', 'public.enrollments', 'UPDATE'),
  'authenticated holds no UPDATE on enrollments'
);
select ok(
  not has_table_privilege('authenticated', 'public.enrollments', 'INSERT'),
  'authenticated holds no INSERT on enrollments'
);
select ok(
  not has_table_privilege('authenticated', 'public.enrollments', 'DELETE'),
  'authenticated holds no DELETE on enrollments'
);

-- Reads are unchanged. This migration removed privilege; it must not have
-- removed the reach the operations pages depend on.
select ok(
  has_table_privilege('authenticated', 'public.programs', 'SELECT'),
  'authenticated still reads programs'
);
select ok(
  has_table_privilege('anon', 'public.programs', 'SELECT'),
  'public program discovery still works'
);


-- ===========================================================================
-- 2. ADMINISTRATOR — the approved operations succeed
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- A direct table write is refused even for an administrator, because the
-- privilege is gone. The RLS policy still says admins may; the grant says
-- nobody may reach it. Least privilege beating an over-broad policy is the
-- whole point of the revoke.
select throws_ok(
  $$ update public.programs set name = 'Renamed' where slug = 'art-lab' $$,
  '42501',
  null,
  'an administrator cannot write programs directly through the Data API'
);
select throws_ok(
  $$ update public.enrollments set state = 'confirmed'
       where id = '50000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'an administrator cannot write enrollments directly through the Data API'
);

-- Create draft.
select lives_ok(
  $$ select public.admin_create_program_draft('Sample New Draft', 'sample-new-draft') $$,
  'an administrator can create a program draft'
);
select is(
  (select publication_state::text from public.programs
    where slug = 'sample-new-draft'),
  'draft',
  'a new program is a draft, never published on creation'
);
-- Every published fact stays NULL. A created program must claim nothing.
select is(
  (select count(*)::int from public.programs
    where slug = 'sample-new-draft'
      and published_price is null and published_dates is null
      and published_schedule is null and audience is null),
  1,
  'a new draft publishes no fact it was not given'
);
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'program' and action = 'created'
      and actor_user_id = :'admin'::uuid),
  1,
  'creating a program records attributable history'
);

-- Duplicate slug.
select throws_ok(
  $$ select public.admin_create_program_draft('Another', 'sample-new-draft') $$,
  '23505',
  null,
  'a duplicate web address is refused'
);
-- Malformed slug: the database repeats the rule the form states.
select throws_ok(
  $$ select public.admin_create_program_draft('Bad', 'Not A Slug') $$,
  '22023',
  null,
  'a slug that could not appear in a URL is refused'
);

-- Publication transitions.
select is(
  public.admin_set_program_publication(
    :'draft'::uuid, 'published',
    (select updated_at from public.programs where id = :'draft'::uuid)),
  'updated',
  'an administrator can publish a draft (MPS-RUL-005)'
);
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'program' and action = 'updated'
      and changed_fields ? 'publication_state'
      and actor_user_id = :'admin'::uuid),
  1,
  'publishing records attributable history (MPS-ACC-026)'
);

-- Idempotency: the same target again writes nothing and audits nothing.
select is(
  public.admin_set_program_publication(
    :'draft'::uuid, 'published',
    (select updated_at from public.programs where id = :'draft'::uuid)),
  'unchanged',
  'republishing an already-published program is a no-op'
);
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'program' and action = 'updated'
      and changed_fields ? 'publication_state'),
  1,
  'a no-op publication writes no second audit row'
);

-- Publishing requires a summary (MPS-ACC-008/009). `sample-new-draft` was
-- created without one.
select throws_ok(
  $$ select public.admin_set_program_publication(
       (select id from public.programs where slug = 'sample-new-draft'),
       'published',
       (select updated_at from public.programs where slug = 'sample-new-draft')) $$,
  '22023',
  null,
  'a program with no summary cannot be published'
);

-- Archived cannot go straight to published: restoring must not publish.
select lives_ok(
  $$ select public.admin_set_program_publication(
       (select id from public.programs where slug = 'sample-new-draft'),
       'archived',
       (select updated_at from public.programs where slug = 'sample-new-draft')) $$,
  'an administrator can archive a program'
);
select throws_ok(
  $$ select public.admin_set_program_publication(
       (select id from public.programs where slug = 'sample-new-draft'),
       'published',
       (select updated_at from public.programs where slug = 'sample-new-draft')) $$,
  '23514',
  null,
  'an archived program cannot be published without first being restored'
);

-- Stale concurrency token.
select throws_ok(
  $$ select public.admin_set_program_publication(
       '10000000-0000-4000-8000-0000000000ff', 'draft',
       '2000-01-01T00:00:00Z'::timestamptz) $$,
  '40001',
  null,
  'a publication change against a stale row is refused'
);

-- Program facts, including the checkout-URL rule.
select is(
  public.admin_update_program_facts(
    :'art_lab'::uuid,
    (select updated_at from public.programs where id = :'art_lab'::uuid),
    'Art Lab', 'A sample summary.', '', '', '', '', '', '', '', '', '',
    'limited', 'https://pay.homeschoolhaven.org/art-lab',
    'administrator_approval'),
  'updated',
  'an administrator can save program facts and the approved checkout link'
);
-- Cleared facts become NULL, never the empty string: NULL is "not published".
select is(
  (select audience from public.programs where id = :'art_lab'::uuid),
  null,
  'a cleared published fact is stored as NULL, not as an empty string'
);
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-000000000004',
       (select updated_at from public.programs
          where id = '10000000-0000-4000-8000-000000000004'),
       'Art Lab', '', '', '', '', '', '', '', '', '', '',
       'unknown', 'https://evil.example.com/pay', 'administrator_approval') $$,
  '22023',
  null,
  'a checkout link to any other host is refused'
);
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-000000000004',
       (select updated_at from public.programs
          where id = '10000000-0000-4000-8000-000000000004'),
       'Art Lab', '', '', '', '', '', '', '', '', '', '',
       'unknown', 'https://pay.homeschoolhaven.org/x?student=abc',
       'administrator_approval') $$,
  '22023',
  null,
  'a checkout link carrying a query string is refused (no private data in URLs)'
);
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-000000000004',
       '2000-01-01T00:00:00Z'::timestamptz,
       'Art Lab', '', '', '', '', '', '', '', '', '', '',
       'unknown', '', 'administrator_approval') $$,
  '40001',
  null,
  'a facts save against a stale row is refused'
);
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-00000000dead',
       now(), 'X', '', '', '', '', '', '', '', '', '', '', 'unknown', '',
       'administrator_approval') $$,
  'P0002',
  null,
  'a program id that matches nothing is reported as not found'
);


-- ===========================================================================
-- 3. ENROLLMENT TRANSITIONS — the approved table, enforced in SQL
-- ===========================================================================

-- Allowed: payment_pending → confirmed. This is the administrator's decision,
-- and it asserts nothing about a payment (GAP-ADMIN-002).
select is(
  public.admin_set_enrollment_state(
    :'e_paypending'::uuid, 'confirmed', 'Sample reason.',
    (select updated_at from public.enrollments where id = :'e_paypending'::uuid)),
  'updated',
  'an administrator can confirm a payment-pending enrollment (MPS-REQ-017)'
);
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'enrollment' and action = 'state_changed'
      and changed_fields ->> 'to' = 'confirmed'
      and actor_user_id = :'admin'::uuid),
  1,
  'confirming records attributable history (MPS-REQ-024)'
);

-- PRIVACY: the note is stored on the row and must never enter the history.
select is(
  (select state_note from public.enrollments where id = :'e_paypending'::uuid),
  'Sample reason.',
  'the note is stored on the enrollment'
);
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'enrollment'
      and changed_fields::text ilike '%Sample reason%'),
  0,
  'the administrator note never reaches the audit payload'
);

-- Idempotency: same target again is a no-op with no second audit row.
select is(
  public.admin_set_enrollment_state(
    :'e_paypending'::uuid, 'confirmed', 'Sample reason.',
    (select updated_at from public.enrollments where id = :'e_paypending'::uuid)),
  'unchanged',
  'a repeated confirmation is a no-op, not a second change'
);
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'enrollment' and action = 'state_changed'
      and changed_fields ->> 'to' = 'confirmed'),
  1,
  'a no-op enrollment change writes no second audit row (idempotency)'
);

-- REFUSED: confirmed → blocked. The correction path the owner declined
-- (GAP-ADMIN-008). If this ever stops throwing, the transition table was
-- widened without approval.
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000002', 'blocked', 'x',
       (select updated_at from public.enrollments
          where id = '50000000-0000-4000-8000-000000000002')) $$,
  '23514',
  null,
  'a confirmed enrollment cannot be moved to blocked (GAP-ADMIN-008)'
);
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000002', 'waitlisted', 'x',
       (select updated_at from public.enrollments
          where id = '50000000-0000-4000-8000-000000000002')) $$,
  '23514',
  null,
  'a confirmed enrollment cannot be moved back to the waitlist'
);

-- Allowed: confirmed → canceled, recording a status only (MPS-RUL-004).
select is(
  public.admin_set_enrollment_state(
    :'e_confirmed'::uuid, 'canceled', 'Sample cancellation.',
    (select updated_at from public.enrollments where id = :'e_confirmed'::uuid)),
  'updated',
  'a confirmed enrollment can be cancelled, recording a status only'
);

-- REFUSED: canceled is terminal (GAP-ADMIN-003).
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000002', 'confirmed', 'x',
       (select updated_at from public.enrollments
          where id = '50000000-0000-4000-8000-000000000002')) $$,
  '23514',
  null,
  'a cancelled enrollment cannot be reinstated (GAP-ADMIN-003)'
);

-- REFUSED: the three states that are outcomes, not decisions. The enum accepts
-- them; the transition table does not.
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000003', 'payment_failed', 'x',
       (select updated_at from public.enrollments
          where id = '50000000-0000-4000-8000-000000000003')) $$,
  '23514',
  null,
  'payment_failed is never a state an administrator may set (GAP-ADMIN-002)'
);
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000003', 'started', 'x',
       (select updated_at from public.enrollments
          where id = '50000000-0000-4000-8000-000000000003')) $$,
  '23514',
  null,
  'started is never a state an administrator may set'
);
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000003', 'approval_pending', 'x',
       (select updated_at from public.enrollments
          where id = '50000000-0000-4000-8000-000000000003')) $$,
  '23514',
  null,
  'approval_pending is never a state an administrator may set'
);

-- The note is mandatory: MPS-REQ-024's history is only useful if it says why.
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000003', 'waitlisted', '   ',
       (select updated_at from public.enrollments
          where id = '50000000-0000-4000-8000-000000000003')) $$,
  '22023',
  null,
  'an enrollment change with no note is refused'
);
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000003', 'waitlisted', repeat('x', 401),
       (select updated_at from public.enrollments
          where id = '50000000-0000-4000-8000-000000000003')) $$,
  '22023',
  null,
  'an over-long note is refused'
);

-- Stale token, and a null one: a forged body that omits the field is treated as
-- stale rather than allowed through.
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000003', 'waitlisted', 'x',
       '2000-01-01T00:00:00Z'::timestamptz) $$,
  '40001',
  null,
  'an enrollment change against a stale row is refused'
);
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000003', 'waitlisted', 'x', null) $$,
  '40001',
  null,
  'an omitted concurrency token is treated as stale, never as permission'
);

-- A manipulated record id.
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-0000dead0000', 'confirmed', 'x', now()) $$,
  'P0002',
  null,
  'an enrollment id that matches nothing is reported as not found'
);


-- ===========================================================================
-- 4. EVERY OTHER CALLER — refused, identically
-- ===========================================================================
-- The refusal must be `42501` for all of them, and it must happen before the
-- row is looked at, so a non-administrator learns nothing about whether an id
-- exists.

-- Parent (ACT-001): controls their own family, never an operation.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ select public.admin_create_program_draft('Parent Draft', 'parent-draft') $$,
  '42501', null, 'a parent cannot create a program');
select throws_ok(
  $$ select public.admin_set_program_publication(
       '10000000-0000-4000-8000-000000000004', 'draft', now()) $$,
  '42501', null, 'a parent cannot change publication');
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000001', 'confirmed', 'x', now()) $$,
  '42501', null, 'a parent cannot change an enrollment state — even their own');

-- Educator (ACT-003), assigned to `art-lab` and to the draft. Assignment grants
-- read. MPS-ACC-027: an educator cannot publish a price, open registration, or
-- cancel — asserted here as an enforced control, not a hidden button.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select throws_ok(
  $$ select public.admin_set_program_publication(
       '10000000-0000-4000-8000-0000000000ff', 'published', now()) $$,
  '42501', null,
  'an assigned educator cannot publish their own assigned program (MPS-ACC-027)');
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-000000000004', now(),
       'Art Lab', '', '', '', '', '', '', '', '', '', '$1',
       'open', '', 'administrator_approval') $$,
  '42501', null,
  'an assigned educator cannot publish a price or open registration (MPS-ACC-027)');
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000001', 'canceled', 'x', now()) $$,
  '42501', null,
  'an assigned educator cannot cancel an enrollment on their own roster');

-- A verified adult with no role grant at all.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-0000000000f0","role":"authenticated"}';

select throws_ok(
  $$ select public.admin_create_program_draft('No Role', 'no-role') $$,
  '42501', null, 'a role-less account cannot create a program');
select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000001', 'confirmed', 'x', now()) $$,
  '42501', null, 'a role-less account cannot change an enrollment');

-- Forged role claims. `raw_user_meta_data` is editable by the user themselves
-- through the Auth API, so a role asserted there is a role the attacker chose.
-- `private.is_admin()` reads `public.user_roles` and nothing else.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-0000000000f0",'
  '"role":"authenticated","user_metadata":{"role":"admin","is_admin":true}}';

select throws_ok(
  $$ select public.admin_set_enrollment_state(
       '50000000-0000-4000-8000-000000000001', 'confirmed', 'x', now()) $$,
  '42501', null,
  'user_metadata claiming admin cannot change an enrollment');

set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-0000000000f0",'
  '"role":"authenticated","app_metadata":{"role":"admin"}}';

select throws_ok(
  $$ select public.admin_set_program_publication(
       '10000000-0000-4000-8000-000000000004', 'archived', now()) $$,
  '42501', null,
  'app_metadata claiming admin cannot archive a program');

-- Anonymous: holds EXECUTE on none of these functions.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select ok(
  not has_function_privilege('anon',
    'public.admin_set_enrollment_state(uuid, public.enrollment_state, text, timestamptz)',
    'EXECUTE'),
  'anon cannot execute the enrollment state function at all'
);
select ok(
  not has_function_privilege('anon',
    'public.admin_create_program_draft(text, text, text)', 'EXECUTE'),
  'anon cannot execute the program draft function at all'
);


select * from finish();
rollback;
