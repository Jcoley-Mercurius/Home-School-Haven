-- Foundation Release — inquiry capture
-- (MPS-REQ-009, MPS-REQ-010, MPS-REQ-024, MPS-RUL-003, MPS-RUL-004;
--  MPS-WFL-001, MPS-WFL-004; MPS-ACC-012, MPS-ACC-013, MPS-ACC-014)
--
-- WHAT THIS FILE IS FOR
--
-- `/contact` decides what a visitor is SHOWN. This file decides what the
-- database does when asked directly — by a forged PostgREST request, by a
-- future migration that adds a convenience policy, or by an educator who
-- simply types the URL. Six things are proven:
--
--   1. `public.inquiries` has no client write privilege at all. The function
--      is the only door, and it did not quietly open a second one.
--   2. An EDUCATOR reads zero inquiries, including an assistance request, and
--      so does a parent and so does an anonymous visitor (MPS-ACC-013). The
--      guarantee is the absence of a policy, not a filter on type.
--   3. A submission creates exactly ONE record, and a retry under the same
--      token creates none (MPS-ACC-012).
--   4. A caller cannot choose the state or the owner, and cannot name an
--      unpublished program.
--   5. State moves only along the MPS-WFL-004 graph, and only for an
--      administrator; the owner must itself be an administrator.
--   6. The audit payload discloses NO contact detail and NO message text —
--      `public.audit_events` is readable by every authenticated user, so a
--      leak there would reopen exactly what assertion 2 closes.

begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

\set parent   '20000000-0000-4000-8000-00000000000a'
\set educator '20000000-0000-4000-8000-00000000000e'
\set admin    '20000000-0000-4000-8000-000000000ad0'

\set tok_assist '90000000-0000-4000-8000-000000000001'
\set tok_repeat '90000000-0000-4000-8000-000000000002'
\set tok_visit  '90000000-0000-4000-8000-000000000003'


-- ===========================================================================
-- 1. PRIVILEGES — the table stayed shut
-- ===========================================================================
-- The whole design rests on this. If a future migration grants INSERT here,
-- every rule below becomes bypassable and these assertions are what says so.

select ok(
  not has_table_privilege('anon', 'public.inquiries', 'SELECT'),
  'anon holds no SELECT on inquiries'
);
select ok(
  not has_table_privilege('anon', 'public.inquiries', 'INSERT'),
  'anon holds no INSERT on inquiries'
);
select ok(
  not has_table_privilege('authenticated', 'public.inquiries', 'INSERT'),
  'authenticated holds no INSERT on inquiries — not even an administrator'
);
select ok(
  not has_table_privilege('authenticated', 'public.inquiries', 'DELETE'),
  'authenticated holds no DELETE on inquiries'
);
select ok(
  has_function_privilege(
    'anon',
    'public.submit_inquiry(public.inquiry_type, text, text, text, text, text, uuid)',
    'EXECUTE'),
  'anon may execute submit_inquiry — the one public door'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_set_inquiry_state(uuid, public.inquiry_state, uuid, boolean)',
    'EXECUTE'),
  'anon cannot execute admin_set_inquiry_state'
);

-- MPS-WFL-004 names six states. A seventh would be a workflow nobody approved.
select is(
  (select count(*)::int from pg_enum e
     join pg_type t on t.oid = e.enumtypid
    where t.typname = 'inquiry_state'),
  6,
  'inquiry_state has exactly the six approved MPS-WFL-004 values'
);
select is(
  (select count(*)::int from pg_enum e
     join pg_type t on t.oid = e.enumtypid
    where t.typname = 'inquiry_type'),
  4,
  'inquiry_type has exactly the four approved MPS-REQ-009 pathways'
);

-- There must be no SELECT policy other than the administrator one. This is the
-- assertion that fails if somebody later adds "educators can see inquiries for
-- their own programs".
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'inquiries' and cmd = 'SELECT'),
  1,
  'inquiries has exactly one SELECT policy'
);


-- ===========================================================================
-- 2. SUBMISSION — anonymous, once, and with nothing the caller chose
-- ===========================================================================
set local role anon;

select isnt(
  public.submit_inquiry(
    'assistance', 'Sample Parent', 'sample.parent@example.com', null, null,
    'Asking privately about support for a class.', :'tok_assist'),
  null,
  'an anonymous visitor can submit a discounted-class assistance request'
);

