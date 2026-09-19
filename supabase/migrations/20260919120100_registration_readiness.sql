-- Slice 2.5 — registration policy and design readiness
--
-- MPS: DEC-026 (required registration information), DEC-027 (sensitive-data
--      access and the educator safety subset), DEC-028 (STEP UP review queue
--      and outcomes; supersedes DEC-025's evaluation clause), DEC-029 (document
--      reacceptance), DEC-030 (media permission), DEC-031 (retention minimum),
--      DEC-032 (structured attendance days); MPS-RUL-003/006/008/009/010;
--      MPS-REQ-002/003/004/012/014/017/018/024; EXC-002; GAP-014/015/016.
-- MTS: SECURITY-ARCHITECTURE mandatory controls; DEFECT-FF1 (grants last).
-- Prompt: prompts/registration-readiness.md (approved 2026-09-19)
--
-- WHAT THIS DOES, IN ORDER
--
--   1. Explicit Yes/No for medical and accommodation needs.
--   2. Structured attendance configuration (rules, days, plans), seeded for
--      the nine verified programs, with an administrator door.
--   3. The enrollment core takes `require_review`: a STEP UP selection never
--      reaches `started`, the only state that offers external checkout.
--   4. STEP UP outcomes: a transition table, a column-limited guard in place
--      of the blanket immutability trigger, an admin transition RPC, and an
--      admin review queue. Nothing here reads or writes enrollments.
--   5. Document versions: one approved plus one draft per kind, a presented-
--      version rule, an edit guard, a sha256 snapshot on acceptance,
--      reacceptance when a new version is published, a family renewal RPC,
--      and an owner-only publish RPC that the approval lock still refuses.
--   6. An assignment-scoped educator safety RPC. No educator policy is added
--      to any registration table.
--   7. submit_family_registration: same signature, stricter contract.
--
-- WHAT THIS DOES NOT DO
--
--   * Lift any sample-only lock. `check (is_sample)`, `demo-unapproved-v0`, and
--     `registration_document_versions_approval_locked` all stand. No approved
--     source, content, hash, or approval evidence for any registration
--     document exists in the repository (GAP-014).
--   * Add a deletion job. DEC-031 sets only a minimum: sensitive registration
--     data may remain at least 30 days after the child leaves. The maximum,
--     clock start, holds, surviving audit, and deletion authority are GAP-016.
--   * Touch `students`, `enrollments`, either roster view, or any hosted data.
--
-- rollback (reverse order; local-only until the owner pushes):
--   drop function if exists public.educator_child_safety(uuid);
--   drop function if exists public.owner_publish_registration_document(uuid);
--   drop function if exists public.renew_registration_documents(uuid, jsonb);
--   drop function if exists public.registration_documents_requiring_acceptance(uuid);
--   drop function if exists public.admin_step_up_review_queue();
--   drop function if exists public.admin_set_step_up_state(uuid, public.step_up_verification_state, public.step_up_verification_state);
--   drop function if exists public.admin_set_program_attendance(uuid, public.attendance_selection_mode, public.attendance_day[], smallint[]);
--   -- Restore verbatim from 20260918120000_family_registration_foundation.sql:
--   --   public.submit_family_registration, public.registration_policy_satisfied,
--   --   private.request_enrollment_core (4-arg), public.family_request_enrollment,
--   --   private.enforce_registration_acceptance_signer, the
--   --   registration_document_versions_select_parent policy, the
--   --   registration_document_versions_one_current index, and the
--   --   registration_step_up_requests_immutable trigger. Then:
--   drop function if exists private.request_enrollment_core(uuid, uuid, uuid, uuid, boolean);
--   drop trigger if exists registration_step_up_requests_guard on public.registration_step_up_requests;
--   drop trigger if exists registration_document_versions_guard on public.registration_document_versions;
--   drop function if exists private.registration_step_up_guard();
--   drop function if exists private.registration_document_version_guard();
--   drop function if exists private.step_up_transition_allowed(public.step_up_verification_state, public.step_up_verification_state);
--   drop function if exists private.presented_document_version(public.registration_document_kind);
--   alter table public.registration_document_versions
--     drop constraint registration_document_versions_approval_recorded,
--     add constraint registration_document_versions_approval_paired
--       check ((status = 'approved') = (approved_at is not null));
--   drop index if exists public.registration_document_versions_one_approved;
--   drop index if exists public.registration_document_versions_one_draft;
--   alter table public.registration_document_acceptances
--     drop constraint registration_document_acceptances_one_per_version_status,
--     add constraint registration_document_accepta_registration_id_document_kind_key
--       unique (registration_id, document_kind),
--     drop column document_sha256_at_acceptance;
--   alter table public.registration_step_up_requests
--     drop column state_changed_at, drop column state_changed_by;
--   alter table public.registration_selections drop column plan_days_per_week;
--   alter table public.registration_child_health
--     drop column has_medical_needs, drop column has_accommodation_needs;
--   drop table if exists public.program_attendance_plans;
--   drop table if exists public.program_attendance_days;
--   drop table if exists public.program_attendance_rules;
--   drop type if exists public.attendance_selection_mode;
--   -- The enum values from 20260919120000 have their own rollback note.
--   -- Audit events written by these functions remain (append-only).


-- ===========================================================================
-- 1. Explicit medical and accommodation answers (DEC-026)
-- ===========================================================================
-- NOT NULL without a default: if a health row already exists this migration
-- fails rather than infer "No" from a blank. No such row can exist on the
-- hosted project (no document version has ever been available there), and a
-- local reset has none.
alter table public.registration_child_health
  add column has_medical_needs boolean not null,
  add column has_accommodation_needs boolean not null,
  add constraint registration_child_health_medical_details_match
    check (has_medical_needs = (medical_information is not null)),
  add constraint registration_child_health_accommodation_details_match
    check (has_accommodation_needs = (accommodation_information is not null));

comment on table public.registration_child_health is
  'RESTRICTED. Explicit Yes/No allergy, medical-needs, and accommodation-needs '
  'answers, with details exactly when the answer is Yes (DEC-026). Family and '
  'administrator read. An assigned educator receives the allergy answer and '
  'details only, and only through public.educator_child_safety (DEC-027). '
  'Never copied into audit_events. Retention: may remain at least 30 days after '
  'the child leaves (DEC-031); no deletion deadline is approved (GAP-016). '
  'SAMPLE ONLY.';

comment on column public.registration_children.photo_video_permission is
  'The family''s explicit Yes/No answer to the neutral media-permission question '
  '(DEC-030). Separate from every signature and acknowledgment, and never a '
  'condition of eligibility. The question is not approved for real families '
  '(checklist §8).';

comment on table public.registration_contacts is
  'RESTRICTED. Guardian, emergency, and approved-pickup contacts for one '
  'submission. At least one emergency contact and one pickup person are '
  'required (DEC-026). Family and administrator read. An assigned educator '
  'receives emergency and pickup name, relationship, and phone only, through '
  'public.educator_child_safety; guardian contacts never (DEC-027). SAMPLE ONLY.';


-- ===========================================================================
-- 2. Structured attendance configuration (DEC-032)
-- ===========================================================================
-- `programs.published_schedule` stays the display text. These tables are the
-- rule a selection is validated against. Public program facts, not family
-- data, so no is_sample column.
create type public.attendance_selection_mode as enum ('fixed', 'family_selects');

comment on type public.attendance_selection_mode is
  'fixed: the program meets on its configured days and the family chooses '
  'nothing. family_selects: the family chooses from the configured days, '
  'exactly the plan''s count when plans are configured (DEC-032).';

create table public.program_attendance_rules (
  program_id uuid primary key references public.programs (id) on delete cascade,
  selection_mode public.attendance_selection_mode not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (program_id, selection_mode)
);

create table public.program_attendance_days (
  program_id uuid not null
    references public.program_attendance_rules (program_id) on delete cascade,
  day public.attendance_day not null,
  primary key (program_id, day)
);

-- The composite foreign key means a plan can exist only under a
-- family_selects rule: changing a rule to `fixed` while plans exist fails.
create table public.program_attendance_plans (
  program_id uuid not null,
  selection_mode public.attendance_selection_mode not null default 'family_selects',
  days_per_week smallint not null,
  primary key (program_id, days_per_week),
  foreign key (program_id, selection_mode)
    references public.program_attendance_rules (program_id, selection_mode)
    on delete cascade,
  constraint program_attendance_plans_family_selects
    check (selection_mode = 'family_selects'),
  constraint program_attendance_plans_days_range
    check (days_per_week between 1 and 7)
);

