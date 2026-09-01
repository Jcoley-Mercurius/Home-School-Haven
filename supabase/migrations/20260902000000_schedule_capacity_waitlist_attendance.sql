-- Foundation Release — schedule, capacity, waitlist, and attendance foundation
--
-- MPS: MPS-REQ-012 (capacity and waitlist evaluated before payment),
--      MPS-REQ-014 (one authoritative enrollment state),
--      MPS-REQ-015 (family sees schedules and program changes),
--      MPS-REQ-016/017 (authorized administrative operations),
--      MPS-REQ-020 (one schedule truth across every surface),
--      MPS-REQ-024 (attributable history for schedule and capacity),
--      MPS-RUL-002 (capacity is program-specific; a waitlist collects no
--      payment), MPS-RUL-005 (only an administrator publishes),
--      MPS-FEA-011 (attendance tracking), MPS-FEA-012 (capacity and waitlist),
--      MPS-WFL-005 ("Add verified details, schedule, capacity …"; alternate
--      paths Rescheduled and Canceled), MPS-WFL-006 ("View assigned schedule
--      and roster"), MPS-WFL-007 (upcoming/active/changed/canceled/completed),
--      MPS-ACC-018/019/020/025/026/027/028/031
-- MDS: components.schedule_item — variants [class, event, deadline, cancelled,
--      rescheduled], states [upcoming, today, completed, changed, cancelled];
--      components.enrollment_state `waitlist` and `limited_spaces`
-- MTS: CAPABILITY-MATRIX "Supabase-backed program-specific capacity and
--      waitlist state" and "Assignment-scoped Supabase attendance records";
--      SECURITY-ARCHITECTURE deny-by-default and least privilege
--
-- WHAT A SCHEDULE IS, AFTER THIS MIGRATION
--
-- Until now there was no schedule model at all. `public.programs` held
-- published schedule *text* and NULL meant "the source does not publish this",
-- which is why the educator and family schedule surfaces could only restate
-- sentences and say so plainly (deviations D-EW2 and D-FD1).
--
-- `public.program_sessions` is the first dated schedule record in the product.
-- It does not replace, correct, or derive from the published text: the
-- `published_*` columns stay exactly as they are and stay the public catalog's
-- source of truth. A session is administrator-authored VERIFIED detail — step 2
-- of MPS-WFL-005 — and deriving one from "Tuesdays" or from a range that
-- publishes no year would be precisely the invention
-- BETA-CONTENT-IMPORT-INVENTORY rule 3 forbids. Where sessions exist they are
-- shown in addition to the published text; where they do not, nothing changes.
--
-- WHICH SESSION STATES ARE STORED, AND WHY THE OTHERS ARE NOT
--
-- Only the four an authorized person decides: scheduled, rescheduled, canceled,
-- completed. MPS-WFL-005's alternate paths name Rescheduled and Canceled;
-- MPS-WFL-007's states name canceled and completed; MDS `schedule_item.states`
-- names the presentation for all of them.
--
-- `upcoming`, `today`, and `active` are NOT stored and NOT enum values. They
-- are facts about the clock, not decisions, and storing them would require a
-- scheduled job nothing approves and would be wrong between its runs. They are
-- derived at render time in `src/lib/schedule/sessions.ts`.
--
-- These are SESSION states. Program-level `canceled` and `completed` remain
-- absent from `program_publication_state`: MPS-WFL-005 requires that affected
-- families be notified of a cancellation and no notification capability exists
-- (GAP-ADMIN-005). Nothing here adds one.
--
-- WHAT IS DELIBERATELY ABSENT
--
--   * No attendance status column. MPS-FEA-011 approves attendance tracking and
--     defines no vocabulary for absent, excused, tardy, or late, and no reason
--     or note field (GAP-ADMIN-010). A `session_attendance` row means "recorded
--     present"; no row means "not recorded", which is NOT the same claim as
--     "absent" and is never rendered as one.
--   * No `student_id` on `session_attendance`. It is keyed on `enrollment_id`,
--     so an educator recording attendance never receives an identifier for a
--     child. `EDUCATOR_ROSTER_COLUMNS` is not widened; a separate
--     security-barrier view carries its own allowlist.
--   * No waitlist position, priority, or promotion. MPS approves no ordering or
--     promotion rule (GAP-ADMIN-011). Placement order is read from
--     `state_changed_at`, which is a fact about when a decision was recorded,
--     not an entitlement to a seat.
--   * No capacity-driven enrollment mutation of any kind. See the note on
--     `admin_set_program_capacity`.
--   * No payment field, no notification, no refund, credit, or transfer.
--   * No family policy on `session_attendance`. MPS defines no family
--     attendance visibility (GAP-ADMIN-013), so none is granted.
--
-- rollback:
--   drop view if exists public.educator_session_roster;
--   revoke all on function public.clear_session_attendance(uuid, uuid) from authenticated;
--   revoke all on function public.record_session_attendance(uuid, uuid) from authenticated;
--   revoke all on function public.admin_set_program_capacity(uuid, timestamptz, integer, boolean) from authenticated;
--   revoke all on function public.admin_set_session_state(uuid, public.session_state, text, timestamptz) from authenticated;
--   revoke all on function public.admin_update_program_session(uuid, timestamptz, text, timestamptz, timestamptz, text, text) from authenticated;
--   revoke all on function public.admin_create_program_session(uuid, text, timestamptz, timestamptz, text) from authenticated;
--   drop function if exists public.clear_session_attendance(uuid, uuid);
--   drop function if exists public.record_session_attendance(uuid, uuid);
--   drop function if exists public.admin_set_program_capacity(uuid, timestamptz, integer, boolean);
--   drop function if exists public.admin_set_session_state(uuid, public.session_state, text, timestamptz);
--   drop function if exists public.admin_update_program_session(uuid, timestamptz, text, timestamptz, timestamptz, text, text);
--   drop function if exists public.admin_create_program_session(uuid, text, timestamptz, timestamptz, text);
--   drop function if exists private.session_transition_allowed(public.session_state, public.session_state);
--   drop function if exists private.may_record_attendance(uuid);
--   drop trigger if exists session_attendance_audit on public.session_attendance;
--   drop trigger if exists session_attendance_matches_session on public.session_attendance;
--   drop trigger if exists program_sessions_audit on public.program_sessions;
--   drop trigger if exists program_sessions_set_updated_at on public.program_sessions;
--   drop function if exists public.record_session_attendance_audit();
--   drop function if exists public.enforce_attendance_matches_session();
--   drop function if exists public.record_program_session_audit();
--   drop table if exists public.session_attendance;
--   drop table if exists public.program_sessions;
--   drop type if exists public.session_state;
--   alter table public.programs drop column if exists waitlist_enabled;
--   alter table public.programs drop column if exists capacity;
--   -- and restore record_program_audit()'s `material` array to its prior value.


-- ---------------------------------------------------------------------------
-- session_state
-- ---------------------------------------------------------------------------
create type public.session_state as enum (
  'scheduled',
  'rescheduled',
  'canceled',
  'completed'
);

comment on type public.session_state is
  'The four session states an authorized person decides (MPS-WFL-005 alternate '
  'paths, MPS-WFL-007 states). `upcoming`, `today`, and `active` are derived '
  'from the clock at render time and are deliberately not stored.';


-- ---------------------------------------------------------------------------
-- program_sessions
-- ---------------------------------------------------------------------------
create table public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete restrict,

  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,

  state public.session_state not null default 'scheduled',

  -- The previous start time, kept when a session is moved. Without it the
  -- family surface could say "changed" but not say what it changed from, and
  -- MPS-ACC-025 requires the current state to replace stale guidance "without
  -- erasing history".
  rescheduled_from timestamptz,
  -- Why it moved or why it was called off, in the administrator's words. Shown
  -- to families; never a policy decision and never a financial outcome.
  change_note text,

  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint program_sessions_sample_only check (is_sample),
  constraint program_sessions_title_length
    check (char_length(title) between 1 and 160),
  constraint program_sessions_location_length
    check (location is null or char_length(location) between 1 and 160),
  constraint program_sessions_change_note_length
    check (change_note is null or char_length(change_note) between 1 and 400),
  constraint program_sessions_ends_after_starts check (ends_at > starts_at),
  -- A rescheduled session that cannot say what it moved from is a claim with
  -- no content behind it.
  constraint program_sessions_rescheduled_has_origin
    check (state <> 'rescheduled' or rescheduled_from is not null)
);

