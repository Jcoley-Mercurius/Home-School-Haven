-- Foundation Release — RLS test harness sanity checks
--
-- Run with: supabase test db
-- These run inside a rolled-back transaction against the seeded local stack.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Every table in the exposed `public` schema must have RLS enabled. A new table
-- without RLS is reachable through the Data API, so this test is the guard
-- against a future migration forgetting it.
select is(
  (
    select count(*)::int
    from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = t.tablename
          and c.relrowsecurity
      )
  ),
  0,
  'every public table has row level security enabled'
);

-- Least privilege at the GRANT layer, not only the RLS layer.
--
-- Some Supabase projects auto-expose new tables to the Data API roles. The
-- linked project did, so `anon` briefly held INSERT/UPDATE/DELETE on every
-- table including `user_roles`. RLS refused all of it, but the privilege
-- surface contradicted the design and differed from local. These three assert
-- the surface that `*_foundation_least_privilege_grants.sql` establishes.
select is(
  (
    select coalesce(string_agg(distinct table_name, ', ' order by table_name), '')
    from information_schema.table_privileges
    where table_schema = 'public' and grantee in ('anon', 'public')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ),
  '',
  'anon and PUBLIC hold no write privilege on any table'
);

select is(
  (
    select coalesce(string_agg(distinct table_name, ', ' order by table_name), '')
    from information_schema.table_privileges
    where table_schema = 'public' and grantee in ('anon', 'public')
  ),
  'programs',
  'anon and PUBLIC reach exactly one table: programs'
);

-- No client role may write a role grant. This is the privilege-layer half of
-- the escalation defence; the RLS half is in 20_rls_family.test.sql.
select is(
  (
    select count(*)::int
    from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'user_roles'
      and grantee in ('anon', 'authenticated', 'public')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ),
  0,
  'no client role or PUBLIC can write a role grant'
);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'user_roles', 'user_roles exists');
select has_table('public', 'families', 'families exists');
select has_table('public', 'family_members', 'family_members exists');
select has_table('public', 'programs', 'programs exists');
select has_table('public', 'educator_assignments', 'educator_assignments exists');
select has_table('public', 'audit_events', 'audit_events exists');

-- Student, consent, and enrollment data is deliberately absent while MPS
-- GAP-005 and GAP-010 are open. If one of these appears, the policy question
-- was answered somewhere other than the MPS.
select hasnt_table('public', 'students',
  'no students table: MPS GAP-005 leaves approved minimum fields unconfirmed');
select hasnt_table('public', 'consents',
  'no consents table: MPS GAP-005 leaves consent language unconfirmed');
select hasnt_table('public', 'enrollments',
  'no enrollments table: MPS GAP-010 leaves financial policy unconfirmed');

select * from finish();
rollback;
