-- Foundation Release — educator scope (MPS-REQ-018, MPS-REQ-017)
--
-- "An educator's program access does not imply access to every family, student,
-- or administrator record." (AGENTS.md §12)

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

\set educator  '20000000-0000-4000-8000-00000000000e'
\set sewing    '10000000-0000-4000-8000-000000000005'
\set family_a  '30000000-0000-4000-8000-00000000000a'

set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

-- POSITIVE: the educator sees their own assignments.
select is(
  (select count(*)::int from public.educator_assignments),
  2,
  'an educator reads their own two assignments'
);

-- NEGATIVE: and no one else's.
select is(
  (select count(*)::int from public.educator_assignments
     where educator_user_id <> :'educator'::uuid),
  0,
  'an educator cannot read another educator''s assignments'
);

-- NEGATIVE: no self-assignment (MPS-REQ-017).
select throws_ok(
  $$ insert into public.educator_assignments (educator_user_id, program_id)
       values ('20000000-0000-4000-8000-00000000000e',
               '10000000-0000-4000-8000-000000000005') $$,
  '42501',
  null,
  'an educator cannot assign themselves to a program'
);

-- NEGATIVE: nor unassign themselves from oversight.
--
-- This assertion got STRONGER in 20260831000000 and the form had to change with
-- it. Previously the educator held the DELETE privilege but no DELETE policy,
-- so the statement affected zero rows and the test measured the surviving
-- count. That migration revoked the privilege itself -- the only write path is
-- now `admin_unassign_educator`, which checks `private.is_admin()` -- so the
-- same statement is refused one layer earlier and raises 42501 instead.
--
-- The refusal is asserted rather than the survivors because a privilege that
-- does not exist cannot be re-opened by a future policy change, while a
-- zero-row delete could quietly become a real one.
select throws_ok(
  $$ delete from public.educator_assignments
       where educator_user_id = '20000000-0000-4000-8000-00000000000e' $$,
  '42501',
  null,
  'an educator cannot delete their own assignment'
);

select is(
  (select count(*)::int from public.educator_assignments
     where educator_user_id = :'educator'::uuid),
  2,
  'and both assignments survive'
);

-- NEGATIVE: program assignment grants nothing about families (MPS-REQ-004).
select is(
  (select count(*)::int from public.families),
  0,
  'an educator cannot read any family'
);
select is(
  (select count(*)::int from public.family_members),
  0,
  'an educator cannot read any family membership'
);

-- NEGATIVE: nor any administrator surface.
select is(
  (select count(*)::int from public.audit_events),
  0,
  'an educator cannot read audit history'
);

select * from finish();
rollback;
