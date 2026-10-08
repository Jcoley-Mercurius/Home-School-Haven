-- Slice 2 — registration policy and data foundation
--
-- Updated for Slice 2.5 (prompts/registration-readiness.md): payloads carry the
-- explicit medical and accommodation answers DEC-026 requires, selections obey
-- the structured attendance rules (DEC-032), a STEP UP child never reaches
-- `started` (DEC-028), and the STEP UP enum has its five review outcomes. Every
-- original intent below is kept; 170 and 180 cover the new rules themselves.
-- (MPS-REQ-002/003/004/005/006/012/014/018/024; MPS-RUL-006/007/008/009/010;
--  MPS-ACC-002/003/005/018/023/028; DEC-025; EXC-002; GAP-014/015)
--
-- WHAT THIS FILE PROVES
--
--   1. Privileges and RLS: no client write path, nothing for anon, sample-only
--      and approval-lock constraints attached.
--   2. Anonymous users can neither read nor submit.
--   3. A parent's multi-child submission records every part, and its evidence
--      is shaped as policy requires: explicit allergy Yes/No, handbook
--      acknowledgment without a signature, Code of Conduct signed by the parent,
--      version and time on every acceptance, STEP UP pending only.
--   4. Retries are idempotent; a changed payload on the same key is a conflict;
--      a fresh key for the same children and programs is a duplicate.
--   5. A blocked selection rolls back the whole submission.
--   6. Payloads that try to smuggle family, role, state, or verification fields
--      are refused, and errors name paths, never values.
--   7. Drafts never qualify as accepted policy.
--   8. Cross-family, educator, and administrator boundaries.
--   9. Audit payloads carry no submitted value.

begin;
create extension if not exists pgtap with schema extensions;

select plan(99);

\set parent_a  '20000000-0000-4000-8000-00000000000a'
\set parent_b  '20000000-0000-4000-8000-00000000000b'
\set educator  '20000000-0000-4000-8000-00000000000e'
\set admin     '20000000-0000-4000-8000-000000000ad0'

\set student_a1 '40000000-0000-4000-8000-000000000001'
\set student_a2 '40000000-0000-4000-8000-000000000002'
\set student_b1 '40000000-0000-4000-8000-000000000003'

-- administrator_approval, no capacity.
\set p_approval '10000000-0000-4000-8000-000000000009'
-- instant, no capacity.
\set p_instant  '10000000-0000-4000-8000-000000000006'
-- instant, capacity 1 taken, waitlist ON.
\set p_waitlist '10000000-0000-4000-8000-00000000000d'
-- instant, capacity 1 taken, waitlist OFF.
\set p_full     '10000000-0000-4000-8000-00000000000b'

\set doc_waiver   'd0000000-0000-4000-8000-000000000001'
\set doc_conduct  'd0000000-0000-4000-8000-000000000002'
\set doc_handbook 'd0000000-0000-4000-8000-000000000003'

\set key_a1 'e0000000-0000-4000-8000-0000000000a1'
\set key_a2 'e0000000-0000-4000-8000-0000000000a2'
\set key_a3 'e0000000-0000-4000-8000-0000000000a3'
\set key_a4 'e0000000-0000-4000-8000-0000000000a4'
\set key_b1 'e0000000-0000-4000-8000-0000000000b1'


-- ---------------------------------------------------------------------------
-- Payload builders (rolled back with the transaction)
-- ---------------------------------------------------------------------------
-- Every sensitive fixture value carries the marker ZZSENS so section 9 can
-- search the audit trail for all of them at once.
create function public._t_docs()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'liability_waiver', jsonb_build_object(
      'version_id', 'd0000000-0000-4000-8000-000000000001',
      'typed_signature', 'ZZSENS Signature Waiver'),
    'code_of_conduct', jsonb_build_object(
      'version_id', 'd0000000-0000-4000-8000-000000000002',
      'typed_signature', 'ZZSENS Signature Conduct'),
    'parent_handbook', jsonb_build_object(
      'version_id', 'd0000000-0000-4000-8000-000000000003',
      'acknowledged', true));
$$;

create function public._t_kid(student uuid, program uuid, extra jsonb default '{}')
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'student_id', student,
    'has_allergies', false,
    'has_medical_needs', false,
    'has_accommodation_needs', false,
    'photo_video_permission', false,
    'selections', jsonb_build_array(jsonb_build_object('program_id', program))
  ) || extra;
