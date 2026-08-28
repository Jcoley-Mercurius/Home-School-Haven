-- Foundation Release — family ownership boundaries (MPS-REQ-004)

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

\set family_a '30000000-0000-4000-8000-00000000000a'
\set family_b '30000000-0000-4000-8000-00000000000b'
\set parent_b '20000000-0000-4000-8000-00000000000b'

set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

-- POSITIVE: a parent reaches their own family.
select is(
  (select count(*)::int from public.families where id = :'family_a'::uuid),
  1,
  'a parent reads their own family'
);
select is(
  (select count(*)::int from public.family_members where family_id = :'family_a'::uuid),
  1,
  'a parent reads their own family membership'
);
select is(
  (select count(*)::int from public.profiles),
  1,
  'a parent reads exactly one profile — their own'
);
select is(
  (select count(*)::int from public.user_roles),
  1,
  'a parent reads only their own role grant'
);

-- NEGATIVE: another family is completely invisible (MPS-REQ-004).
select is(
  (select count(*)::int from public.families where id = :'family_b'::uuid),
  0,
  'a parent cannot read another family'
);
select is(
  (select count(*)::int from public.family_members where family_id = :'family_b'::uuid),
  0,
  'a parent cannot read another family''s membership'
);

-- NEGATIVE: privilege escalation through the Data API. `user_roles` has no
-- write policy for any role, so this is denied rather than merely filtered.
select throws_ok(
  $$ insert into public.user_roles (user_id, role)
       values ('20000000-0000-4000-8000-00000000000a', 'admin') $$,
  '42501',
  null,
  'a parent cannot grant itself the admin role'
);

-- NEGATIVE: a profile cannot be edited on someone else's behalf. UPDATE first
-- needs SELECT, and the SELECT policy is owner-scoped, so this affects 0 rows
-- rather than raising.
update public.profiles set display_name = 'tampered' where id = :'parent_b'::uuid;
select is(
  (select count(*)::int from public.profiles
     where id = :'parent_b'::uuid and display_name = 'tampered'),
  0,
  'a parent cannot rename another user''s profile'
);

-- NEGATIVE: audit history is administrator-only.
select is(
  (select count(*)::int from public.audit_events),
  0,
  'a parent cannot read audit history'
);

select * from finish();
rollback;
