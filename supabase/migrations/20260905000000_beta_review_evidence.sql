-- Foundation Release — beta review evidence and feedback classification
--
-- MPS: MPS-REQ-022 (preserve enough beta-review evidence to demonstrate each
--      approved beta success signal and classify Samantha's feedback WITHOUT
--      silently changing scope),
--      MPS-REQ-024 (attributable history),
--      MPS-WFL-008 (main path "Walk through success signals → Record feedback
--      → Classify issue or idea → Approve disposition → Update affected MPS
--      state"; six states, verbatim; alternate paths "Must-fix beta defect",
--      "Launch requirement", "Next or Later idea", "Rejected change";
--      recovery "Unresolved items remain explicit gaps; they do not silently
--      enter launch scope"),
--      MPS-ACC-032 (the MPS-REQ-022 half),
--      SIG-BETA-001 through SIG-BETA-008,
--      MPS-RUL-005 (only administrators or Samantha publish changes),
--      MPS-RUL-010 (only Samantha-approved policy language)
-- MDS: `navigation.specification.admin` already names **Reports**; this fills
--      it, so unlike the inquiry queue it introduces no navigation gap.
-- MTS: SECURITY-ARCHITECTURE deny-by-default and least privilege.
--
-- WHAT THIS IS FOR
--
-- MPS-REQ-022 asks for two things that are easy to conflate. Evidence that a
-- signal was demonstrated, and a classification of what Samantha said about
-- it. They are separate records here because they answer to different people:
-- the evidence is an engineering claim about a build, and the classification
-- is the owner's judgment about the product.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- It does not write to `mps/`, `mds/`, or `mts/`. MPS-WFL-008's last main-path
-- step, "Update affected MPS state", is a governance act performed in ChatGPT
-- Work by the system that owns the decision (AGENTS.md §3). Recording an
-- approved disposition here and then editing an approved artifact from
-- application code would let the beta rewrite its own authority. This schema
-- makes the pending set visible and stops (GAP-EVIDENCE-002).
--
-- It does not accept a scope, priority, requirement, or acceptance change of
-- any kind. There is no column for one.
--
-- It stores no evidence FILE. Private Storage exists from
-- HSH-SLICE-CONTENT-01, but MPS-ACC-032 is satisfiable with a written record
-- plus this history, and an upload surface is its own slice
-- (GAP-EVIDENCE-001).
--
-- THE TWO HONESTY CONTROLS THAT MATTER MOST
--
--   1. `result` defaults to `not_tested`, NOT `pass`. A signal nobody has
--      walked is not a signal that passed, and the summary above this data
--      must never be able to round a silence up into a demonstration.
--   2. A disposition cannot be approved while it is unclassified — enforced by
--      `review_feedback_approved_requires_disposition`, in the database. An
--      approved item with no classification is precisely the silent scope
--      change MPS-REQ-022 exists to prevent.
--
-- rollback:
--   drop trigger if exists review_feedback_audit on public.review_feedback;
--   drop trigger if exists review_signals_audit on public.review_signals;
--   drop function if exists public.record_review_feedback_audit();
--   drop function if exists public.record_review_signal_audit();
--   revoke all on function public.admin_approve_review_disposition(uuid) from authenticated;
--   drop function if exists public.admin_approve_review_disposition(uuid);
--   revoke all on function public.admin_classify_review_feedback(uuid, public.review_disposition) from authenticated;
--   drop function if exists public.admin_classify_review_feedback(uuid, public.review_disposition);
--   revoke all on function public.admin_record_review_feedback(text, text) from authenticated;
--   drop function if exists public.admin_record_review_feedback(text, text);
--   revoke all on function public.admin_record_signal_evidence(
--     text, public.review_result, text, text, text, text, public.review_signal_state) from authenticated;
--   drop function if exists public.admin_record_signal_evidence(
--     text, public.review_result, text, text, text, text, public.review_signal_state);
--   revoke all on function private.review_transition_allowed(
--     public.review_signal_state, public.review_signal_state) from authenticated;
--   drop function if exists private.review_transition_allowed(
--     public.review_signal_state, public.review_signal_state);
--   drop table if exists public.review_feedback;
--   drop table if exists public.review_signals;
--   drop type if exists public.review_disposition;
--   drop type if exists public.review_result;
--   drop type if exists public.review_signal_state;


-- ---------------------------------------------------------------------------
-- review_signal_state
-- ---------------------------------------------------------------------------
-- MPS-WFL-008 `states`, verbatim and exhaustive.
create type public.review_signal_state as enum (
  'not_reviewed',
  'in_review',
  'feedback_recorded',
  'decision_pending',
  'disposition_approved',
  'review_complete'
);

comment on type public.review_signal_state is
  'MPS-WFL-008 states, verbatim. Progress through the owner walkthrough of one '
  'approved beta success signal.';


-- ---------------------------------------------------------------------------
-- review_result
-- ---------------------------------------------------------------------------
-- `mps/ACCEPTANCE-CRITERIA.md` §"Required evidence": "Result: pass, fail,
-- blocked, or not tested". Those four words, and no fifth.
create type public.review_result as enum (
  'pass',
  'fail',
  'blocked',
  'not_tested'
);

comment on type public.review_result is
  'The four results ACCEPTANCE-CRITERIA.md requires be recorded per criterion. '
  '`not_tested` is the default: an unwalked signal has not passed.';


-- ---------------------------------------------------------------------------
-- review_disposition
-- ---------------------------------------------------------------------------
-- MPS-WFL-008 `alternate_paths`, which are the dispositions Samantha may
-- choose: "Must-fix beta defect", "Launch requirement", "Next or Later idea"
-- (two distinct timings, so two values), "Rejected change".
--
-- There is no `accepted_into_this_release` value, and that absence is the
-- point. Nothing Samantha says here may quietly become Foundation Release
-- scope; MPS-WFL-008's recovery is explicit that "unresolved items remain
-- explicit gaps; they do not silently enter launch scope". A change that
-- should be built is a `launch_requirement` — a thing to be approved through
-- MPS, not through this table.
create type public.review_disposition as enum (
  'must_fix_beta_defect',
  'launch_requirement',
  'next_idea',
  'later_idea',
  'rejected_change'
);

comment on type public.review_disposition is
  'MPS-WFL-008 alternate paths, verbatim and exhaustive. Deliberately has no '
  '"accepted into this release" value: approving a disposition records the '
  'owner''s judgment, it does not change approved scope (MPS-REQ-022).';


-- ---------------------------------------------------------------------------
-- review_signals
-- ---------------------------------------------------------------------------
-- The primary key is the approved SIG-BETA identifier itself, not a surrogate.
-- These eight rows are approved MPS constants, and an id that matches the
-- artifact means a reviewer reading `OUTCOMES-METRICS.md` and a reviewer
-- reading this table are provably discussing the same signal.
create table public.review_signals (
  id text primary key
    check (id ~ '^SIG-BETA-00[1-8]$'),

  -- Quoted verbatim from `mps/MPS-PROJECT-STATE.yaml`. Never edited here:
  -- MPS-RUL-010 permits only Samantha-approved language, and this is hers.
  statement text not null,
  display_order smallint not null unique,

  state public.review_signal_state not null default 'not_reviewed',
  state_changed_at timestamptz not null default now(),

  -- The per-criterion evidence fields ACCEPTANCE-CRITERIA.md §"Required
  -- evidence" names. All nullable: an unwalked signal has nothing to say, and
  -- a placeholder would read as a record of something that did not happen.
  result public.review_result not null default 'not_tested',
  environment text check (environment is null or char_length(environment) between 1 and 200),
  build_identifier text check (build_identifier is null or char_length(build_identifier) between 1 and 200),
  method text check (method is null or char_length(method) between 1 and 400),
  actor text check (actor is null or char_length(actor) between 1 and 200),
  evidence text check (evidence is null or char_length(evidence) between 1 and 4000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.review_signals is
  'The eight approved beta success signals (SIG-BETA-001..008) and the '
  'evidence recorded against each during Samantha''s walkthrough '
  '(MPS-REQ-022, MPS-ACC-032). Administrator and owner only.';

comment on column public.review_signals.result is
  'Defaults to `not_tested`. A signal nobody walked has NOT passed, and no '
  'summary may present it as demonstrated.';

create trigger review_signals_set_updated_at
  before update on public.review_signals
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- review_feedback
-- ---------------------------------------------------------------------------
create table public.review_feedback (
  id uuid primary key default gen_random_uuid(),
  signal_id text not null references public.review_signals (id) on delete restrict,

  -- Samantha's words. Business-sensitive rather than child data, but treated
  -- the same way: never written into `audit_events`, which every authenticated
  -- user may read.
  note text not null check (char_length(btrim(note)) between 1 and 4000),

  -- Null until classified. MPS-WFL-008 separates "Classify issue or idea" from
  -- "Approve disposition", so these are two acts and two columns.
  disposition public.review_disposition,

  disposition_approved_at timestamptz,
  disposition_approved_by uuid references auth.users (id) on delete set null,

  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The control MPS-REQ-022 is really asking for. An approved item with no
  -- classification is a decision nobody can categorise later — the silent
  -- scope change. Enforced here so it holds for a caller who never touches
  -- `admin_approve_review_disposition`.
  constraint review_feedback_approved_requires_disposition
    check (disposition_approved_at is null or disposition is not null),

  constraint review_feedback_approval_paired
    check ((disposition_approved_at is null) = (disposition_approved_by is null))
);

comment on table public.review_feedback is
  'Samantha''s recorded feedback against one beta success signal, its '
  'classification, and its approved disposition (MPS-REQ-022, MPS-WFL-008). '
  'Administrator and owner only; the note text never enters audit history.';

create index review_feedback_signal_idx
  on public.review_feedback (signal_id, created_at desc);

create index review_feedback_unclassified_idx
  on public.review_feedback (created_at)
  where disposition is null;

create trigger review_feedback_set_updated_at
  before update on public.review_feedback
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- The eight approved signals
-- ---------------------------------------------------------------------------
-- In the migration, not `supabase/seed.sql`: these are approved MPS constants
-- that must exist in every environment, not sanitized demo data that exists
-- only for the review. Statements are quoted verbatim from
-- `mps/MPS-PROJECT-STATE.yaml` `metrics:` (MPS-RUL-010).
insert into public.review_signals (id, statement, display_order) values
  ('SIG-BETA-001',
   'A prospective family can understand Home School Haven and identify an appropriate program.', 1),
  ('SIG-BETA-002',
   'A family can request guidance or proceed directly into registration and payment.', 2),
  ('SIG-BETA-003',
   'A parent can create a family account and manage student profiles.', 3),
  ('SIG-BETA-004',
   'Samantha can create and manage programs, schedules, enrollment, and rosters.', 4),
  ('SIG-BETA-005',
   'An educator can access assigned programs and appropriate enrolled-family information.', 5),
  ('SIG-BETA-006',
   'An educator or administrator can publish an announcement or learning resource.', 6),
  ('SIG-BETA-007',
   'Website, enrollment, and portal information remain consistent.', 7),
  ('SIG-BETA-008',
   'Samantha can identify what must be added, changed, or removed before complete-platform launch approval.', 8)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Privileges and policies
-- ---------------------------------------------------------------------------
alter table public.review_signals enable row level security;
alter table public.review_feedback enable row level security;

revoke all on public.review_signals from anon, authenticated, public;
revoke all on public.review_feedback from anon, authenticated, public;

-- MPS-WFL-008's actors are ACT-006 (Samantha, the owner) and ACT-004
-- (administrator). `private.is_admin()` is exactly that pair. No educator
-- policy and no family policy: an educator has no business reading the owner's
-- assessment of the educator workspace.
grant select on public.review_signals to authenticated;
grant select on public.review_feedback to authenticated;

create policy "review_signals_select_admin"
  on public.review_signals for select to authenticated
  using (private.is_admin());

create policy "review_feedback_select_admin"
  on public.review_feedback for select to authenticated
  using (private.is_admin());

-- No INSERT, UPDATE, or DELETE grant on either table. A signal is created by
-- this migration; feedback and every later write go through the functions below.
-- Nothing deletes a recorded piece of the owner's feedback: MPS-WFL-008's
-- recovery keeps unresolved items explicit rather than removable.


-- ---------------------------------------------------------------------------
-- review_transition_allowed
-- ---------------------------------------------------------------------------
-- MPS-WFL-008's main path and alternate paths, read as a graph:
--
--   not_reviewed         → in_review
--   in_review            → feedback_recorded, review_complete
--   feedback_recorded    → decision_pending, in_review
--   decision_pending     → disposition_approved, feedback_recorded
--   disposition_approved → review_complete, in_review
--   review_complete      → in_review
--
-- `in_review → review_complete` exists because a signal can be demonstrated
-- with nothing to say about it, and forcing a feedback item to close a clean
-- walkthrough would manufacture feedback that was never given.
--
-- `review_complete → in_review` exists because unlike a family's inquiry, a
-- review is not a record of someone's request: reopening a signal Samantha
-- wants to revisit loses nothing and hides nothing. Every reopen is one audit
-- row.
create function private.review_transition_allowed(
  from_state public.review_signal_state,
  to_state public.review_signal_state
)
returns boolean
language sql
immutable
as $$
  select case from_state
    when 'not_reviewed' then to_state = 'in_review'
    when 'in_review' then
      to_state in ('feedback_recorded', 'review_complete')
    when 'feedback_recorded' then
      to_state in ('decision_pending', 'in_review')
    when 'decision_pending' then
      to_state in ('disposition_approved', 'feedback_recorded')
    when 'disposition_approved' then
      to_state in ('review_complete', 'in_review')
    when 'review_complete' then to_state = 'in_review'
  end;
$$;

revoke all on function private.review_transition_allowed(
  public.review_signal_state, public.review_signal_state) from public;
grant execute on function private.review_transition_allowed(
  public.review_signal_state, public.review_signal_state) to authenticated;


-- ---------------------------------------------------------------------------
-- admin_record_signal_evidence
-- ---------------------------------------------------------------------------
-- One walkthrough step: what was checked, in what build, by whom, and what
-- happened. Optionally moves the state at the same time, because recording
-- evidence and saying "this one is done" are usually the same keystroke.
create function public.admin_record_signal_evidence(
  p_signal_id text,
  p_result public.review_result,
  p_environment text,
  p_build_identifier text,
  p_method text,
  p_evidence text,
  p_next_state public.review_signal_state default null
)
returns public.review_signal_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_row public.review_signals%rowtype;
  target_state public.review_signal_state;
  caller_label text;
begin
  if caller is null or not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into current_row
  from public.review_signals
  where id = p_signal_id
  for update;

  if not found then
    raise exception 'signal not found' using errcode = 'P0002';
  end if;

  target_state := coalesce(p_next_state, current_row.state);

  if target_state <> current_row.state
     and not private.review_transition_allowed(current_row.state, target_state) then
    raise exception 'review transition % -> % is not permitted',
      current_row.state, target_state using errcode = '23514';
  end if;

  -- The actor is derived from the session, never accepted as an argument.
  -- ACCEPTANCE-CRITERIA.md asks who performed the check; a caller-supplied
  -- name would make that answer worth nothing.
  --
  -- `public.profiles` holds no email (it is in `auth.users`), so the fallback
  -- reads there. Both are staff identifiers for an administrator or the owner
  -- — the same pair `AdminPortalShell` already displays as `viewerLabel` — and
  -- no family or child identifier is touched.
  select coalesce(p.display_name, u.email) into caller_label
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = caller;

  update public.review_signals
  set result           = p_result,
      environment      = nullif(btrim(coalesce(p_environment, '')), ''),
      build_identifier = nullif(btrim(coalesce(p_build_identifier, '')), ''),
      method           = nullif(btrim(coalesce(p_method, '')), ''),
      evidence         = nullif(btrim(coalesce(p_evidence, '')), ''),
      actor            = caller_label,
      state            = target_state,
      state_changed_at = case
        when target_state <> current_row.state then now()
        else current_row.state_changed_at
      end
  where id = p_signal_id;

  return target_state;
end;
$$;

revoke all on function public.admin_record_signal_evidence(
  text, public.review_result, text, text, text, text,
  public.review_signal_state) from public;
grant execute on function public.admin_record_signal_evidence(
  text, public.review_result, text, text, text, text,
  public.review_signal_state) to authenticated;


-- ---------------------------------------------------------------------------
-- admin_record_review_feedback
-- ---------------------------------------------------------------------------
-- Records one thing Samantha said, unclassified, and moves the signal so its
-- state cannot contradict the fact that feedback now exists.
--
-- A `not_reviewed` signal is walked through `in_review` first. Recording what
-- someone said about a signal IS reviewing it, and the graph has no direct
-- `not_reviewed → feedback_recorded` edge, so without this the card would show
-- feedback while still reading "nobody has walked this signal yet". Both hops
-- are approved transitions and each is one audit row; nothing is skipped.
create function public.admin_record_review_feedback(
  p_signal_id text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  clean_note text := btrim(coalesce(p_note, ''));
  current_state public.review_signal_state;
  created uuid;
begin
  if caller is null or not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if char_length(clean_note) < 1 or char_length(clean_note) > 4000 then
    raise exception 'a feedback note is required' using errcode = '22023';
  end if;

  select state into current_state
  from public.review_signals
  where id = p_signal_id
  for update;

  if not found then
    raise exception 'signal not found' using errcode = 'P0002';
  end if;

  insert into public.review_feedback (signal_id, note, recorded_by)
  values (p_signal_id, clean_note, caller)
  returning id into created;

  -- Walk an untouched signal into review first, so the two-hop path
  -- not_reviewed → in_review → feedback_recorded is taken one approved edge at
  -- a time rather than jumped.
  if current_state = 'not_reviewed'
     and private.review_transition_allowed(current_state, 'in_review') then
    update public.review_signals
    set state = 'in_review', state_changed_at = now()
    where id = p_signal_id;
    current_state := 'in_review';
  end if;

  if private.review_transition_allowed(current_state, 'feedback_recorded') then
    update public.review_signals
    set state = 'feedback_recorded', state_changed_at = now()
    where id = p_signal_id;
  end if;

  return created;
end;
$$;

revoke all on function public.admin_record_review_feedback(text, text) from public;
grant execute on function public.admin_record_review_feedback(text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- admin_classify_review_feedback
-- ---------------------------------------------------------------------------
-- MPS-WFL-008 "Classify issue or idea". Separate from approval below, and
-- re-classifiable until approved: an owner refining "next idea" into "launch
-- requirement" before signing off is the workflow working.
create function public.admin_classify_review_feedback(
  p_feedback_id uuid,
  p_disposition public.review_disposition
)
returns public.review_disposition
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_row public.review_feedback%rowtype;
begin
  if caller is null or not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_disposition is null then
    raise exception 'a classification is required' using errcode = '22023';
  end if;

  select * into current_row
  from public.review_feedback
  where id = p_feedback_id
  for update;

  if not found then
    raise exception 'feedback not found' using errcode = 'P0002';
  end if;

  -- Re-classifying an APPROVED disposition would change what the owner signed
  -- off on after they signed it off. Refused; the honest move is a new
  -- feedback item recording the change of mind, which keeps both.
  if current_row.disposition_approved_at is not null then
    raise exception 'an approved disposition cannot be reclassified'
      using errcode = '23514';
  end if;

  update public.review_feedback
  set disposition = p_disposition
  where id = p_feedback_id;

  -- Classification is what makes a decision pending: there is now something
  -- specific for the owner to approve.
  update public.review_signals s
  set state = 'decision_pending', state_changed_at = now()
  where s.id = current_row.signal_id
    and private.review_transition_allowed(s.state, 'decision_pending');

  return p_disposition;
end;
$$;

revoke all on function public.admin_classify_review_feedback(
  uuid, public.review_disposition) from public;
grant execute on function public.admin_classify_review_feedback(
  uuid, public.review_disposition) to authenticated;


-- ---------------------------------------------------------------------------
-- admin_approve_review_disposition
-- ---------------------------------------------------------------------------
-- MPS-WFL-008 "Approve disposition". The act this whole schema exists to make
-- attributable: who accepted this classification, and when.
--
-- It records an approved JUDGMENT. It does not change scope, and there is
-- nothing here that could — the disposition enum has no value meaning
-- "accepted into this release" (GAP-EVIDENCE-002: carrying an approved
-- disposition into `mps/` is a governance act performed elsewhere).
create function public.admin_approve_review_disposition(
  p_feedback_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_row public.review_feedback%rowtype;
  approved_at timestamptz := now();
begin
  if caller is null or not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into current_row
  from public.review_feedback
  where id = p_feedback_id
  for update;

  if not found then
    raise exception 'feedback not found' using errcode = 'P0002';
  end if;

  -- The MPS-REQ-022 control, stated in the layer that cannot be bypassed.
  -- `review_feedback_approved_requires_disposition` would also catch this; the
  -- explicit raise exists so the caller gets a reason rather than a constraint
  -- name.
  if current_row.disposition is null then
    raise exception 'classify this feedback before approving its disposition'
      using errcode = '22023';
  end if;

  if current_row.disposition_approved_at is not null then
    -- Idempotent: a double-clicked button does not rewrite who approved it or
    -- when they did.
    return current_row.disposition_approved_at;
  end if;

  update public.review_feedback
  set disposition_approved_at = approved_at,
      disposition_approved_by = caller
  where id = p_feedback_id;

  update public.review_signals s
  set state = 'disposition_approved', state_changed_at = now()
  where s.id = current_row.signal_id
    and private.review_transition_allowed(s.state, 'disposition_approved');

  return approved_at;
end;
$$;

revoke all on function public.admin_approve_review_disposition(uuid) from public;
grant execute on function public.admin_approve_review_disposition(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------
-- MPS-REQ-024 for the walkthrough.
--
-- READ THIS BEFORE ADDING A FIELD. `public.audit_events` is readable by every
-- authenticated user (`grant select on public.audit_events to authenticated`,
-- 20260828010906). Samantha's note text must never appear in `changed_fields`:
-- her candid assessment of an educator's workspace is not something that
-- educator reads. Ids, states, results, and dispositions only — the same rule
-- `record_inquiry_audit()` follows for a family's message.
create function public.record_review_signal_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state is distinct from old.state then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'review_signal', null, 'state_changed',
       jsonb_build_object(
         'signal', new.id, 'from', old.state, 'to', new.state
       ));
  end if;

  if new.result is distinct from old.result then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'review_signal', null, 'result_recorded',
       jsonb_build_object(
         'signal', new.id, 'from', old.result, 'to', new.result,
         'build', new.build_identifier
       ));
  end if;

  return new;
end;
$$;

revoke all on function public.record_review_signal_audit() from public;

create trigger review_signals_audit
  after update on public.review_signals
  for each row execute function public.record_review_signal_audit();


create function public.record_review_feedback_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'review_feedback', new.id, 'recorded',
       jsonb_build_object('signal', new.signal_id));
    return new;
  end if;

  if new.disposition is distinct from old.disposition then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'review_feedback', new.id, 'classified',
       jsonb_build_object(
         'signal', new.signal_id,
         'from', old.disposition, 'to', new.disposition
       ));
  end if;

  if new.disposition_approved_at is distinct from old.disposition_approved_at
     and new.disposition_approved_at is not null then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'review_feedback', new.id, 'disposition_approved',
       jsonb_build_object(
         'signal', new.signal_id, 'disposition', new.disposition
       ));
  end if;

  return new;
end;
$$;

revoke all on function public.record_review_feedback_audit() from public;

create trigger review_feedback_audit
  after insert or update on public.review_feedback
  for each row execute function public.record_review_feedback_audit();