create index program_sessions_program_starts_idx
  on public.program_sessions (program_id, starts_at);

create index program_sessions_starts_idx
  on public.program_sessions (starts_at);

comment on table public.program_sessions is
  'Dated program sessions — the schedule truth shared by the public calendar, '
  'the family dashboard, the educator workspace, and administration '
  '(MPS-REQ-020). Administrator-authored verified detail; never derived from '
  'published schedule text. SAMPLE ONLY while MPS GAP-005 and GAP-010 are '
  'open. No client role holds any write privilege.';

create trigger program_sessions_set_updated_at
  before update on public.program_sessions
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- programs.capacity and programs.waitlist_enabled
-- ---------------------------------------------------------------------------
-- MPS-RUL-002: "capacity behavior is program-specific". This is the capability
-- half of GAP-ADMIN-004. The per-program NUMBERS remain Samantha's under
-- checklist §1 and are still unanswered, so `capacity` is nullable and NULL is
-- the default.
--
-- NULL means "not established" and produces NO numeric claim on any surface —
-- the same discipline every `published_*` column already uses, and the MDS
-- `limited_spaces` rule "exact capacity only when verified". A seats-remaining
-- figure is computed for display only, and only when a number has been set.
alter table public.programs
  add column capacity integer,
  add column waitlist_enabled boolean not null default false;

