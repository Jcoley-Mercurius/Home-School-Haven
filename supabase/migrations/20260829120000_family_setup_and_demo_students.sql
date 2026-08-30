-- Foundation Release — parent-controlled family setup and demo student profiles
--
-- MPS: MPS-REQ-011 (one family account, resumable setup), MPS-REQ-001/003/004,
--      MPS-RUL-005/006/007/008/010, MPS-ACC-015/016/017, MPS-WFL-002
-- MTS: SECURITY-ARCHITECTURE "Deny by default and apply least privilege";
--      IMPLEMENTATION-PLAN Phase 3
--
-- WHY A FUNCTION AND NOT AN RLS INSERT POLICY
--
-- Family creation needs two rows — a family and its membership — and they must
-- appear together or not at all. An RLS INSERT policy on `family_members` that
-- allowed a caller to insert their own `user_id` would also let them insert
-- themselves into ANY family id they could guess, which is precisely the
-- cross-family boundary this release exists to hold. So `families` and
-- `family_members` keep NO client write policy, and every write arrives through
-- the SECURITY DEFINER functions below, each of which derives the caller from
-- `auth.uid()` rather than from an argument.
--
-- DEMO STUDENT PROFILES (deviation D-FF1)
--
-- `public.students` exists under an explicit owner decision of 2026-08-29 while
-- MPS GAP-005 is still open. Samantha has not confirmed the approved minimum
-- fields (checklist §7) or the consent and guardian-authority language
-- (checklist §6). Two constraints keep that honest rather than implied:
--
--   * `check (is_sample)` — while the policy is unconfirmed, a non-sample
--     student row cannot be stored at all. MPS-RUL-007 as a constraint.
--   * `check (affirmation_version = 'demo-unapproved-v0')` — no row can record
--     that Samantha-approved language was accepted, because no approved version
--     string is storable. MPS-REQ-003 records version and time; MPS-RUL-010
--     forbids inventing the language, so the version says what it is.
--
-- Deliberately absent, per MPS-RUL-006: legal name, date of birth or age,
-- allergies, medical needs, accommodations, emergency contacts, authorized
-- pickup, and photographs.
--
-- rollback:
--   drop trigger if exists students_audit on public.students;
--   drop function if exists public.record_student_audit();
--   drop function if exists public.remove_student_from_own_family(uuid);
--   drop function if exists public.add_student_to_own_family(text, text, text);
--   drop function if exists public.create_family_for_current_user(text);
--   drop table if exists public.students;
--   drop index if exists public.family_members_one_family_per_user;


-- ---------------------------------------------------------------------------
-- One family per adult
-- ---------------------------------------------------------------------------
-- MPS-REQ-011 says "one family account" and MPS-ACC-016 requires that a repeat
-- attempt does not produce a second one. This index is what makes that true
-- under concurrency: the functions below check first for a friendly answer, but
-- correctness does not depend on that check winning the race.
create unique index family_members_one_family_per_user
  on public.family_members (user_id);


-- ---------------------------------------------------------------------------
-- students (demo — see the header)
-- ---------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- The name the family uses day to day. Not a legal name: a legal name is a
  -- stronger identifier of a minor and is not needed to demonstrate anything.
  preferred_name text not null,
  grade_level text,
  -- Recorded for the roster, and only that. It grants no permission anywhere:
  -- authority comes from family membership, never from this string.
  guardian_relationship text,
  is_sample boolean not null default true,
  affirmation_version text not null default 'demo-unapproved-v0',
  affirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_sample_only check (is_sample),
  constraint students_affirmation_unapproved
    check (affirmation_version = 'demo-unapproved-v0'),
  constraint students_preferred_name_length
    check (char_length(preferred_name) between 1 and 80),
  constraint students_grade_level_length
    check (grade_level is null or char_length(grade_level) between 1 and 40),
  constraint students_guardian_relationship_length
    check (guardian_relationship is null
           or char_length(guardian_relationship) between 1 and 40)
);

create index students_family_id_idx on public.students (family_id);

-- Duplicate-submission protection (MPS-REQ-014's "retries do not duplicate",
-- applied to profiles rather than enrollments). Two children in one family do
-- not share a preferred name; a double-submitted form does.
create unique index students_unique_name_per_family
  on public.students (family_id, lower(preferred_name));

comment on table public.students is
  'DEMO ONLY. Sample student profiles for the sanitized Foundation Review, '
  'built under the owner decision of 2026-08-29 while MPS GAP-005 leaves the '
  'approved minimum fields and consent language unconfirmed. The is_sample and '
  'affirmation_version checks make that boundary enforceable rather than '
  'documentary. See prompts/family-foundation-vertical-slice.md §3 (D-FF1).';


