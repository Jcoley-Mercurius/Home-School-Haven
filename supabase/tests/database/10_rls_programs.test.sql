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
select is((select count(*)::int from public.families), 0,
  'anon cannot read families');
select is((select count(*)::int from public.family_members), 0,
  'anon cannot read family members');
select is((select count(*)::int from public.user_roles), 0,
  'anon cannot read role grants');
select is((select count(*)::int from public.audit_events), 0,
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
select is(
  (with attempted as (
     update public.programs set publication_state = 'published'
       where slug = 'sample-unpublished-draft' returning 1
   ) select count(*)::int from attempted),
  0,
  'a parent cannot publish a program'
);

reset role;

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
select is(
  (with attempted as (
     update public.programs set published_price = '$1'
       where slug = 'art-lab' returning 1
   ) select count(*)::int from attempted),
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
