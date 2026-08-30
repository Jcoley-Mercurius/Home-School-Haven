-- Foundation Release — enrollment, announcement, and learning-resource records
--
-- MPS: MPS-REQ-015 (family dashboard), MPS-REQ-014 (one authoritative
--      enrollment state, no duplicates), MPS-REQ-004/005/018/019/020/024,
--      MPS-RUL-004/006/007, MPS-ACC-022/024/025/028/030/031, MPS-WFL-007
-- MTS: IMPLEMENTATION-PLAN Phase 3; TECHNOLOGY-BLUEPRINT names Supabase the
--      Foundation Release system of record for enrollment, announcements, and
--      learning resources; SECURITY-ARCHITECTURE deny-by-default and least
--      privilege
-- MDS: components.enrollment_state, components.announcement,
--      components.learning_resource; MDS-REF-007
--
-- WHY THESE TABLES EXIST NOW
--
-- The family foundation deferred the dashboard because these records did not
-- exist, and rendering the shell over nothing would have been the simulated
-- data DO-DONT forbids. This migration creates them. GAP-010 blocks automated
-- financial *decisions* — scholarships, refunds, cancellations, credits — not
-- the existence of an enrollment record whose state an authorized human set.
-- Nothing here decides anything; it stores a state and the audit of who
-- changed it.
--
-- WHOSE STATE VOCABULARY THIS IS
--
-- Two approved vocabularies exist and they are not the same list. MPS-WFL-003
-- owns the *state*; MDS `components.enrollment_state` owns its *presentation*.
-- Resolved by subject authority rather than by picking one: the enum below is
-- the MPS-WFL-003 list verbatim, and the mapping to the MDS variant, label, and
-- sentence lives in `src/components/family/enrollment-state.tsx`. A state the
-- database can store but the UI cannot name would be a defect in that file, not
-- a licence to rename a state here.
--
-- SAMPLE-ONLY, AS A CONSTRAINT
--
-- Every table below carries `check (is_sample)`, exactly as `students` does.
-- While GAP-005 and GAP-010 are open, a non-sample enrollment, announcement, or
-- resource cannot be stored at all. MPS-RUL-007 as an enforceable boundary
-- rather than as a promise in a comment.
--
-- NO CLIENT WRITE PATH, ANYWHERE
--
-- None of these tables has an INSERT, UPDATE, or DELETE policy for any client
-- role, and `anon` holds nothing on any of them at any verb. Self-service
-- enrollment is MPS-REQ-012/013 (the conversion journey) and educator or
-- administrator authoring is MPS-REQ-019 (Phase 4). Shipping a write path now
-- would ship an access path nothing tests and nothing needs. Rows arrive from
-- the sanitized seed.
--
-- rollback:
--   drop policy if exists "learning_resources_select_admin" on public.learning_resources;
--   drop policy if exists "learning_resources_select_enrolled_family" on public.learning_resources;
--   drop policy if exists "learning_resources_select_assigned_educator" on public.learning_resources;
--   drop policy if exists "announcements_select_admin" on public.announcements;
--   drop policy if exists "announcements_select_enrolled_family" on public.announcements;
--   drop policy if exists "announcements_select_assigned_educator" on public.announcements;
--   drop policy if exists "enrollments_select_admin" on public.enrollments;
--   drop policy if exists "enrollments_select_assigned_educator" on public.enrollments;
--   drop policy if exists "enrollments_select_own_family" on public.enrollments;
--   drop trigger if exists enrollments_audit on public.enrollments;
--   drop function if exists public.record_enrollment_audit();
--   drop function if exists private.family_has_enrollment_in(uuid);
--   drop table if exists public.learning_resources;
--   drop table if exists public.announcements;
--   drop table if exists public.enrollments;
--   drop type if exists public.enrollment_state;


-- ---------------------------------------------------------------------------
-- enrollment_state
-- ---------------------------------------------------------------------------
-- MPS-WFL-003 `states`, verbatim and in order.
create type public.enrollment_state as enum (
  'started',
  'approval_pending',
  'payment_pending',
  'waitlisted',
  'confirmed',
  'payment_failed',
  'canceled',
  'blocked'
);

comment on type public.enrollment_state is
  'MPS-WFL-003 enrollment states. Only `confirmed` means enrollment is '
  'confirmed. `payment_pending` is payment activity awaiting verification and '
  'is never confirmed enrollment (MPS-REQ-013, DO-DONT trust states).';