-- ---------------------------------------------------------------------------
-- create_family_for_current_user
-- ---------------------------------------------------------------------------
-- Idempotent by contract: calling it twice returns the same family id and
-- creates nothing the second time. That is what makes a refresh, a retry, or a
-- double-clicked button safe (MPS-ACC-016).
create function public.create_family_for_current_user(family_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  existing uuid;
  created uuid;
  clean text := nullif(btrim(coalesce(family_name, '')), '');
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- The role gate is repeated here on purpose. The page guard already refuses a
  -- non-parent, but a guard is a courtesy to the viewer and this is the control:
  -- the function is reachable through the Data API without ever loading a page.
  -- Granting a role is a privileged operation and is never a side effect of
  -- calling this (see the identity migration).
  if not private.has_role('parent') and not private.is_admin() then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  select fm.family_id into existing
  from public.family_members fm
  where fm.user_id = caller
  limit 1;

  if existing is not null then
    return existing;
  end if;

  if clean is null or char_length(clean) > 80 then
    raise exception 'invalid family name' using errcode = '22023';
  end if;

  -- Both inserts, or neither. If a concurrent call won the race, the unique
  -- index on family_members.user_id raises here, this block rolls back the
  -- family row with it, and we return the family that call created.
  begin
    insert into public.families (name) values (clean) returning id into created;
    insert into public.family_members (family_id, user_id, member_role)
    values (created, caller, 'primary_guardian');
  exception
    when unique_violation then
      select fm.family_id into existing
      from public.family_members fm
      where fm.user_id = caller
      limit 1;
      return existing;
  end;

  -- Attributable history (MPS-REQ-024). The family NAME is deliberately not
  -- copied into the payload: history should say what happened and who did it,
  -- not duplicate family data into a second admin-readable table.
  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values (caller, 'family', created, 'created', '{}'::jsonb);

  return created;
end;
$$;


-- ---------------------------------------------------------------------------
-- add_student_to_own_family
-- ---------------------------------------------------------------------------
-- The family is derived from the caller's membership. It is NOT an argument:
-- accepting a family_id here would reintroduce the cross-family write the whole
-- design avoids.
create function public.add_student_to_own_family(
  preferred_name text,
  grade_level text default null,
  guardian_relationship text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_family uuid;
  created uuid;
  clean_name text := nullif(btrim(coalesce(preferred_name, '')), '');
  clean_grade text := nullif(btrim(coalesce(grade_level, '')), '');
  clean_rel text := nullif(btrim(coalesce(guardian_relationship, '')), '');
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select fm.family_id into target_family
  from public.family_members fm
  where fm.user_id = caller
  limit 1;

  if target_family is null then
    raise exception 'no family' using errcode = '42501';
  end if;

  if clean_name is null or char_length(clean_name) > 80 then
    raise exception 'invalid student name' using errcode = '22023';
  end if;

  -- Idempotent on a repeat submission of the same child, for the same reason
  -- family creation is: a refresh must not produce a second record.
  select s.id into created
  from public.students s
  where s.family_id = target_family
    and lower(s.preferred_name) = lower(clean_name)
  limit 1;

  if created is not null then
    return created;
  end if;

  begin
    insert into public.students
      (family_id, preferred_name, grade_level, guardian_relationship)
    values (target_family, clean_name, clean_grade, clean_rel)
    returning id into created;
  exception
    when unique_violation then
      select s.id into created
      from public.students s
      where s.family_id = target_family
        and lower(s.preferred_name) = lower(clean_name)
      limit 1;
  end;

  return created;
end;
$$;


-- ---------------------------------------------------------------------------
-- remove_student_from_own_family
-- ---------------------------------------------------------------------------
-- A recovery path for a mistyped demo record, not a data-deletion policy.
-- Retention, correction, and deletion policy is checklist §11 and unresolved;
-- this only removes a row the caller's own family created in this review.
create function public.remove_student_from_own_family(student_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  removed int;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.students s
  where s.id = student_id
    and exists (
      select 1 from public.family_members fm
      where fm.user_id = caller and fm.family_id = s.family_id
    );

  get diagnostics removed = row_count;
  -- Idempotent: removing something already gone is not an error, and the
  -- answer is the same whether the row belonged to another family or never
  -- existed. Distinguishing them would confirm another family's record exists.
  return removed > 0;
end;
$$;


-- ---------------------------------------------------------------------------
-- Student audit trigger
-- ---------------------------------------------------------------------------
-- Records that a profile was added or removed, and by whom. It records NO child
-- data: not the name, not the grade, not the relationship. Audit history is
-- admin-readable, and copying child data into it would widen the audience for
-- that data rather than narrow it (AGENTS.md §11).
create function public.record_student_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'student', new.id, 'created',
            jsonb_build_object('is_sample', new.is_sample,
                               'affirmation_version', new.affirmation_version));
    return new;
  end if;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values ((select auth.uid()), 'student', old.id, 'deleted', '{}'::jsonb);
  return old;
end;
$$;

create trigger students_audit
  after insert or delete on public.students
  for each row execute function public.record_student_audit();


-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- `students` follows the same rule as `families`: readable by its own family
-- through RLS, never writable through the Data API. Every write goes through
-- the functions above.
revoke all on public.students from anon, authenticated;
grant select on public.students to authenticated;

revoke all on function public.record_student_audit() from public;

revoke all on function public.create_family_for_current_user(text) from public;
revoke all on function public.add_student_to_own_family(text, text, text) from public;
revoke all on function public.remove_student_from_own_family(uuid) from public;

grant execute on function public.create_family_for_current_user(text) to authenticated;
grant execute on function public.add_student_to_own_family(text, text, text) to authenticated;
grant execute on function public.remove_student_from_own_family(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.students enable row level security;

create policy "students_select_own_family"
  on public.students for select
  to authenticated
  using (private.is_family_member(family_id));

create policy "students_select_admin"
  on public.students for select
  to authenticated
  using (private.is_admin());

-- No INSERT, UPDATE, or DELETE policy for any client role, and none for `anon`
-- at any verb. An educator reaches nothing here: MPS-REQ-018 limits educators to
-- approved roster fields for assigned programs, and enrollment does not exist in
-- this release, so there is no assignment that could authorize a student row.
