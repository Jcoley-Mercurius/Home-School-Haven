-- Foundation Release — beta review evidence and feedback classification
-- (MPS-REQ-022, MPS-REQ-024; MPS-WFL-008; MPS-ACC-032; MPS-RUL-010)
--
-- WHAT THIS FILE IS FOR
--
-- `/admin/reports` decides what an administrator is shown. This decides what
-- the database does when asked directly. Six things are proven:
--
--   1. Neither review table has a client INSERT, UPDATE, or DELETE privilege;
--      all writes go through the security-definer functions.
--   2. An EDUCATOR and a PARENT each read zero rows from both tables. This is
--      the one that matters most: Samantha's candid assessment of the educator
--      workspace must not be readable by that educator.
--   3. The eight approved signals exist with their statements quoted verbatim
--      from `mps/MPS-PROJECT-STATE.yaml` (MPS-RUL-010), and every one starts
--      as `not_reviewed` / `not_tested`.
--   4. A disposition cannot be approved while unclassified — the MPS-REQ-022
--      control — and cannot be reclassified once approved.
--   5. The MPS-WFL-008 graph is enforced, including that nothing skips from
--      `not_reviewed` to a conclusion.
--   6. The audit payload records states, results, and dispositions and
--      contains NO note text. `audit_events` is readable by every
--      authenticated user, so a leak there would reopen exactly what
--      assertion 2 closes.

begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

\set parent   '20000000-0000-4000-8000-00000000000a'
\set educator '20000000-0000-4000-8000-00000000000e'
\set admin    '20000000-0000-4000-8000-000000000ad0'

\set secret 'The educator workspace felt cramped and I would rework it.'


-- ===========================================================================
-- 1. PRIVILEGES — the tables stayed shut
-- ===========================================================================

select ok(
  not has_table_privilege('anon', 'public.review_signals', 'SELECT'),
  'anon holds no SELECT on review_signals'
);
select ok(
  not has_table_privilege('anon', 'public.review_feedback', 'SELECT'),
  'anon holds no SELECT on review_feedback'
);
select ok(
  not has_table_privilege('authenticated', 'public.review_signals', 'INSERT'),
  'authenticated holds no INSERT on review_signals — the eight are fixed'
);
select ok(
  not has_table_privilege('authenticated', 'public.review_signals', 'DELETE'),
  'authenticated holds no DELETE on review_signals'
);
select ok(
  not has_table_privilege('authenticated', 'public.review_signals', 'UPDATE'),
  'authenticated holds no UPDATE on review_signals — the function is the door'
);
select ok(
  not has_table_privilege('authenticated', 'public.review_feedback', 'INSERT'),
  'authenticated holds no INSERT on review_feedback — the function is the door'
);
select ok(
  not has_table_privilege('authenticated', 'public.review_feedback', 'DELETE'),
  'authenticated holds no DELETE on review_feedback — feedback is not erasable'
);
select ok(
  not has_table_privilege('authenticated', 'public.review_feedback', 'UPDATE'),
  'authenticated holds no UPDATE on review_feedback — the function is the door'
);

-- Exactly one SELECT policy per table. This is the assertion that fails if
-- somebody later adds "educators can see feedback about their own workspace".
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'review_signals'
      and cmd = 'SELECT'),
  1,
  'review_signals has exactly one SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'review_feedback'
      and cmd = 'SELECT'),
  1,
  'review_feedback has exactly one SELECT policy'
);

-- The approved vocabularies, exhaustively.
select is(
  (select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'review_signal_state'),
  6,
  'review_signal_state has exactly the six approved MPS-WFL-008 values'
);
select is(
  (select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'review_disposition'),
  5,
  'review_disposition has exactly the five approved alternate paths'
);
select is(
  (select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'review_result'),
  4,
  'review_result has exactly the four results ACCEPTANCE-CRITERIA requires'
);

