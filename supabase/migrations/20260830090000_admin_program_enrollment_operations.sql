-- Foundation Release — authorized administrator program and enrollment operations
--
-- MPS: MPS-REQ-016 (program lifecycle with material state history),
--      MPS-REQ-017 (enrollment states), MPS-REQ-020/021/024,
--      MPS-RUL-004 (records status; decides no financial outcome),
--      MPS-RUL-005 (only an administrator or the owner publishes),
--      MPS-ACC-026/027/031
-- MTS: SECURITY-ARCHITECTURE deny-by-default and least privilege;
--      INTEGRATION-MANIFEST "use idempotency for enrollment ... mutations";
--      MTS-ARCHITECTURE-ADDENDUM item 8 (manual checkout reconciliation)
--
-- WHY EVERY WRITE IS A FUNCTION AND NOT A TABLE POLICY
--
-- An RLS policy can say *who* may write. It cannot say *which* state change is
-- legal, cannot refuse a write made against a stale copy of the row, and cannot
-- tell a repeat submission from a new one. All three are requirements here, so
-- the write path is a SECURITY DEFINER function that performs the check, the
-- transition rule, the concurrency test, and the update as one statement — the
-- same shape `families` and `students` already use.
--
-- Consequently `public.enrollments` gains no write policy and no write grant,
-- and `public.programs` LOSES the three write verbs it held. That revoke is the
-- point: after this migration no Data API client role can write either table by
-- any route, so the transition rules below cannot be walked around by an
-- authenticated caller composing their own PostgREST request. This removes
-- privilege and grants none.
--
-- WHAT IS DELIBERATELY ABSENT
--
--   * No payment table, payment column, verification flag, or evidence field.
--     Checklist §2 does not define how a successful payment is identified, so
--     nothing here may record that one was (GAP-ADMIN-002).
--   * No capacity or seat-count column (checklist §1, GAP-ADMIN-004).
--   * No new enum value. Program `canceled`/`completed` need the family
--     notification MPS-WFL-005 mandates and nothing provides (GAP-ADMIN-005).
--   * No scholarship, discount, refund, credit, or transfer of any kind
--     (MPS GAP-010, MPS-RUL-004).
--   * No delete path for either entity (checklist §11 retention is unanswered).
--
-- rollback:
--   revoke all on function public.admin_set_enrollment_state(uuid, public.enrollment_state, text, timestamptz) from authenticated;
--   drop function if exists public.admin_set_enrollment_state(uuid, public.enrollment_state, text, timestamptz);
--   drop function if exists public.admin_set_program_publication(uuid, public.program_publication_state, timestamptz);
--   drop function if exists public.admin_update_program_facts(uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, text, public.availability_state, text);
--   drop function if exists public.admin_create_program_draft(text, text, text);
--   drop function if exists private.program_publication_transition_allowed(public.program_publication_state, public.program_publication_state);
--   drop function if exists private.enrollment_transition_allowed(public.enrollment_state, public.enrollment_state);
--   drop trigger if exists enrollments_set_updated_at on public.enrollments;
--   grant insert, update, delete on public.programs to authenticated;