alter table public.programs
  add constraint programs_capacity_non_negative
    check (capacity is null or capacity >= 0);

comment on column public.programs.capacity is
  'Program-specific capacity (MPS-RUL-002, MPS-FEA-012). NULL means not '
  'established and is never rendered as a number. Setting it creates and '
  'removes no enrollment.';

comment on column public.programs.waitlist_enabled is
  'Whether this program accepts waitlist placements (MPS-ACC-020). A waitlist '
  'place is not enrollment and collects no payment (MPS-RUL-002).';


-- ---------------------------------------------------------------------------
-- session_attendance
-- ---------------------------------------------------------------------------
-- A row means one thing: an authorized person recorded this enrollment as
-- present at this session. There is no status column, because MPS defines no
-- attendance vocabulary (GAP-ADMIN-010) and "absent", "excused", and "tardy"
-- are policy words nobody has approved. The absence of a row is "not recorded",
-- and the application says those words rather than inferring absence.
--
-- Keyed on `enrollment_id` and NOT on `student_id`, deliberately. An educator
-- may record attendance, so an educator must be able to name the row they are
-- writing; naming it by enrollment means the identifier they hold points at a
-- registration, not at a child. `public.students` remains unreachable to them
-- by every route.
create table public.session_attendance (
  session_id uuid not null references public.program_sessions (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  primary key (session_id, enrollment_id)
);

create index session_attendance_enrollment_idx
  on public.session_attendance (enrollment_id);

comment on table public.session_attendance is
  'Minimum-information attendance (MPS-FEA-011). A row means "recorded '
  'present"; no row means "not recorded" and never "absent" (GAP-ADMIN-010). '
  'Carries no student identifier and no status, reason, or note field.';


-- The enrollment must belong to the session's own program and must be
-- confirmed. Without this, a mis-supplied pair would record attendance for a
-- child in a different program, or for a registration that holds no place —
-- the same class of defect `enforce_enrollment_family_matches_student` closes.
create function public.enforce_attendance_matches_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.enrollments e
    join public.program_sessions s on s.id = new.session_id
    where e.id = new.enrollment_id
      and e.program_id = s.program_id
      and e.state = 'confirmed'
  ) then
    raise exception
      'attendance requires a confirmed enrollment in the session''s own program'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_attendance_matches_session() from public;

