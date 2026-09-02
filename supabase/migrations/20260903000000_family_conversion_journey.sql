-- Foundation Release — the family-side conversion journey
--
-- MPS: MPS-REQ-012 (evaluate program, capacity, waitlist, confirmation,
--      duplicate enrollment, family readiness, student, and consent state
--      BEFORE payment),
--      MPS-REQ-013 (hand off an eligible registration without treating
--      initiation as successful payment),
--      MPS-REQ-014 (one authoritative state; no duplicate enrollment or
--      double charge on retry),
--      MPS-REQ-002/003 (guardian-authority affirmation and its version),
--      MPS-REQ-024 (attributable history),
--      MPS-RUL-001 (per-program instant confirmation OR administrator
--      approval, as configured by an administrator),
--      MPS-RUL-002 (capacity is program-specific; a waitlist collects no
--      payment), MPS-RUL-007 (sample data only), MPS-RUL-008 (parent authority
--      before enrollment), MPS-RUL-010 (no invented policy language),
--      MPS-WFL-003 (main path, alternate paths "Administrator approval
--      required" / "Program full with waitlist" / "Program full without
--      waitlist", failure paths "Duplicate enrollment" / "Stale capacity",
--      recovery "safe retry without duplicate enrollment or double charging"),
--      MPS-ACC-002/018/019/020/021/022/023
-- MDS: components.enrollment_state; DO-DONT "Trust states"
-- MTS: SECURITY-ARCHITECTURE deny-by-default and least privilege;
--      INTEGRATION-MANIFEST "External checkout" (handoff only)
--
-- WHAT THIS MIGRATION ADDS, AND WHY IT IS THE FIRST OF ITS KIND
--
-- Until now no parent could create an enrollment. `public.enrollments` holds no
-- client write privilege at all and every row in the review environment arrives
-- from the sanitized seed. That was deliberate: creating an enrollment is
-- MPS-REQ-012/013, and evaluating eligibility is not something a client may be
-- trusted to do. This file adds the one door, on the server, in the database.
--
-- `public.family_request_enrollment` is that door. `public.enrollments` STILL
-- has no INSERT policy and no INSERT privilege for any client role. A parent
-- reaches this function or nothing.
--
-- CONFIRMATION MODE (closes GAP-ADMIN-006)
--
-- MPS-RUL-001: "Each program uses either instant confirmation or administrator
-- approval as configured." Two values, exactly those two, no third. Every
-- existing program defaults to `administrator_approval` under the owner
-- decision of 2026-09-01: a program nobody has configured must not route a
-- family toward a payment page. An administrator sets `instant` deliberately.
--
-- WHAT COUNTS AS A SEAT (GAP-FAM-001)
--
-- Only `confirmed`. MPS defines capacity but no seat-holding rule, and
-- `confirmed` is the only state the approved trust language calls a place
-- (src/components/enrollment/enrollment-state.tsx). An approval-required
-- program can therefore accumulate more pending requests than seats. That is
-- visible to the administrator and decided by them; it is not silently
-- resolved here. Owner decision of 2026-09-01.
--
-- WHAT THIS FUNCTION CAN NEVER DO
--
--   * It can never write `confirmed`, `payment_pending`, `payment_failed`, or
--     `canceled`. Those are administrator decisions and stay behind
--     `admin_set_enrollment_state`. A parent action cannot confirm an
--     enrollment or assert a payment outcome (MPS-REQ-013, DO-DONT).
--   * It accepts no family_id, no price, no state, and no capacity from the
--     caller. The family is re-derived from auth.uid(); everything else is read
--     from the locked program row.
--   * It initiates no payment and touches no checkout URL. The handoff is a
--     link on a page, and nothing is appended to it.
--
-- WHAT IS DELIBERATELY ABSENT
--
--   * No waitlist position, priority, or promotion (GAP-ADMIN-011 unchanged).
--   * No notification of any kind (GAP-ADMIN-005 unchanged).
--   * No consent or waiver record beyond the guardian-authority affirmation,
--     versioned 'demo-unapproved-v0' and CHECK-constrained to that value, the
--     same way public.students already is. MPS GAP-005 leaves the approved
--     language unwritten and MPS-RUL-010 forbids inventing it.
--   * No `payment_failed` path. MPS-WFL-003 names it, but no provider signal
--     exists that could produce it honestly (GAP-FAM-002).
--   * No change to `enrollments_sample_only`. A parent-created row in this
--     review environment is a sample row (MPS-RUL-007).
--
-- rollback:
--   revoke all on function public.family_request_enrollment(uuid, uuid, boolean) from authenticated;
--   drop function if exists public.family_request_enrollment(uuid, uuid, boolean);
--   revoke all on function public.admin_update_program_facts(
--     uuid, timestamptz, text, text, text, text, text, text, text, text, text,
--     text, text, public.availability_state, text,
--     public.program_confirmation_mode) from authenticated;
--   drop function if exists public.admin_update_program_facts(
--     uuid, timestamptz, text, text, text, text, text, text, text, text, text,
--     text, text, public.availability_state, text,
--     public.program_confirmation_mode);
--   -- then restore admin_update_program_facts and record_program_audit() from
--   -- 20260830090000 and 20260902000000 verbatim;
--   alter table public.enrollments
--     drop constraint if exists enrollments_affirmation_paired,
--     drop constraint if exists enrollments_affirmation_unapproved;
--   alter table public.enrollments
--     drop column if exists requested_by,
--     drop column if exists authority_affirmed_at,
--     drop column if exists authority_affirmation_version;
--   alter table public.programs drop column if exists confirmation_mode;
--   drop type if exists public.program_confirmation_mode;