$$;

create function public._t_payload(kids jsonb, docs jsonb default public._t_docs())
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'authority_affirmed', true,
    'guardian_contacts', jsonb_build_array(jsonb_build_object(
      'full_name', 'ZZSENS Guardian Name', 'phone', '555-0100',
      'email', 'zzsens.guardian@example.com', 'is_submitter', true)),
    'emergency_contacts', jsonb_build_array(jsonb_build_object(
      'full_name', 'ZZSENS Emergency Name', 'relationship', 'Aunt',
      'phone', '555-0101')),
    'pickup_persons', jsonb_build_array(jsonb_build_object(
      'full_name', 'ZZSENS Pickup Name', 'relationship', 'Grandparent')),
    'children', kids,
    'documents', docs);
$$;

-- The main multi-child payload for parent A: an existing child with allergies,
-- medical and accommodation notes, and STEP UP on an approval program (Ready
-- Set Prep, fixed Tuesday and Thursday, so no days are sent); and a new child
-- on an instant program.
create function public._t_main_a()
returns jsonb language sql immutable as $$
  select public._t_payload(jsonb_build_array(
    public._t_kid('40000000-0000-4000-8000-000000000001',
                  '10000000-0000-4000-8000-000000000009',
      jsonb_build_object(
        'has_allergies', true,
        'allergy_details', 'ZZSENS allergy detail',
        'has_medical_needs', true,
        'medical_information', 'ZZSENS medical detail',
        'has_accommodation_needs', true,
        'accommodation_information', 'ZZSENS accommodation detail',
        'step_up', jsonb_build_object('selected', true, 'reference', 'ZZSENS-STEPUP-REF'))),
    jsonb_build_object(
      'new_student', jsonb_build_object('preferred_name', 'Sample Student A3'),
      'has_allergies', false,
      'has_medical_needs', false,
      'has_accommodation_needs', false,
      'photo_video_permission', true,
      'selections', jsonb_build_array(jsonb_build_object(
        'program_id', '10000000-0000-4000-8000-000000000006')))));
$$;

grant execute on function public._t_docs() to authenticated;
grant execute on function public._t_kid(uuid, uuid, jsonb) to authenticated;
grant execute on function public._t_payload(jsonb, jsonb) to authenticated;
grant execute on function public._t_main_a() to authenticated;


-- ===========================================================================
-- 1. PRIVILEGES, RLS, CONSTRAINTS
-- ===========================================================================
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name like 'registration\_%'
      and grantee in ('anon', 'public')),
  0,
  'anon and PUBLIC hold no privilege on any registration table'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name like 'registration\_%'
      and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0,
  'authenticated holds no write privilege on any registration table'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name like 'registration\_%'
      and grantee = 'authenticated' and privilege_type = 'SELECT'),
  9,
  'authenticated can SELECT all nine registration tables (RLS decides rows)'
);
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'registration\_%'
      and c.relkind = 'r' and c.relrowsecurity),
  9,
  'RLS is enabled on all nine registration tables'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename like 'registration\_%'
      and cmd <> 'SELECT'),
  0,
  'no INSERT, UPDATE, or DELETE policy exists on any registration table'
);
select ok(
  not has_function_privilege('anon',
    'public.submit_family_registration(uuid, jsonb)', 'EXECUTE'),
  'anon cannot execute submit_family_registration'
);
select ok(
  not has_function_privilege('anon',
    'public.registration_policy_satisfied(uuid)', 'EXECUTE'),
  'anon cannot execute registration_policy_satisfied'
);
select ok(
  not has_function_privilege('authenticated',
    'private.request_enrollment_core(uuid, uuid, uuid, uuid, boolean)', 'EXECUTE'),
  'the shared enrollment core is not callable by a client role'
);

select col_has_check('public', 'registration_document_versions', 'is_sample', 'document versions: sample only');
select col_has_check('public', 'registration_submissions', 'is_sample', 'submissions: sample only');
select col_has_check('public', 'registration_children', 'is_sample', 'children: sample only');
select col_has_check('public', 'registration_child_health', 'is_sample', 'health: sample only');
select col_has_check('public', 'registration_contacts', 'is_sample', 'contacts: sample only');
select col_has_check('public', 'registration_selections', 'is_sample', 'selections: sample only');
select col_has_check('public', 'registration_step_up_requests', 'is_sample', 'STEP UP: sample only');
select col_has_check('public', 'registration_document_acceptances', 'is_sample', 'acceptances: sample only');
select col_has_check('public', 'registration_acceptance_children', 'is_sample', 'acceptance children: sample only');

