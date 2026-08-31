-- Foundation Release — administrator family/educator reads, educator assignment
-- writes, and the assigned-educator roster boundary
-- (MPS-REQ-004, MPS-REQ-017, MPS-REQ-018, MPS-REQ-024;
--  MPS-RUL-003, MPS-RUL-006; MPS-ACC-005, MPS-ACC-028)
--
-- WHAT THIS FILE IS FOR
--
-- `src/lib/admin/*` decides what an administrator is *offered*. This file
-- decides what the database does when asked directly — by a forged request, by
-- a refactor that forgets a guard, or by anyone holding a session and a
-- PostgREST client. Five things are proven:
--
--   1. No client role can insert or delete an assignment through the table.
--      After 20260831000000 the only write path is a function.
--   2. Those functions refuse every caller who is not an administrator, and
--      refuse an ineligible target even for a caller who is one.
--   3. Assignment is idempotent: a repeat writes nothing and records no second
--      audit row claiming a change that did not happen.
--   4. An assigned educator reads exactly the CONFIRMED roster and nothing
--      else. An unassigned one reads nothing. A removed assignment stops
--      reading immediately, in the same transaction, with no sign-out.
--   5. Nothing here lets an administrator write a family or a student row.
--
-- And one attribution rule: the audit row must name the acting administrator
-- even though the write happens inside a SECURITY DEFINER function.

begin;
create extension if not exists pgtap with schema extensions;

select plan(55);

\set admin    '20000000-0000-4000-8000-000000000ad0'
\set parent_a '20000000-0000-4000-8000-00000000000a'
\set parent_b '20000000-0000-4000-8000-00000000000b'
\set educator '20000000-0000-4000-8000-00000000000e'
\set norole   '20000000-0000-4000-8000-0000000000f0'

\set art_lab      '10000000-0000-4000-8000-000000000004'
\set draft        '10000000-0000-4000-8000-0000000000ff'
-- Haven Days: holds a confirmed enrollment, and the educator is NOT assigned.
\set haven_days   '10000000-0000-4000-8000-000000000002'
-- Sewing: family B's waitlisted program, and no assignment.
\set sewing       '10000000-0000-4000-8000-000000000005'

\set family_a  '30000000-0000-4000-8000-00000000000a'
\set student_a1 '40000000-0000-4000-8000-000000000001'
\set student_a2 '40000000-0000-4000-8000-000000000002'
\set student_b1 '40000000-0000-4000-8000-000000000003'


-- ===========================================================================
-- 1. PRIVILEGES — the direct write path is gone
-- ===========================================================================
-- These are the grants 20260831000000 removed. If a future migration re-grants
-- either verb, every eligibility and archival rule below becomes bypassable and
-- these two assertions are what says so.

select ok(
  not has_table_privilege('authenticated', 'public.educator_assignments', 'INSERT'),
  'authenticated holds no INSERT on educator_assignments'
);
select ok(
  not has_table_privilege('authenticated', 'public.educator_assignments', 'DELETE'),
  'authenticated holds no DELETE on educator_assignments'
);
select ok(
  not has_table_privilege('anon', 'public.educator_assignments', 'SELECT'),
  'anon holds no SELECT on educator_assignments'
);
-- Nothing in this slice adds a write path to parent-controlled records.
select ok(
  not has_table_privilege('authenticated', 'public.students', 'UPDATE'),
  'authenticated holds no UPDATE on students'
);
select ok(
  not has_table_privilege('authenticated', 'public.students', 'DELETE'),
  'authenticated holds no DELETE on students'
);
select ok(
  not has_table_privilege('authenticated', 'public.families', 'UPDATE'),
  'authenticated holds no UPDATE on families'
);
select ok(
  not has_table_privilege('authenticated', 'public.family_members', 'INSERT'),
  'authenticated holds no INSERT on family_members'
);
select ok(
  not has_table_privilege('authenticated', 'public.user_roles', 'INSERT'),
  'authenticated holds no INSERT on user_roles (no self-promotion)'
);


-- ===========================================================================
-- 2. PUBLIC — an unauthenticated caller reaches nothing (MPS-ACC-005)
-- ===========================================================================
-- `anon` is refused at the PRIVILEGE layer, one step earlier than RLS: the
-- least-privilege migration revoked SELECT outright, so these reads raise 42501
-- rather than returning an empty set. Asserting the privilege is the stronger
-- statement — an empty result could later come from a policy that a future
-- migration widens, while an absent grant cannot be widened by a policy at all.
select ok(
  not has_table_privilege('anon', 'public.families', 'SELECT'),
  'anon holds no SELECT on families'
);
select ok(
  not has_table_privilege('anon', 'public.students', 'SELECT'),
  'anon holds no SELECT on students'
);
select ok(
  not has_table_privilege('anon', 'public.enrollments', 'SELECT'),
  'anon holds no SELECT on enrollments'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anon holds no SELECT on profiles'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000002',
       'forged') $$,
  '42501', null,
  'anon cannot assign an educator'
);

reset role;


