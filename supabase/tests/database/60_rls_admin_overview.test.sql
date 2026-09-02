-- Foundation Release — the administrator operations overview, read by every role
-- (MPS-REQ-004, MPS-REQ-016, MPS-REQ-017, MPS-REQ-020, MPS-REQ-024,
--  MPS-ACC-005, MPS-ACC-022, MPS-ACC-026)
--
-- The overview at `/admin` performs exactly seven reads: programs, educator
-- assignments, enrollments, families, students, role grants, and audit events.
-- `requireAdmin()` in `src/lib/auth/guards.ts` decides whether the page renders;
-- this file decides what the database would hand over if that guard were ever
-- bypassed, forgotten, or moved. Two independent controls, and this is the one
-- that does not depend on any application code being correct.
--
-- So each read below is run verbatim, as five different callers:
--
--   administrator   the delegated operational reach of ACT-004
--   parent          their own family, and nothing operational
--   educator        their assigned programs, and no family or history
--   no role grant   a verified adult who has been granted nothing
--   forged metadata a caller whose editable JWT metadata claims `admin`
--
-- The last one is the escalation this schema was designed against: roles live
-- in `public.user_roles`, never in `auth.users.raw_user_meta_data`, and this
-- proves that claiming otherwise in a token changes nothing.

begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

\set admin    '20000000-0000-4000-8000-000000000ad0'
\set parent_a '20000000-0000-4000-8000-00000000000a'
\set educator '20000000-0000-4000-8000-00000000000e'
-- Not present in auth.users at all, which is precisely the point: RLS decides
-- on `auth.uid()`, and a uid with no row in `user_roles` has no role. This
-- models a verified adult whose access has not been granted yet.
\set norole   '20000000-0000-4000-8000-0000000000f0'

set local role authenticated;


-- ---------------------------------------------------------------------------
-- Administrator — the delegated operational reach the overview depends on
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- Eight published programs plus the draft fixture. An administrator seeing the
-- draft is the reach that distinguishes them from every other role (MPS-ACC-026).
select is((select count(*)::int from public.programs), 9,
  'an administrator reads every program at every publication state');

select is(
  (select count(*)::int from public.programs where publication_state = 'draft'),
  1,
  'an administrator reads the unpublished draft');

select is((select count(*)::int from public.educator_assignments), 2,
  'an administrator reads every educator assignment');

/* Seven since the conversion-journey fixtures added family B's two confirmed
   places (see supabase/seed.sql). */
select is((select count(*)::int from public.enrollments), 7,
  'an administrator reads every enrollment');

select is((select count(*)::int from public.families), 2,
  'an administrator reads every family');

select is((select count(*)::int from public.students), 3,
  'an administrator reads every student profile');

select ok((select count(*) from public.audit_events) > 0,
  'an administrator reads attributable history');

-- The consent signal the attention list is derived from. While MPS GAP-005 is
-- open a check constraint pins every row to the demo affirmation, so the
-- overview's "consent policy not yet approved" item is a fact about the data
-- rather than a sentence someone wrote into a component.
select is(
  (select count(*)::int from public.students
     where affirmation_version <> 'demo-unapproved-v0'),
  0,
  'no student profile carries an approved consent affirmation yet');


-- ---------------------------------------------------------------------------
-- Parent — the overview's reads return their own family, and nothing more
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.enrollments), 4,
  'a parent reads only their own family''s enrollments');

select is((select count(*)::int from public.families), 1,
  'a parent reads only their own family');

select is((select count(*)::int from public.students), 2,
  'a parent reads only their own children');

-- The operational surfaces an administrator has and a parent must not.
select is((select count(*)::int from public.audit_events), 0,
  'a parent reads no change history');

select is((select count(*)::int from public.user_roles), 1,
  'a parent reads only their own role grant');

-- Publication state is the boundary: a parent is a member of the public here.
select is((select count(*)::int from public.programs), 8,
  'a parent reads published programs only, never the draft');


-- ---------------------------------------------------------------------------
-- Educator — assigned programs, and nothing administrative
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

-- Two enrollments sit on an assigned program -- one confirmed, one
-- payment_pending, both on Art Lab. Roster reach follows assignment
-- (MPS-REQ-018, MPS-ACC-028) and stops there.
select is((select count(*)::int from public.enrollments), 2,
  'an educator reads only the roster of an assigned program');

select is((select count(*)::int from public.families), 0,
  'an educator reads no family record');

-- The student read is NARROWER than the enrollment read, and deliberately so.
-- `enrollments_select_assigned_educator` returns every state on an assigned
-- program, because an operator needs to see that a place is unsettled.
-- `educator_roster_students` returns only preferred names whose enrollment is
-- CONFIRMED: a family whose arrangement is still pending is not an educator's
-- business (MPS-RUL-003). So of the two enrollments above, exactly one names a
-- child this educator may identify, while the unrestricted table returns none.
select is((select count(*)::int from public.educator_roster_students), 1,
  'an educator reads only the students confirmed on an assigned program');

select is((select count(*)::int from public.audit_events), 0,
  'an educator reads no change history');


-- ---------------------------------------------------------------------------
-- Authenticated, no role grant — an absent grant is a denial, not a default
-- ---------------------------------------------------------------------------
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-0000000000f0","role":"authenticated"}';

select is((select count(*)::int from public.programs), 8,
  'a role-less account reads published programs only');

select is((select count(*)::int from public.enrollments), 0,
  'a role-less account reads no enrollment');

select is((select count(*)::int from public.families), 0,
  'a role-less account reads no family');

select is((select count(*)::int from public.audit_events), 0,
  'a role-less account reads no change history');


-- ---------------------------------------------------------------------------
-- Forged role claims — the escalation this schema exists to refuse
-- ---------------------------------------------------------------------------
-- `raw_user_meta_data` is editable by the user themselves through the Auth API,
-- so a role asserted there is a role the attacker chose. `private.is_admin()`
-- never looks at it.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-0000000000f0",'
  '"role":"authenticated","user_metadata":{"role":"admin","is_admin":true}}';

select is((select count(*)::int from public.audit_events), 0,
  'user_metadata claiming admin grants no administrative read');

-- `app_metadata` is not user-editable, but it is still not the authorization
-- source, and nothing in this schema reads it. Asserted so that a future change
-- which starts trusting it fails here first.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-0000000000f0",'
  '"role":"authenticated","app_metadata":{"role":"admin"}}';

select is((select count(*)::int from public.audit_events), 0,
  'app_metadata claiming admin grants no administrative read');

select is((select count(*)::int from public.students), 0,
  'a forged role claim reaches no student profile');


select * from finish();
rollback;
