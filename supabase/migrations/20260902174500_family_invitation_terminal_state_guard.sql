-- Foundation Release — an accepted or revoked invitation is final
--
-- MPS: MPS-REQ-011, MPS-REQ-024 (history is not rewritten)
-- MTS: SECURITY-ARCHITECTURE deny-by-default
--
-- WHAT THIS CLOSES, AND HOW IT WAS FOUND
--
-- `140_family_invitations.test.sql` asked whether an administrator could push
-- an ACCEPTED invitation back to `pending`. It could.
-- `family_invitations_state_consistent` only requires the timestamps to agree
-- with the state, and clearing `accepted_at` while setting `state = 'pending'`
-- satisfies it. That mattered: a pending invitation pointing at an account that
-- has already accepted is the one shape in which the withdraw path would
-- consider a real family's account for deletion.
--
-- The application refused it three ways already — the caller checks the state,
-- `accountIsEstablished()` refuses an account holding a role or a family
-- membership, and neither is reachable without an administrator session. This
-- adds the refusal a forged PostgREST request also meets.
--
-- A terminal state is terminal:
--   * `accepted` and `revoked` cannot change to anything, including each other;
--   * their timestamps cannot be cleared or moved, so history is not rewritten;
--   * a non-pending invitation cannot be re-pointed at an account.
--
-- Reissuing after a revoke is unaffected: that is a NEW invitation for the
-- address, which the unique partial index permits because the revoked row is
-- not pending.
--
-- rollback:
--   drop trigger if exists family_invitations_terminal_state on public.family_invitations;
--   drop function if exists public.enforce_family_invitation_terminal_state();

create function public.enforce_family_invitation_terminal_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.state <> 'pending' then
    if new.state is distinct from old.state then
      raise exception
        'an invitation that is already % cannot change state', old.state
        using errcode = '23514';
    end if;

    if new.invited_user_id is not null
       and new.invited_user_id is distinct from old.invited_user_id then
      raise exception
        'an invitation that is already % cannot be re-pointed at an account',
        old.state
        using errcode = '23514';
    end if;
  end if;

  -- MPS-REQ-024: the moment something happened is not editable after the fact.
  if old.accepted_at is not null
     and new.accepted_at is distinct from old.accepted_at then
    raise exception 'an acceptance time cannot be changed'
      using errcode = '23514';
  end if;

  if old.revoked_at is not null
     and new.revoked_at is distinct from old.revoked_at then
    raise exception 'a revocation time cannot be changed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.enforce_family_invitation_terminal_state() is
  'Accepted and revoked invitations are final. Keeps an accepted invitation out '
  'of the withdraw path, which is the only path that deletes an account.';

create trigger family_invitations_terminal_state
  before update on public.family_invitations
  for each row execute function public.enforce_family_invitation_terminal_state();

revoke all on function public.enforce_family_invitation_terminal_state()
  from public, anon;