-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  -- Denormalised from `students`, deliberately. RLS on this table must decide
  -- family membership without joining a table whose own RLS would then have to
  -- permit the join. The check constraint below keeps the two in step.
  family_id uuid not null references public.families (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete restrict,

  state public.enrollment_state not null default 'started',
  state_changed_at timestamptz not null default now(),

  -- Free-text note from the authorized administrator who last set the state.
  -- Never a policy decision, never a financial outcome (MPS-RUL-004).
  state_note text,

  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint enrollments_sample_only check (is_sample),
  constraint enrollments_state_note_length
    check (state_note is null or char_length(state_note) between 1 and 400)
);

-- MPS-REQ-014: "prevent duplicate enrollment ... during retries". A retry that
-- reaches the database twice finds this index, not a second row.
create unique index enrollments_one_per_student_program
  on public.enrollments (student_id, program_id);

create index enrollments_family_id_idx on public.enrollments (family_id);
create index enrollments_program_id_idx on public.enrollments (program_id);

comment on table public.enrollments is
  'Authoritative enrollment state across family, roster, and administrative '
  'views (MPS-REQ-014, MPS-REQ-020). SAMPLE ONLY while MPS GAP-005 and GAP-010 '
  'are open: the is_sample check makes that enforceable. No client role holds '
  'any write privilege; rows arrive from the sanitized seed.';


-- A student's enrollment must belong to that student's own family. Without
-- this, a mis-set `family_id` would hand one family a read of another family's
-- enrollment through the very policy meant to prevent it.
create function public.enforce_enrollment_family_matches_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.students s
    where s.id = new.student_id and s.family_id = new.family_id
  ) then
    raise exception
      'enrollment family_id does not match the student''s family'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger enrollments_family_matches_student
  before insert or update of family_id, student_id on public.enrollments
  for each row execute function public.enforce_enrollment_family_matches_student();


-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  -- Program-scoped only. A family-addressed announcement is a communications
  -- feature (MPS-FEA-009, Phase 4); adding the column now would ship an
  -- access path nothing reaches and no test covers.
  program_id uuid not null references public.programs (id) on delete cascade,
  title text not null,
  body text not null,
  published boolean not null default false,
  published_at timestamptz,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint announcements_sample_only check (is_sample),
  constraint announcements_title_length
    check (char_length(title) between 1 and 160),
  constraint announcements_body_length
    check (char_length(body) between 1 and 4000),
  -- A published row without a publication time cannot be ordered honestly.
  constraint announcements_published_has_time
    check (not published or published_at is not null)
);

create index announcements_program_published_idx
  on public.announcements (program_id, published, published_at desc);

comment on table public.announcements is
  'Program announcements visible to enrolled families (MPS-REQ-019, '
  'MPS-ACC-030). SAMPLE ONLY. No client write path in this release.';


-- ---------------------------------------------------------------------------
-- learning_resources
-- ---------------------------------------------------------------------------
create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  title text not null,
  description text,
  -- A published link, not a stored file. Private Supabase Storage with scoped
  -- signed access is approved (MTS) but is a slice of its own: upload
  -- authorization, type and size validation, and signed URLs. No file leaves
  -- Storage here because none enters it.
  url text not null,
  published boolean not null default false,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint learning_resources_sample_only check (is_sample),
  constraint learning_resources_title_length
    check (char_length(title) between 1 and 160),
  constraint learning_resources_description_length
    check (description is null or char_length(description) between 1 and 600),
  -- Rendered as an external link. Anything but http(s) — `javascript:`,
  -- `data:` — must not be storable, so the renderer never has to defend
  -- against a scheme the database allowed.
  constraint learning_resources_url_scheme
    check (url ~ '^https?://')
);

create index learning_resources_program_published_idx
  on public.learning_resources (program_id, published);

comment on table public.learning_resources is
  'Published learning resources visible to enrolled families (MPS-REQ-019). '
  'SAMPLE ONLY. Links, not stored files. No client write path in this release.';


