-- Foundation Release — invite-only family account provisioning
--
-- MPS: MPS-REQ-011 (create and verify ONE family account, recover from expired
--      verification, resume incomplete setup),
--      MPS-ACC-015 (a verified unique parent identity creates one family
--      account and can continue setup),
--      MPS-ACC-016 (an existing identity does not create a duplicate family and
--      receives a recovery path),
--      MPS-ACC-017 (expired verification can be renewed safely),
--      MPS-REQ-004 (private family data unreachable by anyone else),
--      MPS-REQ-021 (observable state and recovery),
--      MPS-REQ-024 (attributable history),
--      MPS-RUL-006 (approved minimum fields only),
--      MPS-RUL-007 (sanitized sample data).
-- MDS: no new visual convention.
-- MTS: SECURITY-ARCHITECTURE deny-by-default and least privilege;
--      IMPLEMENTATION-PLAN Phase 3; INTEGRATION-MANIFEST (Resend is NOT
--      configured — Supabase Auth sends the invitation with the committed
--      template, and no second provider is introduced).
--
-- ABOUT THIS FILE'S VERSION
--
-- `20260902170123` is the real clock time this slice was closed. It sorts
-- BEFORE `20260903000000`, `20260904000000`, and `20260905000000`, which were
-- authored with round forward-dated stamps and are already applied on both the
-- local stack and the linked project. That ordering is safe: this migration
-- depends only on `20260827212014` (roles and identity), `20260827212020`
-- (audit history), `20260827212023` (RLS policies), and `20260828010906`
-- (least-privilege grants), all of which precede it, and nothing later depends
-- on it. A fresh `supabase db reset` applies the whole set in filename order
-- and was verified to succeed.
--
-- Both history tables were repaired to this version with
-- `supabase migration repair`, so neither database will try to re-apply it.
-- `20260902171500_family_invitation_anon_grant_hardening.sql` follows this file
-- and closes an `anon` EXECUTE surface that only exists on the hosted project.
--
-- APPROVED PRODUCT DECISION, 2026-09-02
--
-- Family provisioning is INVITE-ONLY. Only an authorized administrator may
-- invite a family. There is no public self-service signup — `enable_signup`
-- stays false in config.toml, and nothing here reopens it. An invitation may
-- create the `parent` role and no other.
--
-- WHY EXPIRY IS NOT A STORED STATE
--
-- `invitation_state` has three values, not four. "Expired" is derived from
-- `expires_at` at read time. A stored fourth value would need something to move
-- rows into it — a job that does not exist in this release — and until that job
-- ran, an expired invitation would sit in the table claiming to be pending. A
-- derived answer cannot drift from the clock.
--
-- WHY `accept_family_invitation()` TAKES NO ARGUMENTS
--
-- Every escalation this flow could suffer arrives as a parameter: a role, a
-- family id, someone else's invitation id, an email. So the function accepts
-- none of them. It reads `auth.uid()`, finds the invitation issued to exactly
-- that account, and grants the literal role `'parent'`. There is no argument to
-- tamper with and no branch a caller can steer.
--
-- WHAT REVOKE ACTUALLY DOES
--
-- Marking a row revoked would not stop the emailed link: the token lives in
-- `auth.users`, not here. So the application deletes the unaccepted account
-- through the Admin API (`src/lib/admin/invitations.ts`), which invalidates the
-- outstanding link, and `invited_user_id` becomes NULL by the FK's ON DELETE SET
-- NULL. The row stays as history. An ACCEPTED invitation is never revoked here:
-- deleting a real family's account is a retention decision this release does not
-- have (GAP-ADMIN-011).
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--
--   * No educator or administrator invitation. `accept_family_invitation`
--     grants one literal role and there is no parameter to widen it
--     (AGENTS.md §5, GAP-ADMIN-004).
--   * No secondary-guardian invitation (ACT-007). That needs an existing family
--     to invite INTO and a consent position MPS GAP-005 leaves open.
--   * No family record. Acceptance grants the role and hands the parent to the
--     existing `/family/setup`, which is where a parent names their own family.
--   * No deletion of an accepted account, and no retention rule (GAP-ADMIN-011).
--   * No abuse protection on any public surface — this flow has none; invitation
--     creation is administrator-only. Turnstile remains the activation gate.
--
-- rollback:
--   drop trigger if exists family_invitations_audit on public.family_invitations;
--   drop function if exists public.record_family_invitation_audit();
--   revoke all on function public.family_invitation_status() from authenticated;
--   drop function if exists public.family_invitation_status();
--   revoke all on function public.accept_family_invitation() from authenticated;
--   drop function if exists public.accept_family_invitation();
--   drop table if exists public.family_invitations;
--   drop type if exists public.invitation_state;


