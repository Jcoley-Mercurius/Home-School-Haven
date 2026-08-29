-- Foundation Release — programs visibility (MPS-REQ-008, MPS-REQ-018, MPS-RUL-005)

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

\set parent_a  '20000000-0000-4000-8000-00000000000a'
\set educator  '20000000-0000-4000-8000-00000000000e'
\set admin     '20000000-0000-4000-8000-000000000ad0'
\set art_lab   '10000000-0000-4000-8000-000000000004'
\set draft     '10000000-0000-4000-8000-0000000000ff'

-- ---------------------------------------------------------------------------
-- anon  (public visitor, ACT-005)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

-- POSITIVE: published discovery works without an account.
select is(
  (select count(*)::int from public.programs),
  8,
  'anon reads exactly the 8 published programs'
);

-- NEGATIVE: the draft is invisible.
select is(
  (select count(*)::int from public.programs where id = :'draft'::uuid),
  0,
  'anon cannot see an unpublished program'
);

-- NEGATIVE: no private table is readable.
--
-- These are `throws_ok` rather than `is(count, 0)` because the denial happens a
-- layer earlier than it used to. `*_foundation_least_privilege_grants.sql`
-- revoked every privilege `anon` held on these tables, so the query is refused
-- outright (42501) instead of running and being filtered to zero rows by RLS.
-- Asserting a count of 0 raised an error and aborted this file before the
-- remaining assertions ran.
select throws_ok(
  $$ select count(*) from public.families $$, '42501', null,
  'anon cannot read families');
select throws_ok(
  $$ select count(*) from public.family_members $$, '42501', null,
  'anon cannot read family members');
select throws_ok(
  $$ select count(*) from public.user_roles $$, '42501', null,
  'anon cannot read role grants');
select throws_ok(
  $$ select count(*) from public.audit_events $$, '42501', null,
  'anon cannot read audit history');

reset role;

-- ---------------------------------------------------------------------------
-- parent (ACT-001)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.programs where id = :'draft'::uuid),
  0,
  'a parent cannot see an unpublished program'
);

-- NEGATIVE: MPS-RUL-005 — only an administrator or the owner publishes.
-- The UPDATE policy's USING clause excludes every row for a non-admin, so this
-- affects 0 rows rather than raising. Silent and harmless is the correct
-- outcome; what matters is that nothing changed.
-- Top-level, for the same reason as the educator suite: Postgres refuses a
-- data-modifying CTE inside a subquery expression, so the previous form raised
-- before it asserted anything. The parent holds the UPDATE privilege but no
-- UPDATE policy, so this matches no row rather than raising -- and the check
-- is made after dropping back to the owner, because a parent cannot see the
-- draft at all and "invisible" would pass whether or not the write landed.
update public.programs set publication_state = 'published'
  where slug = 'sample-unpublished-draft';

reset role;

select is(
  (select publication_state::text from public.programs
     where slug = 'sample-unpublished-draft'),
  'draft',
  'a parent cannot publish a program'
);

-- ---------------------------------------------------------------------------
-- educator (ACT-003) — MPS-REQ-018
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

-- POSITIVE: an assigned program is visible even while unpublished.
select is(
  (select count(*)::int from public.programs where id = :'draft'::uuid),
  1,
  'an educator sees an assigned program at any publication state'
);

-- NEGATIVE: assignment grants read access, never write authority. An educator
-- can SELECT this row, so this is a genuine "visible but not writable" case.
-- Top-level again: a data-modifying CTE cannot sit inside a subquery
-- expression. The educator can SELECT this row, so the refusal is checked
-- directly on what they can see -- a genuine "visible but not writable" case.
update public.programs set published_price = '$1' where slug = 'art-lab';

select is(
  (select count(*)::int from public.programs
     where slug = 'art-lab' and published_price = '$1'),
  0,
  'an assigned educator cannot change a program price'
);

-- ...and the price is untouched.
select is(
  (select published_price from public.programs where slug = 'art-lab'),
  null,
  'the attempted price change did not land'
);

reset role;

-- ---------------------------------------------------------------------------
-- administrator (ACT-004)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- POSITIVE: administrators see drafts as well as published programs.
select is(
  (select count(*)::int from public.programs),
  9,
  'an administrator sees published and draft programs'
);

-- POSITIVE: administrators may publish (MPS-RUL-005).
select lives_ok(
  $$ update public.programs set publication_state = 'published'
       where slug = 'sample-unpublished-draft' $$,
  'an administrator can publish a program'
);

-- POSITIVE: that material change left attributable history (MPS-REQ-024).
select is(
  (
    select count(*)::int from public.audit_events
    where entity_type = 'program'
      and action = 'updated'
      and changed_fields ? 'publication_state'
  ),
  1,
  'publishing a program records an audit event'
);

select * from finish();
rollback;
