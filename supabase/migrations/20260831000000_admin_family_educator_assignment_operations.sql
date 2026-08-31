-- Foundation Release — authorized administrator educator-assignment operations
-- and the assigned-educator roster boundary
--
-- MPS: MPS-REQ-004 (unassigned educators reach no private student data),
--      MPS-REQ-017 (administrators manage educator assignments and accurate
--      rosters without granting educators organization-level control),
--      MPS-REQ-018 (educator limited to assigned programs and approved roster
--      fields), MPS-REQ-024 (attributable history),
--      MPS-ACC-005, MPS-ACC-028
-- MDS: page_shells.admin_operations (educator navigation), components.table
--      variant `roster`
-- MTS: SECURITY-ARCHITECTURE deny-by-default, least privilege, "enforce family
--      ownership, educator program assignment ... in RLS and server logic"
--
-- WHAT THIS MIGRATION DOES NOT ADD
--
-- No table. No column. No enum. Every concept this slice needs already exists:
-- `public.educator_assignments` holds the relationship and its composite
-- primary key is already the duplicate guard; `public.audit_events` and the
-- `educator_assignments_audit` trigger already record assignment history;
-- `public.enrollments` is already the authoritative roster relationship. A
-- second roster store, an educator profile table, or an assignment `status`
-- column would each be a competing source of truth for something the schema
-- already answers.
--
-- Specifically absent, and why:
--
--   * No educator operational-profile table. Checklist §9 does not define which
--     educator fields exist, so a `title`, `bio`, or `specialty` column would
--     invent published facts (GAP-ADMIN-013).
--   * No educator `active`/`suspended` column. Checklist §9 leaves "how access
--     changes when an educator is reassigned or leaves" unanswered. Removing an
--     assignment is the approved lever, and it takes effect on the next
--     authorized request (see the policy at the foot of this file).
--   * No note column on `educator_assignments`. The functions below require a
--     note so an administrator states a reason before acting, but MPS-REQ-024
--     requires actor, operation, record, prior and new state, and time — not a
--     rationale. Persisting one for a rule no approved requirement states would
--     be a speculative field (deviation D-FE2).
--   * No roster export, and no path that could become one.
--   * No write of any kind against `families`, `family_members`, or
--     `students`. Parents control those records (ACT-001) and checklist §11
--     leaves administrator correction and deletion unanswered
--     (GAP-ADMIN-009/010/011).
--
-- WHY THE WRITES ARE FUNCTIONS AND THE TABLE GRANT IS REVOKED
--
-- `20260827212023_foundation_rls_policies.sql` gave `authenticated` INSERT and
-- DELETE on `public.educator_assignments` behind admin-only policies. A policy
-- can say *who* may write. It cannot check that the target actually holds the
-- `educator` grant, cannot refuse an assignment to an archived program, cannot
-- require a stated reason, and cannot tell a repeat submission from a new one.
-- All four are requirements here, so the write path becomes a SECURITY DEFINER
-- function and the table loses the two verbs it held — the same §11 option-A
-- shape `public.programs` took in 20260830090000.
--
-- The two admin write POLICIES are deliberately left in place. A policy without
-- a privilege grants nothing, so they are inert today; keeping them documents
-- the intended reach and keeps the table safe if a future migration ever
-- re-grants a verb.
--
-- rollback:
--   drop policy if exists "students_select_assigned_educator" on public.students;
--   revoke all on function public.admin_unassign_educator(uuid, uuid, text) from authenticated;
--   revoke all on function public.admin_assign_educator(uuid, uuid, text) from authenticated;
--   drop function if exists public.admin_unassign_educator(uuid, uuid, text);
--   drop function if exists public.admin_assign_educator(uuid, uuid, text);
--   drop function if exists private.educator_has_role(uuid);
--   grant insert, delete on public.educator_assignments to authenticated;