select throws_ok(
  $$ insert into public.registration_document_versions
       (document_kind, version_label, title, is_sample)
     values ('parent_handbook', 'real-v1', 'Real handbook', false) $$,
  '23514', null,
  'a non-sample document version cannot be stored'
);
select throws_ok(
  $$ insert into public.registration_submissions
       (family_id, submitted_by, idempotency_key, request_fingerprint, is_sample)
     select fm.family_id, fm.user_id, gen_random_uuid(), repeat('a', 64), false
     from public.family_members fm
     where fm.user_id = '20000000-0000-4000-8000-00000000000a' $$,
  '23514', null,
  'a non-sample registration submission cannot be stored'
);

-- Drafts can never become approved policy while the lock stands.
select throws_ok(
  $$ insert into public.registration_document_versions
       (document_kind, version_label, title, status, approved_at)
     values ('liability_waiver', 'approved-v1', 'Approved waiver', 'approved', now()) $$,
  '23514', null,
  'no document version can be stored as approved (approval lock)'
);
select throws_ok(
  $$ update public.registration_document_versions
       set status = 'approved', approved_at = now()
     where id = 'd0000000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'an existing draft cannot be promoted to approved'
);
select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum e
     join pg_type t on t.oid = e.enumtypid
    where t.typname = 'step_up_verification_state'),
  array['pending_verification', 'needs_information', 'verified', 'declined', 'canceled'],
  'STEP UP has exactly the five review outcomes of DEC-028, none of them payment or enrollment'
);
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'registration_step_up_requests'
      and (column_name ~ '(pay|price|discount|amount|state_of_enrollment|confirmed)')),
  0,
  'the STEP UP table carries no payment, price, discount, or confirmation column'
);


-- ===========================================================================
-- 2. ANONYMOUS
-- ===========================================================================
set local role anon;

select throws_ok(
  $$ select count(*) from public.registration_submissions $$,
  '42501', null,
  'anon cannot read registration submissions'
);
select throws_ok(
  $$ select count(*) from public.registration_child_health $$,
  '42501', null,
  'anon cannot read registration health records'
);
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, '{}'::jsonb) $$, :'key_a1'),
  '42501', null,
  'anon cannot submit a registration'
);

reset role;


-- ===========================================================================
-- 3. PARENT A — the multi-child submission
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ insert into public.registration_submissions
       (family_id, submitted_by, idempotency_key, request_fingerprint)
     values (gen_random_uuid(), '20000000-0000-4000-8000-00000000000a',
             gen_random_uuid(), repeat('a', 64)) $$,
  '42501', null,
  'a parent cannot insert a registration directly'
);

create temp table _t_first on commit drop as
  select * from public.submit_family_registration(:'key_a1', public._t_main_a());

select is((select outcome from _t_first), 'submitted',
  'a two-child submission is accepted');

select is(
  (select count(*)::int from public.registration_children c
    join _t_first f on f.registration_id = c.registration_id),
  2, 'both children are recorded in one submission');
select is(
  (select count(*)::int from public.students
    where family_id = (select family_id from public.family_members
                        where user_id = '20000000-0000-4000-8000-00000000000a')),
  3, 'the new child was created as an ordinary student, once');
select is(
  (select count(*)::int from public.registration_children c
    join _t_first f on f.registration_id = c.registration_id
   where c.created_student),
  1, 'exactly one child is marked as created by this submission');

-- One enrollment authority: each selection points at an enrollment whose state
-- the shared evaluation set.
select is(
  (select array_agg(e.state::text order by e.state::text)
     from public.registration_selections s
     join public.enrollments e on e.id = s.enrollment_id
     join _t_first f on f.registration_id = s.registration_id),
  array['approval_pending', 'started'],
  'selections create enrollments through the approved evaluation');
select is(
  (select attendance_days::text[] from public.registration_selections s
     join _t_first f on f.registration_id = s.registration_id
    where s.program_id = :'p_approval'),
  array['tuesday', 'thursday'],
  'a fixed program stores its configured days, ordered, as evidence');

