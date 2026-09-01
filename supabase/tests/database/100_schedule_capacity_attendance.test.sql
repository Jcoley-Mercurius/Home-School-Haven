-- Foundation Release — schedule, capacity, waitlist, and attendance
-- (MPS-REQ-012, 014, 015, 016, 017, 020, 024; MPS-RUL-002, MPS-RUL-005;
--  MPS-ACC-018/020/025/026/027/028/031; MPS-FEA-011, MPS-FEA-012)
--
-- WHAT THIS FILE IS FOR
--
-- The application decides what each role is *offered*. This decides what the
-- database does when asked directly — by a manipulated id in a URL, by a
-- forged PostgREST request, or by a refactor that forgets a guard.
--
-- Seven things are proven:
--
--   1. No client role can write a session, a capacity, or an attendance record
--      through a table. Every write is a function.
--   2. Those functions refuse every caller who is not authorized, including an
--      assigned educator reaching for an administrator's operations
--      (MPS-ACC-027) and a caller whose editable JWT metadata claims a role.
--   3. Session reads are scoped: a visitor sees a published program's sessions
--      and no others; an educator sees their assignments; a family sees the
--      programs it holds; and a manipulated id widens nothing.
--   4. Setting capacity creates and removes NO enrollment, and lowering it
--      below the confirmed count reports the condition rather than deciding
--      who loses a place (GAP-ADMIN-012).
--   5. Attendance is assignment-scoped, refuses an unconfirmed or
--      wrong-program enrollment, refuses a canceled session, and is idempotent.
--   6. `educator_session_roster` exposes exactly four columns and no student
--      identifier; `educator_roster_students` is unchanged.
--   7. Every material change lands in `audit_events`, and no attendance audit
--      row carries a name.

begin;
create extension if not exists pgtap with schema extensions;

select plan(76);

\set admin    '20000000-0000-4000-8000-000000000ad0'
\set parent_a '20000000-0000-4000-8000-00000000000a'
\set parent_b '20000000-0000-4000-8000-00000000000b'
\set educator '20000000-0000-4000-8000-00000000000e'
\set norole   '20000000-0000-4000-8000-0000000000f0'

\set art_lab  '10000000-0000-4000-8000-000000000004'
\set nature   '10000000-0000-4000-8000-000000000002'
\set sewing   '10000000-0000-4000-8000-000000000005'
\set draft    '10000000-0000-4000-8000-0000000000ff'

\set s_upcoming    '80000000-0000-4000-8000-000000000001'
\set s_completed   '80000000-0000-4000-8000-000000000002'
\set s_rescheduled '80000000-0000-4000-8000-000000000003'
\set s_canceled    '80000000-0000-4000-8000-000000000004'
\set s_draft       '80000000-0000-4000-8000-0000000000f1'
\set s_otherfamily '80000000-0000-4000-8000-0000000000f2'

-- The confirmed Art Lab enrollment. The only attendance-eligible record.
\set e_confirmed_artlab '50000000-0000-4000-8000-000000000005'
-- Payment-pending, also Art Lab. Attendance must refuse it.
\set e_paypending       '50000000-0000-4000-8000-000000000001'
-- Confirmed, but on Nature Explorers. Attendance at an Art Lab session must
-- refuse it: the pairing is well-formed and still wrong.
\set e_other_program    '50000000-0000-4000-8000-000000000002'


-- ===========================================================================
-- 1. PRIVILEGES — no table write path exists for anybody
-- ===========================================================================
select ok(
  not has_table_privilege('authenticated', 'public.program_sessions', 'INSERT'),
  'authenticated holds no INSERT on program_sessions'
);
select ok(
  not has_table_privilege('authenticated', 'public.program_sessions', 'UPDATE'),
  'authenticated holds no UPDATE on program_sessions'
);
select ok(
  not has_table_privilege('authenticated', 'public.program_sessions', 'DELETE'),
  'authenticated holds no DELETE on program_sessions'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_attendance', 'INSERT'),
  'authenticated holds no INSERT on session_attendance'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_attendance', 'UPDATE'),
  'authenticated holds no UPDATE on session_attendance'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_attendance', 'DELETE'),
  'authenticated holds no DELETE on session_attendance'
);