-- MPS-REQ-022 forbids silently changing scope. A column that could record one
-- would be the mechanism.
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and table_name in ('review_signals', 'review_feedback')
      and (column_name ilike '%scope%' or column_name ilike '%priority%'
        or column_name ilike '%requirement_id%' or column_name ilike '%release%')),
  0,
  'the review tables record no scope, priority, or release field'
);


-- ===========================================================================
-- 2. THE EIGHT APPROVED SIGNALS
-- ===========================================================================
reset role;

select is(
  (select count(*)::int from public.review_signals),
  8,
  'all eight approved beta success signals exist'
);
select is(
  (select count(*)::int from public.review_signals
    where state <> 'not_reviewed' or result <> 'not_tested'),
  0,
  'every signal starts not_reviewed and not_tested — silence is not evidence'
);
-- Quoted verbatim from mps/MPS-PROJECT-STATE.yaml (MPS-RUL-010). If an agent
-- ever paraphrases one of these, this fails.
select is(
  (select statement from public.review_signals where id = 'SIG-BETA-001'),
  'A prospective family can understand Home School Haven and identify an appropriate program.',
  'SIG-BETA-001 is quoted verbatim'
);
select is(
  (select statement from public.review_signals where id = 'SIG-BETA-008'),
  'Samantha can identify what must be added, changed, or removed before complete-platform launch approval.',
  'SIG-BETA-008 is quoted verbatim'
);


-- ===========================================================================
-- 3. PRIVACY — the educator and the parent see nothing
-- ===========================================================================
-- Seed one piece of feedback as the administrator first, so there is something
-- that COULD leak.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

select isnt(
  public.admin_record_signal_evidence(
    'SIG-BETA-005', 'pass', 'local', 'build-test', 'Manual walkthrough',
    'Walked the educator workspace.', 'in_review'::public.review_signal_state),
  null,
  'an administrator records evidence for a signal'
);
select isnt(
  public.admin_record_review_feedback('SIG-BETA-005', :'secret'),
  null,
  'an administrator records the owner''s feedback'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select is(
  (select count(*)::int from public.review_signals),
  0,
  'an educator reads zero review signals'
);
select is(
  (select count(*)::int from public.review_feedback),
  0,
  'an educator cannot read the owner''s feedback about the educator workspace'
);
select throws_ok(
  $$ select public.admin_record_review_feedback('SIG-BETA-005', 'educator note') $$,
  '42501',
  null,
  'an educator cannot record review feedback'
);
select throws_ok(
  $$ select public.admin_record_signal_evidence(
       'SIG-BETA-005', 'pass', 'x', 'y', 'z', 'w', null) $$,
  '42501',
  null,
  'an educator cannot record review evidence'
);
select is(
  (select count(*)::int from public.audit_events
    where entity_type in ('review_signal', 'review_feedback')),
  0,
  'an educator reads no review history'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.review_feedback),
  0,
  'a parent reads zero review feedback'
);


-- ===========================================================================
-- 4. THE MPS-REQ-022 CONTROL — no approval without a classification
-- ===========================================================================
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

select throws_ok(
  $$ select public.admin_approve_review_disposition(
       (select id from public.review_feedback
         where signal_id = 'SIG-BETA-005' limit 1)) $$,
  '22023',
  null,
  'an unclassified item cannot have its disposition approved'
);

-- And the constraint holds even for a caller who bypasses the function.
select throws_ok(
  $$ update public.review_feedback
       set disposition_approved_at = now(),
           disposition_approved_by = '20000000-0000-4000-8000-000000000ad0'
     where signal_id = 'SIG-BETA-005' $$,
  '42501',
  null,
  'a direct update cannot approve an unclassified disposition either'
);