-- ---------------------------------------------------------------------------
-- invitation_state
-- ---------------------------------------------------------------------------
create type public.invitation_state as enum (
  'pending',
  'accepted',
  'revoked'
);

comment on type public.invitation_state is
  'Lifecycle of an administrator-issued family invitation. "Expired" is NOT a '
  'value: it is derived from expires_at, so it cannot drift from the clock.';


-- ---------------------------------------------------------------------------
-- family_invitations
-- ---------------------------------------------------------------------------
create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),

  -- The invited ADULT's address, stored lowercased so "A@x.org" and "a@x.org"
  -- cannot both be pending. No child field, no household detail, no assistance
  -- or enrollment context (MPS-RUL-006, AGENTS.md §11).
  email text not null
    check (email = lower(btrim(email)))
    check (length(email) between 3 and 254),

  -- The account this invitation provisions. NULL once a pending account has
  -- been deleted by a revoke or a resend — the history stays, the credential
  -- does not.
  invited_user_id uuid references auth.users (id) on delete set null,

  -- MPS-REQ-024. Who issued it. Never NULL in practice: the only writer is an
  -- administrator's own session.
  invited_by uuid references auth.users (id) on delete set null,

  state public.invitation_state not null default 'pending',

  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  -- Resend history. A count rather than a log: how many times an administrator
  -- has had to reissue is the operational fact; each individual send carries
  -- nothing else worth keeping.
  sent_count integer not null default 1 check (sent_count between 1 and 50),
  last_sent_at timestamptz not null default now(),

  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,

  -- The three states and their timestamps cannot disagree.
  constraint family_invitations_state_consistent check (
    case state
      when 'accepted' then accepted_at is not null and revoked_at is null
      when 'revoked' then revoked_at is not null and accepted_at is null
      else accepted_at is null and revoked_at is null
    end
  ),

  constraint family_invitations_expiry_after_creation check (expires_at > created_at)
);

-- Idempotency (AGENTS.md §11 "handle retries idempotently"). A second invitation
-- for an address that is already waiting is refused by the database, so a
-- double-clicked button, a retried action, or two administrators working the
-- same list cannot fan one family out into two pending invitations. The
-- application turns that refusal into a resend of the existing one.
create unique index family_invitations_one_pending_per_email
  on public.family_invitations (email)
  where state = 'pending';

-- One account holds at most one live invitation, which is what lets
-- `accept_family_invitation()` find "the" invitation from `auth.uid()` alone.
create unique index family_invitations_one_pending_per_user
  on public.family_invitations (invited_user_id)
  where state = 'pending' and invited_user_id is not null;

create index family_invitations_state_idx
  on public.family_invitations (state, created_at desc);

comment on table public.family_invitations is
  'Administrator-issued family invitations (MPS-REQ-011). Invite-only: there is '
  'no self-service signup, and acceptance can grant the `parent` role only.';

alter table public.family_invitations enable row level security;

-- Deny-by-default with one authorized reader and writer. There is no `anon`
-- policy and no parent policy: an invited parent never reads this table
-- directly — `public.family_invitation_status()` tells them about their own
-- invitation and nothing else.
create policy "family_invitations_select_admin"
  on public.family_invitations for select
  to authenticated
  using (private.is_admin());

create policy "family_invitations_insert_admin"
  on public.family_invitations for insert
  to authenticated
  with check (private.is_admin());

create policy "family_invitations_update_admin"
  on public.family_invitations for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- No DELETE policy: an invitation is history (MPS-REQ-024), and a revoke is a
-- state change, not an erasure.