create trigger session_attendance_matches_session
  before insert or update on public.session_attendance
  for each row execute function public.enforce_attendance_matches_session();


-- ---------------------------------------------------------------------------
-- audit triggers
-- ---------------------------------------------------------------------------
-- MPS-REQ-024 names schedule and capacity explicitly.
create function public.record_program_session_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed jsonb := '{}'::jsonb;
  material text[] := array[
    'title', 'starts_at', 'ends_at', 'location', 'state', 'rescheduled_from'
  ];
  field text;
  old_json jsonb;
  new_json jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'program_session', new.id, 'created',
       jsonb_build_object('program_id', new.program_id,
                          'starts_at', new.starts_at));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'program_session', old.id, 'deleted',
       jsonb_build_object('program_id', old.program_id));
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
    values ((select auth.uid()), 'program_session', new.id, 'updated', changed);
  end if;

  return new;
end;
$$;

revoke all on function public.record_program_session_audit() from public;

create trigger program_sessions_audit
  after insert or update or delete on public.program_sessions
  for each row execute function public.record_program_session_audit();


-- The payload carries ids only. A child's name must not enter the history
-- payload, and an attendance record is exactly the place that mistake would be
-- easy to make.
create function public.record_session_attendance_audit()
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
      ((select auth.uid()), 'session_attendance', new.session_id, 'recorded',
       jsonb_build_object('enrollment_id', new.enrollment_id));
    return new;
  end if;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values
    ((select auth.uid()), 'session_attendance', old.session_id, 'cleared',
     jsonb_build_object('enrollment_id', old.enrollment_id));
  return old;
end;
$$;

revoke all on function public.record_session_attendance_audit() from public;

create trigger session_attendance_audit
  after insert or delete on public.session_attendance
  for each row execute function public.record_session_attendance_audit();


-- `capacity` and `waitlist_enabled` join the material set MPS-REQ-024 names.
-- The function is otherwise unchanged from
-- `20260827212020_foundation_audit_history.sql`.
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
    'capacity', 'waitlist_enabled'
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
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.program_sessions enable row level security;
alter table public.session_attendance enable row level security;

-- A session of a PUBLISHED program is public information. This is what makes
-- the public calendar honest: it plots a session because a session carries a
-- day and a year, which is the condition `src/content/calendar.ts` already
-- required before drawing anything. A draft or archived program's sessions
-- reach nobody but an administrator and an assigned educator.
create policy "program_sessions_select_published_anon"
  on public.program_sessions for select
  to anon
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_sessions.program_id
        and p.publication_state = 'published'
    )
  );

create policy "program_sessions_select_published_authenticated"
  on public.program_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_sessions.program_id
        and p.publication_state = 'published'
    )
  );

-- MPS-REQ-018: an assigned educator sees their assigned programs' schedule,
-- including a program that is not published.
create policy "program_sessions_select_assigned_educator"
  on public.program_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.educator_assignments a
      where a.program_id = program_sessions.program_id
        and a.educator_user_id = (select auth.uid())
    )
  );

-- MPS-REQ-015: a family holding an enrollment sees that program's schedule even
-- if the program has since been unpublished — the schedule they are relying on
-- does not disappear because the catalog entry did.
create policy "program_sessions_select_enrolled_family"
  on public.program_sessions for select
  to authenticated
  using (private.family_has_enrollment_in(program_id));

create policy "program_sessions_select_admin"
  on public.program_sessions for select
  to authenticated
  using (private.is_admin());

-- Attendance: administrators and assigned educators only. There is no family
-- policy, because MPS defines no family attendance visibility (GAP-ADMIN-013),
-- and no `anon` policy at any verb.
create policy "session_attendance_select_assigned_educator"
  on public.session_attendance for select
  to authenticated
  using (
    exists (
      select 1
      from public.program_sessions s
      join public.educator_assignments a on a.program_id = s.program_id
      where s.id = session_attendance.session_id
        and a.educator_user_id = (select auth.uid())
    )
  );

create policy "session_attendance_select_admin"
  on public.session_attendance for select
  to authenticated
  using (private.is_admin());


