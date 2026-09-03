-- Foundation Release — atomically claim invitation account mutations
--
-- Revoking and resending must call the external Auth Admin API to invalidate
-- an emailed link. A database transaction cannot safely stay open across that
-- call. `processing_token` is a short-lived compare-and-set claim instead: the
-- acceptance functions treat a claimed invitation as closed, while only the
-- operation holding the token may restore or finalize it.
--
-- The token is not an invitation credential and is never sent to a browser.
-- The table remains administrator-only under its existing RLS policies.
--
-- rollback:
--   Restore `accept_family_invitation` and `family_invitation_status` from
--   20260902170123_family_invitation_provisioning.sql, then run:
--   alter table public.family_invitations
--     drop constraint family_invitations_processing_pending;
--   alter table public.family_invitations drop column processing_token;

alter table public.family_invitations
  add column processing_token uuid;

comment on column public.family_invitations.processing_token is
  'Short-lived ownership token for revoke/resend work. While present, the '
  'invitation cannot be accepted.';

alter table public.family_invitations
  add constraint family_invitations_processing_pending check (
    processing_token is null or state = 'pending'
  );


-- A claim and an acceptance race on the same row. Whichever conditional UPDATE
-- takes the row lock first wins; after a claim commits, this WHERE clause is no
-- longer eligible until that operation deliberately restores it.
create or replace function public.accept_family_invitation()
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
     and i.processing_token is null
     and i.expires_at > now()
  returning i.id into claimed;

  if claimed is null then
    return null;
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (viewer, 'parent', viewer)
  on conflict (user_id, role) do nothing;

  return 'accepted';
end;
$$;

comment on function public.accept_family_invitation() is
  'Accepts the calling account''s own unclaimed pending invitation and grants '
  'the literal role `parent` (MPS-REQ-011). Single use.';


-- Do not render an acceptance form during revoke/resend processing. Returning
-- NULL preserves the existing indistinguishable closed-invitation response.
create or replace function public.family_invitation_status()
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
    and i.processing_token is null
  order by i.created_at desc
  limit 1;
$$;

comment on function public.family_invitation_status() is
  'The calling account''s own unclaimed invitation state, with expiry derived. '
  'Discloses nothing about any other account or email address.';
