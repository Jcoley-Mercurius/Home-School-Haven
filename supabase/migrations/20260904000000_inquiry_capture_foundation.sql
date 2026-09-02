-- Foundation Release — inquiry capture
--
-- MPS: MPS-REQ-009 (a family chooses guidance, a visit, a general question, or
--      discounted-class assistance from the public experience),
--      MPS-REQ-010 (record each submitted inquiry ONCE with its type, contact
--      information, time, current state, and authorized administrative owner,
--      while keeping assistance requests private),
--      MPS-REQ-021 (observable state and recovery),
--      MPS-REQ-024 (attributable history),
--      MPS-RUL-003 (sensitive family matters stay private),
--      MPS-RUL-004 (financial exceptions are handled manually; the beta records
--      status but does not decide or issue outcomes),
--      MPS-RUL-006 (approved minimum fields only),
--      MPS-RUL-007 (sanitized sample data),
--      MPS-WFL-001 (inquiry_submitted; notify the administrator),
--      MPS-WFL-004 (six states, verbatim; confirm receipt privately; notify
--      ONLY authorized administrators; no automated eligibility decision),
--      MPS-ACC-012, MPS-ACC-013, MPS-ACC-014
-- MDS: no new visual convention; the admin list reuses the approved table/card
--      and state-pill patterns.
-- MTS: SECURITY-ARCHITECTURE deny-by-default, least privilege, and "prevent
--      sensitive fields from entering logs, analytics, URLs, errors, prompts,
--      or fixtures"; INTEGRATION-MANIFEST (Resend is NOT configured, so no
--      email is sent from this path).
--
-- WHY A FUNCTION AND NOT A TABLE GRANT
--
-- `20260828010906_foundation_least_privilege_grants.sql` left `anon` holding
-- exactly one privilege in this schema: SELECT on programs. A public visitor
-- submitting an inquiry is the first unauthenticated WRITE in the product, and
-- `supabase/tests/database/00_setup.test.sql` fails the build if any table
-- grants a write verb to `anon`. That test is right, and this migration does
-- not weaken it: `public.inquiries` grants nothing to `anon` and nothing to
-- `authenticated`. `public.submit_inquiry` is the only door, it is SECURITY
-- DEFINER, and it decides every field a caller does not get to choose.
--
-- HOW ASSISTANCE PRIVACY IS ENFORCED (MPS-ACC-013)
--
-- Not by filtering on type. `public.inquiries` has exactly one SELECT policy,
-- `private.is_admin()`. There is no educator policy and no family policy, so
-- an educator's session reaches zero rows of ANY type — an assistance request
-- is unreachable because there is no policy that could return it, which is a
-- property a future filter cannot accidentally invert. The audit trigger below
-- carries the same rule into history: it records states and actors, never a
-- name, an email, a phone number, or a message.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--
--   * No eligibility, discount, scholarship, award, amount, or price. The
--     state `approved_path_provided` records that an administrator gave the
--     family a path; it decides nothing (MPS-RUL-004).
--   * No email. MPS names no confirmation CHANNEL for MPS-ACC-012 or the
--     MPS-WFL-004 notification "Confirm receipt privately", and Resend is
--     unconfigured. Receipt is confirmed on screen and the administrator queue
--     is the notification (prompt GAP-PUBLIC-001).
--   * No automatic owner assignment. MPS-WFL-004 names ACT-006 as the workflow
--     owner but states no assignment rule, so `owner_user_id` starts NULL and
--     an administrator claims it (GAP-PUBLIC-003).
--   * No rate limiting or abuse protection. That is Cloudflare Turnstile at the
--     public-activation gate (GAP-PUBLIC-002).
--   * No retention or deletion rule for contact details (GAP-PUBLIC-004).
--
-- rollback:
--   drop trigger if exists inquiries_audit on public.inquiries;
--   drop function if exists public.record_inquiry_audit();
--   revoke all on function public.admin_set_inquiry_state(uuid, public.inquiry_state, uuid, boolean) from authenticated;
--   drop function if exists public.admin_set_inquiry_state(uuid, public.inquiry_state, uuid, boolean);
--   revoke all on function public.submit_inquiry(public.inquiry_type, text, text, text, text, text, uuid) from anon, authenticated;
--   drop function if exists public.submit_inquiry(public.inquiry_type, text, text, text, text, text, uuid);
--   revoke all on function private.inquiry_transition_allowed(public.inquiry_state, public.inquiry_state) from authenticated;
--   drop function if exists private.inquiry_transition_allowed(public.inquiry_state, public.inquiry_state);
--   drop table if exists public.inquiries;
--   drop type if exists public.inquiry_state;
--   drop type if exists public.inquiry_type;


