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
--
-- The denial moved a layer earlier, exactly as it did for `anon` above.
-- `*_admin_program_enrollment_operations.sql` (§11 option A) revoked INSERT,
-- UPDATE and DELETE on `public.programs` from `authenticated`, so a parent no
-- longer reaches the UPDATE policy at all: the statement is refused outright
-- (42501) instead of running and matching zero rows. That is a stronger
-- guarantee than the one this assertion used to make, and it is the reason the
-- previous "write, then read the row back" form now aborts the file.
select throws_ok(
  $$ update public.programs set publication_state = 'published'
       where slug = 'sample-unpublished-draft' $$,
  '42501', null,
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

-- NEGATIVE: assignment grants read access, never write authority (MPS-ACC-027).
-- The educator CAN select this row, so it is a genuine "visible but not
-- writable" case -- and since option A revoked the write verbs, the refusal is
-- now a privilege error rather than a silently empty update.
select throws_ok(
  $$ update public.programs set published_price = '$1' where slug = 'art-lab' $$,
  '42501', null,
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
--
-- Through the RPC, because option A left no direct write path for any client
-- role -- an administrator included. `admin_set_program_publication` is now the
-- only way a publication state changes, which is the point of the revoke: the
-- transition rules and the truthfulness precondition cannot be walked around by
-- composing a PostgREST update. The concurrency token is read from the row
-- rather than hard-coded, since the seed does not fix `updated_at`.
select is(
  (select public.admin_set_program_publication(
     :'draft'::uuid, 'published',
     (select updated_at from public.programs where id = :'draft'::uuid))),
  'updated',
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