comment on table public.program_attendance_rules is
  'How attendance days are chosen for a program (DEC-032). A published program '
  'with no rule cannot be registered for (blocked_attendance_unconfigured). '
  'Written only by admin_set_program_attendance or a migration.';

-- The nine verified offerings (owner evidence of 2026-09-14, DEC-024). Ready
-- Set Prep and Ready Set Learn are fixed Tuesday and Thursday, as published
-- (owner decision of 2026-09-19). `where exists` keeps this safe on a
-- database that lacks one of them.
insert into public.program_attendance_rules (program_id, selection_mode)
select v.program_id, v.mode::public.attendance_selection_mode
from (values
  ('10000000-0000-4000-8000-000000000002'::uuid, 'family_selects'), -- Haven Days
  ('10000000-0000-4000-8000-00000000000c'::uuid, 'family_selects'), -- Tutoring
  ('10000000-0000-4000-8000-000000000009'::uuid, 'fixed'),          -- Ready Set Prep
  ('10000000-0000-4000-8000-00000000000a'::uuid, 'fixed'),          -- Ready Set Learn
  ('10000000-0000-4000-8000-00000000000b'::uuid, 'fixed'),          -- Ready Set Sensory
  ('10000000-0000-4000-8000-000000000005'::uuid, 'fixed'),          -- Sewing
  ('10000000-0000-4000-8000-00000000000e'::uuid, 'fixed'),          -- Crochet
  ('10000000-0000-4000-8000-000000000006'::uuid, 'fixed'),          -- Gardening
  ('10000000-0000-4000-8000-00000000000d'::uuid, 'fixed')           -- Monthly Clubs
) as v (program_id, mode)
where exists (select 1 from public.programs p where p.id = v.program_id)
on conflict (program_id) do nothing;

insert into public.program_attendance_days (program_id, day)
select v.program_id, v.day::public.attendance_day
from (values
  ('10000000-0000-4000-8000-000000000002'::uuid, 'tuesday'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'wednesday'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'thursday'),
  ('10000000-0000-4000-8000-00000000000c'::uuid, 'tuesday'),
  ('10000000-0000-4000-8000-00000000000c'::uuid, 'wednesday'),
  ('10000000-0000-4000-8000-00000000000c'::uuid, 'thursday'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 'tuesday'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 'thursday'),
  ('10000000-0000-4000-8000-00000000000a'::uuid, 'tuesday'),
  ('10000000-0000-4000-8000-00000000000a'::uuid, 'thursday'),
  ('10000000-0000-4000-8000-00000000000b'::uuid, 'wednesday'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'wednesday'),
  ('10000000-0000-4000-8000-00000000000e'::uuid, 'monday'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 'thursday'),
  ('10000000-0000-4000-8000-00000000000d'::uuid, 'thursday')
) as v (program_id, day)
where exists (select 1 from public.program_attendance_rules r where r.program_id = v.program_id)
on conflict do nothing;

-- Haven Days: one-, two-, or three-day plans.
insert into public.program_attendance_plans (program_id, days_per_week)
select '10000000-0000-4000-8000-000000000002'::uuid, n
from unnest(array[1, 2, 3]::smallint[]) as n
where exists (select 1 from public.program_attendance_rules r
              where r.program_id = '10000000-0000-4000-8000-000000000002'
                and r.selection_mode = 'family_selects')
on conflict do nothing;

alter table public.registration_selections
  add column plan_days_per_week smallint,
  add constraint registration_selections_plan_range
    check (plan_days_per_week is null or plan_days_per_week between 1 and 7);

comment on column public.registration_selections.attendance_days is
  'The days this child attends, as validated against program_attendance_rules '
  'at submission. For a fixed program this is a snapshot of the configured days.';


-- administrator door ---------------------------------------------------------
create function public.admin_set_program_attendance(
  target_program uuid,
  attendance_mode public.attendance_selection_mode,
  available_days public.attendance_day[],
  plan_day_counts smallint[] default '{}'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  clean_days public.attendance_day[];
  clean_plans smallint[];
  old_mode public.attendance_selection_mode;
  old_days public.attendance_day[];
  old_plans smallint[];
begin
  if caller is null or not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform 1 from public.programs where id = target_program for update;
  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  if attendance_mode is null or available_days is null
     or cardinality(available_days) = 0 or array_position(available_days, null) is not null then
    raise exception 'attendance needs a mode and at least one day' using errcode = '22023';
  end if;
  select array_agg(distinct d order by d) into clean_days from unnest(available_days) d;
  if cardinality(clean_days) <> cardinality(available_days) then
    raise exception 'each attendance day may be listed once' using errcode = '22023';
  end if;

  plan_day_counts := coalesce(plan_day_counts, '{}');
  if array_position(plan_day_counts, null) is not null then
    raise exception 'plan day counts must be whole numbers' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct p order by p), '{}') into clean_plans
  from unnest(plan_day_counts) p;
  if cardinality(clean_plans) <> cardinality(plan_day_counts) then
    raise exception 'each plan may be listed once' using errcode = '22023';
  end if;
  if attendance_mode = 'fixed' and cardinality(clean_plans) > 0 then
    raise exception 'a fixed-day program has no plans' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(clean_plans) p
             where p < 1 or p > cardinality(clean_days)) then
    raise exception 'a plan cannot need more days than the program offers'
      using errcode = '22023';
  end if;

  select r.selection_mode into old_mode
  from public.program_attendance_rules r where r.program_id = target_program;
  select coalesce(array_agg(d.day order by d.day), '{}') into old_days
  from public.program_attendance_days d where d.program_id = target_program;
  select coalesce(array_agg(p.days_per_week order by p.days_per_week), '{}') into old_plans
  from public.program_attendance_plans p where p.program_id = target_program;

  if old_mode is not distinct from attendance_mode
     and old_days = clean_days and old_plans = clean_plans then
    return 'unchanged';
  end if;

  delete from public.program_attendance_rules where program_id = target_program;
  insert into public.program_attendance_rules (program_id, selection_mode, updated_by)
  values (target_program, attendance_mode, caller);
  insert into public.program_attendance_days (program_id, day)
  select target_program, d from unnest(clean_days) d;
  insert into public.program_attendance_plans (program_id, days_per_week)
  select target_program, p from unnest(clean_plans) p;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values
    (caller, 'program', target_program, 'attendance_configured', jsonb_build_object(
      'from', jsonb_build_object('mode', old_mode, 'days', to_jsonb(old_days),
                                 'plans', to_jsonb(old_plans)),
      'to', jsonb_build_object('mode', attendance_mode, 'days', to_jsonb(clean_days),
                               'plans', to_jsonb(clean_plans))));

  return 'updated';
end;
$$;


-- ===========================================================================
-- 3. Enrollment core: STEP UP requires review (DEC-028)
-- ===========================================================================
-- `require_review` turns what would have been `started` into
-- `approval_pending`. `started` is the one state that offers the external
-- checkout (src/lib/enrollment/eligibility.ts, mayOfferCheckout), so a STEP UP
-- child is never handed to checkout. Capacity and waitlist are evaluated
-- first and unchanged, and the core still cannot write confirmed,
-- payment_pending, payment_failed, canceled, or blocked.
drop function private.request_enrollment_core(uuid, uuid, uuid, uuid);