-- ---------------------------------------------------------------------------
-- inquiry_type
-- ---------------------------------------------------------------------------
-- The four public paths MPS-REQ-009 offers, matching `GuidanceRequestType` in
-- `src/lib/contact/recorder.ts` exactly. MPS-REQ-009's fifth path, direct
-- registration, is the external checkout handoff and is not an inquiry.
create type public.inquiry_type as enum (
  'guidance',
  'question',
  'visit',
  'assistance'
);

comment on type public.inquiry_type is
  'MPS-REQ-009 public pathways. `assistance` is the discounted-class '
  'assistance request of MPS-WFL-004 and is private to administrators.';


-- ---------------------------------------------------------------------------
-- inquiry_state
-- ---------------------------------------------------------------------------
-- MPS-WFL-004 `states`, verbatim and exhaustive. No seventh value is invented,
-- and none of these asserts a financial outcome.
create type public.inquiry_state as enum (
  'submitted',
  'under_review',
  'awaiting_family',
  'approved_path_provided',
  'not_available',
  'closed'
);

comment on type public.inquiry_state is
  'MPS-WFL-004 states, verbatim. `approved_path_provided` means an '
  'administrator gave the family a registration or payment path — it is NOT '
  'an eligibility, discount, or award decision (MPS-RUL-004).';


-- ---------------------------------------------------------------------------
-- inquiries
-- ---------------------------------------------------------------------------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),

  -- Shown to the sender so a follow-up call can find the request. Opaque, and
  -- carries no contact detail, so it is safe in a URL, a screenshot, or a
  -- spoken sentence.
  reference text not null unique,

  type public.inquiry_type not null,
  submitted_at timestamptz not null default now(),

  state public.inquiry_state not null default 'submitted',
  state_changed_at timestamptz not null default now(),

  -- MPS-REQ-010 "authorized administrative owner". NULL until an administrator
  -- claims it; a claim is an authorized act, never a side effect of submission.
  owner_user_id uuid references auth.users (id) on delete set null,

  -- Contact details of the requesting ADULT only. This flow collects no child
  -- or student field (MPS-RUL-006, AGENTS.md §11).
  contact_name text not null check (length(btrim(contact_name)) between 1 and 120),
  contact_email text not null check (length(btrim(contact_email)) between 3 and 254),
  contact_phone text check (contact_phone is null or length(btrim(contact_phone)) between 1 and 40),

  program_id uuid references public.programs (id) on delete set null,
  message text not null check (length(btrim(message)) between 1 and 2000),

  -- MPS-ACC-012 "an authorized administrative record is created once". A
  -- double-clicked button, a retried action, or a resubmitted form carries the
  -- same token and produces the same single row.
  submission_token uuid not null unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.inquiries is
  'MPS-REQ-010. One row per submitted public inquiry. Readable ONLY by an '
  'administrator: there is no educator policy and no family policy, which is '
  'what keeps a discounted-class assistance request private (MPS-ACC-013).';

comment on column public.inquiries.submission_token is
  'Idempotency key. A retry of the same submission returns the existing '
  'reference and writes nothing (MPS-ACC-012, MPS-ACC-014 recovery).';

