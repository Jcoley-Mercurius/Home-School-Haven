-- Foundation Release — administrator reach and append-only history
-- (MPS-REQ-017, MPS-REQ-024)

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

\set admin    '20000000-0000-4000-8000-000000000ad0'
\set educator '20000000-0000-4000-8000-00000000000e'
\set sewing   '10000000-0000-4000-8000-000000000005'

set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- POSITIVE: delegated operational reach (MPS-REQ-017).
select is((select count(*)::int from public.families), 2,
  'an administrator reads every family');
-- Six, not four: the seed gained two family-less parents, so the
-- `family_incomplete` state of MPS-WFL-002 is reachable without mutating the
-- other fixtures -- one for the tests that must stay family-less, one for the
-- test that completes setup.
select is((select count(*)::int from public.profiles), 6,
  'an administrator reads every profile');
select is((select count(*)::int from public.user_roles), 6,
  'an administrator reads every role grant');

-- POSITIVE: administrators manage educator assignments.
-- The seed's own inserts already fired these triggers, so this measures the
-- delta rather than an absolute count.
create temporary table audit_baseline as
  select count(*) as n from public.audit_events
   where entity_type = 'educator_assignment' and action = 'assigned';

-- The direct INSERT this used to make is refused as of 20260831000000, which
-- revoked the verb: an assignment now goes through `admin_assign_educator`,
-- which additionally checks that the target holds the educator role, that the
-- program is not archived, and that a reason was stated. The assertion is the
-- same one -- an administrator can assign an educator -- through the path that
-- actually exists. `80_admin_family_educator_roster.test.sql` covers the
-- function's own refusals; this file keeps proving the audit consequence.
select is(
  public.admin_assign_educator(
    '20000000-0000-4000-8000-00000000000e',
    '10000000-0000-4000-8000-000000000005',
    'Assigning the sample educator while testing administrator reach.'),
  'assigned',
  'an administrator can assign an educator to a program'
);

-- POSITIVE: that assignment is attributable (MPS-REQ-024).
select is(
  (select count(*)::int from public.audit_events
     where entity_type = 'educator_assignment' and action = 'assigned')
    - (select n::int from audit_baseline),
  1,
  'assigning an educator records exactly one audit event'
);

-- POSITIVE: attributed to the administrator who did it, not to nobody.
select is(
  (select actor_user_id from public.audit_events
     where entity_type = 'educator_assignment' and action = 'assigned'
     order by occurred_at desc limit 1),
  '20000000-0000-4000-8000-000000000ad0'::uuid,
  'the audit event names the acting administrator'
);

-- NEGATIVE: even an administrator cannot grant a role through the Data API.
-- Role changes are a server/CLI operation, not a client mutation.
select throws_ok(
  $$ insert into public.user_roles (user_id, role)
       values ('20000000-0000-4000-8000-00000000000e', 'owner') $$,
  '42501',
  null,
  'an administrator cannot grant a role through the Data API'
);

-- NEGATIVE: history is append-only for everyone, including administrators.
select throws_ok(
  $$ update public.audit_events set action = 'rewritten' where id > 0 $$,
  '42501',
  null,
  'an administrator cannot rewrite audit history'
);
select throws_ok(
  $$ delete from public.audit_events where id > 0 $$,
  '42501',
  null,
  'an administrator cannot delete audit history'
);

select * from finish();
rollback;