-- Allergy Yes/No.
select is(
  (select array_agg(h.has_allergies::text || ':' || (h.allergy_details is not null)::text
                    order by h.has_allergies)
     from public.registration_child_health h
     join _t_first f on f.registration_id = h.registration_id),
  array['false:false', 'true:true'],
  'allergy details exist exactly when the answer is Yes');

-- STEP UP.
select is(
  (select array_agg(verification_state::text) from public.registration_step_up_requests s
     join _t_first f on f.registration_id = s.registration_id),
  array['pending_verification'],
  'the STEP UP request is pending verification');
select is(
  (select e.state::text from public.registration_step_up_requests su
     join public.registration_selections s on s.registration_child_id = su.registration_child_id
     join public.enrollments e on e.id = s.enrollment_id
     join _t_first f on f.registration_id = su.registration_id),
  'approval_pending',
  'STEP UP on an approval program is approval_pending, never further');

-- Acceptance evidence.
select is(
  (select acceptance_method::text || ':' || coalesce(typed_signature, '<none>')
     from public.registration_document_acceptances a
     join _t_first f on f.registration_id = a.registration_id
    where a.document_kind = 'parent_handbook'),
  'acknowledgment:<none>',
  'the Parent Handbook is acknowledged, not signed');
select is(
  (select acceptance_method::text || ':' || signer_user_id::text
     from public.registration_document_acceptances a
     join _t_first f on f.registration_id = a.registration_id
    where a.document_kind = 'code_of_conduct'),
  'signature:20000000-0000-4000-8000-00000000000a',
  'the Code of Conduct is signed by the submitting parent');
select is(
  (select count(*)::int from public.registration_document_acceptances a
     join _t_first f on f.registration_id = a.registration_id
    where a.document_status_at_acceptance = 'draft'
      and a.accepted_at is not null
      and a.document_version_id in (:'doc_waiver', :'doc_conduct', :'doc_handbook')),
  3,
  'every acceptance keeps its document version, its status then, and its time');
select is(
  (select count(*)::int from public.registration_acceptance_children ac
     join _t_first f on f.registration_id = ac.registration_id),
  6,
  'every acceptance records both affected children');
select is(
  public.registration_policy_satisfied((select registration_id from _t_first)),
  false,
  'draft acceptances never satisfy registration policy');

-- Retries.
select is(
  (select outcome || ':' || (registration_id = (select registration_id from _t_first))::text
     from public.submit_family_registration(:'key_a1', public._t_main_a())),
  'replayed:true',
  'the same key and payload replays the original submission');
select is(
  (select outcome from public.submit_family_registration(
     :'key_a1', jsonb_set(public._t_main_a(), '{authority_affirmed}', 'false'))),
  'idempotency_conflict',
  'the same key with a different payload is a conflict, not a replay');
select is(
  (select outcome from public.submit_family_registration(:'key_a2', public._t_main_a())),
  'blocked_duplicate',
  'a fresh key for the same children and programs is a duplicate');
select is(
  (select count(*)::int from public.registration_submissions), 1,
  'retries wrote no second submission');
select is(
  (select count(*)::int from public.registration_selections), 2,
  'retries wrote no second selection');
select is(
  (select count(*)::int from public.registration_document_acceptances), 3,
  'retries wrote no second acceptance');
select is(
  (select count(*)::int from public.students
    where lower(preferred_name) = 'sample student a3'),
  1, 'retries created no second child');


-- ===========================================================================
-- 4. ATOMICITY — a blocked second child rolls back the first
-- ===========================================================================
create temp table _t_before on commit drop as select
  (select count(*) from public.registration_submissions) as subs,
  (select count(*) from public.registration_children) as kids,
  (select count(*) from public.registration_child_health) as health,
  (select count(*) from public.registration_contacts) as contacts,
  (select count(*) from public.registration_selections) as sels,
  (select count(*) from public.registration_step_up_requests) as stepups,
  (select count(*) from public.registration_document_acceptances) as accs,
  (select count(*) from public.enrollments) as enrollments,
  (select count(*) from public.students) as students;