-- Attendance is not public information at any verb. Sessions of a published
-- program are.
select ok(
  not has_table_privilege('anon', 'public.session_attendance', 'SELECT'),
  'anon cannot read attendance at all'
);
select ok(
  has_table_privilege('anon', 'public.program_sessions', 'SELECT'),
  'anon reads program_sessions, which the public calendar needs'
);

-- The educator boundary this slice must not widen.
select is(
  (
    select string_agg(column_name, ', ' order by column_name)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'educator_roster_students'
  ),
  'preferred_name, program_id',
  'educator_roster_students is unchanged: still exactly two columns'
);

-- The new view exposes an ENROLLMENT id, never a student id. If `student_id`
-- or `family_id` ever appears here, an educator has been handed an identifier
-- for a child and this assertion is what says so.
select is(
  (
    select string_agg(column_name, ', ' order by column_name)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'educator_session_roster'
  ),
  'attended, enrollment_id, preferred_name, session_id',
  'educator_session_roster exposes four columns and no student identifier'
);


-- ===========================================================================
-- 2. ANONYMOUS VISITOR — published sessions only
-- ===========================================================================
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select count(*)::int from public.program_sessions
   where program_id = :'art_lab'),
  3,
  'a visitor reads the sessions of a published program'
);

-- The public calendar's honesty rule. A draft program is not public, so its
-- schedule is not either.
select is(
  (select count(*)::int from public.program_sessions
   where program_id = :'draft'),
  0,
  'a visitor reads no session of an unpublished program'
);

-- Naming the row directly changes nothing. This is the manipulated-id check on
-- the anonymous side.
select is(
  (select count(*)::int from public.program_sessions where id = :'s_draft'),
  0,
  'a visitor naming an unpublished session id by hand still reads nothing'
);

select throws_ok(
  format($$ select public.admin_create_program_session(
    %L, 'Forged', now(), now() + interval '1 hour', null) $$, :'art_lab'),
  '42501',
  null,
  'a visitor cannot create a session'
);


-- ===========================================================================
-- 3. ASSIGNED EDUCATOR — reads the schedule, decides nothing about it
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

-- The educator holds Art Lab and the draft fixture, and no others.
select is(
  (select count(*)::int from public.program_sessions
   where program_id = :'art_lab'),
  3,
  'an assigned educator reads their assigned published program''s sessions'
);
select is(
  (select count(*)::int from public.program_sessions
   where program_id = :'draft'),
  1,
  'an assigned educator reads an unpublished assigned program''s session'
);
-- Sewing is PUBLISHED, so its session reaches an educator through the same
-- public policy it reaches a visitor through -- not through any assignment.
-- That is correct and is the point of MPS-REQ-020: a published schedule is one
-- fact everyone sees. The educator's boundary is the ROSTER and the
-- ATTENDANCE on an unassigned program, asserted below, not the published time
-- of a class anyone can read on the public calendar.
select is(
  (select count(*)::int from public.program_sessions
   where id = :'s_otherfamily'),
  1,
  'an unassigned published session reaches an educator only as public information'
);

-- MPS-ACC-027 as an enforced control. Every administrative operation on the
-- schedule is refused to the educator assigned to that very program.
select throws_ok(
  format($$ select public.admin_create_program_session(
    %L, 'Educator authored', now(), now() + interval '1 hour', null) $$,
    :'art_lab'),
  '42501',
  null,
  'an assigned educator cannot create a session on their own program'
);
select throws_ok(
  format($$ select public.admin_set_session_state(
    %L, 'canceled', 'Educator cancelling', now()) $$, :'s_upcoming'),
  '42501',
  null,
  'an assigned educator cannot cancel a session'
);
select throws_ok(
  format($$ select public.admin_update_program_session(
    %L, now(), 'Moved', now(), now() + interval '1 hour', null, 'note') $$,
    :'s_upcoming'),
  '42501',
  null,
  'an assigned educator cannot reschedule a session'
);
select throws_ok(
  format($$ select public.admin_set_program_capacity(%L, now(), 5, true) $$,
    :'art_lab'),
  '42501',
  null,
  'an assigned educator cannot set capacity (MPS-RUL-005)'
);