create function private.request_enrollment_core(
  caller uuid,
  student_family uuid,
  target_student uuid,
  target_program uuid,
  require_review boolean
)
returns table (
  outcome text,
  enrollment_id uuid,
  state public.enrollment_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  program_row public.programs%rowtype;
  existing public.enrollments%rowtype;
  confirmed_count integer;
  resolved_state public.enrollment_state;
  created uuid;
begin
  select * into program_row
  from public.programs
  where id = target_program
  for update;

  if not found or program_row.publication_state <> 'published' then
    return query select 'blocked_unavailable'::text, null::uuid,
                        null::public.enrollment_state;
    return;
  end if;

  if program_row.availability = 'closed' then
    return query select 'blocked_closed'::text, null::uuid,
                        null::public.enrollment_state;
    return;
  end if;

  select * into existing
  from public.enrollments e
  where e.student_id = target_student
    and e.program_id = target_program;

  if found then
    return query select 'duplicate'::text, existing.id, existing.state;
    return;
  end if;

  if program_row.capacity is not null then
    select count(*) into confirmed_count
    from public.enrollments e
    where e.program_id = target_program
      and e.state = 'confirmed';

    if confirmed_count >= program_row.capacity then
      if not program_row.waitlist_enabled then
        return query select 'blocked_full'::text, null::uuid,
                            null::public.enrollment_state;
        return;
      end if;
      resolved_state := 'waitlisted';
    end if;
  end if;

  if resolved_state is null then
    resolved_state := case
      when require_review then 'approval_pending'::public.enrollment_state
      when program_row.confirmation_mode = 'administrator_approval'
        then 'approval_pending'::public.enrollment_state
      else 'started'::public.enrollment_state
    end;
  end if;

  begin
    insert into public.enrollments
      (family_id, student_id, program_id, state, state_changed_at,
       authority_affirmation_version, authority_affirmed_at, requested_by)
    values
      (student_family, target_student, target_program, resolved_state, now(),
       'demo-unapproved-v0', now(), caller)
    returning id into created;
  exception
    when unique_violation then
      select * into existing
      from public.enrollments e
      where e.student_id = target_student
        and e.program_id = target_program;
      return query select 'duplicate'::text, existing.id, existing.state;
      return;
  end;

  return query select resolved_state::text, created, resolved_state;
end;
$$;

comment on function private.request_enrollment_core(uuid, uuid, uuid, uuid, boolean) is
  'The MPS-REQ-012 evaluation shared by family_request_enrollment and '
  'submit_family_registration. Can only write started, approval_pending, or '
  'waitlisted; with require_review (a STEP UP selection, DEC-028) never started. '
  'Callers must authorize and check guardian authority first.';

-- Unchanged apart from the explicit `false`: 110_family_conversion_journey
-- proves it.
create or replace function public.family_request_enrollment(
  target_student uuid,
  target_program uuid,
  authority_affirmed boolean
)
returns table (
  outcome text,
  enrollment_id uuid,
  state public.enrollment_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  student_family uuid;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select s.family_id into student_family
  from public.students s
  where s.id = target_student;

  if student_family is null
     or not private.is_family_member(student_family)
     or not private.has_role('parent') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if authority_affirmed is not true then
    return query select 'blocked_authority'::text, null::uuid,
                        null::public.enrollment_state;
    return;
  end if;

  return query
    select c.outcome, c.enrollment_id, c.state
    from private.request_enrollment_core(
      caller, student_family, target_student, target_program, false) c;
end;
$$;


-- ===========================================================================
-- 4. STEP UP review queue and outcomes (DEC-028)
-- ===========================================================================
comment on type public.step_up_verification_state is
  'DEC-028: STEP UP administrative review outcomes. None is payment, a '
  'discount, confirmation, or enrollment. verified hands the registration to '
  'the ordinary administrative enrollment review and changes no enrollment. '
  'Transitions: private.step_up_transition_allowed.';

alter table public.registration_step_up_requests
  add column state_changed_at timestamptz not null default now(),
  add column state_changed_by uuid references auth.users (id) on delete restrict;

comment on table public.registration_step_up_requests is
  'STEP UP selection for one child, in the administrative STEP UP review queue '
  '(DEC-028). A STEP UP selection skips external checkout (its enrollment is '
  'approval_pending, never started). Only verification_state, state_changed_at, '
  'and state_changed_by may change, only along an allowed transition, and only '
  'through admin_set_step_up_state. No payment, price, discount, or '
  'enrollment-state column exists here by design. SAMPLE ONLY.';

create function private.step_up_transition_allowed(
  current_state public.step_up_verification_state,
  next_state public.step_up_verification_state
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case current_state::text
    when 'pending_verification' then next_state::text in
      ('needs_information', 'verified', 'declined', 'canceled')
    when 'needs_information' then next_state::text in
      ('pending_verification', 'verified', 'declined', 'canceled')
    when 'verified' then next_state::text = 'canceled'
    else false
  end;
$$;

comment on function private.step_up_transition_allowed(
  public.step_up_verification_state, public.step_up_verification_state) is
  'DEC-028 transition table. declined and canceled are terminal; verified may '
  'only be canceled.';

create function private.registration_step_up_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['verification_state', 'state_changed_at', 'state_changed_by'])
     is distinct from
     (to_jsonb(old) - array['verification_state', 'state_changed_at', 'state_changed_by']) then
    raise exception 'registration evidence is immutable' using errcode = '55000';
  end if;
  if new.verification_state is distinct from old.verification_state
     and not private.step_up_transition_allowed(old.verification_state,
                                                new.verification_state) then
    raise exception 'STEP UP transition is not allowed' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger registration_step_up_requests_immutable on public.registration_step_up_requests;

create trigger registration_step_up_requests_guard
  before update on public.registration_step_up_requests
  for each row execute function private.registration_step_up_guard();


create function public.admin_set_step_up_state(
  target_registration_child uuid,
  expected_state public.step_up_verification_state,
  next_state public.step_up_verification_state
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_row public.registration_step_up_requests%rowtype;
begin
  if caller is null or not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if expected_state is null or next_state is null then
    raise exception 'expected and next state are required' using errcode = '22023';
  end if;

  select * into current_row
  from public.registration_step_up_requests
  where registration_child_id = target_registration_child
  for update;

  if not found then
    raise exception 'STEP UP request not found' using errcode = 'P0002';
  end if;

  -- A retry of a transition that already committed.
  if current_row.verification_state = next_state then
    return 'unchanged';
  end if;

  if current_row.verification_state <> expected_state then
    raise exception 'STEP UP request changed since it was loaded' using errcode = '40001';
  end if;

  if not private.step_up_transition_allowed(current_row.verification_state, next_state) then
    raise exception 'STEP UP transition from % to % is not allowed',
      current_row.verification_state, next_state using errcode = '23514';
  end if;

  update public.registration_step_up_requests
  set verification_state = next_state,
      state_changed_at = now(),
      state_changed_by = caller
  where registration_child_id = target_registration_child;

  -- States and ids only. Never the family's STEP UP reference.
  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values
    (caller, 'registration_step_up', target_registration_child, 'state_changed',
     jsonb_build_object(
       'registration_id', current_row.registration_id,
       'from', current_row.verification_state,
       'to', next_state,
       'is_sample', true));

  return 'updated';
end;
$$;

comment on function public.admin_set_step_up_state(
  uuid, public.step_up_verification_state, public.step_up_verification_state) is
  'Admin-only STEP UP outcome transition (DEC-028). Compare-and-set on '
  'expected_state; a same-state retry returns unchanged. Never reads or writes '
  'enrollments: verified is not payment, confirmation, or enrollment.';


create function public.admin_step_up_review_queue()
returns table (
  registration_child_id uuid,
  registration_id uuid,
  family_id uuid,
  preferred_name text,
  verification_state public.step_up_verification_state,
  state_changed_at timestamptz,
  submitted_at timestamptz,
  reference text,
  selections jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select su.registration_child_id, su.registration_id, r.family_id,
         s.preferred_name, su.verification_state, su.state_changed_at,
         r.submitted_at, su.reference,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'program_id', sel.program_id,
                    'enrollment_id', sel.enrollment_id,
                    'enrollment_state', e.state)
                  order by sel.program_id)
           from public.registration_selections sel
           join public.enrollments e on e.id = sel.enrollment_id
           where sel.registration_child_id = su.registration_child_id
         ), '[]'::jsonb)
  from public.registration_step_up_requests su
  join public.registration_submissions r on r.id = su.registration_id
  join public.registration_children c on c.id = su.registration_child_id
  join public.students s on s.id = c.student_id
  order by case su.verification_state::text
             when 'pending_verification' then 0
             when 'needs_information' then 1
             else 2
           end,
           r.submitted_at, su.registration_child_id;
end;
$$;

comment on function public.admin_step_up_review_queue() is
  'The administrative STEP UP review queue (DEC-028): open items first, oldest '
  'first. Administrators hold the full record under DEC-027, so the reference '
  'is included here and nowhere an educator can reach.';