-- ---------------------------------------------------------------------------
-- private.family_has_enrollment_in
-- ---------------------------------------------------------------------------
-- The scoping rule for announcements and resources, in the database rather than
-- in a query the application could forget to write — the same reasoning that
-- keeps `getFamilyState()` free of `.eq()` filters.
--
-- A canceled enrollment stops granting access to new content. The family keeps
-- the enrollment record and its history; it stops receiving the program's
-- ongoing announcements, which is what "canceled" means.
create function private.family_has_enrollment_in(check_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.family_members m on m.family_id = e.family_id
    where e.program_id = check_program_id
      and e.state <> 'canceled'
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.family_has_enrollment_in(uuid) from public;
grant execute on function private.family_has_enrollment_in(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Attributable history (MPS-REQ-024)
-- ---------------------------------------------------------------------------
-- Enrollment state is one of the material changes MPS-REQ-024 names. The row
-- records the transition, not the family: no student name, no family name, no
-- email. `changed_fields` holds enum labels, which are not private data.
create function public.record_enrollment_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'enrollment', new.id, 'created',
            jsonb_build_object('state', new.state, 'is_sample', new.is_sample));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.state is distinct from old.state then
      insert into public.audit_events
        (actor_user_id, entity_type, entity_id, action, changed_fields)
      values ((select auth.uid()), 'enrollment', new.id, 'state_changed',
              jsonb_build_object('from', old.state, 'to', new.state));
    end if;
    return new;
  end if;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values ((select auth.uid()), 'enrollment', old.id, 'deleted',
          jsonb_build_object('state', old.state));
  return old;
end;
$$;

revoke all on function public.record_enrollment_audit() from public;

create trigger enrollments_audit
  after insert or update or delete on public.enrollments
  for each row execute function public.record_enrollment_audit();


-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- `20260828010906_foundation_least_privilege_grants.sql` revokes ALL on every
-- table in `public` and re-grants a hardcoded list. It runs BEFORE this file,
-- so these grants cannot live there — `students` learned that the expensive way
-- (DEFECT-FF1). They live here, after the DDL, and `00_setup.test.sql` asserts
-- them so a silent revocation fails a test instead of reaching a parent.
revoke all on public.enrollments from anon, authenticated;
revoke all on public.announcements from anon, authenticated;
revoke all on public.learning_resources from anon, authenticated;

grant select on public.enrollments to authenticated;
grant select on public.announcements to authenticated;
grant select on public.learning_resources to authenticated;


-- ---------------------------------------------------------------------------
-- RLS — deny by default
-- ---------------------------------------------------------------------------
alter table public.enrollments enable row level security;
alter table public.announcements enable row level security;
alter table public.learning_resources enable row level security;

-- Enrollments: the family's own, and nothing else.
create policy "enrollments_select_own_family"
  on public.enrollments for select
  to authenticated
  using (private.is_family_member(family_id));

-- MPS-REQ-018 and MPS-ACC-028: an assigned educator sees the roster for the
-- program they are assigned to, and no other program's.
create policy "enrollments_select_assigned_educator"
  on public.enrollments for select
  to authenticated
  using (
    exists (
      select 1 from public.educator_assignments a
      where a.program_id = enrollments.program_id
        and a.educator_user_id = (select auth.uid())
    )
  );

create policy "enrollments_select_admin"
  on public.enrollments for select
  to authenticated
  using (private.is_admin());

-- Announcements and resources: published, and only for a program the viewer's
-- family actually holds an enrollment in.
create policy "announcements_select_enrolled_family"
  on public.announcements for select
  to authenticated
  using (published and private.family_has_enrollment_in(program_id));

create policy "announcements_select_assigned_educator"
  on public.announcements for select
  to authenticated
  using (
    exists (
      select 1 from public.educator_assignments a
      where a.program_id = announcements.program_id
        and a.educator_user_id = (select auth.uid())
    )
  );

create policy "announcements_select_admin"
  on public.announcements for select
  to authenticated
  using (private.is_admin());

create policy "learning_resources_select_enrolled_family"
  on public.learning_resources for select
  to authenticated
  using (published and private.family_has_enrollment_in(program_id));

create policy "learning_resources_select_assigned_educator"
  on public.learning_resources for select
  to authenticated
  using (
    exists (
      select 1 from public.educator_assignments a
      where a.program_id = learning_resources.program_id
        and a.educator_user_id = (select auth.uid())
    )
  );

create policy "learning_resources_select_admin"
  on public.learning_resources for select
  to authenticated
  using (private.is_admin());

-- No INSERT, UPDATE, or DELETE policy for any client role on any of the three
-- tables, and nothing at all for `anon`. See the header.