-- Attendance IS theirs, on an assigned program (MPS-FEA-011, assignment-scoped).
select is(
  public.record_session_attendance(:'s_upcoming', :'e_confirmed_artlab'),
  'recorded',
  'an assigned educator records attendance on their own program'
);
-- Idempotent: a resubmitted form writes nothing and records nothing.
select is(
  public.record_session_attendance(:'s_upcoming', :'e_confirmed_artlab'),
  'unchanged',
  'a repeat attendance submission is a no-op'
);

-- Attendance requires a CONFIRMED enrollment. A payment-pending child holds no
-- place, and recording them present would assert one.
select throws_ok(
  format($$ select public.record_session_attendance(%L, %L) $$,
    :'s_upcoming', :'e_paypending'),
  '23514',
  null,
  'attendance is refused for an enrollment that is not confirmed'
);

-- Well-formed and still wrong: a confirmed enrollment in a DIFFERENT program.
select throws_ok(
  format($$ select public.record_session_attendance(%L, %L) $$,
    :'s_upcoming', :'e_other_program'),
  '23514',
  null,
  'attendance is refused when the enrollment belongs to another program'
);

-- A session that did not happen cannot have attendance.
select throws_ok(
  format($$ select public.record_session_attendance(%L, %L) $$,
    :'s_canceled', :'e_other_program'),
  '42501',
  null,
  'attendance on an unassigned canceled session is refused on authorization first'
);

-- Clearing is the correction path, and restores "not recorded".
select is(
  public.clear_session_attendance(:'s_upcoming', :'e_confirmed_artlab'),
  'cleared',
  'an assigned educator clears an attendance record made in error'
);
select is(
  public.clear_session_attendance(:'s_upcoming', :'e_confirmed_artlab'),
  'unchanged',
  'clearing a record that is not there writes nothing'
);

-- The per-session roster: one confirmed child, by preferred name, on the
-- program they hold. MPS-ACC-028's "exactly once".
select is(
  (select count(*)::int from public.educator_session_roster
   where session_id = :'s_upcoming'),
  1,
  'the session roster names exactly one confirmed child'
);
select is(
  (select attended from public.educator_session_roster
   where session_id = :'s_upcoming'),
  false,
  'that child reads as not recorded after the record was cleared'
);
select is(
  (select attended from public.educator_session_roster
   where session_id = :'s_completed'),
  true,
  'the seeded attendance record reads as recorded'
);
select is(
  (select count(*)::int from public.educator_session_roster
   where session_id = :'s_otherfamily'),
  0,
  'the session roster is empty for an unassigned program'
);


-- ===========================================================================
-- 4. UNASSIGNED EDUCATOR — the denial side of the assignment boundary
-- ===========================================================================
select throws_ok(
  format($$ select public.record_session_attendance(%L, %L) $$,
    :'s_otherfamily', :'e_confirmed_artlab'),
  '42501',
  null,
  'an educator cannot record attendance on a program they are not assigned to'
);


-- ===========================================================================
-- 5. PARENT — reads their own programs' schedules and nothing else
-- ===========================================================================
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.program_sessions
   where program_id = :'art_lab'),
  3,
  'a parent reads the schedule of a program their family holds'
);

-- Sewing is family B's. Its sessions are readable here only because Sewing is
-- PUBLISHED, which is the public-visitor policy and not a family one. The
-- family boundary that matters is attendance, asserted next.
select is(
  (select count(*)::int from public.program_sessions where id = :'s_draft'),
  0,
  'a parent reads no session of an unpublished program they do not hold'
);

-- GAP-ADMIN-013: MPS defines no family attendance visibility, so none exists.
select is(
  (select count(*)::int from public.session_attendance),
  0,
  'a parent reads no attendance record at all (GAP-ADMIN-013)'
);

select throws_ok(
  format($$ select public.record_session_attendance(%L, %L) $$,
    :'s_upcoming', :'e_confirmed_artlab'),
  '42501',
  null,
  'a parent cannot record attendance for their own child'
);
select throws_ok(
  format($$ select public.admin_set_program_capacity(%L, now(), 1, false) $$,
    :'art_lab'),
  '42501',
  null,
  'a parent cannot set capacity'
);