create index inquiries_triage_idx
  on public.inquiries (state, submitted_at desc);

create index inquiries_owner_idx
  on public.inquiries (owner_user_id)
  where owner_user_id is not null;

create trigger inquiries_set_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Privileges and policies
-- ---------------------------------------------------------------------------
alter table public.inquiries enable row level security;

-- Start from nothing, and state the exception explicitly rather than inheriting
-- whatever the project's default-privilege behavior happens to be.
revoke all on public.inquiries from anon, authenticated, public;

-- An administrator reads and triages. Nobody inserts through the Data API —
-- not even an administrator; the public door is the function below.
grant select, update on public.inquiries to authenticated;

create policy "inquiries_select_admin"
  on public.inquiries
  for select
  to authenticated
  using (private.is_admin());

-- UPDATE exists for the state machine, which runs inside
-- `admin_set_inquiry_state`. The policy is still admin-only so a direct
-- PostgREST patch by any other session finds no row.
create policy "inquiries_update_admin"
  on public.inquiries
  for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- No INSERT policy and no DELETE policy for anyone. An inquiry is created by
-- `submit_inquiry` and is never deleted through the API; retention is an
-- unresolved owner decision (GAP-PUBLIC-004).


-- ---------------------------------------------------------------------------
-- inquiry_transition_allowed
-- ---------------------------------------------------------------------------
-- MPS-WFL-004's main path, alternate paths, and completion, read as a graph:
--
--   submitted              → under_review, not_available, closed
--   under_review           → awaiting_family, approved_path_provided,
--                            not_available, closed
--   awaiting_family        → under_review, approved_path_provided,
--                            not_available, closed
--   approved_path_provided → closed
--   not_available          → closed
--   closed                 → (terminal)
--
-- "Assistance unavailable" and "Different program recommended" are both
-- administrator conclusions reached from review, which is why `not_available`
-- and `approved_path_provided` are only reachable from a reviewed state.
create function private.inquiry_transition_allowed(
  from_state public.inquiry_state,
  to_state public.inquiry_state
)
returns boolean
language sql
immutable
as $$
  select case from_state
    when 'submitted' then
      to_state in ('under_review', 'not_available', 'closed')
    when 'under_review' then
      to_state in ('awaiting_family', 'approved_path_provided',
                   'not_available', 'closed')
    when 'awaiting_family' then
      to_state in ('under_review', 'approved_path_provided',
                   'not_available', 'closed')
    when 'approved_path_provided' then to_state = 'closed'
    when 'not_available' then to_state = 'closed'
    when 'closed' then false
  end;
$$;

revoke all on function private.inquiry_transition_allowed(
  public.inquiry_state, public.inquiry_state) from public;
grant execute on function private.inquiry_transition_allowed(
  public.inquiry_state, public.inquiry_state) to authenticated;


