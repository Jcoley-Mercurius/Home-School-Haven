-- Foundation Release — invite-only family provisioning
-- (MPS-REQ-011; MPS-ACC-015, MPS-ACC-016, MPS-ACC-017; MPS-REQ-024)
--
-- APPROVED PRODUCT DECISION, 2026-09-02: family provisioning is invite-only.
-- Only an authorized administrator may invite a family, there is no public
-- self-service signup, and an invitation may create the `parent` role and
-- nothing else.
--
-- WHAT THIS FILE IS FOR
--
-- `/admin/families` and `/invitation/accept` decide what a person is SHOWN.
-- This decides what the database does when asked directly — by a forged
-- PostgREST request, by a future migration that adds a convenience policy, or
-- by an educator who simply calls the function. Seven things are proven:
--
--   1. `anon` holds nothing on `family_invitations`, and cannot execute either
--      invitation function.
--   2. A parent and an educator read zero invitations. Not a filtered view of
--      them — zero, because no policy exists that could return one.
--   3. A non-administrator cannot create an invitation, so nobody can invite
--      themselves or anyone else into the platform.
--   4. Accepting grants EXACTLY the role `parent`. Never educator, admin, or
--      owner — and there is no argument through which one could be requested.
--   5. Acceptance is single use. The second attempt returns "not open" rather
--      than silently succeeding.
--   6. An expired invitation and a revoked invitation both refuse acceptance,
--      and an account with no invitation gets no role at all.
--   7. The audit payload discloses NO email address —
--      `public.audit_events` is readable by every administrator, and an
--      invitation list that leaked addresses into history would outlive the
--      invitation itself.

begin;
create extension if not exists pgtap with schema extensions;

select plan(45);

\set parent   '20000000-0000-4000-8000-00000000000a'
\set educator '20000000-0000-4000-8000-00000000000e'
\set admin    '20000000-0000-4000-8000-000000000ad0'

-- Four accounts that exist only inside this rolled-back transaction. Each one
-- stands in for an invited adult at a different point in the lifecycle.
\set invitee_ok      '21000000-0000-4000-8000-000000000001'
\set invitee_expired '21000000-0000-4000-8000-000000000002'
\set invitee_revoked '21000000-0000-4000-8000-000000000003'
\set invitee_none    '21000000-0000-4000-8000-000000000004'

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  t.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  t.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', '', '', '', '', ''
from (values
  (:'invitee_ok'::uuid,      'sample.invitee.one@example.com'),
  (:'invitee_expired'::uuid, 'sample.invitee.two@example.com'),
  (:'invitee_revoked'::uuid, 'sample.invitee.three@example.com'),
  (:'invitee_none'::uuid,    'sample.invitee.four@example.com')
) as t(id, email);


-- ===========================================================================
-- 1. PRIVILEGES — the table stayed shut to the public
-- ===========================================================================
select ok(
  not has_table_privilege('anon', 'public.family_invitations', 'SELECT'),
  'anon holds no SELECT on family_invitations'
);
select ok(
  not has_table_privilege('anon', 'public.family_invitations', 'INSERT'),
  'anon holds no INSERT on family_invitations'
);
select ok(
  not has_table_privilege('authenticated', 'public.family_invitations', 'DELETE'),
  'no client role may DELETE an invitation — a revoke is history, not erasure'
);
select ok(
  not has_function_privilege('anon', 'public.accept_family_invitation()', 'EXECUTE'),
  'an anonymous visitor cannot execute accept_family_invitation'
);
select ok(
  not has_function_privilege('anon', 'public.family_invitation_status()', 'EXECUTE'),
  'an anonymous visitor cannot execute family_invitation_status'
);

-- There must be exactly one SELECT policy, and it must be the administrator
-- one. This is the assertion that fails if somebody later adds "a parent can
-- see the invitation that created their account".
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'family_invitations'
      and cmd = 'SELECT'),
  1,
  'family_invitations has exactly one SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'family_invitations'
      and cmd = 'DELETE'),
  0,
  'family_invitations has no DELETE policy at all'
);

-- Three stored states. "Expired" is derived from expires_at, never stored, so a
-- fourth value here would mean a sweep nobody wrote.
select is(
  (select count(*)::int from pg_enum e
     join pg_type t on t.oid = e.enumtypid
    where t.typname = 'invitation_state'),
  3,
  'invitation_state has exactly three values — expired is derived, not stored'
);


-- ===========================================================================
-- 2. CREATION — administrators only
-- ===========================================================================
set local role authenticated;

-- An educator inviting a family would be provisioning platform access outside
-- their assignment. Refused by RLS, not by the UI.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select throws_ok(
  $$ insert into public.family_invitations (email, expires_at)
     values ('sample.attacker@example.com', now() + interval '1 hour') $$,
  '42501',
  null,
  'an educator cannot create an invitation'
);

-- A parent inviting anyone is the self-service signup this release does not
-- have, reached one step sideways.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ insert into public.family_invitations (email, expires_at)
     values ('sample.attacker@example.com', now() + interval '1 hour') $$,
  '42501',
  null,
  'a parent cannot create an invitation'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