-- Least privilege, stated explicitly rather than inherited
-- (see 20260828010906_foundation_least_privilege_grants.sql). `anon` gets
-- nothing at all.
revoke all on public.family_invitations from anon, authenticated, public;
grant select, insert, update on public.family_invitations to authenticated;


-- ---------------------------------------------------------------------------
-- accept_family_invitation
-- ---------------------------------------------------------------------------
-- Single use, enforced by the WHERE clause of one conditional UPDATE. Two
-- concurrent acceptances both run it; exactly one matches a pending row, and
-- the loser is told the invitation is no longer open rather than silently
-- succeeding.
--
-- Expiry is checked here as well as by Supabase's own token TTL. Those are
-- different clocks guarding different things — the token stops an old EMAIL
-- from working, this stops an old INVITATION from being completed by a session
-- that is already established.
create function public.accept_family_invitation()
returns public.invitation_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := (select auth.uid());
  claimed uuid;
begin
  if viewer is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.family_invitations i
     set state = 'accepted',
         accepted_at = now()
   where i.invited_user_id = viewer
     and i.state = 'pending'
     and i.expires_at > now()
  returning i.id into claimed;

  if claimed is null then
    -- No pending, unexpired invitation for this account. Deliberately one
    -- answer for "expired", "revoked", "already accepted", and "never invited":
    -- the caller learns their invitation is not open, not which of those it was.
    return null;
  end if;

  -- THE ONLY ROLE THIS FLOW CAN EVER GRANT. Written as a literal, not read from
  -- the invitation, not passed in, not derived from anything a caller controls.
  -- An invitation cannot produce an educator, an administrator, or an owner.
  insert into public.user_roles (user_id, role, granted_by)
  values (viewer, 'parent', viewer)
  on conflict (user_id, role) do nothing;

  return 'accepted';
end;
$$;

comment on function public.accept_family_invitation() is
  'Accepts the calling account''s own pending invitation and grants the literal '
  'role `parent` (MPS-REQ-011). Takes no arguments: there is no role, family, '
  'email, or invitation id a caller could substitute. Single use.';

revoke all on function public.accept_family_invitation() from public;
grant execute on function public.accept_family_invitation() to authenticated;


-- ---------------------------------------------------------------------------
-- family_invitation_status
-- ---------------------------------------------------------------------------
-- What the acceptance screen may know: the state of the caller's OWN
-- invitation, with expiry folded in. No email, no inviter, no id, no other
-- account's row. Returns NULL when this account has no invitation, which the
-- screen shows as the same "no longer open" outcome as an expired one.
create function public.family_invitation_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when i.state = 'pending' and i.expires_at <= now() then 'expired'
           else i.state::text
         end
  from public.family_invitations i
  where i.invited_user_id = (select auth.uid())
  order by i.created_at desc
  limit 1;
$$;

comment on function public.family_invitation_status() is
  'The calling account''s own invitation state, with expiry derived. Discloses '
  'nothing about any other account and nothing about any email address.';

revoke all on function public.family_invitation_status() from public;
grant execute on function public.family_invitation_status() to authenticated;


-- ---------------------------------------------------------------------------
-- audit trigger
-- ---------------------------------------------------------------------------
-- MPS-REQ-024. `public.audit_events` is readable by every administrator, so the
-- payload carries ids, actors, and lifecycle actions only — NO email address and
-- NO token. An invitation token never reaches this table, a log, or an error.
create function public.record_family_invitation_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  act text;
begin
  if tg_op = 'INSERT' then
    act := 'invited';
  elsif new.state = 'accepted' and old.state <> 'accepted' then
    act := 'accepted';
  elsif new.state = 'revoked' and old.state <> 'revoked' then
    act := 'revoked';
  elsif new.sent_count > old.sent_count then
    act := 'resent';
  else
    -- Not every UPDATE is history. Clearing `invited_user_id` because the
    -- provisioned account was deleted is a consequence of an action already
    -- recorded, not a second action.
    return new;
  end if;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values (
    (select auth.uid()),
    'family_invitation',
    new.id,
    act,
    jsonb_build_object('state', new.state, 'sent_count', new.sent_count)
  );

  return new;
end;
$$;

create trigger family_invitations_audit
  after insert or update on public.family_invitations
  for each row execute function public.record_family_invitation_audit();