-- ===========================================================================
-- 5. Document versions and reacceptance (DEC-029)
-- ===========================================================================
-- One approved and one draft per kind, so the next version can be prepared
-- while the current one stays published.
drop index public.registration_document_versions_one_current;

create unique index registration_document_versions_one_approved
  on public.registration_document_versions (document_kind)
  where status = 'approved';

create unique index registration_document_versions_one_draft
  on public.registration_document_versions (document_kind)
  where status = 'draft';

-- The version families are shown and must accept: the approved one when it
-- exists, otherwise (sample mode, while the approval lock stands) the draft.
create function private.presented_document_version(
  target_kind public.registration_document_kind
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.id
  from public.registration_document_versions v
  where v.document_kind = target_kind
    and v.status in ('approved', 'draft')
  order by (v.status = 'approved') desc
  limit 1;
$$;

-- 20260918120000 paired approved_at with status = 'approved', so retiring a
-- published version would have had to erase when it was approved. A retired
-- version keeps its approval time; a draft never has one; an approved one
-- always does.
alter table public.registration_document_versions
  drop constraint registration_document_versions_approval_paired,
  add constraint registration_document_versions_approval_recorded
    check ((status <> 'approved' or approved_at is not null)
           and (status <> 'draft' or approved_at is null));

-- Drafts may be edited; an approved version may only be retired; a retired
-- version is frozen. Editing a draft therefore never changes a published
-- version, and never changes what an existing acceptance of one refers to.
create function private.registration_document_version_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.document_kind <> old.document_kind
     or new.created_at <> old.created_at or new.is_sample <> old.is_sample then
    raise exception 'document version identity is immutable' using errcode = '55000';
  end if;

  if old.status = 'draft' then
    return new;
  end if;

  if old.status = 'approved' and new.status = 'retired'
     and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;
  end if;

  raise exception 'a published or retired document version cannot be edited'
    using errcode = '55000';
end;
$$;

create trigger registration_document_versions_guard
  before update on public.registration_document_versions
  for each row execute function private.registration_document_version_guard();

comment on table public.registration_document_versions is
  'Versioned registration documents. Titles, references, and hashes only, never '
  'legal text. At most one approved and one draft per kind; families see the '
  'presented version (private.presented_document_version). Publishing a new '
  'version retires the previous one and requires fresh acceptance (DEC-029). '
  'No version can be approved while registration_document_versions_approval_locked '
  'stands (GAP-014).';

-- Acceptance evidence: a snapshot of the content hash, and one acceptance per
-- version AND status rather than per kind, so a renewal is a new row, not an
-- edit. The status is part of the key because a draft a family accepted can
-- later be published as that same version: the draft-time acceptance must not
-- stand in for, or block, the acceptance of the published text.
alter table public.registration_document_acceptances
  add column document_sha256_at_acceptance text,
  add constraint registration_document_acceptances_sha256_snapshot
    check (document_sha256_at_acceptance is null
           or document_sha256_at_acceptance ~ '^[0-9a-f]{64}$'),
  drop constraint registration_document_accepta_registration_id_document_kind_key,
  add constraint registration_document_acceptances_one_per_version_status
    unique (registration_id, document_version_id, document_status_at_acceptance);

-- The signer is a parent in the registration's family: for the original
-- submission that is the submitter; a renewal may be signed by either
-- guardian with the parent role.
create or replace function private.enforce_registration_acceptance_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.registration_submissions r
    join public.family_members fm on fm.family_id = r.family_id
    join public.user_roles ur on ur.user_id = fm.user_id and ur.role = 'parent'
    where r.id = new.registration_id and fm.user_id = new.signer_user_id
  ) then
    raise exception 'acceptance signer must be a parent or guardian in the registration''s family'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop policy "registration_document_versions_select_parent"
  on public.registration_document_versions;

create policy "registration_document_versions_select_parent"
  on public.registration_document_versions for select
  to authenticated
  using (private.has_role('parent')
         and id = private.presented_document_version(document_kind));

