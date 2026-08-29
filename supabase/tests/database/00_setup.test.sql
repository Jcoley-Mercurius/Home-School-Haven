-- Foundation Release — RLS test harness sanity checks
--
-- Run with: supabase test db
-- These run inside a rolled-back transaction against the seeded local stack.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

-- The regression guard for the defect repaired by
-- `20260829140000_students_grant_repair.sql`. `students` was created with a
-- SELECT grant, and the bulk revoke loop in the least-privilege migration --
-- which re-grants a hardcoded list that cannot mention a table created after
-- it -- took the grant away again. RLS was still correct; the table was simply
-- unreachable, so every parent saw a load error instead of their own children.
-- A policy that no privilege can reach is not a boundary, it is an outage.
select is(
  (
    select count(*)::int
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'students'
      and grantee = 'authenticated' and privilege_type = 'SELECT'
  ),
  1,
  'authenticated can actually reach students, not just be allowed to by RLS'
);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'user_roles', 'user_roles exists');
select has_table('public', 'families', 'families exists');
select has_table('public', 'family_members', 'family_members exists');
select has_table('public', 'programs', 'programs exists');
select has_table('public', 'educator_assignments', 'educator_assignments exists');
select has_table('public', 'audit_events', 'audit_events exists');

-- Consent and enrollment data is deliberately absent while MPS GAP-005 and
-- GAP-010 are open. If one of these appears, the policy question was answered
-- somewhere other than the MPS.
select hasnt_table('public', 'consents',
  'no consents table: MPS GAP-005 leaves consent language unconfirmed');
select hasnt_table('public', 'enrollments',
  'no enrollments table: MPS GAP-010 leaves financial policy unconfirmed');

-- `students` DOES exist, which this file previously asserted it must not. That
-- assertion fired exactly as intended: the policy question was answered
-- somewhere other than the MPS -- by an explicit owner decision on 2026-08-29
-- (deviation D-FF1). It is replaced rather than deleted, because the boundary
-- it guarded still needs guarding: the table may hold sample rows only, and no
-- row may claim approved consent language. `25_family_setup.test.sql` proves
-- both constraints refuse; these two prove the constraints are still attached.
select col_has_check('public', 'students', 'is_sample',
  'students.is_sample carries a CHECK: sample rows only while GAP-005 is open');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.students'::regclass
      and conname = 'students_affirmation_unapproved'
  ),
  'students still refuses any affirmation version other than the unapproved one'
);

select * from finish();
rollback;