-- MPS-ACC-012: "an authorized administrative record is created once". The same
-- token is a double-clicked button, a retried action, or a resubmitted form.
select is(
  public.submit_inquiry(
    'assistance', 'Sample Parent', 'sample.parent@example.com', null, null,
    'Asking privately about support for a class.', :'tok_assist'),
  public.submit_inquiry(
    'assistance', 'Sample Parent', 'sample.parent@example.com', null, null,
    'Asking privately about support for a class.', :'tok_assist'),
  'a retry under the same token returns the same reference'
);

select isnt(
  public.submit_inquiry(
    'visit', 'Sample Visitor', 'sample.visitor@example.com', '555-0100',
    (select slug from public.programs
      where publication_state = 'published' order by slug limit 1),
    'Would like to tour.', :'tok_visit'),
  null,
  'a visit request may name a published program'
);

-- A draft program is not something a public visitor can name. Refused rather
-- than silently recorded as "no program", so a stale link does not quietly
-- detach the request from its context.
select throws_ok(
  $$ select public.submit_inquiry(
       'guidance', 'Sample', 's@example.com', null, 'no-such-program',
       'Hello.', '90000000-0000-4000-8000-0000000000ff') $$,
  '22023',
  null,
  'an unknown program slug is refused'
);

select throws_ok(
  $$ select public.submit_inquiry(
       'guidance', '', 's@example.com', null, null, 'Hello.',
       '90000000-0000-4000-8000-0000000000fe') $$,
  '22023',
  null,
  'an empty name is refused at the database boundary, not only in zod'
);

select throws_ok(
  $$ select public.submit_inquiry(
       'guidance', 'Sample', 'not-an-email', null, null, 'Hello.',
       '90000000-0000-4000-8000-0000000000fd') $$,
  '22023',
  null,
  'a malformed email is refused at the database boundary'
);

select throws_ok(
  $$ select public.submit_inquiry(
       'guidance', 'Sample', 's@example.com', null, null, '',
       '90000000-0000-4000-8000-0000000000fc') $$,
  '22023',
  null,
  'an empty message is refused at the database boundary'
);

-- Even having just submitted one, the visitor cannot read it back. This is a
-- privilege refusal rather than an empty result: `anon` holds no SELECT on the
-- table at all, so RLS is never even consulted.
select throws_ok(
  $$ select count(*) from public.inquiries $$,
  '42501',
  null,
  'an anonymous visitor cannot read inquiries, including the one just submitted'
);

reset role;

-- Two rows exist, not three: the two distinct tokens, and none for the retry.
select is(
  (select count(*)::int from public.inquiries
    where submission_token in (:'tok_assist', :'tok_visit', :'tok_repeat')),
  2,
  'three submissions under two tokens produced exactly two records'
);

-- MPS-REQ-010: state and owner are the system's to set, never the caller's.
select is(
  (select count(*)::int from public.inquiries
    where submission_token in (:'tok_assist', :'tok_visit')
      and (state <> 'submitted' or owner_user_id is not null)),
  0,
  'every submitted inquiry starts unowned in state `submitted`'
);


-- ===========================================================================
-- 3. PRIVACY — the educator sees nothing (MPS-ACC-013)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select is(
  (select count(*)::int from public.inquiries),
  0,
  'an educator reads zero inquiries'
);
select is(
  (select count(*)::int from public.inquiries where type = 'assistance'),
  0,
  'an educator cannot read a discounted-class assistance request'
);
-- An educator's UPDATE is not refused by privilege — `authenticated` holds the
-- verb for the administrator state machine. It is the POLICY that stops it, so
-- the statement succeeds against zero rows and changes nothing. Asserting the
-- unchanged state is what proves that, where an error assertion would not.
select lives_ok(
  format($$ update public.inquiries set state = 'closed'
             where submission_token = %L $$, :'tok_assist'),
  'an educator''s direct update reaches no row'
);
select throws_ok(
  format($$ select public.admin_set_inquiry_state(
              (select id from public.inquiries limit 1),
              'under_review'::public.inquiry_state, %L, false) $$, :'educator'),
  '42501',
  null,
  'an educator cannot triage an inquiry through the admin function'
);

-- MPS-REQ-024 history must not become the disclosure channel. An educator's
-- most plausible route to the contents of an assistance request is
-- `audit_events`, which they hold the SELECT privilege on.
select is(
  (select count(*)::int from public.audit_events where entity_type = 'inquiry'),
  0,
  'an educator reads no inquiry history'
);

reset role;