-- ---------------------------------------------------------------------------
-- program_confirmation_mode
-- ---------------------------------------------------------------------------
create type public.program_confirmation_mode as enum (
  'instant',
  'administrator_approval'
);

comment on type public.program_confirmation_mode is
  'MPS-RUL-001, verbatim and exhaustive: a program uses either instant '
  'confirmation or administrator approval. `instant` does NOT mean the '
  'enrollment becomes confirmed — it means an eligible registration may be '
  'handed off to the external checkout (MPS-REQ-013). Confirmation still '
  'requires an authoritative outcome an administrator records.';

alter table public.programs
  add column confirmation_mode public.program_confirmation_mode
    not null default 'administrator_approval';

comment on column public.programs.confirmation_mode is
  'Per-program confirmation mode (MPS-RUL-001). Defaults to '
  'administrator_approval so an unconfigured program never routes a family '
  'toward payment. Only an administrator changes it (MPS-RUL-005).';


-- ---------------------------------------------------------------------------
-- enrollment affirmation and attribution
-- ---------------------------------------------------------------------------
-- The exact pattern public.students already uses. The version says
-- `demo-unapproved-v0` because it is: MPS-RUL-010 forbids inventing consent or
-- waiver language, none was written, and the CHECK makes it impossible for any
-- row to claim otherwise. This records an affirmation of parental authority
-- (MPS-RUL-008), not an acceptance of approved consent (checklist §6).
alter table public.enrollments
  add column authority_affirmation_version text,
  add column authority_affirmed_at timestamptz,
  add column requested_by uuid references auth.users (id) on delete set null;

alter table public.enrollments
  -- Nullable because seeded rows carry no affirmation. A non-null value can
  -- only ever be the unapproved demo version.
  add constraint enrollments_affirmation_unapproved
    check (authority_affirmation_version is null
           or authority_affirmation_version = 'demo-unapproved-v0'),
  -- A version without a time, or a time without a version, would be a record
  -- nobody could audit (MPS-REQ-003).
  add constraint enrollments_affirmation_paired
    check ((authority_affirmation_version is null)
           = (authority_affirmed_at is null));