select is(
  (select outcome || ':' || blocker_child_index::text || ':' || blocker_program_id::text
     from public.submit_family_registration(:'key_a3', public._t_payload(jsonb_build_array(
       jsonb_build_object(
         'new_student', jsonb_build_object('preferred_name', 'Sample Student A4'),
         'has_allergies', false, 'has_medical_needs', false,
         'has_accommodation_needs', false, 'photo_video_permission', false,
         'step_up', jsonb_build_object('selected', true),
         'selections', jsonb_build_array(jsonb_build_object('program_id', :'p_approval'))),
       public._t_kid(:'student_a2', :'p_full'))))),
  'blocked_full:1:' || :'p_full',
  'a full program on the second child blocks the submission and names it');

select is(
  (select row(
     (select count(*) from public.registration_submissions),
     (select count(*) from public.registration_children),
     (select count(*) from public.registration_child_health),
     (select count(*) from public.registration_contacts),
     (select count(*) from public.registration_selections),
     (select count(*) from public.registration_step_up_requests),
     (select count(*) from public.registration_document_acceptances),
     (select count(*) from public.enrollments),
     (select count(*) from public.students))::text),
  (select row(subs, kids, health, contacts, sels, stepups, accs, enrollments, students)::text
     from _t_before),
  'nothing from the blocked submission survives: no child, enrollment, or evidence');


-- ===========================================================================
-- 5. REFUSALS — shape, smuggled fields, authority, documents
-- ===========================================================================
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    jsonb_set(public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant'))),
              '{documents,parent_handbook,typed_signature}', '"ZZSENS Handbook Sig"')),
  '22023', 'invalid registration payload: documents.parent_handbook has an unknown field',
  'a signature on the handbook is refused: acknowledgment only');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant')))
      #- '{documents,code_of_conduct,typed_signature}'),
  '22023', 'invalid registration payload: documents.code_of_conduct.typed_signature',
  'the Code of Conduct cannot be accepted without a signature');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant',
      '{"has_allergies": false, "allergy_details": "ZZSENS contradicting detail"}')))),
  '22023', 'invalid registration payload: children[0].allergy_details',
  'allergy details with a No answer are refused, and the value is not echoed');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant',
      '{"has_allergies": true}')))),
  '22023', 'invalid registration payload: children[0].allergy_details',
  'a Yes allergy answer without details is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant',
      '{"has_allergies": "yes"}')))),
  '22023', null,
  'allergy status must be an explicit boolean');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant')))
      || '{"family_id": "00000000-0000-4000-8000-000000000000"}'),
  '22023', 'invalid registration payload: payload has an unknown field',
  'a client-supplied family id is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant',
      '{"state": "confirmed", "payment_state": "paid"}')))),
  '22023', 'invalid registration payload: children[0] has an unknown field',
  'a client-supplied enrollment or payment state is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant',
      '{"step_up": {"selected": true, "verification_state": "verified"}}')))),
  '22023', 'invalid registration payload: children[0].step_up has an unknown field',
  'a client-supplied STEP UP verification state is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4',
    public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant')))
      || '{"role": "admin"}'),
  '22023', null,
  'a client-supplied role is refused');
select is(
  (select outcome from public.submit_family_registration(:'key_a4',
     jsonb_set(public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant'))),
               '{authority_affirmed}', 'false'))),
  'blocked_authority',
  'without guardian authority nothing is recorded (MPS-RUL-008)');
select is(
  (select outcome from public.submit_family_registration(:'key_a4',
     jsonb_set(public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant'))),
               '{documents,liability_waiver,version_id}',
               '"d0000000-0000-4000-8000-0000000000ff"'))),
  'blocked_document_version_stale',
  'a document version other than the one presented is refused');
select is(
  (select count(*)::int from public.registration_submissions), 1,
  'no refusal wrote a submission');

-- Evidence is immutable, even to the owning parent (who has no UPDATE anyway).
select throws_ok(
  $$ update public.registration_child_health set medical_information = null $$,
  '42501', null,
  'a parent cannot modify registration evidence');

reset role;


-- ===========================================================================
-- 6. DIRECT-WRITE DEFENCES (as the table owner)
-- ===========================================================================
select throws_ok(
  $$ update public.registration_children set photo_video_permission = true $$,
  '55000', 'registration evidence is immutable',
  'registration evidence cannot be updated even by the owner role');
