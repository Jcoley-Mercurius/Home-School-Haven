-- Foundation Release — deny-by-default Row Level Security
--
-- MPS: MPS-REQ-004, MPS-REQ-018, MPS-RUL-005
-- MTS: SECURITY-ARCHITECTURE "Deny by default and apply least privilege";
--      TECHNOLOGY-BLUEPRINT "Server actions/routes and RLS independently
--      enforce family ownership, educator assignment, and privileged admin
--      operations."
--
-- Conventions applied to every policy below:
--   * RLS is enabled on every table in `public`.
--   * Every policy names its target role with `TO`. `auth.role()` is never used.
--   * `TO authenticated` never stands alone — it is always paired with an
--     ownership or role predicate, otherwise any signed-in user reads any row.
--   * Every UPDATE policy carries both USING and WITH CHECK, so a row cannot be
--     reassigned to another owner.
--   * `auth.uid()` is wrapped as `(select auth.uid())` so it is evaluated once.
--   * Table privileges are granted explicitly: config.toml does not auto-expose
--     new tables to the Data API roles.
--
-- An absent policy is a denial. `user_roles` and `audit_events` deliberately
-- have NO write policy for any client role.
--
-- rollback: `alter table <t> disable row level security;` plus
--   `drop policy` for each policy named below, and revoke the grants.

alter table public.profiles              enable row level security;
alter table public.user_roles            enable row level security;
alter table public.families              enable row level security;
alter table public.family_members        enable row level security;
alter table public.programs              enable row level security;
alter table public.educator_assignments  enable row level security;
alter table public.audit_events          enable row level security;


-- ---------------------------------------------------------------------------
-- Data API exposure (privileges). RLS then decides which rows.
-- ---------------------------------------------------------------------------
grant select on public.programs to anon, authenticated;
grant insert, update, delete on public.programs to authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.families to authenticated;
grant select on public.family_members to authenticated;
grant select on public.educator_assignments to authenticated;
grant insert, delete on public.educator_assignments to authenticated;
grant select on public.audit_events to authenticated;


-- ---------------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------------
-- Public discovery: published rows only. Drafts and archived programs are
-- invisible to visitors (MPS-REQ-008 covers *published* program information).
create policy "programs_select_published_anon"
  on public.programs for select
  to anon
  using (publication_state = 'published');

create policy "programs_select_published_authenticated"
  on public.programs for select
  to authenticated
  using (publication_state = 'published');

-- MPS-REQ-018: an educator sees their assigned programs at any publication
-- state, and gains nothing on unassigned programs.
create policy "programs_select_assigned_educator"
  on public.programs for select
  to authenticated
  using (private.is_assigned_educator(id));

create policy "programs_select_admin"
  on public.programs for select
  to authenticated
  using (private.is_admin());

-- MPS-RUL-005: only an administrator or the owner publishes program, price,
-- availability, registration, or cancellation changes. Educators get no write.
create policy "programs_insert_admin"
  on public.programs for insert
  to authenticated
  with check (private.is_admin());

create policy "programs_update_admin"
  on public.programs for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "programs_delete_admin"
  on public.programs for delete
  to authenticated
  using (private.is_admin());


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (private.is_admin());

-- WITH CHECK repeats the predicate so the row's identity cannot be moved.
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No INSERT policy: rows are created by the on_auth_user_created trigger.
-- No DELETE policy: profile removal follows account deletion policy, which is
-- part of the unresolved retention/deletion decision in MPS GAP-005.


-- ---------------------------------------------------------------------------
-- user_roles  —  read-only to clients, always
-- ---------------------------------------------------------------------------
create policy "user_roles_select_own"
  on public.user_roles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_roles_select_admin"
  on public.user_roles for select
  to authenticated
  using (private.is_admin());

-- Deliberately no INSERT, UPDATE, or DELETE policy for any role. A client
-- cannot grant itself or anyone else a role through the Data API. Role changes
-- are an authorized server/CLI operation.


-- ---------------------------------------------------------------------------
-- families and family_members
-- ---------------------------------------------------------------------------
create policy "families_select_member"
  on public.families for select
  to authenticated
  using (private.is_family_member(id));

create policy "families_select_admin"
  on public.families for select
  to authenticated
  using (private.is_admin());

create policy "family_members_select_same_family"
  on public.family_members for select
  to authenticated
  using (private.is_family_member(family_id));

create policy "family_members_select_admin"
  on public.family_members for select
  to authenticated
  using (private.is_admin());

-- No write policies: family creation and guardian invitation are MTS Phase 3
-- workflows and require the consent behavior blocked by MPS GAP-005.


-- ---------------------------------------------------------------------------
-- educator_assignments
-- ---------------------------------------------------------------------------
create policy "educator_assignments_select_own"
  on public.educator_assignments for select
  to authenticated
  using ((select auth.uid()) = educator_user_id);

create policy "educator_assignments_select_admin"
  on public.educator_assignments for select
  to authenticated
  using (private.is_admin());

-- MPS-REQ-017: administrators manage assignments; educators never self-assign.
create policy "educator_assignments_insert_admin"
  on public.educator_assignments for insert
  to authenticated
  with check (private.is_admin());

create policy "educator_assignments_delete_admin"
  on public.educator_assignments for delete
  to authenticated
  using (private.is_admin());


-- ---------------------------------------------------------------------------
-- audit_events  —  admin-readable, append-only via trigger
-- ---------------------------------------------------------------------------
create policy "audit_events_select_admin"
  on public.audit_events for select
  to authenticated
  using (private.is_admin());

-- No write policy for any client role. Rows arrive only from the SECURITY
-- DEFINER triggers in the audit migration, which keeps attribution honest.
