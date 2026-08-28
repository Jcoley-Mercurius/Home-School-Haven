-- Foundation Release — explicit least-privilege table grants
--
-- MTS SECURITY-ARCHITECTURE: "Deny by default and apply least privilege to
-- human and service identities."
--
-- WHY THIS EXISTS
--
-- Supabase projects differ in whether new tables created by `postgres` are
-- auto-exposed to the Data API roles. The linked project applies the legacy
-- behavior, so after the first four migrations `anon` held INSERT, UPDATE,
-- DELETE, and TRUNCATE on every table — including `user_roles` — while
-- `config.toml` locally applies the newer always-revoked behavior and grants
-- nothing. Same migrations, two different privilege surfaces.
--
-- Nothing was exposed by that: RLS is deny-by-default, no policy grants `anon`
-- a row, and `user_roles` has no write policy for anybody, so the escalation
-- path was already closed. But relying on RLS alone means one over-permissive
-- policy added later is the only thing between a visitor and the role table,
-- and it means local tests exercise a privilege surface production does not
-- have.
--
-- So privileges are stated here explicitly rather than inherited from a
-- project-level setting. This migration is idempotent and safe to re-run.
--
-- WHEN YOU ADD A TABLE: add it below. `supabase/tests/database/00_setup.test.sql`
-- fails if any table grants a write privilege to `anon`.
--
-- rollback: this migration only removes privileges that RLS already refused to
--   honour. To reverse it, re-grant per the table below; there is no data to
--   restore.

-- Start from nothing on every table in the exposed schema.
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format(
      'revoke all on public.%I from anon, authenticated, public', t.relname
    );
  end loop;
end;
$$;

-- Revoke default privileges that would apply to future tables.
alter default privileges in schema public
  revoke all on tables from anon, authenticated, public;

-- Re-grant exactly what the RLS matrix needs, and nothing more.
-- RLS then decides which rows; these decide which verbs are reachable at all.

-- Public program discovery. Read-only for visitors.
grant select on public.programs to anon;
grant select, insert, update, delete on public.programs to authenticated;

-- A signed-in adult reads and renames their own profile.
grant select, update on public.profiles to authenticated;

-- Role grants are readable, never writable through the Data API by anyone.
-- Granting a role is a privileged server or CLI operation.
grant select on public.user_roles to authenticated;

-- Family records are readable by their own members; writes are MTS Phase 3 and
-- depend on the consent behavior blocked by MPS GAP-005.
grant select on public.families to authenticated;
grant select on public.family_members to authenticated;

-- Administrators manage assignments; the RLS policies restrict who.
grant select, insert, delete on public.educator_assignments to authenticated;

-- History is append-only, and only the SECURITY DEFINER triggers append.
grant select on public.audit_events to authenticated;

-- `anon` deliberately holds exactly one privilege: SELECT on programs.