select throws_ok(
  $$ insert into public.registration_child_health
       (registration_child_id, registration_id, has_allergies, allergy_details,
        has_medical_needs, has_accommodation_needs)
     select c.id, c.registration_id, false, 'x', false, false
     from public.registration_children c limit 1 $$,
  '23514', null,
  'the allergy Yes/No constraint holds below the function');
select throws_ok(
  $$ insert into public.registration_document_acceptances
       (registration_id, document_version_id, document_kind, acceptance_method,
        signer_user_id, typed_signature, document_status_at_acceptance)
     select r.id, 'd0000000-0000-4000-8000-000000000002', 'code_of_conduct',
            'signature', '20000000-0000-4000-8000-00000000000b', 'Someone else', 'draft'
     from public.registration_submissions r limit 1 $$,
  '23514', 'acceptance signer must be a parent or guardian in the registration''s family',
  'a parent from another family cannot sign the Code of Conduct');
select throws_ok(
  $$ insert into public.registration_document_acceptances
       (registration_id, document_version_id, document_kind, acceptance_method,
        signer_user_id, typed_signature, document_status_at_acceptance)
     select r.id, 'd0000000-0000-4000-8000-000000000003', 'parent_handbook',
            'signature', r.submitted_by, 'A signature', 'draft'
     from public.registration_submissions r limit 1 $$,
  '23514', null,
  'a handbook acceptance cannot be stored as a signature');


-- ===========================================================================
-- 7. PARENT B — cross-family and STEP UP on other paths
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is((select count(*)::int from public.registration_submissions), 0,
  'parent B reads none of family A''s submissions');
select is((select count(*)::int from public.registration_child_health), 0,
  'parent B reads none of family A''s health records');
select is((select count(*)::int from public.registration_contacts), 0,
  'parent B reads none of family A''s contacts');
select is((select count(*)::int from public.registration_step_up_requests), 0,
  'parent B reads none of family A''s STEP UP requests');
select is(
  (select (select count(*) from public.registration_children)
        + (select count(*) from public.registration_selections)
        + (select count(*) from public.registration_document_acceptances)
        + (select count(*) from public.registration_acceptance_children))::int,
  0,
  'parent B reads none of family A''s children, selections, or acceptances');
select is((select count(*)::int from public.registration_document_versions), 3,
  'a parent reads the three presented document versions');

select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_b1', public._t_payload(jsonb_build_array(public._t_kid(:'student_a1', :'p_instant')))),
  '42501', 'not authorized',
  'parent B cannot register family A''s child');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_b1', public._t_payload(jsonb_build_array(
      public._t_kid('40000000-0000-4000-8000-0000000000ff', :'p_instant')))),
  '42501', 'not authorized',
  'a nonexistent child is refused identically');

create temp table _t_b on commit drop as
  select * from public.submit_family_registration(:'key_b1', public._t_payload(jsonb_build_array(
    public._t_kid(:'student_b1', :'p_instant',
      '{"step_up": {"selected": true}}'),
    jsonb_build_object(
      'new_student', jsonb_build_object('preferred_name', 'Sample Student B2'),
      'has_allergies', false, 'has_medical_needs', false,
      'has_accommodation_needs', false, 'photo_video_permission', false,
      'step_up', jsonb_build_object('selected', true),
      'selections', jsonb_build_array(jsonb_build_object('program_id', :'p_waitlist'))))));

select is((select outcome from _t_b), 'submitted', 'parent B submits for their own family');
select is(
  (select array_agg(e.state::text order by e.state::text)
     from public.registration_step_up_requests su
     join public.registration_selections s on s.registration_child_id = su.registration_child_id
     join public.enrollments e on e.id = s.enrollment_id
     join _t_b b on b.registration_id = su.registration_id),
  array['approval_pending', 'waitlisted'],
  'STEP UP on an instant program is approval_pending (no checkout) and on a full one waitlisted: never more');
select is((select count(*)::int from public.registration_submissions), 1,
  'parent B reads only their own submission');

reset role;


-- ===========================================================================
-- 8. STEP UP NEVER IMPLIES PAYMENT OR CONFIRMATION
-- ===========================================================================
select is(
  (select count(*)::int from public.registration_step_up_requests su
     join public.registration_selections s on s.registration_child_id = su.registration_child_id
     join public.enrollments e on e.id = s.enrollment_id
    where e.state in ('confirmed', 'payment_pending', 'payment_failed', 'canceled')),
  0,
  'no STEP UP selection produced a confirmed or payment state');