-- ===========================================================================
-- 3. PARENT — isolation holds, and no educator administration is reachable
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.students), 2,
          'parent A reads their own two children and no more');
select is(
  (select count(*)::int from public.students
     where family_id <> '30000000-0000-4000-8000-00000000000a'::uuid),
  0,
  'parent A reads no other family''s child'
);
select is((select count(*)::int from public.educator_assignments), 0,
          'a parent reads no educator assignment');

-- MPS-REQ-004: a parent is not an educator administrator.
select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000002',
       'a parent should not be able to do this') $$,
  '42501', null,
  'a parent cannot assign an educator'
);
select throws_ok(
  $$ select public.admin_unassign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000004',
       'a parent should not be able to do this') $$,
  '42501', null,
  'a parent cannot unassign an educator'
);

-- A JWT is client-editable. A role claimed there is not a role grant.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-0000000000f0","role":"authenticated",'
  '"user_metadata":{"role":"admin"},"app_metadata":{"role":"owner"}}';

select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000002',
       'metadata is not authorization') $$,
  '42501', null,
  'editable JWT metadata claiming admin does not authorize an assignment'
);


-- ===========================================================================
-- 4. EDUCATOR — no self-assignment, by privilege as well as by policy
-- ===========================================================================
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000002',
       'an educator should not be able to do this') $$,
  '42501', null,
  'an educator cannot assign themselves'
);
select throws_ok(
  $$ select public.admin_unassign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000004',
       'an educator should not be able to do this') $$,
  '42501', null,
  'an educator cannot unassign anyone'
);


-- ===========================================================================
-- 5. THE ROSTER BOUNDARY (MPS-ACC-028, MPS-REQ-018)
-- ===========================================================================
-- Still the educator. Assigned to art_lab and the draft; NOT to haven_days.
--
-- art_lab carries two enrollments: student A2 confirmed, student A1
-- payment_pending. The educator must see exactly one child.

select is(
  (select count(*)::int from public.students),
  1,
  'an assigned educator reads exactly one student — the confirmed one'
);
select is(
  (select preferred_name from public.students),
  'Sample Student A2',
  'and it is the child with the confirmed enrollment'
);

-- MPS-RUL-003: an unsettled arrangement is not an educator's business.
select is(
  (select count(*)::int from public.students
     where id = '40000000-0000-4000-8000-000000000001'::uuid),
  0,
  'a payment_pending child in the SAME assigned program is not disclosed'
);
select is(
  (select count(*)::int from public.students
     where id = '40000000-0000-4000-8000-000000000003'::uuid),
  0,
  'a waitlisted child in an unassigned program is not disclosed'
);

-- MPS-ACC-028 "appears exactly once in the correct program".
select is(
  (select count(*)::int from public.enrollments
     where program_id = '10000000-0000-4000-8000-000000000004'::uuid
       and state = 'confirmed'),
  1,
  'the confirmed roster for the assigned program holds exactly one row'
);
select is(
  (select count(*)::int from public.enrollments
     where program_id = '10000000-0000-4000-8000-000000000002'::uuid),
  0,
  'an educator reads no enrollment for a program they are not assigned to'
);

-- No family reach comes with a roster.
select is((select count(*)::int from public.families), 0,
          'an assigned educator reads no family record');


-- ===========================================================================
-- 6. ADMINISTRATOR — the approved writes
-- ===========================================================================
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- Reads an administrator needs for the two directories.
select is((select count(*)::int from public.families), 2,
          'an administrator reads both sample families');
select is((select count(*)::int from public.students), 3,
          'an administrator reads all three sample children');
select is(
  (select count(*)::int from public.user_roles where role = 'educator'),
  1,
  'an administrator reads the educator role grant that builds the directory'
);

-- A note is mandatory, and is checked before anything is looked up.
select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000002', '   ') $$,
  '22023', null,
  'an assignment without a note is refused'
);
select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000002', repeat('x', 401)) $$,
  '22023', null,
  'an assignment note over 400 characters is refused'
);

-- A manipulated program id learns nothing beyond "not found".
select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '00000000-0000-4000-8000-000000000000', 'no such program') $$,
  'P0002', null,
  'assigning to a program that does not exist is refused'
);

-- Eligibility comes from user_roles, never from the request.
select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000a',
       '10000000-0000-4000-8000-000000000002', 'a parent is not an educator') $$,
  '23514', null,
  'a parent cannot be assigned to a program'
);
select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-0000000000f0',
       '10000000-0000-4000-8000-000000000002', 'no role at all') $$,
  '23514', null,
  'an account with no role cannot be assigned to a program'
);

-- The happy path.
select is(
  public.admin_assign_educator(
    '20000000-0000-4000-8000-00000000000e',
    '10000000-0000-4000-8000-000000000002',
    'Assigning the sample educator to Haven Days for the review walkthrough.'),
  'assigned',
  'an administrator assigns an eligible educator to a program'
);
select is(
  (select count(*)::int from public.educator_assignments
     where educator_user_id = '20000000-0000-4000-8000-00000000000e'::uuid
       and program_id = '10000000-0000-4000-8000-000000000002'::uuid),
  1,
  'the assignment row exists exactly once'
);
select is(
  (select assigned_by from public.educator_assignments
     where educator_user_id = '20000000-0000-4000-8000-00000000000e'::uuid
       and program_id = '10000000-0000-4000-8000-000000000002'::uuid),
  '20000000-0000-4000-8000-000000000ad0'::uuid,
  'assigned_by names the acting administrator'
);

