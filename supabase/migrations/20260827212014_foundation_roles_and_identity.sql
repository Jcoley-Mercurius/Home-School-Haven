-- Foundation Release — identity, roles, and family ownership
--
-- MPS: ACT-001/003/004/006/007, MPS-REQ-004, MPS-RUL-005
-- MTS: TECHNOLOGY-BLUEPRINT "Authorization"; SECURITY-ARCHITECTURE "Mandatory controls"
--
-- Authorization data lives in these tables, never in auth.users.raw_user_meta_data,
-- which is user-editable and therefore unsafe for any access decision.
--
-- rollback:
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user();
--   drop function if exists private.is_assigned_educator(uuid);
--   drop function if exists private.is_family_member(uuid);
--   drop function if exists private.is_admin();
--   drop function if exists private.has_role(public.app_role);
--   drop table if exists public.educator_assignments;
--   drop table if exists public.family_members;
--   drop table if exists public.families;
--   drop table if exists public.user_roles;
--   drop table if exists public.profiles;
--   drop type if exists public.family_member_role;
--   drop type if exists public.app_role;
--   drop schema if exists private;

-- `private` is deliberately absent from config.toml `api.schemas`, so nothing in
-- it is reachable through the Data API. SECURITY DEFINER helpers live here.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ACT-002 (student) is absent by design: students have no login in the
-- Foundation Release. ACT-007 (invited secondary guardian) is a family
-- membership role, not an application role.
create type public.app_role as enum ('parent', 'educator', 'admin', 'owner');

create type public.family_member_role as enum ('primary_guardian', 'invited_guardian');


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per authenticated adult. Holds no child data and no authorization data.';


-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
-- The authoritative role grant. No RLS write policy is ever created for this
-- table (see the RLS migration): a client cannot grant itself a role, and the
-- server never reads a role from client input.
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

comment on table public.user_roles is
  'Authoritative role grants. Deny-by-default: no client write policy exists.';


-- ---------------------------------------------------------------------------
-- families and membership
-- ---------------------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.families is
  'A parent-controlled family account (ACT-001). Student profiles are NOT modelled '
  'in the Foundation Release: MPS GAP-005 leaves the approved minimum student '
  'fields and consent policy unconfirmed, and MPS-RUL-006 forbids inventing them.';

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role public.family_member_role not null default 'primary_guardian',
  added_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_members_user_id_idx on public.family_members (user_id);


-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is used only to break RLS recursion when a policy on one of
-- these tables needs to read the same table. Each function pins an empty
-- search_path, checks auth.uid() itself, lives outside every exposed schema, and
-- has EXECUTE revoked from PUBLIC.

create function private.has_role(target public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = target
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('admin', 'owner')
  );
$$;

create function private.is_family_member(target_family uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.user_id = (select auth.uid())
      and fm.family_id = target_family
  );
$$;

revoke all on function private.has_role(public.app_role) from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_family_member(uuid) from public;

grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_family_member(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Profile provisioning
-- ---------------------------------------------------------------------------
-- Creates the profile row only. It deliberately grants no role: role assignment
-- is an authorized operation, never a side effect of signing up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