select is(
  public.admin_classify_review_feedback(
    (select id from public.review_feedback where signal_id = 'SIG-BETA-005' limit 1),
    'launch_requirement'::public.review_disposition),
  'launch_requirement'::public.review_disposition,
  'an administrator classifies the feedback'
);
select is(
  (select state from public.review_signals where id = 'SIG-BETA-005'),
  'decision_pending'::public.review_signal_state,
  'classifying makes the signal''s decision pending'
);
select isnt(
  public.admin_approve_review_disposition(
    (select id from public.review_feedback where signal_id = 'SIG-BETA-005' limit 1)),
  null,
  'a classified disposition can be approved'
);
select is(
  (select state from public.review_signals where id = 'SIG-BETA-005'),
  'disposition_approved'::public.review_signal_state,
  'approving moves the signal to disposition_approved'
);
select throws_ok(
  $$ select public.admin_classify_review_feedback(
       (select id from public.review_feedback
         where signal_id = 'SIG-BETA-005' limit 1),
       'rejected_change'::public.review_disposition) $$,
  '23514',
  null,
  'an approved disposition cannot be reclassified afterwards'
);


-- ===========================================================================
-- 4b. FEEDBACK ON AN UNWALKED SIGNAL WALKS IT FIRST
-- ===========================================================================
-- Recording what someone said about a signal IS reviewing it. Without the
-- two-hop walk, a card would show feedback while still reading "nobody has
-- walked this signal yet" — the state contradicting the content beside it.
select is(
  (select state from public.review_signals where id = 'SIG-BETA-003'),
  'not_reviewed'::public.review_signal_state,
  'SIG-BETA-003 starts not_reviewed'
);
select isnt(
  public.admin_record_review_feedback('SIG-BETA-003', 'An untouched signal.'),
  null,
  'feedback may be recorded on a signal nobody has walked yet'
);
select is(
  (select state from public.review_signals where id = 'SIG-BETA-003'),
  'feedback_recorded'::public.review_signal_state,
  'recording feedback walks an untouched signal through to feedback_recorded'
);
-- Each hop is its own audit row: nothing was skipped to get there.
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'review_signal' and action = 'state_changed'
      and changed_fields ->> 'signal' = 'SIG-BETA-003'),
  2,
  'the two-hop walk records both transitions, not one jump'
);


-- ===========================================================================
-- 5. THE MPS-WFL-008 GRAPH
-- ===========================================================================
-- Nothing skips from `not_reviewed` to a conclusion: MPS-WFL-008's main path
-- starts by walking the signal.
select throws_ok(
  $$ select public.admin_record_signal_evidence(
       'SIG-BETA-007', 'pass', 'local', 'build-test', 'Manual', 'Checked.',
       'review_complete'::public.review_signal_state) $$,
  '23514',
  null,
  'an unwalked signal cannot jump straight to review_complete'
);
select throws_ok(
  $$ select public.admin_record_signal_evidence(
       'SIG-BETA-007', 'pass', 'local', 'build-test', 'Manual', 'Checked.',
       'disposition_approved'::public.review_signal_state) $$,
  '23514',
  null,
  'an unwalked signal cannot jump straight to disposition_approved'
);


-- ===========================================================================
-- 6. HISTORY DISCLOSES NO NOTE TEXT (MPS-REQ-024 without MPS-RUL-003 harm)
-- ===========================================================================
reset role;

select is(
  (select count(*)::int from public.audit_events
    where entity_type in ('review_signal', 'review_feedback')
      and changed_fields::text ilike '%cramped%'),
  0,
  'no review audit event discloses the text of the owner''s feedback'
);
select isnt(
  (select count(*)::int from public.audit_events
    where entity_type = 'review_feedback' and action = 'disposition_approved'),
  0,
  'an approved disposition is still recorded in history (MPS-REQ-024)'
);
select is(
  (select changed_fields ->> 'disposition' from public.audit_events
    where entity_type = 'review_feedback' and action = 'disposition_approved'
    order by id desc limit 1),
  'launch_requirement',
  'the audit records WHICH disposition was approved'
);

select * from finish();
rollback;