-- True only when every kind has an acceptance of the CURRENTLY approved
-- version, made while it was approved. Publishing a new version retires the
-- old one, so acceptances of it stop counting. Always false while the approval
-- lock stands.
create or replace function public.registration_policy_satisfied(target_registration uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select count(distinct a.document_kind) = 3
  from public.registration_document_acceptances a
  join public.registration_document_versions v on v.id = a.document_version_id
  where a.registration_id = target_registration
    and a.document_status_at_acceptance = 'approved'
    and v.status = 'approved';
$$;

create function public.registration_documents_requiring_acceptance(
  target_registration uuid
)
returns table (
  document_kind public.registration_document_kind,
  version_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select k.kind, private.presented_document_version(k.kind)
  from unnest(enum_range(null::public.registration_document_kind)) as k (kind)
  where private.can_read_registration(target_registration)
    and not exists (
      select 1
      from public.registration_document_acceptances a
      join public.registration_document_versions v on v.id = a.document_version_id
      where a.registration_id = target_registration
        and a.document_version_id = private.presented_document_version(k.kind)
        and a.document_status_at_acceptance = v.status)
  order by k.kind;
$$;

comment on function public.registration_documents_requiring_acceptance(uuid) is
  'Kinds whose presented version this registration has not accepted in its '
  'current status, for consent_state renewal_required (DEC-029). Empty for a '
  'registration the caller cannot read.';


create function public.renew_registration_documents(
  target_registration uuid,
  documents jsonb
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  fam uuid;
  doc_kind public.registration_document_kind;
  presented uuid;
  version_row public.registration_document_versions%rowtype;
  acc_id uuid;
  renewed_ids uuid[] := '{}';
  path text;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select r.family_id into fam
  from public.registration_submissions r where r.id = target_registration;
  -- A registration that does not exist and another family's get the same answer.
  if fam is null or not private.is_family_member(fam)
     or not private.has_role('parent') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform private.reg_object(documents, 'documents',
    array['liability_waiver', 'code_of_conduct', 'parent_handbook']);
  if (select count(*) from jsonb_object_keys(documents)) = 0 then
    perform private.reg_fail('documents');
  end if;

  foreach doc_kind in array enum_range(null::public.registration_document_kind) loop
    continue when not documents ? doc_kind::text;
    path := 'documents.' || doc_kind::text;
    if doc_kind = 'parent_handbook' then
      perform private.reg_object(documents -> doc_kind::text, path,
                                 array['version_id', 'acknowledged']);
      if private.reg_bool(documents -> doc_kind::text, 'acknowledged', path) is not true then
        perform private.reg_fail(path || '.acknowledged');
      end if;
    else
      perform private.reg_object(documents -> doc_kind::text, path,
                                 array['version_id', 'typed_signature']);
      perform private.reg_text(documents -> doc_kind::text, 'typed_signature', path, 120, true);
    end if;
    perform private.reg_uuid(documents -> doc_kind::text, 'version_id', path);
  end loop;

  foreach doc_kind in array enum_range(null::public.registration_document_kind) loop
    continue when not documents ? doc_kind::text;
    presented := private.presented_document_version(doc_kind);
    if presented is null then
      return query select 'blocked_documents_unavailable'::text;
      return;
    end if;
    if presented <> (documents -> doc_kind::text ->> 'version_id')::uuid then
      return query select 'blocked_document_version_stale'::text;
      return;
    end if;
  end loop;

  foreach doc_kind in array enum_range(null::public.registration_document_kind) loop
    continue when not documents ? doc_kind::text;
    select * into version_row
    from public.registration_document_versions v
    where v.id = (documents -> doc_kind::text ->> 'version_id')::uuid;

    continue when exists (
      select 1 from public.registration_document_acceptances a
      where a.registration_id = target_registration
        and a.document_version_id = version_row.id
        and a.document_status_at_acceptance = version_row.status);

    begin
      insert into public.registration_document_acceptances
        (registration_id, document_version_id, document_kind, acceptance_method,
         signer_user_id, typed_signature, document_status_at_acceptance,
         document_sha256_at_acceptance)
      values
        (target_registration, version_row.id, doc_kind,
         case when doc_kind = 'parent_handbook'
              then 'acknowledgment'::public.document_acceptance_method
              else 'signature'::public.document_acceptance_method end,
         caller,
         case when doc_kind = 'parent_handbook' then null
              else private.reg_text(documents -> doc_kind::text, 'typed_signature',
                                    'document', 120, true) end,
         version_row.status, version_row.content_sha256)
      returning id into acc_id;
    exception
      when unique_violation then
        -- A concurrent renewal of the same version committed first.
        continue;
    end;

    insert into public.registration_acceptance_children
      (acceptance_id, registration_child_id, registration_id)
    select acc_id, c.id, target_registration
    from public.registration_children c
    where c.registration_id = target_registration;

    renewed_ids := renewed_ids || version_row.id;
  end loop;

  if cardinality(renewed_ids) = 0 then
    return query select 'already_current'::text;
    return;
  end if;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values
    (caller, 'registration', target_registration, 'documents_renewed',
     jsonb_build_object('document_version_ids', to_jsonb(renewed_ids),
                        'is_sample', true));

  return query select 'renewed'::text;
end;
$$;

comment on function public.renew_registration_documents(uuid, jsonb) is
  'A parent in the registration''s family accepts the presented version of one '
  'to three documents (DEC-029). Idempotent per version and status: a retry returns '
  'already_current. Covers every child of the registration. Errors name paths, '
  'never values.';


create function public.owner_publish_registration_document(target_version uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  version_row public.registration_document_versions%rowtype;
  retired_id uuid;
  failed_constraint text;
begin
  -- MPS-RUL-010: Samantha is the content owner. Administrators cannot publish.
  if caller is null or not private.has_role('owner') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into version_row
  from public.registration_document_versions
  where id = target_version
  for update;
  if not found then
    raise exception 'document version not found' using errcode = 'P0002';
  end if;

  if version_row.status = 'approved' then
    return 'unchanged';
  end if;
  if version_row.status <> 'draft' then
    raise exception 'only a draft can be published' using errcode = '23514';
  end if;
  if version_row.content_reference is null or version_row.content_sha256 is null then
    raise exception 'a published version needs its approved source reference and sha256'
      using errcode = '22023';
  end if;

  -- Serialize publishes of one kind.
  perform 1 from public.registration_document_versions
  where document_kind = version_row.document_kind
  for update;

  begin
    update public.registration_document_versions
    set status = 'retired'
    where document_kind = version_row.document_kind and status = 'approved'
    returning id into retired_id;

    update public.registration_document_versions
    set status = 'approved', approved_at = now(), approved_by = caller
    where id = target_version;
  exception
    when check_violation then
      get stacked diagnostics failed_constraint = constraint_name;
      if failed_constraint = 'registration_document_versions_approval_locked' then
        return 'blocked_approval_locked';
      end if;
      raise;
  end;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values
    (caller, 'registration_document', target_version, 'published',
     jsonb_build_object('document_kind', version_row.document_kind,
                        'version_label', version_row.version_label,
                        'content_sha256', version_row.content_sha256,
                        'retired_version_id', retired_id));

  return 'published';
end;
$$;

comment on function public.owner_publish_registration_document(uuid) is
  'Owner-only publication of a registration document draft (DEC-029, '
  'MPS-RUL-010). Retires the current approved version, so every acceptance of it '
  'stops satisfying registration_policy_satisfied. Returns '
  'blocked_approval_locked and writes nothing while the approval lock stands.';


-- ===========================================================================
-- 6. Educator safety subset (DEC-027)
-- ===========================================================================
-- The ONLY educator path to registration data. It returns allergy, emergency
-- contacts, and approved pickup persons for confirmed children in a program
-- the caller is assigned to, and nothing else. No RLS policy on any
-- registration_* table names an educator.
--
-- An unassigned program and a program that does not exist get the same
-- refusal, so the function is no program or child oracle. Confirmed only, as
-- in both roster views (MPS-RUL-003). The source is the child's most recent
-- registration, so superseded allergy data is never shown.
create function public.educator_child_safety(target_program uuid)
returns table (
  enrollment_id uuid,
  preferred_name text,
  safety_on_file boolean,
  has_allergies boolean,
  allergy_details text,
  emergency_contacts jsonb,
  pickup_persons jsonb,
  recorded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or target_program is null
     or not private.has_role('educator')
     or not private.is_assigned_educator(target_program) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select e.id,
         s.preferred_name,
         latest.registration_id is not null,
         h.has_allergies,
         h.allergy_details,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'full_name', c.full_name,
                    'relationship', c.relationship,
                    'phone', c.phone) order by c.sort_order)
           from public.registration_contacts c
           where c.registration_id = latest.registration_id
             and c.contact_kind = 'emergency'), '[]'::jsonb),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'full_name', c.full_name,
                    'relationship', c.relationship,
                    'phone', c.phone) order by c.sort_order)
           from public.registration_contacts c
           where c.registration_id = latest.registration_id
             and c.contact_kind = 'pickup'), '[]'::jsonb),
         latest.submitted_at
  from public.enrollments e
  join public.students s on s.id = e.student_id
  left join lateral (
    select rc.id as registration_child_id, rc.registration_id, r.submitted_at
    from public.registration_children rc
    join public.registration_submissions r on r.id = rc.registration_id
    where rc.student_id = e.student_id
    order by r.submitted_at desc, r.created_at desc, r.id desc
    limit 1
  ) latest on true
  left join public.registration_child_health h
    on h.registration_child_id = latest.registration_child_id
  where e.program_id = target_program
    and e.state = 'confirmed'
  order by s.preferred_name, e.id;
end;
$$;

comment on function public.educator_child_safety(uuid) is
  'DEC-027 educator safety subset: allergy answer and details, emergency '
  'contacts, and approved pickup persons for confirmed children in one '
  'assigned program. Never guardian contacts, medical, accommodation, media '
  'permission, signatures, acceptances, STEP UP, or payment. 42501 for any '
  'caller who is not an educator assigned to target_program.';


