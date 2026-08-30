-- Foundation Release — educator scope (MPS-REQ-018, MPS-REQ-017)
--
-- "An educator's program access does not imply access to every family, student,
-- or administrator record." (AGENTS.md §12)

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

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
-- Run as a top-level statement: Postgres refuses a data-modifying CTE inside a
-- subquery expression ("WITH clause containing a data-modifying statement must
-- be at the top level"), so the previous form raised before it could assert
-- anything. The educator holds the DELETE privilege but no DELETE policy, so
-- this affects zero rows rather than raising -- and the assignments survive.
delete from public.educator_assignments
  where educator_user_id = :'educator'::uuid;

select is(
  (select count(*)::int from public.educator_assignments
     where educator_user_id = :'educator'::uuid),
  2,
  'an educator cannot delete their own assignment'
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