comment on column public.enrollments.authority_affirmation_version is
  'Version of the guardian-authority affirmation accepted at registration '
  '(MPS-REQ-003, MPS-RUL-009). Always demo-unapproved-v0 while MPS GAP-005 '
  'leaves the approved language unwritten. NULL on seeded rows.';

comment on column public.enrollments.requested_by is
  'The parent who requested this registration (MPS-REQ-024). NULL on seeded '
  'rows and on any row whose requester was later deleted.';


-- ---------------------------------------------------------------------------
-- record_program_audit — confirmation_mode joins the material set
-- ---------------------------------------------------------------------------
-- MPS-REQ-024 names enrollment and program state as material. Confirmation mode
-- decides whether a family is routed toward payment, so a change to it is
-- exactly the kind of change history must carry. The function is otherwise
-- unchanged from `20260902000000_schedule_capacity_waitlist_attendance.sql`.
create or replace function public.record_program_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed jsonb := '{}'::jsonb;
  material text[] := array[
    'publication_state', 'published_price', 'published_registration_options',
    'published_dates', 'published_schedule', 'published_duration',
    'published_session_length', 'availability', 'enrollment_window',
    'checkout_url', 'educator', 'location', 'name', 'slug',
    'capacity', 'waitlist_enabled', 'confirmation_mode'
  ];
  field text;
  old_json jsonb;
  new_json jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'program', new.id, 'created',
       jsonb_build_object('publication_state', new.publication_state));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'program', old.id, 'deleted',
       jsonb_build_object('slug', old.slug));
    return old;
  end if;

  old_json := to_jsonb(old);
  new_json := to_jsonb(new);

  foreach field in array material loop
    if old_json -> field is distinct from new_json -> field then
      changed := changed || jsonb_build_object(
        field,
        jsonb_build_object('from', old_json -> field, 'to', new_json -> field)
      );
    end if;
  end loop;

  if changed <> '{}'::jsonb then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'program', new.id, 'updated', changed);
  end if;

  return new;
end;
$$;

revoke all on function public.record_program_audit() from public;


-- ---------------------------------------------------------------------------
-- public.admin_update_program_facts — confirmation mode joins the signature
-- ---------------------------------------------------------------------------
-- The prior 15-argument function is dropped and replaced rather than
-- overloaded: two overloads differing by one trailing argument is a footgun for
-- PostgREST, and a stale overload would be a second write path with no
-- confirmation-mode validation. Everything else in the body is unchanged from
-- `20260830090000_admin_program_enrollment_operations.sql`, including the
-- optimistic `expected_updated_at` guard and the checkout host allowlist.
drop function if exists public.admin_update_program_facts(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text,
  text, text, public.availability_state, text);

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
  program_checkout_url text,
  program_confirmation_mode public.program_confirmation_mode
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

  if program_confirmation_mode is null then
    raise exception 'confirmation mode is required' using errcode = '22023';
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
      checkout_url             = clean_checkout,
      confirmation_mode        = program_confirmation_mode
  where id = target_id;

  return 'updated';
end;
$$;

revoke all on function public.admin_update_program_facts(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text,
  text, text, public.availability_state, text,
  public.program_confirmation_mode) from public;
grant execute on function public.admin_update_program_facts(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text,
  text, text, public.availability_state, text,
  public.program_confirmation_mode) to authenticated;