-- ---------------------------------------------------------------------------
-- submit_inquiry
-- ---------------------------------------------------------------------------
-- The only write door, and the first one open to an unauthenticated visitor.
--
-- What the caller may choose: their own request type, their own contact
-- details, their own message, an optional published program, and an
-- idempotency token.
--
-- What the caller may NOT choose, and cannot influence: the state (always
-- `submitted`), the owner (always NULL), the reference, the submitted time, or
-- whether a row already exists under their token.
--
-- The program is resolved from a SLUG against published programs only. A draft
-- or archived program is not a thing a public visitor can name, and passing an
-- unknown slug is refused rather than silently recorded as "no program", so a
-- mistyped link does not quietly detach the request from its context.
create function public.submit_inquiry(
  p_type public.inquiry_type,
  p_name text,
  p_email text,
  p_phone text,
  p_program_slug text,
  p_message text,
  p_submission_token uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := btrim(coalesce(p_name, ''));
  clean_email text := btrim(coalesce(p_email, ''));
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  clean_slug text := nullif(btrim(coalesce(p_program_slug, '')), '');
  clean_message text := btrim(coalesce(p_message, ''));
  resolved_program uuid;
  existing_reference text;
  new_reference text;
begin
  if p_submission_token is null then
    raise exception 'submission token is required' using errcode = '22023';
  end if;

  -- Idempotency first, before any validation work: a retry must be cheap and
  -- must reach the same answer even if the original submission is the only one
  -- that ever ran the checks (MPS-ACC-012).
  select i.reference into existing_reference
  from public.inquiries i
  where i.submission_token = p_submission_token;

  if found then
    return existing_reference;
  end if;

  -- Server-side validation. The zod schema in `src/app/contact/actions.ts`
  -- says the same things in friendlier words; this layer is what holds when no
  -- page is involved (AGENTS.md §11 "client input is untrusted").
  if length(clean_name) < 1 or length(clean_name) > 120 then
    raise exception 'invalid name' using errcode = '22023';
  end if;

  if clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(clean_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  if clean_phone is not null and length(clean_phone) > 40 then
    raise exception 'invalid phone' using errcode = '22023';
  end if;

  if length(clean_message) < 1 or length(clean_message) > 2000 then
    raise exception 'invalid message' using errcode = '22023';
  end if;

  if clean_slug is not null then
    select p.id into resolved_program
    from public.programs p
    where p.slug = clean_slug
      and p.publication_state = 'published';

    if resolved_program is null then
      raise exception 'unknown program' using errcode = '22023';
    end if;
  end if;

  -- An opaque, collision-checked reference. Ambiguous characters are left out
  -- so it survives being read aloud on the phone, which is the fallback path
  -- MPS-ACC-014 offers when this function is unreachable.
  loop
    select 'HSH-' || string_agg(
             substr('ACDEFHJKLMNPRTUVWXY34679',
                    1 + floor(random() * 24)::int, 1),
             ''
           )
      into new_reference
      from generate_series(1, 6);

    exit when not exists (
      select 1 from public.inquiries i where i.reference = new_reference
    );
  end loop;

  begin
    insert into public.inquiries
      (reference, type, submitted_at, state, state_changed_at, owner_user_id,
       contact_name, contact_email, contact_phone, program_id, message,
       submission_token)
    values
      (new_reference, p_type, now(), 'submitted', now(), null,
       clean_name, clean_email, clean_phone, resolved_program, clean_message,
       p_submission_token);
  exception
    when unique_violation then
      -- A concurrent retry won the race. One row, not two.
      select i.reference into existing_reference
      from public.inquiries i
      where i.submission_token = p_submission_token;

      if existing_reference is null then
        raise;
      end if;

      return existing_reference;
  end;

  return new_reference;
end;
$$;

comment on function public.submit_inquiry(
  public.inquiry_type, text, text, text, text, text, uuid) is
  'The only path by which an inquiry is created (MPS-REQ-010). State is always '
  '`submitted` and owner is always NULL: a caller cannot assert a review state '
  'or an owner. Idempotent on the submission token (MPS-ACC-012).';

revoke all on function public.submit_inquiry(
  public.inquiry_type, text, text, text, text, text, uuid) from public;
grant execute on function public.submit_inquiry(
  public.inquiry_type, text, text, text, text, text, uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- admin_set_inquiry_state
-- ---------------------------------------------------------------------------
-- Triage: move the state, claim or reassign the owner, or both. An
-- administrator may claim ownership without moving the state, which is how
-- MPS-REQ-010's "authorized administrative owner" gets filled in.
--
-- `p_clear_owner` exists because NULL already means "leave the owner alone";
-- releasing a claim needs a distinguishable instruction.
create function public.admin_set_inquiry_state(
  p_inquiry_id uuid,
  -- Defaulted so a caller changing only the owner omits the state, and a
  -- caller changing only the state omits the owner. Both are ordinary triage
  -- moves, and neither should have to restate the other.
  p_next_state public.inquiry_state default null,
  p_owner_user_id uuid default null,
  p_clear_owner boolean default false
)
returns public.inquiry_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_row public.inquiries%rowtype;
  target_state public.inquiry_state;
begin
  if caller is null or not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into current_row
  from public.inquiries
  where id = p_inquiry_id
  for update;

  if not found then
    raise exception 'inquiry not found' using errcode = 'P0002';
  end if;

  target_state := coalesce(p_next_state, current_row.state);

  if target_state <> current_row.state
     and not private.inquiry_transition_allowed(current_row.state, target_state) then
    raise exception 'inquiry transition % -> % is not permitted',
      current_row.state, target_state using errcode = '23514';
  end if;

  if p_owner_user_id is not null and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_owner_user_id
      and ur.role in ('admin', 'owner')
  ) then
    -- MPS-REQ-010: the owner is an AUTHORIZED administrative owner. Assigning
    -- an inquiry to an educator or a parent would hand them a reason to be
    -- given access later; it is refused here (MPS-ACC-013).
    raise exception 'inquiry owner must be an administrator or the owner'
      using errcode = '42501';
  end if;

  update public.inquiries
  set state = target_state,
      state_changed_at = case
        when target_state <> current_row.state then now()
        else current_row.state_changed_at
      end,
      owner_user_id = case
        when p_clear_owner then null
        when p_owner_user_id is not null then p_owner_user_id
        else current_row.owner_user_id
      end
  where id = p_inquiry_id;

  return target_state;
end;
$$;

comment on function public.admin_set_inquiry_state(
  uuid, public.inquiry_state, uuid, boolean) is
  'Administrator triage of an inquiry (MPS-REQ-010, MPS-WFL-004). Moves state '
  'only along the approved graph and records no financial outcome '
  '(MPS-RUL-004).';

revoke all on function public.admin_set_inquiry_state(
  uuid, public.inquiry_state, uuid, boolean) from public;
grant execute on function public.admin_set_inquiry_state(
  uuid, public.inquiry_state, uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- Audit trigger
-- ---------------------------------------------------------------------------
-- MPS-REQ-024 for inquiry state and ownership.
--
-- READ THIS BEFORE ADDING A FIELD. `public.audit_events` is readable by every
-- authenticated user (`grant select on public.audit_events to authenticated`
-- in 20260828010906). Anything written into `changed_fields` here is therefore
-- visible to an EDUCATOR and to a PARENT. The name, email, phone, message, and
-- program of an inquiry must never appear in this payload — putting them here
-- would disclose the contents of an assistance request through the back door
-- MPS-ACC-013 closes at the table. States, actors, and the opaque reference
-- only.
create function public.record_inquiry_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- No actor: submission is a public act, and `auth.uid()` is NULL for a
    -- visitor. Recorded honestly rather than attributed to nobody in
    -- particular. The type is recorded because triage volume by pathway is a
    -- beta success signal; the contents are not.
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'inquiry', new.id, 'submitted',
       jsonb_build_object(
         'reference', new.reference,
         'type', new.type,
         'state', new.state
       ));
    return new;
  end if;

  if new.state is distinct from old.state then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'inquiry', new.id, 'state_changed',
       jsonb_build_object(
         'reference', new.reference,
         'from', old.state,
         'to', new.state
       ));
  end if;

  if new.owner_user_id is distinct from old.owner_user_id then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'inquiry', new.id, 'owner_changed',
       jsonb_build_object(
         'reference', new.reference,
         'from', old.owner_user_id,
         'to', new.owner_user_id
       ));
  end if;

  return new;
end;
$$;

revoke all on function public.record_inquiry_audit() from public;

create trigger inquiries_audit
  after insert or update on public.inquiries
  for each row execute function public.record_inquiry_audit();