-- ===========================================================================
-- 6. A FORGED ROLE CLAIM
-- ===========================================================================
-- `private.is_admin()` reads `public.user_roles`, never the JWT. A caller who
-- writes `"role":"admin"` into their own editable metadata is still refused.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-0000000000f0","role":"authenticated",'
  '"user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}';

select throws_ok(
  format($$ select public.admin_create_program_session(
    %L, 'Forged', now(), now() + interval '1 hour', null) $$, :'art_lab'),
  '42501',
  null,
  'a JWT metadata role claim does not create a session'
);
select throws_ok(
  format($$ select public.admin_set_program_capacity(%L, now(), 99, true) $$,
    :'art_lab'),
  '42501',
  null,
  'a JWT metadata role claim does not set capacity'
);


-- ===========================================================================
-- 7. ADMINISTRATOR — the approved operations, and their refusals
-- ===========================================================================
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- Direct table writes stay closed even for an administrator: the privilege is
-- gone, so the transition rules cannot be walked around.
select throws_ok(
  $$ update public.program_sessions set title = 'Renamed'
       where id = '80000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'an administrator cannot write program_sessions directly through the Data API'
);
select throws_ok(
  $$ insert into public.session_attendance (session_id, enrollment_id)
     values ('80000000-0000-4000-8000-000000000001',
             '50000000-0000-4000-8000-000000000005') $$,
  '42501',
  null,
  'an administrator cannot write session_attendance directly'
);

-- Creation.
select lives_ok(
  format($$ select public.admin_create_program_session(
    %L, 'Sample session — added by test',
    now() + interval '30 days', now() + interval '30 days 1 hour',
    'Sample location') $$, :'art_lab'),
  'an administrator creates a session'
);
select is(
  (select count(*)::int from public.audit_events a
   where a.entity_type = 'program_session' and a.action = 'created'
     and a.entity_id = (select id from public.program_sessions
                        where title = 'Sample session — added by test')),
  1,
  'creating a session recorded one attributable audit row (MPS-REQ-024)'
);

-- The idempotency half of §3, asserted here because `audit_events` is readable
-- to an administrator only -- an educator counting their own history would
-- have counted zero whatever the trigger did.
select is(
  (select count(*)::int from public.audit_events
   where entity_type = 'session_attendance' and entity_id = :'s_upcoming'
     and action = 'recorded'),
  1,
  'the repeated attendance submission recorded no second audit row'
);

-- A session must end after it starts, and the rule lives in the database.
select throws_ok(
  format($$ select public.admin_create_program_session(
    %L, 'Backwards', now() + interval '2 hours', now(), null) $$, :'art_lab'),
  '22023',
  null,
  'a session that ends before it starts is refused'
);
select throws_ok(
  $$ select public.admin_create_program_session(
    '00000000-0000-4000-8000-00000000dead', 'Orphan',
    now(), now() + interval '1 hour', null) $$,
  'P0002',
  null,
  'a session cannot be created against a program that does not exist'
);

-- Rescheduling. Moving a session sets `rescheduled`, preserves the original
-- start, and REQUIRES a note — a family told "this changed" and nothing else is
-- worse off than one told nothing.
select throws_ok(
  format($$ select public.admin_update_program_session(
    %L, (select updated_at from public.program_sessions where id = %L),
    'Sample session — Art Lab meeting',
    now() + interval '40 days', now() + interval '40 days 2 hours',
    'Sample location', null) $$, :'s_upcoming', :'s_upcoming'),
  '22023',
  null,
  'moving a session without a note is refused'
);

select is(
  (select public.admin_update_program_session(
    :'s_upcoming',
    (select updated_at from public.program_sessions where id = :'s_upcoming'),
    'Sample session — Art Lab meeting',
    now() + interval '40 days', now() + interval '40 days 2 hours',
    'Sample location', 'Sample record. Moved for testing.')),
  'rescheduled',
  'moving a session returns rescheduled'
);
select is(
  (select state::text from public.program_sessions where id = :'s_upcoming'),
  'rescheduled',
  'the moved session is now in the rescheduled state'
);
select isnt(
  (select rescheduled_from from public.program_sessions where id = :'s_upcoming'),
  null,
  'the original start time is preserved, so the change can be explained'
);