-- ---------------------------------------------------------------------------
-- Least-privilege grants
-- ---------------------------------------------------------------------------
-- Read verbs only. Every write goes through a SECURITY DEFINER function below,
-- for the reason recorded at length in the ADM-02 migration: an RLS policy can
-- say who may write but cannot say which state change is legal, cannot refuse a
-- write made against a stale row, and cannot tell a repeat submission from a
-- new one.
grant select on public.program_sessions to anon;
grant select on public.program_sessions to authenticated;
grant select on public.session_attendance to authenticated;


-- ---------------------------------------------------------------------------
-- private.session_transition_allowed
-- ---------------------------------------------------------------------------
-- MPS-WFL-005 alternate paths (Rescheduled, Canceled) and MPS-WFL-007 states
-- (changed, canceled, completed).
--
-- `canceled` and `completed` are terminal. Reinstating a session Home School
-- Haven has told families is off, or reopening one it has closed, is a decision
-- MPS does not define and would arrive at families as a second reversal with no
-- approved notice behind it. The approved recovery is to author a new session,
-- which leaves both records and both audit rows in place.
create function private.session_transition_allowed(
  current_state public.session_state,
  next_state public.session_state
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case current_state
    when 'scheduled'   then next_state in ('rescheduled', 'canceled', 'completed')
    when 'rescheduled' then next_state in ('rescheduled', 'canceled', 'completed')
    when 'canceled'    then false
    when 'completed'   then false
    else false
  end;
$$;

revoke all on function private.session_transition_allowed(
  public.session_state, public.session_state) from public;
grant execute on function private.session_transition_allowed(
  public.session_state, public.session_state) to authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_create_program_session
-- ---------------------------------------------------------------------------
-- MPS-WFL-005 step 2, MPS-RUL-005 (only an administrator or the owner).
-- An assigned educator reaches this function and is refused, which is
-- MPS-ACC-027 as an enforced control rather than a hidden button.
create function public.admin_create_program_session(
  target_program uuid,
  session_title text,
  session_starts_at timestamptz,
  session_ends_at timestamptz,
  session_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  trimmed_title text := btrim(coalesce(session_title, ''));
  trimmed_location text := nullif(btrim(coalesce(session_location, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_title = '' or char_length(trimmed_title) > 160 then
    raise exception 'a session title of 1 to 160 characters is required'
      using errcode = '22023';
  end if;

  if session_starts_at is null or session_ends_at is null then
    raise exception 'a session needs both a start and an end'
      using errcode = '22023';
  end if;

  if session_ends_at <= session_starts_at then
    raise exception 'a session must end after it starts' using errcode = '22023';
  end if;

  if trimmed_location is not null and char_length(trimmed_location) > 160 then
    raise exception 'location must be 160 characters or fewer'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.programs p where p.id = target_program) then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  insert into public.program_sessions
    (program_id, title, starts_at, ends_at, location, state)
  values
    (target_program, trimmed_title, session_starts_at, session_ends_at,
     trimmed_location, 'scheduled')
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.admin_create_program_session(
  uuid, text, timestamptz, timestamptz, text) from public;
grant execute on function public.admin_create_program_session(
  uuid, text, timestamptz, timestamptz, text) to authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_update_program_session
-- ---------------------------------------------------------------------------
-- Editing a session and RESCHEDULING one are the same operation seen from two
-- sides, and separating them would let an administrator move a session without
-- the record saying it moved. So: if either time changes, the row becomes
-- `rescheduled`, the previous start is preserved in `rescheduled_from`, and a
-- change note becomes MANDATORY — because a family being told "this changed"
-- and not told anything else is worse than not being told.
--
-- Correcting a title, a location, or a typo changes no time, sets no state, and
-- needs no note.
--
-- A canceled or completed session cannot be edited: both are terminal, and
-- MPS approves no reopening (see `private.session_transition_allowed`).
create function public.admin_update_program_session(
  target_id uuid,
  expected_updated_at timestamptz,
  session_title text,
  session_starts_at timestamptz,
  session_ends_at timestamptz,
  session_location text,
  session_change_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.program_sessions%rowtype;
  trimmed_title text := btrim(coalesce(session_title, ''));
  trimmed_location text := nullif(btrim(coalesce(session_location, '')), '');
  trimmed_note text := nullif(btrim(coalesce(session_change_note, '')), '');
  time_changed boolean;
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_title = '' or char_length(trimmed_title) > 160 then
    raise exception 'a session title of 1 to 160 characters is required'
      using errcode = '22023';
  end if;

  if session_starts_at is null or session_ends_at is null then
    raise exception 'a session needs both a start and an end'
      using errcode = '22023';
  end if;

  if session_ends_at <= session_starts_at then
    raise exception 'a session must end after it starts' using errcode = '22023';
  end if;

  select * into current_row
  from public.program_sessions
  where id = target_id
  for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'session changed since it was loaded' using errcode = '40001';
  end if;

  if current_row.state in ('canceled', 'completed') then
    raise exception 'a % session cannot be edited', current_row.state
      using errcode = '23514';
  end if;

  time_changed :=
    current_row.starts_at is distinct from session_starts_at
    or current_row.ends_at is distinct from session_ends_at;

  if time_changed then
    if trimmed_note is null or char_length(trimmed_note) > 400 then
      raise exception
        'moving a session requires a note of 1 to 400 characters explaining the change'
        using errcode = '22023';
    end if;

    update public.program_sessions
    set title            = trimmed_title,
        starts_at        = session_starts_at,
        ends_at          = session_ends_at,
        location         = trimmed_location,
        state            = 'rescheduled',
        /* The ORIGINAL time, not the previous one. A session moved twice still
           tells a family the time they first planned around. */
        rescheduled_from = coalesce(current_row.rescheduled_from,
                                    current_row.starts_at),
        change_note      = trimmed_note
    where id = target_id;

    return 'rescheduled';
  end if;

  if trimmed_note is not null and char_length(trimmed_note) > 400 then
    raise exception 'the note must be 400 characters or fewer'
      using errcode = '22023';
  end if;

  if current_row.title is not distinct from trimmed_title
     and current_row.location is not distinct from trimmed_location
     and current_row.change_note is not distinct from trimmed_note then
    return 'unchanged';
  end if;

  update public.program_sessions
  set title       = trimmed_title,
      location    = trimmed_location,
      change_note = trimmed_note
  where id = target_id;

  return 'updated';
end;
$$;

revoke all on function public.admin_update_program_session(
  uuid, timestamptz, text, timestamptz, timestamptz, text, text) from public;
grant execute on function public.admin_update_program_session(
  uuid, timestamptz, text, timestamptz, timestamptz, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_set_session_state
-- ---------------------------------------------------------------------------
-- Cancelling or completing a session. A mandatory note applies to both: a
-- cancellation a family reads without a reason is the half of MPS-WFL-005's
-- "communicate material changes" that families actually rely on.
--
-- What this does NOT do, deliberately: it does not touch a single enrollment.
-- Cancelling a session decides no refund, credit, transfer, or enrollment
-- outcome (MPS-RUL-004, MPS GAP-010). The function does not name the
-- `enrollments` table, so it cannot.
create function public.admin_set_session_state(
  target_id uuid,
  next_state public.session_state,
  note text,
  expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.program_sessions%rowtype;
  trimmed_note text := btrim(coalesce(note, ''));
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_note = '' or char_length(trimmed_note) > 400 then
    raise exception 'a note of 1 to 400 characters is required'
      using errcode = '22023';
  end if;

  select * into current_row
  from public.program_sessions
  where id = target_id
  for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'session changed since it was loaded' using errcode = '40001';
  end if;

  if current_row.state = next_state then
    return 'unchanged';
  end if;

  if not private.session_transition_allowed(current_row.state, next_state) then
    raise exception 'transition from % to % is not approved',
      current_row.state, next_state using errcode = '23514';
  end if;

  update public.program_sessions
  set state = next_state,
      change_note = trimmed_note
  where id = target_id;

  return 'updated';
end;
$$;

revoke all on function public.admin_set_session_state(
  uuid, public.session_state, text, timestamptz) from public;
grant execute on function public.admin_set_session_state(
  uuid, public.session_state, text, timestamptz) to authenticated;

comment on function public.admin_set_session_state(
  uuid, public.session_state, text, timestamptz) is
  'Cancel or complete one session (MPS-WFL-005). Touches no enrollment and '
  'decides no refund, credit, or transfer (MPS-RUL-004).';


-- ---------------------------------------------------------------------------
-- public.admin_set_program_capacity
-- ---------------------------------------------------------------------------
-- MPS-RUL-002, MPS-FEA-012. NULL clears the capacity back to "not established".
--
-- CAPACITY NEVER CREATES OR REMOVES AN ENROLLMENT, AND THAT IS STRUCTURAL.
--
-- This function updates `public.programs` and names no other table. It cannot
-- confirm, waitlist, block, or cancel anybody as a side effect of a number
-- changing, because there is no statement here that could.
--
-- Lowering capacity below the confirmed count is PERMITTED and returns
-- 'updated_over_capacity'. It is permitted because an administrator correcting
-- a room size must not be blocked by a number, and nothing is auto-cancelled
-- because choosing which family loses a place is a policy decision MPS does not
-- define (GAP-ADMIN-012). The return value exists so the surface can say the
-- condition out loud instead of leaving it to be discovered.
create function public.admin_set_program_capacity(
  target_id uuid,
  expected_updated_at timestamptz,
  next_capacity integer,
  next_waitlist_enabled boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.programs%rowtype;
  confirmed_count integer;
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if next_capacity is not null and next_capacity < 0 then
    raise exception 'capacity cannot be negative' using errcode = '22023';
  end if;

  if next_capacity is not null and next_capacity > 10000 then
    raise exception 'capacity must be 10000 or fewer' using errcode = '22023';
  end if;

  if next_waitlist_enabled is null then
    raise exception 'a waitlist setting is required' using errcode = '22023';
  end if;

  select * into current_row from public.programs where id = target_id for update;

  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'program changed since it was loaded' using errcode = '40001';
  end if;

  if current_row.capacity is not distinct from next_capacity
     and current_row.waitlist_enabled is not distinct from next_waitlist_enabled then
    return 'unchanged';
  end if;

  update public.programs
  set capacity = next_capacity,
      waitlist_enabled = next_waitlist_enabled
  where id = target_id;

  if next_capacity is null then
    return 'updated';
  end if;

  select count(*) into confirmed_count
  from public.enrollments e
  where e.program_id = target_id and e.state = 'confirmed';

  if confirmed_count > next_capacity then
    return 'updated_over_capacity';
  end if;

  return 'updated';
end;
$$;

revoke all on function public.admin_set_program_capacity(
  uuid, timestamptz, integer, boolean) from public;
grant execute on function public.admin_set_program_capacity(
  uuid, timestamptz, integer, boolean) to authenticated;

comment on function public.admin_set_program_capacity(
  uuid, timestamptz, integer, boolean) is
  'Program-specific capacity and waitlist setting (MPS-RUL-002, MPS-FEA-012). '
  'Creates and removes no enrollment; returns updated_over_capacity rather '
  'than deciding who loses a place (GAP-ADMIN-012).';


-- ---------------------------------------------------------------------------
-- private.may_record_attendance
-- ---------------------------------------------------------------------------
-- MPS-FEA-011 with MTS "assignment-scoped": an administrator, or the educator
-- actually assigned to the session's program. Checked against
-- `public.program_sessions` rather than against a program id the caller
-- supplies, so a caller cannot name one program's session and another's
-- assignment.
create function private.may_record_attendance(target_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1
    from public.program_sessions s
    join public.educator_assignments a on a.program_id = s.program_id
    where s.id = target_session
      and a.educator_user_id = (select auth.uid())
  );
$$;

revoke all on function private.may_record_attendance(uuid)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- public.record_session_attendance / public.clear_session_attendance
-- ---------------------------------------------------------------------------
-- The only write paths to `public.session_attendance`.
--
-- Recording is idempotent by construction: the primary key makes a second
-- identical submission a no-op that returns 'unchanged', so a retry leaves one
-- row and one audit event rather than two of each.
--
-- A canceled session accepts no attendance. Recording someone present at a
-- session that did not happen is a false record, not an edge case.
create function public.record_session_attendance(
  target_session uuid,
  target_enrollment uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.program_sessions%rowtype;
begin
  if not private.may_record_attendance(target_session) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into session_row
  from public.program_sessions where id = target_session;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if session_row.state = 'canceled' then
    raise exception 'attendance cannot be recorded for a canceled session'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.session_attendance
    where session_id = target_session and enrollment_id = target_enrollment
  ) then
    return 'unchanged';
  end if;

  /* The trigger enforces that this enrollment is confirmed and belongs to this
     session's own program. An unmatched pair raises 23514 from there, and the
     caller learns nothing about whether the enrollment exists. */
  insert into public.session_attendance
    (session_id, enrollment_id, recorded_by)
  values (target_session, target_enrollment, (select auth.uid()));

  return 'recorded';
end;
$$;

revoke all on function public.record_session_attendance(uuid, uuid) from public;
grant execute on function public.record_session_attendance(uuid, uuid) to authenticated;

comment on function public.record_session_attendance(uuid, uuid) is
  'Record one enrollment as present at one session (MPS-FEA-011). A row means '
  '"recorded present"; its absence means "not recorded", never "absent" '
  '(GAP-ADMIN-010).';


-- Clearing a record is the correction path for one recorded in error. It
-- restores "not recorded"; it does not assert absence.
create function public.clear_session_attendance(
  target_session uuid,
  target_enrollment uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.may_record_attendance(target_session) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  delete from public.session_attendance
  where session_id = target_session and enrollment_id = target_enrollment;

  if not found then
    return 'unchanged';
  end if;

  return 'cleared';
end;
$$;

revoke all on function public.clear_session_attendance(uuid, uuid) from public;
grant execute on function public.clear_session_attendance(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- educator_session_roster
-- ---------------------------------------------------------------------------
-- The educator's one door to per-session attendance, and the counterpart of
-- `public.educator_roster_students`.
--
-- WHY A SECOND VIEW AND NOT A WIDER FIRST ONE
--
-- Attendance is written per child per session, so an educator needs an
-- identifier to write against. `educator_roster_students` exposes only
-- `preferred_name` and deliberately carries no id, and widening it would push
-- an identifier into every roster read that has no use for one. This view is
-- the narrow addition: it exposes `enrollment_id` — which points at a
-- registration, not at a child — alongside the same single approved name field,
-- scoped to the educator's own assignments and to confirmed enrollments.
--
-- `EDUCATOR_ROSTER_COLUMNS` is untouched. This view carries its own allowlist
-- constant in `src/lib/educator/attendance.ts`, bound to its select literal at
-- compile time the same way.
--
-- `public.students` gains no educator policy here either, so grade level,
-- guardian relationship, and affirmation bookkeeping remain unreachable to an
-- educator by every route.
create view public.educator_session_roster
with (security_barrier = true)
as
select
  ps.id as session_id,
  e.id as enrollment_id,
  s.preferred_name,
  exists (
    select 1 from public.session_attendance sa
    where sa.session_id = ps.id and sa.enrollment_id = e.id
  ) as attended
from public.program_sessions ps
join public.enrollments e
  on e.program_id = ps.program_id
join public.students s
  on s.id = e.student_id
join public.educator_assignments a
  on a.program_id = ps.program_id
where e.state = 'confirmed'
  and a.educator_user_id = (select auth.uid());

revoke all on public.educator_session_roster from public, anon, authenticated;
grant select on public.educator_session_roster to authenticated;

comment on view public.educator_session_roster is
  'Per-session attendance roster for the current educator''s assigned '
  'programs. Exposes session scope, an enrollment id, one approved name field, '
  'and whether attendance is recorded — and no student identifier '
  '(MPS-REQ-018, MPS-ACC-028, MPS-FEA-011).';
