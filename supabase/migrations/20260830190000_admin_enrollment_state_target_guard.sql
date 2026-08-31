-- Foundation Release — refuse a non-administrative enrollment state outright
--
-- MPS: MPS-REQ-017 (an administrator manages enrollment STATES), MPS-RUL-004,
--      MPS-ACC-026; GAP-ADMIN-002 (no payment claim may be recorded)
-- MTS: SECURITY-ARCHITECTURE — an authorization decision is taken on the
--      server, and a refusal must not be reported as a success
--
-- WHAT WAS WRONG
--
-- `public.admin_set_enrollment_state`, as shipped in
-- 20260830090000_admin_program_enrollment_operations.sql, checked the approved
-- transition table only AFTER its idempotent no-op short-circuit:
--
--     if current_row.state = next_state then return 'unchanged'; end if;
--     if not private.enrollment_transition_allowed(...) then raise ...
--
-- The transition table never lists `started`, `approval_pending`, or
-- `payment_failed` as a target, so any real MOVE to one of them was refused.
-- But a call naming a state the row ALREADY held never reached that check: it
-- returned 'unchanged' and reported success for a state an administrator has no
-- authority to set at all. Nothing was written and no audit row was created, so
-- this granted no privilege over the data -- what it granted was a false
-- affirmative, which is its own problem on a surface whose entire purpose is to
-- say only true things about an enrollment.
--
-- `supabase/tests/database/70_admin_program_enrollment_ops.test.sql` asserts
-- exactly this ("approval_pending is never a state an administrator may set")
-- and caught it the first time pgTAP was run against a real database.
--
-- WHY THIS IS A SEPARATE MIGRATION
--
-- 20260830090000 has already been applied to the linked review project, and its
-- version is recorded in `supabase_migrations.schema_migrations` there. Editing
-- that file would fix a local `db reset` and change nothing on the review
-- project, because `supabase db push` does not re-run a migration it has
-- already recorded. An applied migration is history; a correction is a new
-- migration. This one is `create or replace`, so it is safe to apply to a
-- database that has the flawed definition and to one built from scratch.
--
-- No signature change, so no grant changes: the existing
-- `grant execute ... to authenticated` from 20260830090000 still applies, and
-- `public.enrollments` still has no write policy and no write grant.
--
-- rollback:
--   Re-apply the function body as it stands in
--   20260830090000_admin_program_enrollment_operations.sql (identical except
--   for the admissibility check below). Rolling back restores the false
--   'unchanged' affirmative, so there is no reason to do it except to reproduce
--   the defect.


create or replace function public.admin_set_enrollment_state(
  target_id uuid,
  next_state public.enrollment_state,
  note text,
  expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.enrollments%rowtype;
  trimmed_note text := btrim(coalesce(note, ''));
begin
  -- Authorization first, before the row is even looked at. A caller who is not
  -- an administrator learns nothing about whether the id exists.
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_note = '' or char_length(trimmed_note) > 400 then
    raise exception 'a note of 1 to 400 characters is required'
      using errcode = '22023';
  end if;

  -- FOR UPDATE, so two administrators submitting at the same moment serialise
  -- here instead of racing: the second waits, then reads the first one's result
  -- and fails the staleness test below rather than overwriting it.
  select * into current_row
  from public.enrollments
  where id = target_id
  for update;

  if not found then
    raise exception 'enrollment not found' using errcode = 'P0002';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'enrollment changed since it was loaded'
      using errcode = '40001';
  end if;

  -- THE FIX. Only four states are administrative decisions. `started`,
  -- `approval_pending` and `payment_failed` are outcomes of the family journey
  -- and the payment path -- things that HAPPEN to an enrollment, never things
  -- an administrator declares about one. `payment_failed` in particular is a
  -- payment claim, and checklist §2 does not define how one is established
  -- (GAP-ADMIN-002).
  --
  -- It runs BEFORE the no-op short-circuit, and that order is the whole point.
  if next_state not in ('confirmed', 'waitlisted', 'blocked', 'canceled') then
    raise exception '% is not a state an administrator may set', next_state
      using errcode = '23514';
  end if;

  -- Idempotent no-op. Checked after staleness on purpose: a caller working from
  -- a stale row should be told the record moved even when their target happens
  -- to match where it moved to, because their reason for acting was formed
  -- against a state that no longer holds.
  if current_row.state = next_state then
    return 'unchanged';
  end if;

  if not private.enrollment_transition_allowed(current_row.state, next_state) then
    raise exception 'transition from % to % is not approved',
      current_row.state, next_state using errcode = '23514';
  end if;

  update public.enrollments
  set state = next_state,
      state_changed_at = now(),
      state_note = trimmed_note
  where id = target_id;

  return 'updated';
end;
$$;