-- A stale token is refused. Two administrators submitting at once do not
-- silently overwrite one another.
select throws_ok(
  format($$ select public.admin_update_program_session(
    %L, '2020-01-01T00:00:00Z'::timestamptz, 'Stale',
    now() + interval '50 days', now() + interval '50 days 1 hour', null,
    'note') $$, :'s_upcoming'),
  '40001',
  null,
  'an edit made against a stale copy of the session is refused'
);

-- Editing a title changes no time, sets no state, and needs no note.
select is(
  (select public.admin_update_program_session(
    :'s_rescheduled',
    (select updated_at from public.program_sessions where id = :'s_rescheduled'),
    'Sample session — retitled',
    (select starts_at from public.program_sessions where id = :'s_rescheduled'),
    (select ends_at from public.program_sessions where id = :'s_rescheduled'),
    'Sample location',
    null)),
  'updated',
  'correcting a title is an edit, not a reschedule'
);
select is(
  (select change_note from public.program_sessions where id = :'s_rescheduled'),
  'Sample record. Moved one week later so a changed session is reviewable.',
  'a title-only edit preserves the existing reschedule explanation'
);
select is(
  (select public.admin_update_program_session(
    :'s_rescheduled',
    (select updated_at from public.program_sessions where id = :'s_rescheduled'),
    'Sample session — retitled',
    (select starts_at from public.program_sessions where id = :'s_rescheduled'),
    (select ends_at from public.program_sessions where id = :'s_rescheduled'),
    'Sample location',
    null)),
  'unchanged',
  'an omitted note is not treated as a change when the existing note is preserved'
);

-- Cancellation and completion, each with a mandatory note.
select throws_ok(
  format($$ select public.admin_set_session_state(%L, 'canceled', '  ',
    (select updated_at from public.program_sessions where id = %L)) $$,
    :'s_rescheduled', :'s_rescheduled'),
  '22023',
  null,
  'cancelling a session without a note is refused'
);
select is(
  (select public.admin_set_session_state(:'s_rescheduled', 'canceled',
    'Sample record. Called off for testing.',
    (select updated_at from public.program_sessions where id = :'s_rescheduled'))),
  'updated',
  'an administrator cancels a session'
);

-- Terminal, and the refusal is the database's, not the form's.
select throws_ok(
  format($$ select public.admin_set_session_state(%L, 'scheduled', 'Reopening',
    (select updated_at from public.program_sessions where id = %L)) $$,
    :'s_rescheduled', :'s_rescheduled'),
  '23514',
  null,
  'a canceled session cannot be reopened'
);
select throws_ok(
  format($$ select public.admin_update_program_session(
    %L, (select updated_at from public.program_sessions where id = %L),
    'Edit after cancel', now() + interval '60 days',
    now() + interval '60 days 1 hour', null, 'note') $$,
    :'s_rescheduled', :'s_rescheduled'),
  '23514',
  null,
  'a canceled session cannot be edited'
);
select throws_ok(
  format($$ select public.admin_set_session_state(%L, 'scheduled', 'Reopening',
    (select updated_at from public.program_sessions where id = %L)) $$,
    :'s_completed', :'s_completed'),
  '23514',
  null,
  'a completed session cannot be reopened'
);

-- Cancelling a session touched no enrollment. MPS-RUL-004: the beta records a
-- status and decides no financial or enrollment outcome.
select is(
  (select state::text from public.enrollments where id = :'e_confirmed_artlab'),
  'confirmed',
  'cancelling a session changed no enrollment state (MPS-RUL-004)'
);

-- Attendance on a canceled session is a false record.
select throws_ok(
  format($$ select public.record_session_attendance(%L, %L) $$,
    :'s_rescheduled', :'e_confirmed_artlab'),
  '23514',
  null,
  'attendance cannot be recorded for a canceled session'
);


