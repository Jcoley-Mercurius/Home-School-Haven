-- Foundation Release — family setup, idempotency, and demo student boundaries
--
-- MPS-REQ-011 / MPS-ACC-015, MPS-ACC-016, MPS-ACC-017 (one family, no
-- duplicate, resumable), MPS-REQ-004 / MPS-ACC-005 (no cross-family access),
-- MPS-REQ-001 / MPS-RUL-006 / MPS-RUL-007 (demo student boundaries, D-FF1).
--
-- These prove the boundary in the database, where it actually lives. The
-- browser half is tests/e2e/family-setup.spec.ts. Neither alone is the control:
-- a page can forget its guard, and a policy can be written too loosely.

begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

\set parent_a '20000000-0000-4000-8000-00000000000a'
\set parent_c '20000000-0000-4000-8000-00000000000c'
\set educator '20000000-0000-4000-8000-00000000000e'
\set family_a '30000000-0000-4000-8000-00000000000a'
\set family_b '30000000-0000-4000-8000-00000000000b'
\set student_a1 '40000000-0000-4000-8000-000000000001'
\set student_b1 '40000000-0000-4000-8000-000000000003'


-- ---------------------------------------------------------------------------
-- Schema-level guarantees
-- ---------------------------------------------------------------------------
select has_table('public', 'students', 'students exists (D-FF1, owner decision 2026-08-29)');

-- MPS-RUL-006 names the sensitive group explicitly. These columns are absent
-- because Samantha's checklist §7 is unanswered, and this test is what stops a
-- later change from quietly adding one.
select hasnt_column('public', 'students', 'legal_name',
  'no legal name: checklist §7 unanswered');
select hasnt_column('public', 'students', 'date_of_birth',
  'no date of birth: checklist §7 unanswered');
select hasnt_column('public', 'students', 'allergies',
  'no allergies: MPS-RUL-006 forbids sensitive fields without confirmation');
select hasnt_column('public', 'students', 'medical_notes',
  'no medical notes: MPS-RUL-006 forbids sensitive fields without confirmation');
select hasnt_column('public', 'students', 'emergency_contact',
  'no emergency contact: MPS-RUL-006 forbids it without confirmation');

-- MPS-RUL-007 as a constraint rather than a convention: while the policy is
-- unconfirmed, a non-sample student row cannot be stored at all.
select throws_ok(
  format($$ insert into public.students (family_id, preferred_name, is_sample)
              values (%L, 'Not A Sample', false) $$, :'family_a'::uuid),
  '23514',
  null,
  'a non-sample student row cannot be stored while GAP-005 is open'
);

-- MPS-RUL-010: no row can claim that Samantha-approved language was accepted.
select throws_ok(
  format($$ insert into public.students
              (family_id, preferred_name, affirmation_version)
            values (%L, 'Sample Claim', 'samantha-approved-v1') $$,
         :'family_a'::uuid),
  '23514',
  null,
  'no student row can record an approved affirmation version'
);


-- ---------------------------------------------------------------------------
-- A parent with no family creates exactly one, twice
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000c","role":"authenticated"}';

select is(
  (select count(*)::int from public.family_members
     where user_id = :'parent_c'::uuid),
  0,
  'parent C starts in the family_incomplete state'
);

select lives_ok(
  $$ select public.create_family_for_current_user('Sample Family C') $$,
  'a parent with the parent role can create their family'
);

-- MPS-ACC-016. The second call is the whole point: a refresh, a retry, or a
-- double-clicked button must not produce a second family.
select is(
  (select public.create_family_for_current_user('Sample Family C Again')),
  (select fm.family_id from public.family_members fm
     where fm.user_id = :'parent_c'::uuid),
  'a repeat call returns the same family instead of creating another'
);

select is(
  (select count(*)::int from public.family_members
     where user_id = :'parent_c'::uuid),
  1,
  'a parent holds exactly one family membership after two calls'
);

-- The unique index is the backstop the check-then-insert race cannot cover.
select throws_ok(
  format($$ insert into public.family_members (family_id, user_id)
              values (%L, %L) $$, :'family_b'::uuid, :'parent_c'::uuid),
  '42501',
  null,
  'a parent cannot join a second family through the Data API'
);


-- ---------------------------------------------------------------------------
-- Demo student profiles stay inside the family that created them
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.students),
  2,
  'a parent reads their own two students and no others'
);

select is(
  (select count(*)::int from public.students where id = :'student_b1'::uuid),
  0,
  'a parent cannot read another family''s student'
);

-- A direct write is refused rather than merely filtered: `students` has no
-- INSERT policy for any client role, so the function is the only door.
select throws_ok(
  format($$ insert into public.students (family_id, preferred_name)
              values (%L, 'Injected') $$, :'family_a'::uuid),
  '42501',
  null,
  'a parent cannot insert a student directly through the Data API'
);

select throws_ok(
  format($$ insert into public.students (family_id, preferred_name)
              values (%L, 'Injected Into Another Family') $$, :'family_b'::uuid),
  '42501',
  null,
  'a parent cannot insert a student into another family'
);

-- MPS-REQ-014's "retries do not duplicate", applied to profiles.
select is(
  (select public.add_student_to_own_family('Sample Student A1')),
  :'student_a1'::uuid,
  'adding a student that already exists returns the existing profile'
);

select is(
  (select count(*)::int from public.students),
  2,
  'a duplicate submission created no second profile'
);

-- Removal answers the same way for another family''s row as for a row that
-- never existed. Distinguishing them would confirm the other row exists.
select is(
  (select public.remove_student_from_own_family(:'student_b1'::uuid)),
  false,
  'a parent cannot remove another family''s student'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select count(*)::int from public.students where id = :'student_b1'::uuid),
  1,
  'the other family''s student is still there afterwards'
);


-- ---------------------------------------------------------------------------
-- An educator reaches nothing here
-- ---------------------------------------------------------------------------
-- MPS-REQ-018 limits an educator to approved roster fields for assigned
-- programs. Enrollment does not exist in this release, so no assignment can
-- authorize a student row, and an educator with no family sees none.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select is(
  (select count(*)::int from public.students),
  0,
  'an educator reads no student profiles'
);

select throws_ok(
  $$ select public.create_family_for_current_user('Educator Family') $$,
  '42501',
  null,
  'an account without the parent role cannot create a family'
);


-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

-- Refused at the privilege layer, not merely filtered: `anon` holds no SELECT
-- grant on students at all, so there is no query for a policy to filter.
select throws_ok(
  $$ select count(*) from public.students $$,
  '42501',
  null,
  'a public visitor cannot even query student profiles'
);

select throws_ok(
  $$ select public.create_family_for_current_user('Anonymous Family') $$,
  '42501',
  null,
  'a public visitor cannot create a family'
);

select * from finish();
rollback;
