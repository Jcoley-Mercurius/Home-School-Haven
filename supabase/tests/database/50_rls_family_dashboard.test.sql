-- Foundation Release — family dashboard record boundaries
--
-- MPS-REQ-004 (no private family information leaks), MPS-REQ-014 (no duplicate
-- enrollment), MPS-REQ-018/MPS-ACC-028 (an educator reaches assigned programs
-- only), MPS-ACC-030 (unauthorized families cannot access program content).
--
-- This is the database half of the boundary. The browser half is
-- `tests/e2e/family-dashboard.spec.ts`. Both are required: a page that forgets
-- its guard must still get nothing, and a policy no privilege can reach must
-- still fail loudly.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

\set parent_a '20000000-0000-4000-8000-00000000000a'
\set parent_b '20000000-0000-4000-8000-00000000000b'
\set educator '20000000-0000-4000-8000-00000000000e'
\set art_lab '10000000-0000-4000-8000-000000000004'
\set sewing '10000000-0000-4000-8000-000000000005'
\set family_b_enrollment '50000000-0000-4000-8000-000000000004'


-- ---------------------------------------------------------------------------
-- Parent A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

-- POSITIVE: their own family's enrollments, all three of them.
select is(
  (select count(*)::int from public.enrollments),
  3,
  'a parent reads their own family''s enrollments and no others'
);

-- The trust states the dashboard exists to distinguish are all present and
-- readable, so a rendering test has something real to render.
select is(
  (select state::text from public.enrollments
     where program_id = :'art_lab'::uuid),
  'payment_pending',
  'the payment-pending enrollment is readable by its own family'
);
select is(
  (select count(*)::int from public.enrollments where state = 'confirmed'),
  1,
  'exactly one enrollment is confirmed — confirmation is not the default'
);

-- NEGATIVE: family B's enrollment is invisible, by id and in aggregate.
select is(
  (select count(*)::int from public.enrollments
     where id = :'family_b_enrollment'::uuid),
  0,
  'a parent cannot read another family''s enrollment by id'
);
select is(
  (select count(*)::int from public.enrollments
     where program_id = :'sewing'::uuid),
  0,
  'a parent cannot read another family''s enrollment by program'
);

-- POSITIVE: published announcements and resources for programs they hold an
-- enrollment in.
select is(
  (select count(*)::int from public.announcements),
  2,
  'a parent reads published announcements for their own programs only'
);
select is(
  (select count(*)::int from public.learning_resources),
  2,
  'a parent reads published resources for their own programs only'
);

-- NEGATIVE: an unpublished row on a program they ARE enrolled in. This proves
-- the `published` half of the policy, independently of the family half.
select is(
  (select count(*)::int from public.announcements
     where program_id = :'art_lab'::uuid and not published),
  0,
  'an unpublished announcement is invisible even on an enrolled program'
);
select is(
  (select count(*)::int from public.learning_resources
     where program_id = :'art_lab'::uuid and not published),
  0,
  'an unpublished resource is invisible even on an enrolled program'
);

-- NEGATIVE: a PUBLISHED row on a program they are NOT enrolled in. This proves
-- the family half, independently of the published half.
select is(
  (select count(*)::int from public.announcements
     where program_id = :'sewing'::uuid),
  0,
  'a published announcement for another family''s program is invisible'
);
select is(
  (select count(*)::int from public.learning_resources
     where program_id = :'sewing'::uuid),
  0,
  'a published resource for another family''s program is invisible'
);

-- NEGATIVE: no write path exists. Not "the row would be rejected" — the
-- privilege itself is absent, so this raises rather than filtering.
select throws_ok(
  $$ insert into public.enrollments (family_id, student_id, program_id, state)
       values ('30000000-0000-4000-8000-00000000000a',
               '40000000-0000-4000-8000-000000000001',
               '10000000-0000-4000-8000-000000000005', 'confirmed') $$,
  '42501',
  null,
  'a parent cannot create an enrollment, let alone a confirmed one'
);
select throws_ok(
  $$ update public.enrollments set state = 'confirmed' $$,
  '42501',
  null,
  'a parent cannot promote their own enrollment to confirmed'
);


-- ---------------------------------------------------------------------------
-- Parent B — the other side of the same boundary
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.enrollments),
  1,
  'the other parent reads exactly their own one enrollment'
);


-- ---------------------------------------------------------------------------
-- Educator — assigned programs only (MPS-ACC-028)
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

-- Assigned to Art Lab, so its roster is reachable.
select is(
  (select count(*)::int from public.enrollments
     where program_id = :'art_lab'::uuid),
  1,
  'an assigned educator reads the roster for their assigned program'
);

-- Not assigned to Sewing or Haven Days, so those rosters are not.
select is(
  (select count(*)::int from public.enrollments
     where program_id <> :'art_lab'::uuid),
  0,
  'an assigned educator reads no enrollment for an unassigned program'
);


-- ---------------------------------------------------------------------------
-- Anonymous — nothing, at all
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '';

select throws_ok(
  $$ select count(*) from public.enrollments $$,
  '42501',
  null,
  'an anonymous visitor holds no privilege on enrollments'
);

select * from finish();
rollback;