-- ===========================================================================
-- 8. CAPACITY — sets a number, and never an enrollment
-- ===========================================================================
select is(
  (select public.admin_set_program_capacity(:'nature',
    (select updated_at from public.programs where id = :'nature'), 20, true)),
  'updated',
  'an administrator sets capacity and a waitlist setting'
);
select is(
  (select public.admin_set_program_capacity(:'nature',
    (select updated_at from public.programs where id = :'nature'), 20, true)),
  'unchanged',
  'a repeat capacity submission writes nothing'
);
select is(
  (select count(*)::int from public.audit_events
   where entity_type = 'program' and entity_id = :'nature'
     and changed_fields ? 'capacity'),
  1,
  'the capacity change is attributable, and the no-op added no second row'
);

-- GAP-ADMIN-012. Lowering capacity below the confirmed count is permitted and
-- REPORTED. Nothing is auto-cancelled, because choosing who loses a place is a
-- policy decision MPS does not define.
select is(
  (select public.admin_set_program_capacity(:'nature',
    (select updated_at from public.programs where id = :'nature'), 0, true)),
  'updated_over_capacity',
  'lowering capacity below the confirmed count reports the condition'
);
select is(
  (select count(*)::int from public.enrollments
   where program_id = :'nature' and state = 'confirmed'),
  1,
  'and removed no enrollment (GAP-ADMIN-012)'
);
select is(
  (select count(*)::int from public.enrollments where program_id = :'nature'),
  1,
  'and created none either'
);

-- NULL is "not established", and clearing back to it is allowed.
select is(
  (select public.admin_set_program_capacity(:'nature',
    (select updated_at from public.programs where id = :'nature'), null, false)),
  'updated',
  'capacity can be cleared back to not established'
);
select is(
  (select capacity from public.programs where id = :'nature'),
  null,
  'and NULL is what is stored, so no number is claimed anywhere'
);

select throws_ok(
  format($$ select public.admin_set_program_capacity(%L,
    (select updated_at from public.programs where id = %L), -1, false) $$,
    :'nature', :'nature'),
  '22023',
  null,
  'a negative capacity is refused'
);
select throws_ok(
  format($$ select public.admin_set_program_capacity(
    %L, '2020-01-01T00:00:00Z'::timestamptz, 5, false) $$, :'nature'),
  '40001',
  null,
  'a capacity edit made against a stale copy of the program is refused'
);


-- ===========================================================================
-- 9. WAITLIST — a place, not an enrollment, and no payment anywhere
-- ===========================================================================
-- MPS-RUL-002 and MPS-ACC-020. This slice adds no state and no automation; it
-- asserts that the existing waitlist record stays what it is.
select is(
  (select state::text from public.enrollments
   where id = '50000000-0000-4000-8000-000000000004'),
  'waitlisted',
  'a waitlisted record is waitlisted, and is not enrollment'
);

-- The whole product carries no payment column. If one ever appears, a waitlist
-- placement is the first place it would do harm.
select is(
  (
    select coalesce(string_agg(table_name || '.' || column_name, ', '), '')
    from information_schema.columns
    where table_schema = 'public'
      and (column_name like '%payment%' or column_name like '%paid%'
           or column_name like '%amount%' or column_name like '%price%'
             and column_name not like 'published_price')
  ),
  '',
  'no payment, paid, or amount column exists anywhere (MPS-RUL-002, GAP-ADMIN-002)'
);


-- ===========================================================================
-- 10. ATTENDANCE HISTORY CARRIES IDS, NEVER NAMES
-- ===========================================================================
-- MPS-REQ-024 requires the history. The child-data rule requires that it not
-- become a record of which named child was where.
select is(
  (
    select count(*)::int
    from public.audit_events a
    join public.students s on true
    where a.entity_type = 'session_attendance'
      and a.changed_fields::text ilike '%' || s.preferred_name || '%'
  ),
  0,
  'no attendance audit row contains a student name'
);
select is(
  (
    select count(*)::int from public.audit_events
    where entity_type = 'session_attendance'
      and not (changed_fields ? 'enrollment_id')
  ),
  0,
  'every attendance audit row identifies its subject by enrollment id'
);

select * from finish();
rollback;