insert into public.family_invitations (email, invited_user_id, invited_by, expires_at)
values (
  'sample.invitee.one@example.com', :'invitee_ok', :'admin',
  now() + interval '1 hour'
);

select is(
  (select count(*)::int from public.family_invitations
    where email = 'sample.invitee.one@example.com' and state = 'pending'),
  1,
  'an administrator creates one pending invitation'
);

-- Idempotency (AGENTS.md §11). A double-clicked button must not fan one family
-- out into two invitations.
select throws_ok(
  $$ insert into public.family_invitations (email, expires_at)
     values ('sample.invitee.one@example.com', now() + interval '1 hour') $$,
  '23505',
  null,
  'a second pending invitation for the same address is refused'
);

-- The three states and their timestamps cannot disagree.
select throws_ok(
  $$ insert into public.family_invitations (email, expires_at, state)
     values ('sample.invitee.nine@example.com', now() + interval '1 hour', 'accepted') $$,
  '23514',
  null,
  'an invitation cannot be born accepted with no accepted_at'
);

-- An invitation issued two hours ago under a one-hour window: the ordinary way
-- one expires. `created_at` is set explicitly because
-- `family_invitations_expiry_after_creation` refuses a row that was born
-- already expired, which is an invariant worth keeping.
insert into public.family_invitations
  (email, invited_user_id, invited_by, created_at, expires_at)
values (
  'sample.invitee.two@example.com', :'invitee_expired', :'admin',
  now() - interval '2 hours', now() - interval '1 hour'
);

insert into public.family_invitations
  (email, invited_user_id, invited_by, expires_at, state, revoked_at, revoked_by)
values (
  'sample.invitee.three@example.com', :'invitee_revoked', :'admin',
  now() + interval '1 hour', 'revoked', now(), :'admin'
);


-- ===========================================================================
-- 3. VISIBILITY — administrators only
-- ===========================================================================
select cmp_ok(
  (select count(*)::int from public.family_invitations),
  '>=',
  3,
  'an administrator reads the invitations'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select is(
  (select count(*)::int from public.family_invitations),
  0,
  'an educator reads zero invitations'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select count(*)::int from public.family_invitations),
  0,
  'a parent reads zero invitations'
);

-- Nor can a parent quietly extend, revoke, or redirect one they cannot see.
-- Not an error: RLS silently narrows the UPDATE to the rows the caller may
-- reach, which for a parent is none. So the statement succeeds and changes
-- nothing, and the assertion that matters is the one after it.
select lives_ok(
  $$ update public.family_invitations
        set expires_at = now() + interval '100 years' $$,
  'a parent''s attempt to extend every invitation is not an error'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

select is(
  (select count(*)::int from public.family_invitations
    where expires_at > now() + interval '50 years'),
  0,
  'and it extended nothing — the UPDATE policy reached zero rows'
);


-- ===========================================================================
-- 4. ACCEPTANCE — one role, one time
-- ===========================================================================
set local request.jwt.claims =
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.family_invitation_status(),
  'pending',
  'the invited account sees its own invitation as pending'
);

select is(
  public.accept_family_invitation()::text,
  'accepted',
  'the invited account accepts its own invitation (MPS-ACC-015)'
);

-- THE ASSERTION THIS WHOLE FILE EXISTS FOR.
select is(
  (select string_agg(role::text, ',' order by role::text)
     from public.user_roles where user_id = :'invitee_ok'),
  'parent',
  'acceptance grants exactly one role, and it is parent — never educator, admin, or owner'
);

-- Single use. The second attempt is a retried request, a double-clicked button,
-- or a replayed one; all three get the same refusal.
select is(
  public.accept_family_invitation(),
  null,
  'a second acceptance is refused (single use)'
);

select is(
  public.family_invitation_status(),
  'accepted',
  'the accepted invitation reports itself accepted, not pending'
);

-- An expired invitation cannot be completed by a session that is already open.
set local request.jwt.claims =
  '{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  public.family_invitation_status(),
  'expired',
  'expiry is derived from expires_at, not from a stored state'
);
select is(
  public.accept_family_invitation(),
  null,
  'an expired invitation is refused (MPS-ACC-017)'
);
select is(
  (select count(*)::int from public.user_roles where user_id = :'invitee_expired'),
  0,
  'a refused expired acceptance grants no role'
);

-- A revoked invitation is refused for a different reason and with the same
-- answer: the caller is never told which closure it hit.
set local request.jwt.claims =
  '{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is(
  public.family_invitation_status(),
  'revoked',
  'a revoked invitation reports itself revoked to its own account'
);
select is(
  public.accept_family_invitation(),
  null,
  'a revoked invitation is refused'
);
select is(
  (select count(*)::int from public.user_roles where user_id = :'invitee_revoked'),
  0,
  'a refused revoked acceptance grants no role'
);

-- An account nobody invited gets nothing. This is the forged-request case: a
-- signed-in visitor calling the function directly.
set local request.jwt.claims =
  '{"sub":"21000000-0000-4000-8000-000000000004","role":"authenticated"}';