-- ===========================================================================
-- 7. submit_family_registration (same signature, DEC-026/028/029/032)
-- ===========================================================================
-- Changes from 20260918120000:
--   * children require has_medical_needs and has_accommodation_needs; details
--     go with Yes and only with Yes;
--   * at least one emergency contact and one pickup person;
--   * selections are validated against program_attendance_rules, and carry an
--     optional plan_days_per_week; a published program with no rule is
--     blocked_attendance_unconfigured;
--   * a STEP UP child's enrollments are evaluated with require_review;
--   * the stale check uses the presented version, and each acceptance keeps a
--     sha256 snapshot.
--
-- Payload (snake_case JSON):
--   authority_affirmed   boolean, must be true
--   guardian_contacts    1–2 of {full_name, phone, email?, relationship?, is_submitter}
--   emergency_contacts   1–4 of {full_name, relationship, phone}
--   pickup_persons       1–6 of {full_name, relationship, phone?}
--   children             1–10 of {student_id | new_student{preferred_name,
--                        grade_level?, guardian_relationship?},
--                        has_allergies, allergy_details?,
--                        has_medical_needs, medical_information?,
--                        has_accommodation_needs, accommodation_information?,
--                        photo_video_permission, step_up?{selected, reference?},
--                        selections 1–10 of {program_id, attendance_days?,
--                        plan_days_per_week?}}
--   documents            {liability_waiver{version_id, typed_signature},
--                         code_of_conduct{version_id, typed_signature},
--                         parent_handbook{version_id, acknowledged: true}}
--
-- Outcomes: submitted, replayed, idempotency_conflict, blocked_authority,
-- blocked_documents_unavailable, blocked_document_version_stale,
-- blocked_attendance_unconfigured, blocked_unavailable, blocked_closed,
-- blocked_full, blocked_duplicate. A blocked submission writes nothing.
create or replace function public.submit_family_registration(
  idempotency_key uuid,
  payload jsonb
)
returns table (
  outcome text,
  registration_id uuid,
  blocker_child_index integer,
  blocker_program_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  fam uuid;
  fingerprint text;
  prior public.registration_submissions%rowtype;
  reg_id uuid;

  guardians jsonb;
  emergencies jsonb;
  pickups jsonb;
  kids jsonb;
  docs jsonb;
  item jsonb;
  sub jsonb;
  sels jsonb;
  days jsonb;
  path text;
  sel_path text;
  i integer;
  j integer;
  submitter_count integer := 0;
  answer boolean;
  step_up jsonb;
  referenced_family uuid;

  prog uuid;
  mode public.attendance_selection_mode;
  plan_count integer;
  has_plans boolean;

  doc_kind public.registration_document_kind;
  doc_version uuid;
  current_version public.registration_document_versions%rowtype;
  version_ids uuid[] := '{}';

  child_ids uuid[] := '{}';
  student_ids uuid[] := '{}';
  step_up_flags boolean[] := '{}';
  created_count integer := 0;
  step_up_count integer := 0;
  selection_count integer := 0;
  sid uuid;
  cid uuid;
  created_flag boolean;
  clean_name text;
  sel record;
  core record;
  acc_id uuid;
  resolved_days public.attendance_day[];

  err_msg text;
  err_detail text;
  err_hint text;
begin
  -- 1. Identity, role, and family: all from the session.
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not private.has_role('parent') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select fm.family_id into fam
  from public.family_members fm
  where fm.user_id = caller
  limit 1;
  if fam is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if submit_family_registration.idempotency_key is null then
    perform private.reg_fail('idempotency_key');
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    perform private.reg_fail('payload');
  end if;

  -- 2. Idempotency, before anything else is evaluated.
  fingerprint := encode(sha256(convert_to(payload::text, 'UTF8')), 'hex');

  select * into prior
  from public.registration_submissions r
  where r.submitted_by = caller
    and r.idempotency_key = submit_family_registration.idempotency_key;

  if found then
    if prior.request_fingerprint = fingerprint then
      return query select 'replayed'::text, prior.id, null::integer, null::uuid;
    else
      return query select 'idempotency_conflict'::text, null::uuid,
                          null::integer, null::uuid;
    end if;
    return;
  end if;

  -- 3. Shape. Everything is validated before anything is written.
  perform private.reg_object(payload, 'payload', array[
    'authority_affirmed', 'guardian_contacts', 'emergency_contacts',
    'pickup_persons', 'children', 'documents']);

  guardians := private.reg_array(payload, 'guardian_contacts', 'payload', 1, 2);
  for i in 0 .. jsonb_array_length(guardians) - 1 loop
    path := format('guardian_contacts[%s]', i);
    item := private.reg_object(guardians -> i, path, array[
      'full_name', 'phone', 'email', 'relationship', 'is_submitter']);
    perform private.reg_text(item, 'full_name', path, 120, true);
    perform private.reg_text(item, 'phone', path, 32, true);
    perform private.reg_text(item, 'email', path, 254, false);
    perform private.reg_text(item, 'relationship', path, 40, false);
    if private.reg_bool(item, 'is_submitter', path) then
      submitter_count := submitter_count + 1;
    end if;
  end loop;
  if submitter_count <> 1 then
    perform private.reg_fail('guardian_contacts needs exactly one submitter');
  end if;

  -- DEC-026: at least one emergency contact and one approved pickup person.
  emergencies := private.reg_array(payload, 'emergency_contacts', 'payload', 1, 4);
  for i in 0 .. jsonb_array_length(emergencies) - 1 loop
    path := format('emergency_contacts[%s]', i);
    item := private.reg_object(emergencies -> i, path,
                               array['full_name', 'relationship', 'phone']);
    perform private.reg_text(item, 'full_name', path, 120, true);
    perform private.reg_text(item, 'relationship', path, 40, true);
    perform private.reg_text(item, 'phone', path, 32, true);
  end loop;

  pickups := private.reg_array(payload, 'pickup_persons', 'payload', 1, 6);
  for i in 0 .. jsonb_array_length(pickups) - 1 loop
    path := format('pickup_persons[%s]', i);
    item := private.reg_object(pickups -> i, path,
                               array['full_name', 'relationship', 'phone']);
    perform private.reg_text(item, 'full_name', path, 120, true);
    perform private.reg_text(item, 'relationship', path, 40, true);
    perform private.reg_text(item, 'phone', path, 32, false);
  end loop;

  kids := private.reg_array(payload, 'children', 'payload', 1, 10);
  for i in 0 .. jsonb_array_length(kids) - 1 loop
    path := format('children[%s]', i);
    item := private.reg_object(kids -> i, path, array[
      'student_id', 'new_student', 'has_allergies', 'allergy_details',
      'has_medical_needs', 'medical_information',
      'has_accommodation_needs', 'accommodation_information',
      'photo_video_permission', 'step_up', 'selections']);

    if (item ? 'student_id') = (item ? 'new_student') then
      perform private.reg_fail(path || ' needs exactly one of student_id or new_student');
    end if;
    if item ? 'student_id' then
      perform private.reg_uuid(item, 'student_id', path);
    else
      sub := private.reg_object(item -> 'new_student', path || '.new_student',
        array['preferred_name', 'grade_level', 'guardian_relationship']);
      perform private.reg_text(sub, 'preferred_name', path || '.new_student', 80, true);
      perform private.reg_text(sub, 'grade_level', path || '.new_student', 40, false);
      perform private.reg_text(sub, 'guardian_relationship', path || '.new_student', 40, false);
    end if;

    -- DEC-026: each answer is an explicit boolean (absent or null is refused);
    -- details go with Yes and only with Yes.
    answer := private.reg_bool(item, 'has_allergies', path);
    if answer <> (private.reg_text(item, 'allergy_details', path, 1000, false) is not null) then
      perform private.reg_fail(path || '.allergy_details');
    end if;
    answer := private.reg_bool(item, 'has_medical_needs', path);
    if answer <> (private.reg_text(item, 'medical_information', path, 1000, false) is not null) then
      perform private.reg_fail(path || '.medical_information');
    end if;
    answer := private.reg_bool(item, 'has_accommodation_needs', path);
    if answer <> (private.reg_text(item, 'accommodation_information', path, 1000, false)
                  is not null) then
      perform private.reg_fail(path || '.accommodation_information');
    end if;
    perform private.reg_bool(item, 'photo_video_permission', path);

    if item ? 'step_up' and jsonb_typeof(item -> 'step_up') <> 'null' then
      step_up := private.reg_object(item -> 'step_up', path || '.step_up',
                                    array['selected', 'reference']);
      if not private.reg_bool(step_up, 'selected', path || '.step_up')
         and private.reg_text(step_up, 'reference', path || '.step_up', 64, false)
             is not null then
        perform private.reg_fail(path || '.step_up.reference');
      end if;
      perform private.reg_text(step_up, 'reference', path || '.step_up', 64, false);
    end if;

    sels := private.reg_array(item, 'selections', path, 1, 10);
    for j in 0 .. jsonb_array_length(sels) - 1 loop
      sel_path := format('%s.selections[%s]', path, j);
      sub := private.reg_object(sels -> j, sel_path,
                                array['program_id', 'attendance_days', 'plan_days_per_week']);
      perform private.reg_uuid(sub, 'program_id', sel_path);
      days := private.reg_array(sub, 'attendance_days', sel_path, 0, 7);
      if exists (
           select 1 from jsonb_array_elements(days) d
           where jsonb_typeof(d) <> 'string'
              or not ((d #>> '{}') = any (enum_range(null::public.attendance_day)::text[]))
         )
         or (select count(distinct d) from jsonb_array_elements(days) d)
            <> jsonb_array_length(days) then
        perform private.reg_fail(sel_path || '.attendance_days');
      end if;
      if sub ? 'plan_days_per_week' and jsonb_typeof(sub -> 'plan_days_per_week') <> 'null'
         and (jsonb_typeof(sub -> 'plan_days_per_week') <> 'number'
              or (sub ->> 'plan_days_per_week') !~ '^[1-7]$') then
        perform private.reg_fail(sel_path || '.plan_days_per_week');
      end if;
    end loop;
    if (select count(distinct s ->> 'program_id') from jsonb_array_elements(sels) s)
       <> jsonb_array_length(sels) then
      perform private.reg_fail(path || '.selections repeats a program');
    end if;
  end loop;

  docs := private.reg_object(payload -> 'documents', 'documents',
    array['liability_waiver', 'code_of_conduct', 'parent_handbook']);
  perform private.reg_object(docs -> 'liability_waiver', 'documents.liability_waiver',
                             array['version_id', 'typed_signature']);
  perform private.reg_uuid(docs -> 'liability_waiver', 'version_id', 'documents.liability_waiver');
  perform private.reg_text(docs -> 'liability_waiver', 'typed_signature',
                           'documents.liability_waiver', 120, true);
  perform private.reg_object(docs -> 'code_of_conduct', 'documents.code_of_conduct',
                             array['version_id', 'typed_signature']);
  perform private.reg_uuid(docs -> 'code_of_conduct', 'version_id', 'documents.code_of_conduct');
  perform private.reg_text(docs -> 'code_of_conduct', 'typed_signature',
                           'documents.code_of_conduct', 120, true);
  -- No typed_signature key is allowed here: an acknowledgment is not a signature.
  perform private.reg_object(docs -> 'parent_handbook', 'documents.parent_handbook',
                             array['version_id', 'acknowledged']);
  perform private.reg_uuid(docs -> 'parent_handbook', 'version_id', 'documents.parent_handbook');
  if private.reg_bool(docs -> 'parent_handbook', 'acknowledged',
                      'documents.parent_handbook') is not true then
    perform private.reg_fail('documents.parent_handbook.acknowledged');
  end if;

  -- 4. Guardian authority (MPS-RUL-008).
  if private.reg_bool(payload, 'authority_affirmed', 'payload') is not true then
    return query select 'blocked_authority'::text, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- Referenced students must be this family's. Another family's child and a
  -- child that never existed get the identical refusal (no membership oracle).
  for i in 0 .. jsonb_array_length(kids) - 1 loop
    if kids -> i ? 'student_id' then
      referenced_family := null;
      select s.family_id into referenced_family
      from public.students s
      where s.id = (kids -> i ->> 'student_id')::uuid;
      if referenced_family is null or referenced_family <> fam then
        raise exception 'not authorized' using errcode = '42501';
      end if;
    end if;
  end loop;

  -- 5. Documents: the version the family saw must be the one presented now.
  foreach doc_kind in array enum_range(null::public.registration_document_kind) loop
    doc_version := (docs -> doc_kind::text ->> 'version_id')::uuid;
    current_version := null;
    select * into current_version
    from public.registration_document_versions v
    where v.id = private.presented_document_version(doc_kind);
    if current_version.id is null then
      return query select 'blocked_documents_unavailable'::text, null::uuid,
                          null::integer, null::uuid;
      return;
    end if;
    if current_version.id <> doc_version then
      return query select 'blocked_document_version_stale'::text, null::uuid,
                          null::integer, null::uuid;
      return;
    end if;
    version_ids := version_ids || current_version.id;
  end loop;

  -- 6. Attendance (DEC-032), against the structured configuration.
  for i in 0 .. jsonb_array_length(kids) - 1 loop
    sels := kids -> i -> 'selections';
    for j in 0 .. jsonb_array_length(sels) - 1 loop
      sub := sels -> j;
      sel_path := format('children[%s].selections[%s]', i, j);
      prog := (sub ->> 'program_id')::uuid;
      days := coalesce(nullif(sub -> 'attendance_days', 'null'::jsonb), '[]'::jsonb);
      plan_count := case when jsonb_typeof(sub -> 'plan_days_per_week') = 'number'
                         then (sub ->> 'plan_days_per_week')::integer end;

      mode := null;
      select r.selection_mode into mode
      from public.program_attendance_rules r where r.program_id = prog;

      if mode is null then
        -- An unpublished or missing program is left to the enrollment core,
        -- which answers blocked_unavailable.
        if exists (select 1 from public.programs p
                   where p.id = prog and p.publication_state = 'published') then
          return query select 'blocked_attendance_unconfigured'::text, null::uuid, i, prog;
          return;
        end if;
        continue;
      end if;

      if mode = 'fixed' then
        -- The family is not asked; any day or plan they send is refused.
        if jsonb_array_length(days) > 0 then
          perform private.reg_fail(sel_path || '.attendance_days');
        end if;
        if plan_count is not null then
          perform private.reg_fail(sel_path || '.plan_days_per_week');
        end if;
        continue;
      end if;

      if exists (select 1 from jsonb_array_elements_text(days) d
                 where not exists (
                   select 1 from public.program_attendance_days pd
                   where pd.program_id = prog and pd.day::text = d)) then
        perform private.reg_fail(sel_path || '.attendance_days');
      end if;

      has_plans := exists (select 1 from public.program_attendance_plans pp
                           where pp.program_id = prog);
      if has_plans then
        if plan_count is null or not exists (
             select 1 from public.program_attendance_plans pp
             where pp.program_id = prog and pp.days_per_week = plan_count) then
          perform private.reg_fail(sel_path || '.plan_days_per_week');
        end if;
        if jsonb_array_length(days) <> plan_count then
          perform private.reg_fail(sel_path || '.attendance_days');
        end if;
      else
        if plan_count is not null then
          perform private.reg_fail(sel_path || '.plan_days_per_week');
        end if;
        if jsonb_array_length(days) < 1 then
          perform private.reg_fail(sel_path || '.attendance_days');
        end if;
      end if;
    end loop;
  end loop;

  -- 7. Atomic body. A blocked selection raises HR001, which rolls back every
  --    row written in this block, including the submission itself.
  begin
    begin
      insert into public.registration_submissions
        (family_id, submitted_by, idempotency_key, request_fingerprint)
      values
        (fam, caller, submit_family_registration.idempotency_key, fingerprint)
      returning id into reg_id;
    exception
      when unique_violation then
        -- A concurrent retry with the same key committed first.
        select * into prior
        from public.registration_submissions r
        where r.submitted_by = caller
          and r.idempotency_key = submit_family_registration.idempotency_key;
        if prior.request_fingerprint = fingerprint then
          return query select 'replayed'::text, prior.id, null::integer, null::uuid;
        else
          return query select 'idempotency_conflict'::text, null::uuid,
                              null::integer, null::uuid;
        end if;
        return;
    end;

    -- Children, their health, and STEP UP.
    for i in 0 .. jsonb_array_length(kids) - 1 loop
      item := kids -> i;
      created_flag := false;

      if item ? 'student_id' then
        sid := (item ->> 'student_id')::uuid;
      else
        sub := item -> 'new_student';
        clean_name := private.reg_text(sub, 'preferred_name', 'new_student', 80, true);
        sid := null;
        select s.id into sid
        from public.students s
        where s.family_id = fam and lower(s.preferred_name) = lower(clean_name)
        limit 1;
        if sid is null then
          begin
            insert into public.students
              (family_id, preferred_name, grade_level, guardian_relationship)
            values
              (fam, clean_name,
               private.reg_text(sub, 'grade_level', 'new_student', 40, false),
               private.reg_text(sub, 'guardian_relationship', 'new_student', 40, false))
            returning id into sid;
            created_flag := true;
            created_count := created_count + 1;
          exception
            when unique_violation then
              select s.id into sid
              from public.students s
              where s.family_id = fam and lower(s.preferred_name) = lower(clean_name)
              limit 1;
          end;
        end if;
      end if;

      begin
        insert into public.registration_children
          (registration_id, student_id, created_student, photo_video_permission)
        values
          (reg_id, sid, created_flag, (item ->> 'photo_video_permission')::boolean)
        returning id into cid;
      exception
        when unique_violation then
          perform private.reg_fail(format('children[%s] repeats another child', i));
      end;

      child_ids := child_ids || cid;
      student_ids := student_ids || sid;

      insert into public.registration_child_health
        (registration_child_id, registration_id, has_allergies, allergy_details,
         has_medical_needs, medical_information,
         has_accommodation_needs, accommodation_information)
      values
        (cid, reg_id, (item ->> 'has_allergies')::boolean,
         private.reg_text(item, 'allergy_details', 'child', 1000, false),
         (item ->> 'has_medical_needs')::boolean,
         private.reg_text(item, 'medical_information', 'child', 1000, false),
         (item ->> 'has_accommodation_needs')::boolean,
         private.reg_text(item, 'accommodation_information', 'child', 1000, false));

      step_up := item -> 'step_up';
      if step_up is not null and jsonb_typeof(step_up) = 'object'
         and (step_up ->> 'selected')::boolean then
        insert into public.registration_step_up_requests
          (registration_child_id, registration_id, reference)
        values
          (cid, reg_id, private.reg_text(step_up, 'reference', 'step_up', 64, false));
        step_up_count := step_up_count + 1;
        step_up_flags := step_up_flags || true;
      else
        step_up_flags := step_up_flags || false;
      end if;
    end loop;

    -- Contacts.
    for i in 0 .. jsonb_array_length(guardians) - 1 loop
      item := guardians -> i;
      insert into public.registration_contacts
        (registration_id, contact_kind, full_name, relationship, phone, email,
         is_submitter, sort_order)
      values
        (reg_id, 'guardian',
         private.reg_text(item, 'full_name', 'contact', 120, true),
         private.reg_text(item, 'relationship', 'contact', 40, false),
         private.reg_text(item, 'phone', 'contact', 32, true),
         private.reg_text(item, 'email', 'contact', 254, false),
         (item ->> 'is_submitter')::boolean, i);
    end loop;
    for i in 0 .. jsonb_array_length(emergencies) - 1 loop
      item := emergencies -> i;
      insert into public.registration_contacts
        (registration_id, contact_kind, full_name, relationship, phone, sort_order)
      values
        (reg_id, 'emergency',
         private.reg_text(item, 'full_name', 'contact', 120, true),
         private.reg_text(item, 'relationship', 'contact', 40, true),
         private.reg_text(item, 'phone', 'contact', 32, true), i);
    end loop;
    for i in 0 .. jsonb_array_length(pickups) - 1 loop
      item := pickups -> i;
      insert into public.registration_contacts
        (registration_id, contact_kind, full_name, relationship, phone, sort_order)
      values
        (reg_id, 'pickup',
         private.reg_text(item, 'full_name', 'contact', 120, true),
         private.reg_text(item, 'relationship', 'contact', 40, true),
         private.reg_text(item, 'phone', 'contact', 32, false), i);
    end loop;

    -- Selections, in program order so concurrent submissions lock program
    -- rows in the same order and cannot deadlock each other.
    for sel in
      select (c.ord - 1)::integer as child_index,
             (s.value ->> 'program_id')::uuid as program_id,
             coalesce(nullif(s.value -> 'attendance_days', 'null'::jsonb),
                      '[]'::jsonb) as days,
             case when jsonb_typeof(s.value -> 'plan_days_per_week') = 'number'
                  then (s.value ->> 'plan_days_per_week')::smallint end as plan
      from jsonb_array_elements(kids) with ordinality as c(value, ord)
      cross join lateral jsonb_array_elements(c.value -> 'selections') as s(value)
      order by 2, 1
    loop
      select * into core
      from private.request_enrollment_core(
        caller, fam, student_ids[sel.child_index + 1], sel.program_id,
        step_up_flags[sel.child_index + 1]) rc;

      if core.outcome in ('blocked_unavailable', 'blocked_closed', 'blocked_full') then
        raise exception using errcode = 'HR001', message = core.outcome,
          detail = sel.child_index::text, hint = sel.program_id::text;
      elsif core.outcome = 'duplicate' then
        raise exception using errcode = 'HR001', message = 'blocked_duplicate',
          detail = sel.child_index::text, hint = sel.program_id::text;
      end if;

      -- A fixed program stores its configured days as evidence; a chosen
      -- program stores the family's validated choice.
      if exists (select 1 from public.program_attendance_rules r
                 where r.program_id = sel.program_id and r.selection_mode = 'fixed') then
        select coalesce(array_agg(d.day order by d.day), '{}') into resolved_days
        from public.program_attendance_days d where d.program_id = sel.program_id;
      else
        select coalesce(array_agg(d::public.attendance_day order by d::public.attendance_day), '{}')
        into resolved_days
        from jsonb_array_elements_text(sel.days) d;
      end if;

      insert into public.registration_selections
        (registration_child_id, registration_id, program_id, enrollment_id,
         attendance_days, plan_days_per_week)
      values
        (child_ids[sel.child_index + 1], reg_id, sel.program_id, core.enrollment_id,
         resolved_days, sel.plan);
      selection_count := selection_count + 1;
    end loop;

    -- Acceptance evidence. Signer is always the caller; every child is covered.
    foreach doc_kind in array enum_range(null::public.registration_document_kind) loop
      select * into current_version
      from public.registration_document_versions v
      where v.id = (docs -> doc_kind::text ->> 'version_id')::uuid;

      insert into public.registration_document_acceptances
        (registration_id, document_version_id, document_kind, acceptance_method,
         signer_user_id, typed_signature, document_status_at_acceptance,
         document_sha256_at_acceptance)
      values
        (reg_id, current_version.id, doc_kind,
         case when doc_kind = 'parent_handbook'
              then 'acknowledgment'::public.document_acceptance_method
              else 'signature'::public.document_acceptance_method end,
         caller,
         case when doc_kind = 'parent_handbook' then null
              else private.reg_text(docs -> doc_kind::text, 'typed_signature',
                                    'document', 120, true) end,
         current_version.status, current_version.content_sha256)
      returning id into acc_id;

      insert into public.registration_acceptance_children
        (acceptance_id, registration_child_id, registration_id)
      select acc_id, c, reg_id from unnest(child_ids) as c;
    end loop;

    -- Attributable history: counts and ids only, never a submitted value.
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      (caller, 'registration', reg_id, 'submitted', jsonb_build_object(
        'child_count', cardinality(child_ids),
        'created_student_count', created_count,
        'selection_count', selection_count,
        'guardian_contact_count', jsonb_array_length(guardians),
        'emergency_contact_count', jsonb_array_length(emergencies),
        'pickup_person_count', jsonb_array_length(pickups),
        'step_up_count', step_up_count,
        'document_version_ids', to_jsonb(version_ids),
        'is_sample', true));
  exception
    when sqlstate 'HR001' then
      get stacked diagnostics
        err_msg = message_text,
        err_detail = pg_exception_detail,
        err_hint = pg_exception_hint;
      return query select err_msg, null::uuid, err_detail::integer, err_hint::uuid;
      return;
  end;

  return query select 'submitted'::text, reg_id, null::integer, null::uuid;
end;
$$;

comment on function public.submit_family_registration(uuid, jsonb) is
  'The only write path for family registration (SAMPLE ONLY). Derives family '
  'and role from the session, is idempotent per (caller, idempotency_key), is '
  'atomic across children and selections, validates attendance against '
  'program_attendance_rules, requires explicit health answers and at least one '
  'emergency and pickup contact, sends STEP UP children to administrative '
  'review instead of checkout, and never writes confirmed or payment states. '
  'Errors name payload paths, never values.';


-- ===========================================================================
-- 8. Function privileges
-- ===========================================================================
revoke all on function private.request_enrollment_core(uuid, uuid, uuid, uuid, boolean) from public;
revoke all on function private.step_up_transition_allowed(
  public.step_up_verification_state, public.step_up_verification_state) from public;
revoke all on function private.registration_step_up_guard() from public;
revoke all on function private.registration_document_version_guard() from public;
revoke all on function private.enforce_registration_acceptance_signer() from public;

-- Called from RLS and an invoker function, so authenticated needs EXECUTE.
-- `private` is not an exposed schema.
revoke all on function private.presented_document_version(public.registration_document_kind) from public;
grant execute on function private.presented_document_version(public.registration_document_kind)
  to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_set_program_attendance(uuid, public.attendance_selection_mode, public.attendance_day[], smallint[])',
    'public.admin_set_step_up_state(uuid, public.step_up_verification_state, public.step_up_verification_state)',
    'public.admin_step_up_review_queue()',
    'public.registration_documents_requiring_acceptance(uuid)',
    'public.renew_registration_documents(uuid, jsonb)',
    'public.owner_publish_registration_document(uuid)',
    'public.educator_child_safety(uuid)',
    'public.registration_policy_satisfied(uuid)',
    'public.submit_family_registration(uuid, jsonb)',
    'public.family_request_enrollment(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;


-- ===========================================================================
-- 9. RLS and table privileges — last, after every DDL statement (DEFECT-FF1)
-- ===========================================================================
alter table public.program_attendance_rules enable row level security;
alter table public.program_attendance_days enable row level security;
alter table public.program_attendance_plans enable row level security;

-- Readable exactly when the program is: the subquery runs under the caller's
-- own RLS on public.programs (anon: published only).
do $$
declare
  t text;
begin
  foreach t in array array[
    'program_attendance_rules', 'program_attendance_days', 'program_attendance_plans'
  ] loop
    execute format(
      'create policy %I on public.%I for select to anon, authenticated '
      'using (exists (select 1 from public.programs p where p.id = program_id))',
      t || '_select_visible_program', t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end;
$$;