-- ---------------------------------------------------------------------------
-- public.family_request_enrollment
-- ---------------------------------------------------------------------------
-- The MPS-REQ-012 evaluation, in the only place a client cannot reach around:
-- inside the database, on a locked program row, deriving the family from
-- auth.uid().
--
-- It returns an `outcome` rather than raising for the expected refusals, so the
-- surface can name the blocker to the parent (MPS-ACC-018) instead of showing a
-- generic failure. Only genuine authorization violations raise — a caller who
-- is not the student's parent gets no information at all.
--
-- Outcomes:
--   blocked_authority    guardian authority not affirmed (MPS-RUL-008, ACC-002)
--   blocked_unavailable  program is not published
--   blocked_closed       program availability is `closed`
--   duplicate            an enrollment already exists; its state is returned
--   blocked_full         at capacity, no waitlist (MPS-WFL-003 alternate path)
--   waitlisted           at capacity, waitlist enabled (MPS-ACC-020)
--   approval_pending     confirmation mode is administrator_approval (ACC-019)
--   started              eligible; the external handoff may be offered (ACC-021)
--
-- Every `blocked_*` outcome returns BEFORE any row is written and BEFORE any
-- payment path can be offered. That is MPS-ACC-018 and MPS-ACC-002 in one
-- control rather than in a page's judgement.
create function public.family_request_enrollment(
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
  program_row public.programs%rowtype;
  existing public.enrollments%rowtype;
  confirmed_count integer;
  resolved_state public.enrollment_state;
  created uuid;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- 1. Authorization. The family is READ FROM THE STUDENT and then checked
  --    against the caller's own membership; it is never an argument. A caller
  --    who is not a parent of this student learns nothing about whether the
  --    student exists.
  select s.family_id into student_family
  from public.students s
  where s.id = target_student;

  if student_family is null
     or not private.is_family_member(student_family)
     or not private.has_role('parent') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- 2. Guardian authority (MPS-RUL-008, MPS-ACC-002). Checked before anything
  --    is read about the program, and long before payment could be offered.
  if authority_affirmed is not true then
    return query select 'blocked_authority'::text, null::uuid,
                        null::public.enrollment_state;
    return;
  end if;

  -- 3/4. Program state. `for update` is what makes the capacity read below
  --      trustworthy: two concurrent registrations serialize here rather than
  --      both reading the same pre-insert count (MPS-WFL-003 "Stale capacity").
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

  -- 5. Duplicate enrollment (MPS-REQ-014, MPS-ACC-023). A resubmitted form, a
  --    refresh, or a double-clicked button lands here and creates nothing. The
  --    existing state is returned so the parent sees where they already are.
  select * into existing
  from public.enrollments e
  where e.student_id = target_student
    and e.program_id = target_program;

  if found then
    return query select 'duplicate'::text, existing.id, existing.state;
    return;
  end if;

  -- 6. Capacity and waitlist (MPS-RUL-002, MPS-ACC-020). NULL capacity means
  --    the program does not publish one, which is not the same as zero and is
  --    never treated as full.
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
      -- A waitlist place collects no payment and is not enrollment.
      resolved_state := 'waitlisted';
    end if;
  end if;

  -- 7/8. Confirmation mode (MPS-RUL-001, MPS-ACC-019). Reached only when a seat
  --      is available. `instant` yields `started`, which means the external
  --      handoff may be offered — never that anything is confirmed or paid.
  if resolved_state is null then
    resolved_state := case program_row.confirmation_mode
      when 'administrator_approval' then 'approval_pending'::public.enrollment_state
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
      -- A concurrent retry won the race. enrollments_one_per_student_program is
      -- the control MPS-REQ-014 asks for: there is one row, not two, and no
      -- second registration was handed to the payment path.
      select * into existing
      from public.enrollments e
      where e.student_id = target_student
        and e.program_id = target_program;
      return query select 'duplicate'::text, existing.id, existing.state;
      return;
  end;

  -- The enrollments_audit trigger already recorded the insert with its state
  -- and actor (MPS-REQ-024); nothing is written here twice.
  return query select resolved_state::text, created, resolved_state;
end;
$$;

comment on function public.family_request_enrollment(uuid, uuid, boolean) is
  'The MPS-REQ-012 pre-payment evaluation and the only path by which a parent '
  'creates an enrollment. Cannot write confirmed, payment_pending, '
  'payment_failed, or canceled; those stay administrator decisions. '
  'public.enrollments has no client INSERT privilege or policy.';

revoke all on function public.family_request_enrollment(uuid, uuid, boolean)
  from public;
grant execute on function public.family_request_enrollment(uuid, uuid, boolean)
  to authenticated;