-- ---------------------------------------------------------------------------
-- private.educator_has_role
-- ---------------------------------------------------------------------------
-- Whether a target account holds the `educator` grant.
--
-- SECURITY DEFINER for one narrow reason: the caller is an administrator whose
-- own `user_roles_select_admin` policy would already return this row, but the
-- assignment functions must reach the answer without depending on which policy
-- happened to apply to the caller. It answers one boolean about one supplied
-- id and exposes no list.
create function private.educator_has_role(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    where r.user_id = target_user
      and r.role = 'educator'
  );
$$;

revoke all on function private.educator_has_role(uuid) from public;
grant execute on function private.educator_has_role(uuid) to authenticated;

comment on function private.educator_has_role(uuid) is
  'Whether an account holds the educator grant. Used by the assignment '
  'functions so eligibility is decided from the authoritative role table '
  'rather than from client input (MPS-REQ-017).';


-- ---------------------------------------------------------------------------
-- public.admin_assign_educator
-- ---------------------------------------------------------------------------
-- MPS-REQ-017: "let authorized administrators manage educator assignments".
-- MPS-WFL-005 main_path: "add verified details, schedule, capacity, educator".
--
-- IDEMPOTENT BY CONTRACT. A second submission of the same pair writes nothing,
-- fires no audit trigger, and returns 'unchanged'. That is what makes a
-- double-click, a double-tap, or two open tabs safe, and it is why a repeat is
-- not an error: the administrator's intent is already true.
--
-- ASSIGNMENT CARRIES NO CONCURRENCY TOKEN, DELIBERATELY (deviation D-FE1).
-- Assignment is set membership. There is no prior material state for a second
-- administrator to flatten, and both orderings of two concurrent submissions
-- reach the same membership. The `for update` lock below serialises them so the
-- second reads the first one's result and reports 'unchanged' truthfully,
-- rather than raising a staleness error about a conflict that does not exist.
create function public.admin_assign_educator(
  educator_id uuid,
  target_program_id uuid,
  note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  program_row public.programs%rowtype;
  trimmed_note text := btrim(coalesce(note, ''));
  inserted int;
begin
  -- Authorization first, before any id is looked at. A caller who is not an
  -- administrator learns nothing about whether either record exists.
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_note = '' or char_length(trimmed_note) > 400 then
    raise exception 'a note of 1 to 400 characters is required'
      using errcode = '22023';
  end if;

  -- FOR UPDATE, so two administrators acting on the same program at the same
  -- moment serialise here instead of racing.
  select * into program_row
  from public.programs
  where id = target_program_id
  for update;

  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  -- An archived program is not operated. Assigning an educator to one would
  -- create an access grant to a program nobody is running.
  if program_row.publication_state = 'archived' then
    raise exception 'an archived program cannot be assigned an educator'
      using errcode = '23514';
  end if;

  -- Eligibility comes from the authoritative role table, never from the
  -- request. A client that submits an administrator's or a parent's id is
  -- refused here even though the caller is authorized to assign somebody.
  if not private.educator_has_role(educator_id) then
    raise exception 'that account does not hold the educator role'
      using errcode = '23514';
  end if;

  insert into public.educator_assignments
    (educator_user_id, program_id, assigned_by)
  values
    (educator_id, target_program_id, (select auth.uid()))
  on conflict (educator_user_id, program_id) do nothing;

  get diagnostics inserted = row_count;

  if inserted = 0 then
    return 'unchanged';
  end if;

  return 'assigned';
end;
$$;

revoke all on function public.admin_assign_educator(uuid, uuid, text) from public;
grant execute on function public.admin_assign_educator(uuid, uuid, text)
  to authenticated;

comment on function public.admin_assign_educator(uuid, uuid, text) is
  'Authorized administrative educator assignment (MPS-REQ-017). Idempotent: a '
  'repeat returns unchanged and writes no second audit row. Grants the '
  'educator assigned-program scope and nothing organization-wide.';


-- ---------------------------------------------------------------------------
-- public.admin_unassign_educator
-- ---------------------------------------------------------------------------
-- MPS-WFL-006 alternate path "Educator reassigned" and recovery "let an
-- administrator correct assignment or content state".
--
-- Reassignment is this plus an assign, not a third verb. `educator_assignments`
-- has a composite primary key rather than a unique program, so a program may
-- carry several educators; an atomic "reassign" would have to guess which
-- existing assignment it replaced. Two attributable events say what actually
-- happened.
--
-- A missing row and a missing pair are reported identically ('unchanged'), so a
-- manipulated identifier learns nothing about what exists.
create function public.admin_unassign_educator(
  educator_id uuid,
  target_program_id uuid,
  note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  trimmed_note text := btrim(coalesce(note, ''));
  removed int;
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_note = '' or char_length(trimmed_note) > 400 then
    raise exception 'a note of 1 to 400 characters is required'
      using errcode = '22023';
  end if;

  delete from public.educator_assignments
  where educator_user_id = educator_id
    and program_id = target_program_id;

  get diagnostics removed = row_count;

  if removed = 0 then
    return 'unchanged';
  end if;

  return 'unassigned';
end;
$$;

revoke all on function public.admin_unassign_educator(uuid, uuid, text) from public;
grant execute on function public.admin_unassign_educator(uuid, uuid, text)
  to authenticated;

comment on function public.admin_unassign_educator(uuid, uuid, text) is
  'Authorized administrative educator unassignment (MPS-REQ-017, MPS-WFL-006). '
  'Revokes assigned-program scope on the next authorized request; no sign-out '
  'is required. Idempotent: removing an absent assignment returns unchanged.';


-- ---------------------------------------------------------------------------
-- Remove the direct write path
-- ---------------------------------------------------------------------------
-- See the header. After this, no Data API client role can insert or delete an
-- assignment by any route, so the eligibility, archival, and note rules above
-- cannot be walked around by an authenticated caller composing their own
-- PostgREST request. This removes privilege and grants none.
revoke insert, delete on public.educator_assignments from authenticated;


-- ---------------------------------------------------------------------------
-- students_select_assigned_educator
-- ---------------------------------------------------------------------------
-- MPS-ACC-028: "given a confirmed enrollment, when the roster is viewed, then
-- the student appears exactly once in the correct program and only approved
-- fields are visible to the assigned educator."
--
-- Until this policy, an assigned educator could read the enrollment row through
-- `enrollments_select_assigned_educator` but not the student it names, so a
-- roster was not reachable at all and MPS-ACC-028 could not be satisfied. This
-- is the boundary the later Educator Assigned-Program Workspace depends on. It
-- is built and tested here; no educator UI is built here.
--
-- THREE NARROWINGS, EACH LOAD-BEARING
--
--   1. `e.state = 'confirmed'`. An educator sees the children who have a place.
--      A pending, payment-pending, waitlisted, failed, cancelled, or blocked
--      child is NOT disclosed: that family's arrangement with Home School Haven
--      is unsettled and is not an educator's business (MPS-RUL-003).
--   2. The join to `educator_assignments` is on `(select auth.uid())`, so
--      removing the assignment removes the read on the very next request. No
--      session, cookie, or JWT claim caches it and no sign-out is needed.
--   3. It is additive. `students_select_own_family` and `students_select_admin`
--      are untouched — no family policy is weakened to make this query easier.
--
-- WHICH FIELDS THIS ACTUALLY EXPOSES
--
-- RLS grants rows, not columns, so this policy technically exposes every
-- column of a matched row: `preferred_name`, `grade_level`,
-- `guardian_relationship`, and the sample/affirmation bookkeeping. Checklist §9
-- does not confirm which student fields an educator may see (GAP-ADMIN-014), so
-- the server-side roster read selects `preferred_name` alone and the educator
-- surface that will consume it must do the same. That column restriction lives
-- in `src/lib/admin/roster.ts`; this comment records that the policy is the
-- coarser of the two controls and that the narrower one is not optional.
create policy "students_select_assigned_educator"
  on public.students for select
  to authenticated
  using (
    exists (
      select 1
      from public.enrollments e
      join public.educator_assignments a
        on a.program_id = e.program_id
      where e.student_id = students.id
        and e.state = 'confirmed'
        and a.educator_user_id = (select auth.uid())
    )
  );