-- MPS-REQ-024, and the SECURITY DEFINER attribution question: the trigger runs
-- inside a definer function, and auth.uid() must still resolve to the caller.
select is(
  (select actor_user_id from public.audit_events
     where entity_type = 'educator_assignment'
       and entity_id = '10000000-0000-4000-8000-000000000002'::uuid
       and action = 'assigned'),
  '20000000-0000-4000-8000-000000000ad0'::uuid,
  'the audit row is attributed to the administrator, not to the definer'
);
select is(
  (select changed_fields ->> 'educator_user_id' from public.audit_events
     where entity_type = 'educator_assignment'
       and entity_id = '10000000-0000-4000-8000-000000000002'::uuid
       and action = 'assigned'),
  '20000000-0000-4000-8000-00000000000e',
  'the audit payload names the educator'
);
-- The note is administrator free text and must not reach the audit.
select is(
  (select count(*)::int from public.audit_events
     where changed_fields::text ilike '%walkthrough%'),
  0,
  'the administrator note does not reach audit_events'
);
-- MPS-RUL-006: no child or family data in an audit payload.
select is(
  (select count(*)::int from public.audit_events
     where entity_type = 'educator_assignment'
       and changed_fields::text ilike '%Sample Student%'),
  0,
  'no child name reaches an assignment audit payload'
);

-- Idempotency: a repeat writes nothing and records nothing.
select is(
  public.admin_assign_educator(
    '20000000-0000-4000-8000-00000000000e',
    '10000000-0000-4000-8000-000000000002',
    'Submitting the same assignment a second time.'),
  'unchanged',
  'a repeat assignment returns unchanged rather than raising'
);
select is(
  (select count(*)::int from public.audit_events
     where entity_type = 'educator_assignment'
       and entity_id = '10000000-0000-4000-8000-000000000002'::uuid
       and action = 'assigned'),
  1,
  'and writes no second audit row claiming a change that did not happen'
);

-- An archived program is not operated, so it is not assigned.
select is(
  public.admin_set_program_publication(
    '10000000-0000-4000-8000-000000000005'::uuid, 'archived',
    (select updated_at from public.programs
       where id = '10000000-0000-4000-8000-000000000005'::uuid)),
  'updated',
  'the administrator archives a program to set up the next assertion'
);
select throws_ok(
  $$ select public.admin_assign_educator(
       '20000000-0000-4000-8000-00000000000e',
       '10000000-0000-4000-8000-000000000005', 'archived program') $$,
  '23514', null,
  'an archived program cannot be assigned an educator'
);


-- ===========================================================================
-- 7. REMOVAL REVOKES ACCESS IMMEDIATELY
-- ===========================================================================
-- The educator can currently read Haven Days' confirmed roster through the
-- assignment made above. Remove it and re-read in the SAME transaction: no
-- sign-out, no new session, no cache to expire.

select is(
  public.admin_unassign_educator(
    '20000000-0000-4000-8000-00000000000e',
    '10000000-0000-4000-8000-000000000002',
    'Removing the walkthrough assignment.'),
  'unassigned',
  'an administrator removes an assignment'
);
select is(
  (select count(*)::int from public.audit_events
     where entity_type = 'educator_assignment'
       and entity_id = '10000000-0000-4000-8000-000000000002'::uuid
       and action = 'unassigned'),
  1,
  'and the removal is attributable'
);
select is(
  public.admin_unassign_educator(
    '20000000-0000-4000-8000-00000000000e',
    '10000000-0000-4000-8000-000000000002',
    'Removing it again.'),
  'unchanged',
  'removing an absent assignment returns unchanged'
);
-- A pair that never existed is reported identically, so a manipulated id
-- learns nothing about what exists.
select is(
  public.admin_unassign_educator(
    '20000000-0000-4000-8000-00000000000e',
    '00000000-0000-4000-8000-000000000000',
    'A program id that does not exist.'),
  'unchanged',
  'unassigning a non-existent program is reported identically'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select is(
  (select count(*)::int from public.enrollments
     where program_id = '10000000-0000-4000-8000-000000000002'::uuid),
  0,
  'the removed assignment revokes the roster read on the next statement'
);
select is(
  (select count(*)::int from public.students
     where id = '40000000-0000-4000-8000-000000000001'::uuid),
  0,
  'and the student it named is unreachable again'
);
-- The educator's remaining assignment is untouched: removal is scoped.
select is(
  (select count(*)::int from public.educator_assignments),
  2,
  'the educator''s other two assignments survive'
);
select is(
  (select preferred_name from public.students),
  'Sample Student A2',
  'and the surviving assignment still yields its confirmed roster'
);

select * from finish();
rollback;