-- And the payload itself carries nothing to disclose, checked with RLS out of
-- the way so this holds no matter who is later permitted to read history.
select is(
  (select count(*)::int
     from public.audit_events
    where entity_type = 'inquiry'
      and (changed_fields::text ilike '%sample.parent@example.com%'
        or changed_fields::text ilike '%Sample Parent%'
        or changed_fields::text ilike '%privately about support%'
        or changed_fields::text ilike '%555-0100%'
        or changed_fields::text ilike '%Sample Visitor%'
        or changed_fields::text ilike '%tour%')),
  0,
  'no inquiry audit event discloses a name, email, phone, or message'
);
select isnt(
  (select count(*)::int from public.audit_events
    where entity_type = 'inquiry' and action = 'submitted'),
  0,
  'a submission is still recorded in history (MPS-REQ-024)'
);

set local role authenticated;

-- A parent has no more reach than an educator.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.inquiries),
  0,
  'a parent reads zero inquiries, including their own submission'
);


-- ===========================================================================
-- 4. TRIAGE — administrator only, along the approved graph
-- ===========================================================================
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- Scoped to this test's own rows: the sanitized seed carries sample inquiries
-- too, and an assertion that counted everything would fail the day someone
-- adds another sample.
select is(
  (select count(*)::int from public.inquiries
    where submission_token in (:'tok_assist', :'tok_visit')),
  2,
  'an administrator reads the inquiries'
);

select is(
  public.admin_set_inquiry_state(
    (select id from public.inquiries where submission_token = :'tok_assist'),
    'under_review'::public.inquiry_state, :'admin', false),
  'under_review'::public.inquiry_state,
  'an administrator takes an inquiry under review and claims it'
);

select is(
  (select owner_user_id from public.inquiries
    where submission_token = :'tok_assist'),
  :'admin'::uuid,
  'the authorized administrative owner is recorded (MPS-REQ-010)'
);

-- MPS-ACC-013 again, from the other side: assigning an inquiry to an educator
-- would be a standing reason to grant them access later.
select throws_ok(
  format($$ select public.admin_set_inquiry_state(
              (select id from public.inquiries where submission_token = %L),
              null::public.inquiry_state, %L, false) $$,
         :'tok_assist', :'educator'),
  '42501',
  null,
  'an inquiry cannot be assigned to an educator'
);

-- MPS-WFL-004 has no path from `submitted` straight to `approved_path_provided`:
-- an administrator reviews before concluding anything.
select throws_ok(
  format($$ select public.admin_set_inquiry_state(
              (select id from public.inquiries where submission_token = %L),
              'approved_path_provided'::public.inquiry_state, null, false) $$,
         :'tok_visit'),
  '23514',
  null,
  'an unreviewed inquiry cannot jump to approved_path_provided'
);

select is(
  public.admin_set_inquiry_state(
    (select id from public.inquiries where submission_token = :'tok_assist'),
    'approved_path_provided'::public.inquiry_state, null, false),
  'approved_path_provided'::public.inquiry_state,
  'a reviewed assistance request may be given a registration or payment path'
);

-- `closed` is terminal: MPS-WFL-004 completion. Reopening is a new inquiry, not
-- a resurrected one.
select is(
  public.admin_set_inquiry_state(
    (select id from public.inquiries where submission_token = :'tok_assist'),
    'closed'::public.inquiry_state, null, false),
  'closed'::public.inquiry_state,
  'a completed inquiry closes'
);
select throws_ok(
  format($$ select public.admin_set_inquiry_state(
              (select id from public.inquiries where submission_token = %L),
              'under_review'::public.inquiry_state, null, false) $$,
         :'tok_assist'),
  '23514',
  null,
  'a closed inquiry cannot be reopened'
);

-- MPS-RUL-004: the record carries a review state and nothing that resembles a
-- financial outcome. If a column named for money ever appears here, the beta
-- has started deciding something it must not decide.
select is(
  (select count(*)::int
     from information_schema.columns
    where table_schema = 'public' and table_name = 'inquiries'
      and (column_name ilike '%amount%' or column_name ilike '%discount%'
        or column_name ilike '%price%' or column_name ilike '%award%'
        or column_name ilike '%eligib%')),
  0,
  'an inquiry records no amount, discount, price, award, or eligibility'
);

select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'inquiry' and action = 'state_changed'
      and changed_fields ->> 'reference' = (
        select reference from public.inquiries
         where submission_token = :'tok_assist')),
  3,
  'each state change is attributable history (MPS-REQ-024)'
);

select * from finish();
rollback;