-- ---------------------------------------------------------------------------
-- enrollments.updated_at — the optimistic-concurrency token
-- ---------------------------------------------------------------------------
-- The column existed from the family-dashboard migration but nothing maintained
-- it, so it silently held the insert time forever. It is now the value a form
-- carries to prove which version of the row it was rendered from, which only
-- works if every update moves it.
create trigger enrollments_set_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- private.enrollment_transition_allowed
-- ---------------------------------------------------------------------------
-- The approved administrative transition table, in the database rather than in
-- application code the browser talks to.
--
-- Only four target states are administrative decisions:
--   confirmed  — MPS-REQ-017 with the owner's confirmation of 2026-08-29, read
--                together with SECURITY-ARCHITECTURE "...or authorized manual
--                verification". It is a decision by a person, never a claim
--                about a payment.
--   waitlisted — MPS-RUL-002. A waitlist place is not enrollment and collects
--                no payment.
--   blocked    — MPS-WFL-003 `blocked`, owner ACT-004: hold for administrative
--                review.
--   canceled   — MPS-RUL-004: the beta RECORDS the status. It decides and
--                issues no refund, credit, or transfer.
--
-- `started`, `approval_pending`, and `payment_failed` are outcomes of the
-- family journey and the payment path, not decisions an administrator makes, so
-- they are never a legal target here.
--
-- Two refusals are deliberate and are not oversights:
--
--   payment_failed -> confirmed. Confirming an enrollment whose payment is
--   recorded as failed is a financial judgment, and checklist §2 and §5 are
--   unanswered. The two-step payment_failed -> blocked -> confirmed stays open
--   and leaves two audit rows explaining the correction.
--
--   confirmed -> blocked. Proposed as the correction path for a confirmation
--   made in error; the owner declined to confirm it on 2026-08-29. There is
--   therefore no approved way to undo a confirmation short of cancelling the
--   enrollment, which means something different to the family. Recorded as
--   GAP-ADMIN-008; the confirmation dialog warns before the fact rather than
--   leaving an administrator to discover it after.
--
-- `canceled` is terminal: reinstatement touches checklist §5 (GAP-ADMIN-003).
create function private.enrollment_transition_allowed(
  current_state public.enrollment_state,
  next_state public.enrollment_state
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case current_state
    when 'started'          then next_state in ('confirmed', 'waitlisted', 'blocked', 'canceled')
    when 'approval_pending' then next_state in ('confirmed', 'waitlisted', 'blocked', 'canceled')
    when 'payment_pending'  then next_state in ('confirmed', 'waitlisted', 'blocked', 'canceled')
    when 'waitlisted'       then next_state in ('confirmed', 'blocked', 'canceled')
    when 'blocked'          then next_state in ('confirmed', 'waitlisted', 'canceled')
    when 'payment_failed'   then next_state in ('waitlisted', 'blocked', 'canceled')
    when 'confirmed'        then next_state in ('canceled')
    when 'canceled'         then false
    else false
  end;
$$;

revoke all on function private.enrollment_transition_allowed(
  public.enrollment_state, public.enrollment_state) from public;
grant execute on function private.enrollment_transition_allowed(
  public.enrollment_state, public.enrollment_state) to authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_set_enrollment_state
-- ---------------------------------------------------------------------------
-- The only write path to `public.enrollments` in the product.
--
-- Returns a short word rather than raising for the outcomes that are normal
-- results instead of faults:
--   'updated'   — the state changed and the audit trigger recorded it
--   'unchanged' — the target already is the current state
--
-- 'unchanged' is what makes a repeat submission safe (INTEGRATION-MANIFEST
-- idempotency): the second of two identical submissions writes nothing, so
-- `state_changed_at` does not creep forward and no second audit row appears
-- claiming a change that did not happen.
--
-- Everything else raises, each with a distinguishable SQLSTATE so the
-- application can render the right recovery without parsing a message:
--   42501 — the caller is not an administrator
--   P0002 — no such enrollment (also: an id belonging to nothing the caller
--           may see; the application reports both identically so the function
--           never confirms that a record exists)
--   40001 — the row changed since the form was rendered (stale)
--   23514 — that transition is not approved from the current state
--   22023 — the note is missing or too long
--
-- `state_note` is stored on the row and is NOT written to `audit_events`: it is
-- administrator free text and cannot be guaranteed free of a child's or a
-- family's name, which must not enter the history payload.
create function public.admin_set_enrollment_state(
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

revoke all on function public.admin_set_enrollment_state(
  uuid, public.enrollment_state, text, timestamptz) from public;
grant execute on function public.admin_set_enrollment_state(
  uuid, public.enrollment_state, text, timestamptz) to authenticated;

comment on function public.admin_set_enrollment_state(
  uuid, public.enrollment_state, text, timestamptz) is
  'Authorized administrative enrollment state change (MPS-REQ-017). Records a '
  'status; decides and issues no financial outcome (MPS-RUL-004). Confirms no '
  'payment: no payment evidence exists in this release (GAP-ADMIN-002).';


-- ---------------------------------------------------------------------------
-- private.program_publication_transition_allowed
-- ---------------------------------------------------------------------------
-- MPS-REQ-016 "create, review, publish, ... and archive", plus MPS-WFL-005's
-- recovery clause "correct errors through authorized edits", which is what
-- makes published -> draft and archived -> draft legal.
--
-- Every transition here is reversible, which is why publication needs no
-- separate correction gap the way enrollment confirmation does.
create function private.program_publication_transition_allowed(
  current_state public.program_publication_state,
  next_state public.program_publication_state
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case current_state
    when 'draft'     then next_state in ('published', 'archived')
    when 'published' then next_state in ('draft', 'archived')
    when 'archived'  then next_state in ('draft')
    else false
  end;
$$;

revoke all on function private.program_publication_transition_allowed(
  public.program_publication_state, public.program_publication_state) from public;
grant execute on function private.program_publication_transition_allowed(
  public.program_publication_state, public.program_publication_state) to authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_create_program_draft
-- ---------------------------------------------------------------------------
-- MPS-WFL-005 main path step 1. A draft and nothing more: every published_*
-- fact is left NULL, because NULL means "the approved source does not publish
-- this" and the catalog already renders that as "Contact for details". Creating
-- a program with invented dates, prices, or audiences would be the one thing
-- the import rules forbid outright.
--
-- `publication_state` is not a parameter. A new program is a draft; publishing
-- is a separate, separately audited decision.
--
-- `source` records that this row was authored in the operations portal rather
-- than imported from the published website, so a later content audit can tell
-- the two apart. It is a provenance fact, not a claim about the content.
create function public.admin_create_program_draft(
  program_name text,
  program_slug text,
  program_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  trimmed_name text := btrim(coalesce(program_name, ''));
  trimmed_slug text := btrim(coalesce(program_slug, ''));
  trimmed_summary text := nullif(btrim(coalesce(program_summary, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_name = '' or char_length(trimmed_name) > 160 then
    raise exception 'program name must be 1 to 160 characters'
      using errcode = '22023';
  end if;

  if trimmed_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(trimmed_slug) > 80 then
    raise exception 'program slug must be lowercase letters, numbers, and single hyphens'
      using errcode = '22023';
  end if;

  if trimmed_summary is not null and char_length(trimmed_summary) > 600 then
    raise exception 'summary must be 600 characters or fewer'
      using errcode = '22023';
  end if;

  if exists (select 1 from public.programs p where p.slug = trimmed_slug) then
    raise exception 'that web address is already in use' using errcode = '23505';
  end if;

  insert into public.programs (name, slug, summary, publication_state,
                               availability, source, sort_order)
  values (trimmed_name, trimmed_slug, trimmed_summary, 'draft', 'unknown',
          'Authored in the operations portal',
          coalesce((select max(p.sort_order) + 1 from public.programs p), 0))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.admin_create_program_draft(text, text, text) from public;
grant execute on function public.admin_create_program_draft(text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_update_program_facts
-- ---------------------------------------------------------------------------
-- Published facts, availability state, and the external checkout link, as one
-- update so the audit trigger records one coherent change rather than a dozen
-- partial ones.
--
-- Empty string becomes NULL for every optional fact. The difference matters:
-- NULL is "not published" and renders as "Contact for details"; '' would be a
-- published empty fact, which is a claim that the fact is nothing.
--
-- CHECKOUT URL. Constrained here, in the database, and not only in the form:
-- https only, exactly the approved `pay.homeschoolhaven.org` host from
-- BETA-CONTENT-IMPORT-INVENTORY, and no query string or fragment — nothing may
-- ride along in that URL, because an identifier appended to a checkout link is
-- private data leaving the platform in a query string.
--
-- No capacity, seat count, price rule, or scholarship field appears anywhere in
-- this signature (GAP-ADMIN-004, MPS GAP-010).
create function public.admin_update_program_facts(
  target_id uuid,
  expected_updated_at timestamptz,
  program_name text,
  program_summary text,
  program_audience text,
  program_format text,
  program_location text,
  program_educator text,
  program_dates text,
  program_schedule text,
  program_duration text,
  program_session_length text,
  program_price text,
  program_availability public.availability_state,
  program_checkout_url text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.programs%rowtype;
  trimmed_name text := btrim(coalesce(program_name, ''));
  clean_checkout text := nullif(btrim(coalesce(program_checkout_url, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_name = '' or char_length(trimmed_name) > 160 then
    raise exception 'program name must be 1 to 160 characters'
      using errcode = '22023';
  end if;

  if clean_checkout is not null
     and clean_checkout !~ '^https://pay\.homeschoolhaven\.org(/[A-Za-z0-9._~/-]*)?$' then
    raise exception 'checkout link must be an https pay.homeschoolhaven.org address with no query string'
      using errcode = '22023';
  end if;

  select * into current_row from public.programs where id = target_id for update;

  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'program changed since it was loaded' using errcode = '40001';
  end if;

  update public.programs
  set name                     = trimmed_name,
      summary                  = nullif(btrim(coalesce(program_summary, '')), ''),
      audience                 = nullif(btrim(coalesce(program_audience, '')), ''),
      format                   = nullif(btrim(coalesce(program_format, '')), ''),
      location                 = nullif(btrim(coalesce(program_location, '')), ''),
      educator                 = nullif(btrim(coalesce(program_educator, '')), ''),
      published_dates          = nullif(btrim(coalesce(program_dates, '')), ''),
      published_schedule       = nullif(btrim(coalesce(program_schedule, '')), ''),
      published_duration       = nullif(btrim(coalesce(program_duration, '')), ''),
      published_session_length = nullif(btrim(coalesce(program_session_length, '')), ''),
      published_price          = nullif(btrim(coalesce(program_price, '')), ''),
      availability             = program_availability,
      checkout_url             = clean_checkout
  where id = target_id;

  return 'updated';
end;
$$;

revoke all on function public.admin_update_program_facts(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text,
  text, text, public.availability_state, text) from public;
grant execute on function public.admin_update_program_facts(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text,
  text, text, public.availability_state, text) to authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_set_program_publication
-- ---------------------------------------------------------------------------
-- MPS-RUL-005: only an administrator or the owner publishes. `private.is_admin()`
-- is that rule; an assigned educator reaches this function and is refused,
-- which is MPS-ACC-027 as an enforced control rather than a hidden button.
--
-- Publishing carries one truthfulness precondition (MPS-ACC-008/009): a program
-- reaching the public catalog must at least carry a name and a summary, so a
-- visitor never meets an entry that says nothing. It is checked here rather
-- than only in the form, and it is reported as a refusal an administrator can
-- act on, not as a generic failure.
create function public.admin_set_program_publication(
  target_id uuid,
  next_state public.program_publication_state,
  expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.programs%rowtype;
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into current_row from public.programs where id = target_id for update;

  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'program changed since it was loaded' using errcode = '40001';
  end if;

  if current_row.publication_state = next_state then
    return 'unchanged';
  end if;

  if not private.program_publication_transition_allowed(
       current_row.publication_state, next_state) then
    raise exception 'transition from % to % is not approved',
      current_row.publication_state, next_state using errcode = '23514';
  end if;

  if next_state = 'published'
     and (current_row.summary is null or btrim(current_row.summary) = '') then
    raise exception 'a program needs a summary before it can be published'
      using errcode = '22023';
  end if;

  update public.programs
  set publication_state = next_state
  where id = target_id;

  return 'updated';
end;
$$;

revoke all on function public.admin_set_program_publication(
  uuid, public.program_publication_state, timestamptz) from public;
grant execute on function public.admin_set_program_publication(
  uuid, public.program_publication_state, timestamptz) to authenticated;


-- ---------------------------------------------------------------------------
-- Least privilege: remove the direct write path to public.programs
-- ---------------------------------------------------------------------------
-- Approved by the owner on 2026-08-29 (implementation prompt §11, option A).
--
-- `20260827212023_foundation_rls_policies.sql` granted INSERT, UPDATE, and
-- DELETE on `programs` to `authenticated`, gated by `private.is_admin()`
-- policies. That was correct for who, but it left an administrator a PostgREST
-- route that skips the transition rules, the publication precondition, and the
-- concurrency check above. Every table in `public` now holds the same shape:
-- reads through RLS, writes only through an authorized function.
--
-- The `programs_insert_admin`, `programs_update_admin`, and
-- `programs_delete_admin` policies are left in place deliberately. They are
-- unreachable without the privilege and they document the authority; removing
-- them would also change what happens if a future migration re-grants a verb.
revoke insert, update, delete on public.programs from authenticated;