select is(
  (select count(*)::int from public.registration_step_up_requests
    where verification_state <> 'pending_verification'),
  0,
  'every STEP UP request is pending verification');


-- ===========================================================================
-- 9. AUDIT — attributable, value-free
-- ===========================================================================
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'registration' and action = 'submitted'),
  2,
  'each accepted submission has exactly one audit event (blocked ones none)');
select is(
  (select actor_user_id::text from public.audit_events
    where entity_type = 'registration'
      and entity_id = (select registration_id from _t_first)),
  '20000000-0000-4000-8000-00000000000a',
  'the registration audit event is attributed to the submitting parent');
select is(
  (select count(*)::int from public.audit_events
    where occurred_at = now()
      and changed_fields::text ~* '(zzsens|555-01|sample student a3|sample student b2)'),
  0,
  'no audit payload contains a submitted name, phone, email, health text, signature, or reference');
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'registration'
      and changed_fields ?| array['request_fingerprint', 'reference', 'typed_signature',
                                  'allergy_details', 'full_name', 'phone']),
  0,
  'registration audit payloads carry no sensitive field keys');


-- ===========================================================================
-- 10. EDUCATOR — nothing sensitive, roster unchanged
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select is(
  (select (select count(*) from public.registration_submissions)
        + (select count(*) from public.registration_children)
        + (select count(*) from public.registration_selections)
        + (select count(*) from public.registration_document_acceptances)
        + (select count(*) from public.registration_acceptance_children)
        + (select count(*) from public.registration_document_versions))::int,
  0,
  'an educator reads no registration record or document');
select is(
  (select (select count(*) from public.registration_child_health)
        + (select count(*) from public.registration_contacts)
        + (select count(*) from public.registration_step_up_requests))::int,
  0,
  'an educator reads no health, contact, pickup, or STEP UP information');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4', public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant')))),
  '42501', null,
  'an educator cannot submit a registration');

reset role;

select is(
  (select string_agg(column_name::text, ',' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'educator_roster_students'),
  'program_id,preferred_name',
  'the educator roster view still exposes only program and preferred name');
select is(
  (select string_agg(column_name::text, ',' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'educator_session_roster'),
  'session_id,enrollment_id,preferred_name,attended',
  'the educator session roster view is unchanged');
select is(
  (select count(*)::int from pg_views
    where schemaname = 'public'
      and viewname in ('educator_roster_students', 'educator_session_roster')
      and definition ~ 'registration_'),
  0,
  'no educator roster view reads a registration table');


-- ===========================================================================
-- 11. ADMINISTRATOR — read-only operational access
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

select is((select count(*)::int from public.registration_submissions), 2,
  'an administrator reads every submission');
select is((select count(*)::int from public.registration_child_health), 4,
  'an administrator reads health records (sample data, read-only)');
select is((select count(*)::int from public.registration_step_up_requests), 3,
  'an administrator reads STEP UP requests for verification');
select throws_ok(
  $$ delete from public.registration_contacts $$,
  '42501', null,
  'an administrator cannot delete registration contacts');
select throws_ok(
  $$ update public.registration_step_up_requests set reference = null $$,
  '42501', null,
  'an administrator cannot change a STEP UP request directly');
select throws_ok(
  $$ insert into public.registration_document_versions (document_kind, version_label, title)
     values ('parent_handbook', 'admin-v1', 'Admin handbook') $$,
  '42501', null,
  'an administrator cannot create a document version through the Data API');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$,
    :'key_a4', public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant')))),
  '42501', null,
  'an administrator cannot submit a registration on a family''s behalf');

reset role;


-- ===========================================================================
-- 12. DOCUMENTS UNAVAILABLE
-- ===========================================================================
update public.registration_document_versions set status = 'retired'
  where id = 'd0000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select outcome from public.submit_family_registration(:'key_a4',
     public._t_payload(jsonb_build_array(public._t_kid(:'student_a2', :'p_instant'))))),
  'blocked_documents_unavailable',
  'with no presented handbook version, nothing can be accepted');
select is(
  (select count(*)::int from public.registration_document_versions
    where id = 'd0000000-0000-4000-8000-000000000003'),
  0,
  'a parent no longer reads a retired document version');

reset role;

select * from finish();
rollback;