select is(
  public.family_invitation_status(),
  null,
  'an account with no invitation learns nothing about anyone else''s'
);
select is(
  public.accept_family_invitation(),
  null,
  'an uninvited account cannot grant itself access'
);
select is(
  (select count(*)::int from public.user_roles where user_id = :'invitee_none'),
  0,
  'an uninvited account holds no role'
);

-- A parent cannot re-run acceptance to collect a second role, and an educator
-- cannot run it to collect a first one.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select is(
  public.accept_family_invitation(),
  null,
  'an educator cannot use the acceptance function to gain family access'
);
select is(
  (select string_agg(role::text, ',' order by role::text)
     from public.user_roles where user_id = :'educator'),
  'educator',
  'the educator still holds exactly the educator role'
);

-- The role table itself remains unwritable by its own holder, acceptance or no
-- acceptance. `accept_family_invitation` is SECURITY DEFINER precisely so that
-- this stays true.
set local request.jwt.claims =
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('21000000-0000-4000-8000-000000000001', 'admin') $$,
  '42501',
  null,
  'an accepted parent still cannot grant itself the admin role'
);


-- ===========================================================================
-- 4b. AN ACCEPTED INVITATION IS OUT OF THE REVOKE PATH, IN THE DATABASE
-- ===========================================================================
-- The application refuses to withdraw an accepted invitation, and refuses to
-- delete an account that holds a role or a family membership. This is the third
-- refusal, and it is the one a forged request cannot go around: withdrawing is
-- an UPDATE to `revoked`, and the state/timestamp constraint will not let an
-- accepted row take it. An administrator therefore has no path — through the
-- UI, through PostgREST, or through psql as `authenticated` — that turns a
-- real family's account into a deletion candidate.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

select throws_ok(
  $$ update public.family_invitations
        set state = 'revoked', revoked_at = now()
      where email = 'sample.invitee.one@example.com' $$,
  '23514',
  null,
  'an ACCEPTED invitation cannot be marked revoked — the account is never a deletion candidate'
);

select throws_ok(
  $$ update public.family_invitations
        set state = 'pending', accepted_at = null
      where email = 'sample.invitee.one@example.com' $$,
  '23514',
  null,
  'an accepted invitation cannot be pushed back to pending to re-open the revoke path'
);

select is(
  (select state::text from public.family_invitations
    where email = 'sample.invitee.one@example.com'),
  'accepted',
  'and the accepted invitation is unchanged by either attempt'
);

-- The partial-failure precondition. When a provisioned account is deleted --
-- by a withdraw, by the first half of a resend, or by an administrator working
-- outside the application -- the invitation row SURVIVES with a NULL account.
-- History is preserved (MPS-REQ-024) and the row stays resendable, which is
-- what makes the interrupted resend in `src/lib/admin/invitations.ts`
-- recoverable rather than stranded.
reset role;

delete from auth.users where id = '21000000-0000-4000-8000-000000000002';

select is(
  (select count(*)::int from public.family_invitations
    where email = 'sample.invitee.two@example.com'),
  1,
  'deleting the provisioned account leaves the invitation row standing'
);

select is(
  (select invited_user_id from public.family_invitations
    where email = 'sample.invitee.two@example.com'),
  null,
  'and clears the account reference rather than dangling or cascading'
);

select is(
  (select state::text from public.family_invitations
    where email = 'sample.invitee.two@example.com'),
  'pending',
  'the row keeps its own state — the account going away is not a decision'
);


-- ===========================================================================
-- 5. HISTORY — attributable, and free of contact detail
-- ===========================================================================
reset role;

-- Scoped to this test's own rows. The local stack accumulates invitations from
-- the Playwright round trip, and an assertion that counted every row in the
-- table would fail the next time somebody exercises the real flow — a green
-- suite must not depend on nobody having used the application.
select is(
  (select count(*)::int from public.audit_events a
    where a.entity_type = 'family_invitation' and a.action = 'invited'
      and a.entity_id in (
        select i.id from public.family_invitations i
         where i.email in ('sample.invitee.one@example.com',
                           'sample.invitee.two@example.com',
                           'sample.invitee.three@example.com'))),
  3,
  'each invitation is recorded in history (MPS-REQ-024)'
);

select is(
  (select count(*)::int from public.audit_events a
    where a.entity_type = 'family_invitation' and a.action = 'accepted'
      and a.entity_id in (
        select i.id from public.family_invitations i
         where i.email = 'sample.invitee.one@example.com')),
  1,
  'an acceptance is recorded once'
);

-- `audit_events` is readable by every administrator and outlives the
-- invitation. An address in the payload would be a contact detail nobody
-- decided to retain (GAP-PUBLIC-004).
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'family_invitation'
      and changed_fields::text ilike '%@%'),
  0,
  'no email address reaches invitation history'
);

select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'family_invitation'
      and changed_fields::text ilike '%token%'),
  0,
  'no token reaches invitation history'
);

select * from finish();
rollback;
