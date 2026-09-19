-- Slice 2.5 — registration policy and design readiness
-- (DEC-026, DEC-027, DEC-028, DEC-032; MPS-RUL-003/006/008; MPS-REQ-004/012/
--  014/017/018/024; MPS-ACC-005/018/019/028/029; EXC-002)
-- Prompt: prompts/registration-readiness.md §10
--
-- WHAT THIS FILE PROVES
--
--   1. Required information: guardian phone, at least one emergency contact and
--      one pickup person, explicit allergy/medical/accommodation answers, and
--      details exactly after Yes. A failure anywhere writes nothing.
--   2. Attendance days are validated against the structured configuration:
--      Haven Days plans, Tutoring's available days, fixed-day programs, and
--      unconfigured programs.
--   3. STEP UP skips checkout (approval_pending, never started), and its
--      review outcomes move only along the approved transitions, only by an
--      administrator, idempotently, with value-free audit, and without touching
--      any enrollment.
--   4. The assigned educator receives only the safety subset, for confirmed
--      children in an assigned program, from the latest registration; every
--      other caller is refused identically; no educator reaches a restricted
--      table directly.
--
-- Fixture markers: values an educator MAY see carry ZZALLERGY, ZZEMERG, or
-- ZZPICKUP. Values an educator must NEVER see carry ZZGUARD, ZZMED, ZZACC,
-- ZZREF, or ZZSIG, and the guardian phone is 555-0199.

begin;
create extension if not exists pgtap with schema extensions;

select plan(112);

\set parent_a  '20000000-0000-4000-8000-00000000000a'
\set parent_b  '20000000-0000-4000-8000-00000000000b'
\set educator  '20000000-0000-4000-8000-00000000000e'
\set admin     '20000000-0000-4000-8000-000000000ad0'

\set student_a1 '40000000-0000-4000-8000-000000000001'
\set student_a2 '40000000-0000-4000-8000-000000000002'
\set student_b1 '40000000-0000-4000-8000-000000000003'

\set p_haven     '10000000-0000-4000-8000-000000000002'
\set p_tutoring  '10000000-0000-4000-8000-00000000000c'
\set p_gardening '10000000-0000-4000-8000-000000000006'
\set p_sewing    '10000000-0000-4000-8000-000000000005'
\set p_crochet   '10000000-0000-4000-8000-00000000000e'
\set p_clubs     '10000000-0000-4000-8000-00000000000d'
\set p_artlab    '10000000-0000-4000-8000-000000000004'
\set p_draft     '10000000-0000-4000-8000-0000000000ff'

\set key_r1 'e1000000-0000-4000-8000-0000000000a1'
\set key_r2 'e1000000-0000-4000-8000-0000000000a2'
\set key_r3 'e1000000-0000-4000-8000-0000000000a3'
\set key_r4 'e1000000-0000-4000-8000-0000000000a4'
\set key_rx 'e1000000-0000-4000-8000-0000000000ff'


-- ---------------------------------------------------------------------------
-- Payload builders (rolled back with the transaction)
-- ---------------------------------------------------------------------------
create function public._r_payload(kids jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'authority_affirmed', true,
    'guardian_contacts', jsonb_build_array(jsonb_build_object(
      'full_name', 'ZZGUARD Guardian', 'phone', '555-0199', 'is_submitter', true)),
    'emergency_contacts', jsonb_build_array(jsonb_build_object(
      'full_name', 'ZZEMERG Contact', 'relationship', 'Aunt', 'phone', '555-0102')),
    'pickup_persons', jsonb_build_array(jsonb_build_object(
      'full_name', 'ZZPICKUP Person', 'relationship', 'Grandparent', 'phone', '555-0103')),
    'children', kids,
    'documents', jsonb_build_object(
      'liability_waiver', jsonb_build_object(
        'version_id', 'd0000000-0000-4000-8000-000000000001', 'typed_signature', 'ZZSIG Waiver'),
      'code_of_conduct', jsonb_build_object(
        'version_id', 'd0000000-0000-4000-8000-000000000002', 'typed_signature', 'ZZSIG Conduct'),
      'parent_handbook', jsonb_build_object(
        'version_id', 'd0000000-0000-4000-8000-000000000003', 'acknowledged', true)));
$$;

create function public._r_sel(program uuid, days jsonb default null, plan integer default null)
returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'program_id', program, 'attendance_days', days, 'plan_days_per_week', plan));
$$;

create function public._r_answers()
returns jsonb language sql immutable as $$
  select jsonb_build_object('has_allergies', false, 'has_medical_needs', false,
                            'has_accommodation_needs', false,
                            'photo_video_permission', false);
$$;

create function public._r_kid(student uuid, sel jsonb, extra jsonb default '{}')
returns jsonb language sql immutable as $$
  select jsonb_build_object('student_id', student, 'selections', jsonb_build_array(sel))
         || public._r_answers() || extra;
$$;

create function public._r_new(name text, sel jsonb, extra jsonb default '{}')
returns jsonb language sql immutable as $$
  select jsonb_build_object('new_student', jsonb_build_object('preferred_name', name),
                            'selections', jsonb_build_array(sel))
         || public._r_answers() || extra;
$$;

create function public._r_one(sel jsonb, extra jsonb default '{}')
returns jsonb language sql immutable as $$
  select public._r_payload(jsonb_build_array(
    public._r_kid('40000000-0000-4000-8000-000000000001', sel, extra)));
$$;

grant execute on function public._r_payload(jsonb) to authenticated;
grant execute on function public._r_sel(uuid, jsonb, integer) to authenticated;
grant execute on function public._r_answers() to authenticated;
grant execute on function public._r_kid(uuid, jsonb, jsonb) to authenticated;
grant execute on function public._r_new(text, jsonb, jsonb) to authenticated;
grant execute on function public._r_one(jsonb, jsonb) to authenticated;

create function public._r_counts()
returns text language sql stable security definer set search_path = '' as $$
  select row(
    (select count(*) from public.registration_submissions),
    (select count(*) from public.registration_children),
    (select count(*) from public.registration_child_health),
    (select count(*) from public.registration_contacts),
    (select count(*) from public.registration_selections),
    (select count(*) from public.registration_step_up_requests),
    (select count(*) from public.registration_document_acceptances),
    (select count(*) from public.enrollments),
    (select count(*) from public.students))::text;
$$;
grant execute on function public._r_counts() to authenticated;


-- ===========================================================================
-- 1. SCHEMA
-- ===========================================================================
select col_not_null('public', 'registration_child_health', 'has_medical_needs',
  'the medical-needs answer is required');
select col_not_null('public', 'registration_child_health', 'has_accommodation_needs',
  'the accommodation-needs answer is required');
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename like 'registration\_%'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~* 'educator'),
  0,
  'no policy on any registration table grants an educator anything');
select ok(
  not has_function_privilege('anon', 'public.educator_child_safety(uuid)', 'EXECUTE'),
  'anon cannot execute educator_child_safety');
select ok(
  not has_function_privilege('anon', 'public.admin_set_step_up_state(uuid, public.step_up_verification_state, public.step_up_verification_state)', 'EXECUTE'),
  'anon cannot execute admin_set_step_up_state');
select is(
  pg_get_function_result('public.educator_child_safety(uuid)'::regprocedure),
  'TABLE(enrollment_id uuid, preferred_name text, safety_on_file boolean, '
  'has_allergies boolean, allergy_details text, emergency_contacts jsonb, '
  'pickup_persons jsonb, recorded_at timestamp with time zone)',
  'the educator safety result carries exactly the approved subset');
select is(
  (select string_agg(p.name || '=' || r.selection_mode::text, ',' order by p.name)
     from public.program_attendance_rules r join public.programs p on p.id = r.program_id),
  'Crochet=fixed,Gardening=fixed,Haven Days=family_selects,Monthly Clubs=fixed,'
  'Ready Set Learn=fixed,Ready Set Prep=fixed,Ready Set Sensory=fixed,Sewing=fixed,'
  'Tutoring=family_selects',
  'every verified program has an attendance rule of the approved mode');
select is(
  (select array_agg(days_per_week::int order by days_per_week)
     from public.program_attendance_plans where program_id = :'p_haven'),
  array[1, 2, 3],
  'Haven Days offers one-, two-, and three-day plans');
select throws_ok(
  format($$ insert into public.program_attendance_plans (program_id, days_per_week)
            values (%L, 1) $$, :'p_gardening'),
  '23503', null,
  'a fixed-day program cannot carry a plan');
select throws_ok(
  $$ insert into public.registration_child_health
       (registration_child_id, registration_id, has_allergies,
        has_medical_needs, has_accommodation_needs)
     values (gen_random_uuid(), gen_random_uuid(), false, true, false) $$,
  '23514', null,
  'a Yes medical answer without details is refused below the function');


-- ===========================================================================
-- 2. ANON and the public attendance configuration
-- ===========================================================================
-- A rule on an archived program must stay invisible to visitors.
insert into public.program_attendance_rules (program_id, selection_mode)
  values (:'p_artlab', 'fixed');

set local role anon;
select is((select count(*)::int from public.program_attendance_rules), 9,
  'anon reads attendance rules for published programs only');
select is((select count(*)::int from public.program_attendance_days
            where program_id = :'p_haven'), 3,
  'anon reads Haven Days'' available days');
select throws_ok(
  format($$ insert into public.program_attendance_days (program_id, day) values (%L, 'friday') $$,
         :'p_haven'),
  '42501', null,
  'anon cannot write attendance configuration');
select throws_ok(
  format($$ select * from public.educator_child_safety(%L) $$, :'p_tutoring'),
  '42501', null,
  'anon cannot reach educator safety data');
reset role;

delete from public.program_attendance_rules where program_id = :'p_artlab';


-- ===========================================================================
-- 3. PARENT A — required information (DEC-026)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening')) #- '{guardian_contacts,0,phone}'),
  '22023', 'invalid registration payload: guardian_contacts[0].phone',
  'the parent or guardian phone is required');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    jsonb_set(public._r_one(public._r_sel(:'p_gardening')), '{emergency_contacts}', '[]')),
  '22023', 'invalid registration payload: payload.emergency_contacts',
  'at least one emergency contact is required');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening')) - 'emergency_contacts'),
  '22023', 'invalid registration payload: payload.emergency_contacts',
  'an omitted emergency contact list is refused the same way');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    jsonb_set(public._r_one(public._r_sel(:'p_gardening')), '{pickup_persons}', '[]')),
  '22023', 'invalid registration payload: payload.pickup_persons',
  'at least one approved pickup person is required');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening')) #- '{children,0,has_allergies}'),
  '22023', 'invalid registration payload: children[0].has_allergies',
  'an unanswered allergy question is refused, never read as No');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening')) #- '{children,0,has_medical_needs}'),
  '22023', 'invalid registration payload: children[0].has_medical_needs',
  'an unanswered medical-needs question is refused, never read as No');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening'), '{"has_medical_needs": null}')),
  '22023', 'invalid registration payload: children[0].has_medical_needs',
  'a null medical-needs answer is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening')) #- '{children,0,has_accommodation_needs}'),
  '22023', 'invalid registration payload: children[0].has_accommodation_needs',
  'an unanswered accommodation-needs question is refused, never read as No');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening'), '{"has_medical_needs": true}')),
  '22023', 'invalid registration payload: children[0].medical_information',
  'medical details are required after Yes');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening'),
                  '{"medical_information": "ZZMED contradicting detail"}')),
  '22023', 'invalid registration payload: children[0].medical_information',
  'medical details after No are refused, and the value is not echoed');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening'), '{"has_accommodation_needs": true}')),
  '22023', 'invalid registration payload: children[0].accommodation_information',
  'accommodation details are required after Yes');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening'),
                  '{"accommodation_information": "ZZACC contradicting detail"}')),
  '22023', 'invalid registration payload: children[0].accommodation_information',
  'accommodation details after No are refused');

-- Atomic: a valid first child and an invalid second child write nothing.
create temp table _r_before on commit drop as select public._r_counts() as c;
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_payload(jsonb_build_array(
      public._r_new('Sample Student R0', public._r_sel(:'p_gardening')),
      public._r_kid(:'student_a2', public._r_sel(:'p_sewing'),
                    '{"has_accommodation_needs": true}')))),
  '22023', 'invalid registration payload: children[1].accommodation_information',
  'a second child''s missing detail refuses the whole submission');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_payload(jsonb_build_array(
      public._r_new('Sample Student R0', public._r_sel(:'p_gardening')),
      public._r_kid(:'student_a2', public._r_sel(:'p_haven', '["monday"]', 1))))),
  '22023', 'invalid registration payload: children[1].selections[0].attendance_days',
  'a second child''s unavailable day refuses the whole submission');
select is(public._r_counts(), (select c from _r_before),
  'nothing from either refused submission survives: no child, student, enrollment, or evidence');


-- ===========================================================================
-- 4. PARENT A — attendance days (DEC-032)
-- ===========================================================================
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_haven', '["tuesday","wednesday","thursday"]', 2))),
  '22023', 'invalid registration payload: children[0].selections[0].attendance_days',
  'Haven Days: three days on a two-day plan are refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_haven', '["tuesday"]', 2))),
  '22023', 'invalid registration payload: children[0].selections[0].attendance_days',
  'Haven Days: one day on a two-day plan is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_haven', '["tuesday","tuesday"]', 2))),
  '22023', 'invalid registration payload: children[0].selections[0].attendance_days',
  'Haven Days: a repeated day is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_haven', '["monday"]', 1))),
  '22023', 'invalid registration payload: children[0].selections[0].attendance_days',
  'Haven Days: Monday is not an available day');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_haven', '["tuesday"]'))),
  '22023', 'invalid registration payload: children[0].selections[0].plan_days_per_week',
  'Haven Days: a selection without a plan is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_haven', '["tuesday","wednesday","thursday","friday"]', 4))),
  '22023', null,
  'Haven Days: an unconfigured four-day plan is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(jsonb_build_object('program_id', :'p_haven',
      'attendance_days', '["tuesday"]'::jsonb, 'plan_days_per_week', '1'))),
  '22023', 'invalid registration payload: children[0].selections[0].plan_days_per_week',
  'a plan must be a number, not text');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_tutoring', '["friday"]'))),
  '22023', 'invalid registration payload: children[0].selections[0].attendance_days',
  'Tutoring: a day it is not offered is refused');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_tutoring', '[]'))),
  '22023', 'invalid registration payload: children[0].selections[0].attendance_days',
  'Tutoring: at least one day is required');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_tutoring', '["tuesday"]', 1))),
  '22023', 'invalid registration payload: children[0].selections[0].plan_days_per_week',
  'Tutoring: there is no plan to choose');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening', '["thursday"]'))),
  '22023', 'invalid registration payload: children[0].selections[0].attendance_days',
  'a fixed-day program refuses any day choice, even its own day');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening', '["monday"]'))),
  '22023', 'invalid registration payload: children[0].selections[0].attendance_days',
  'a fixed-day program refuses an arbitrary day');
select throws_ok(
  format($$ select * from public.submit_family_registration(%L, %L::jsonb) $$, :'key_rx',
    public._r_one(public._r_sel(:'p_gardening', null, 1))),
  '22023', 'invalid registration payload: children[0].selections[0].plan_days_per_week',
  'a fixed-day program refuses a plan');

create temp table _r3 on commit drop as
  select * from public.submit_family_registration(:'key_r3', public._r_payload(jsonb_build_array(
    public._r_new('Sample Student R1', public._r_sel(:'p_haven', '["wednesday"]', 1)),
    public._r_new('Sample Student R2',
                  public._r_sel(:'p_haven', '["thursday","tuesday","wednesday"]', 3)),
    public._r_new('Sample Student R3', public._r_sel(:'p_tutoring', '["thursday","tuesday"]')))));

select is((select outcome from _r3), 'submitted',
  'valid Haven Days plans and a Tutoring subset are accepted');
select is(
  (select string_agg(st.preferred_name || ':' || coalesce(s.plan_days_per_week::text, '-')
                     || ':' || array_to_string(s.attendance_days, '+'),
                     ', ' order by st.preferred_name)
     from public.registration_selections s
     join public.registration_children c on c.id = s.registration_child_id
     join public.students st on st.id = c.student_id
     join _r3 r on r.registration_id = s.registration_id),
  'Sample Student R1:1:wednesday, Sample Student R2:3:tuesday+wednesday+thursday, '
  'Sample Student R3:-:tuesday+thursday',
  'plans and chosen days are stored, ordered');

-- A published program with no rule.
reset role;
delete from public.program_attendance_rules where program_id = :'p_crochet';
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

create temp table _r_before2 on commit drop as select public._r_counts() as c;
select is(
  (select outcome || ':' || blocker_child_index::text || ':' || blocker_program_id::text
     from public.submit_family_registration(:'key_rx', public._r_payload(jsonb_build_array(
       public._r_new('Sample Student R0', public._r_sel(:'p_gardening')),
       public._r_new('Sample Student R7', public._r_sel(:'p_crochet')))))),
  'blocked_attendance_unconfigured:1:' || :'p_crochet',
  'a published program without attendance configuration blocks and is named');
select is(
  (select outcome from public.submit_family_registration(:'key_rx', public._r_payload(
     jsonb_build_array(public._r_new('Sample Student R8', public._r_sel(:'p_artlab')))))),
  'blocked_unavailable',
  'an archived program is still simply unavailable');
select is(public._r_counts(), (select c from _r_before2),
  'neither blocked submission wrote anything');

reset role;


-- ===========================================================================
-- 5. ADMINISTRATOR — attendance configuration door
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

select is(
  public.admin_set_program_attendance(:'p_crochet', 'fixed', array['monday']::public.attendance_day[]),
  'updated', 'an administrator configures a fixed day');
select is(
  public.admin_set_program_attendance(:'p_crochet', 'fixed', array['monday']::public.attendance_day[]),
  'unchanged', 'the same configuration again is unchanged');
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'program' and entity_id = :'p_crochet'
      and action = 'attendance_configured' and actor_user_id = :'admin'),
  1, 'the change is audited once, attributed to the administrator');
select throws_ok(
  format($$ select public.admin_set_program_attendance(%L, 'fixed', array['monday']::public.attendance_day[], array[1]::smallint[]) $$, :'p_crochet'),
  '22023', 'a fixed-day program has no plans',
  'a fixed-day program cannot be given plans');
select throws_ok(
  format($$ select public.admin_set_program_attendance(%L, 'family_selects', array['tuesday','wednesday']::public.attendance_day[], array[3]::smallint[]) $$, :'p_crochet'),
  '22023', 'a plan cannot need more days than the program offers',
  'a plan cannot exceed the available days');
select throws_ok(
  format($$ select public.admin_set_program_attendance(%L, 'fixed', array[]::public.attendance_day[]) $$, :'p_crochet'),
  '22023', 'attendance needs a mode and at least one day',
  'at least one day is required');
select throws_ok(
  format($$ select public.admin_set_program_attendance(%L, 'fixed', array['monday','monday']::public.attendance_day[]) $$, :'p_crochet'),
  '22023', 'each attendance day may be listed once',
  'a day may be listed once');
select throws_ok(
  $$ select public.admin_set_program_attendance('10000000-0000-4000-8000-0000000000aa', 'fixed', array['monday']::public.attendance_day[]) $$,
  'P0002', 'program not found',
  'an unknown program is reported as not found');
select throws_ok(
  format($$ insert into public.program_attendance_days (program_id, day) values (%L, 'friday') $$,
         :'p_haven'),
  '42501', null,
  'an administrator cannot write configuration directly');

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  format($$ select public.admin_set_program_attendance(%L, 'fixed', array['friday']::public.attendance_day[]) $$, :'p_crochet'),
  '42501', 'not authorized',
  'a parent cannot configure attendance');
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok(
  format($$ select public.admin_set_program_attendance(%L, 'fixed', array['friday']::public.attendance_day[]) $$, :'p_tutoring'),
  '42501', 'not authorized',
  'an educator cannot configure attendance, even for an assigned program');
reset role;


-- ===========================================================================
-- 6. PARENT A — STEP UP skips checkout (DEC-028)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

create temp table _r4 on commit drop as
  select * from public.submit_family_registration(:'key_r4', public._r_payload(jsonb_build_array(
    public._r_new('Sample Student R4', public._r_sel(:'p_gardening'),
                  '{"step_up": {"selected": true, "reference": "ZZREF-R4"}}'),
    public._r_new('Sample Student R5', public._r_sel(:'p_gardening')),
    public._r_new('Sample Student R6', public._r_sel(:'p_haven', '["tuesday"]', 1),
                  '{"step_up": {"selected": true}}'))));

select is((select outcome from _r4), 'submitted', 'a STEP UP submission is accepted');
select is(
  (select string_agg(st.preferred_name || ':' || e.state::text, ', ' order by st.preferred_name)
     from public.registration_selections s
     join public.registration_children c on c.id = s.registration_child_id
     join public.students st on st.id = c.student_id
     join public.enrollments e on e.id = s.enrollment_id
     join _r4 r on r.registration_id = s.registration_id),
  'Sample Student R4:approval_pending, Sample Student R5:started, Sample Student R6:approval_pending',
  'on the same instant program, STEP UP is approval_pending (no checkout) and ordinary is started');
select is(
  (select string_agg(su.verification_state::text, ',')
     from public.registration_step_up_requests su join _r4 r using (registration_id)),
  'pending_verification,pending_verification',
  'each STEP UP request enters the review queue as pending_verification');
select is(
  (select count(*)::int from public.registration_step_up_requests su
     join _r4 r using (registration_id)),
  2, 'a parent reads their own STEP UP requests');

select throws_ok(
  $$ select public.admin_set_step_up_state(
       (select su.registration_child_id from public.registration_step_up_requests su limit 1),
       'pending_verification', 'verified') $$,
  '42501', 'not authorized',
  'a parent cannot record a STEP UP outcome');
reset role;

-- Ids for the transitions below (read as the owner role, outside RLS).
create temp table _r_su on commit drop as
  select su.registration_child_id as rcid, st.preferred_name, sel.enrollment_id
  from public.registration_step_up_requests su
  join _r4 r using (registration_id)
  join public.registration_children c on c.id = su.registration_child_id
  join public.students st on st.id = c.student_id
  join public.registration_selections sel on sel.registration_child_id = c.id;
grant select on _r_su to authenticated;

create temp table _r_enrollment_before on commit drop as
  select to_jsonb(e) as snapshot from public.enrollments e
  where e.id = (select enrollment_id from _r_su where preferred_name = 'Sample Student R4');
grant select on _r_enrollment_before to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_set_step_up_state(
       (select rcid from _r_su where preferred_name = 'Sample Student R4'),
       'pending_verification', 'verified') $$,
  '42501', 'not authorized',
  'an educator cannot record a STEP UP outcome');
select throws_ok(
  $$ select * from public.admin_step_up_review_queue() $$,
  '42501', 'not authorized',
  'an educator cannot read the STEP UP review queue');

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- R4: pending → needs_information → pending → verified → (retry) → canceled
select is(
  public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
    'pending_verification', 'needs_information'),
  'updated', 'pending_verification → needs_information');
select is(
  public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
    'needs_information', 'pending_verification'),
  'updated', 'needs_information → pending_verification when information arrives');
select is(
  public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
    'pending_verification', 'verified'),
  'updated', 'pending_verification → verified');
select is(
  public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
    'pending_verification', 'verified'),
  'unchanged', 'a retry of a committed transition is unchanged, not an error');
select is(
  (select to_jsonb(e) from public.enrollments e
    where e.id = (select enrollment_id from _r_su where preferred_name = 'Sample Student R4')),
  (select snapshot from _r_enrollment_before),
  'verification leaves the enrollment byte-identical: not paid, confirmed, or enrolled');
select throws_ok(
  $$ select public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
       'verified', 'declined') $$,
  '23514', null,
  'verified → declined is not an allowed transition');
select throws_ok(
  $$ select public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
       'verified', 'pending_verification') $$,
  '23514', null,
  'verified cannot return to pending');
select throws_ok(
  $$ select public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
       'needs_information', 'canceled') $$,
  '40001', 'STEP UP request changed since it was loaded',
  'a stale expected state is refused');
select is(
  public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
    'verified', 'canceled'),
  'updated', 'verified → canceled');
select throws_ok(
  $$ select public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R4'),
       'canceled', 'verified') $$,
  '23514', null,
  'canceled is terminal');

-- R6: pending → declined, then terminal.
select is(
  public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R6'),
    'pending_verification', 'declined'),
  'updated', 'pending_verification → declined');
select throws_ok(
  $$ select public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R6'),
       'declined', 'verified') $$,
  '23514', null,
  'declined is terminal: it cannot become verified');
select throws_ok(
  $$ select public.admin_set_step_up_state((select rcid from _r_su where preferred_name = 'Sample Student R6'),
       'declined', 'pending_verification') $$,
  '23514', null,
  'declined is terminal: it cannot be reopened');
select throws_ok(
  $$ select public.admin_set_step_up_state('00000000-0000-4000-8000-000000000000',
       'pending_verification', 'verified') $$,
  'P0002', 'STEP UP request not found',
  'an unknown STEP UP request is reported as not found');

select is(
  (select string_agg(e.state::text, ',' order by e.state::text) from public.enrollments e
    where e.id in (select enrollment_id from _r_su)),
  'approval_pending,approval_pending',
  'no STEP UP outcome moved any enrollment');
select is(
  (select verification_state::text || ':' || (state_changed_by = :'admin')::text
     from public.registration_step_up_requests
    where registration_child_id = (select rcid from _r_su where preferred_name = 'Sample Student R4')),
  'canceled:true',
  'the request records its state and who changed it');
select throws_ok(
  $$ update public.registration_step_up_requests set verification_state = 'verified' $$,
  '42501', null,
  'an administrator cannot change STEP UP state through the Data API');

reset role;


-- ===========================================================================
-- 7. STEP UP — audit and direct-write defences
-- ===========================================================================
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'registration_step_up' and action = 'state_changed'
      and actor_user_id = :'admin'),
  5,
  'each real transition is audited once; retries and refusals are not');
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'registration_step_up'
      and (changed_fields::text ~* 'zzref' or changed_fields ? 'reference')),
  0,
  'STEP UP audit events never carry the family''s reference');
select is(
  (select changed_fields ->> 'from' || '→' || (changed_fields ->> 'to') from public.audit_events
    where entity_type = 'registration_step_up'
      and entity_id = (select rcid from _r_su where preferred_name = 'Sample Student R6')),
  'pending_verification→declined',
  'the audit event records the transition');
select throws_ok(
  $$ update public.registration_step_up_requests set reference = null $$,
  '55000', 'registration evidence is immutable',
  'no column but the review state can change, even for the owner role');
select throws_ok(
  format($$ update public.registration_step_up_requests set verification_state = 'verified'
            where registration_child_id = %L $$,
         (select rcid from _r_su where preferred_name = 'Sample Student R6')),
  '23514', 'STEP UP transition is not allowed',
  'the guard refuses a forbidden transition below every function');


-- ===========================================================================
-- 8. EDUCATOR SAFETY SUBSET (DEC-027)
-- ===========================================================================
-- Two registrations for Sample Student A2 (confirmed in Tutoring, the
-- educator's program). The earlier one is backdated so "latest" is real.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
create temp table _r1 on commit drop as
  select * from public.submit_family_registration(:'key_r1', public._r_payload(jsonb_build_array(
    public._r_kid(:'student_a2', public._r_sel(:'p_gardening'),
      '{"has_allergies": true, "allergy_details": "ZZALLERGY superseded"}'))));
reset role;

alter table public.registration_submissions disable trigger registration_submissions_immutable;
update public.registration_submissions set submitted_at = submitted_at - interval '1 day'
  where id = (select registration_id from _r1);
alter table public.registration_submissions enable trigger registration_submissions_immutable;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
create temp table _r2 on commit drop as
  select * from public.submit_family_registration(:'key_r2', public._r_payload(jsonb_build_array(
    public._r_kid(:'student_a2', public._r_sel(:'p_sewing'), jsonb_build_object(
      'has_allergies', true, 'allergy_details', 'ZZALLERGY current',
      'has_medical_needs', true, 'medical_information', 'ZZMED detail',
      'has_accommodation_needs', true, 'accommodation_information', 'ZZACC detail',
      'photo_video_permission', true,
      'step_up', jsonb_build_object('selected', true, 'reference', 'ZZREF-A2'))))));
select is((select outcome from _r1) || ',' || (select outcome from _r2), 'submitted,submitted',
  'two registrations for the same child are recorded');
select throws_ok(
  format($$ select * from public.educator_child_safety(%L) $$, :'p_tutoring'),
  '42501', 'not authorized',
  'a parent cannot call the educator safety function');

-- Parent B for their own child, to prove cross-family isolation below.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select outcome from public.submit_family_registration(:'key_rx', public._r_payload(
     jsonb_build_array(public._r_kid(:'student_b1', public._r_sel(:'p_gardening'),
       '{"has_allergies": true, "allergy_details": "ZZALLERGY family B"}'))))),
  'submitted', 'parent B registers their own child');
select is(
  (select (select count(*) from public.registration_child_health)
        + (select count(*) from public.registration_step_up_requests))::int,
  1,
  'parent B reads only their own child''s health record and none of family A''s STEP UP');

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

create temp table _r_safety on commit drop as
  select * from public.educator_child_safety(:'p_tutoring');

select is(
  (select string_agg(preferred_name, ',' order by preferred_name) from _r_safety),
  'Sample Student A2',
  'the educator sees only confirmed children in the assigned program');
select is(
  (select safety_on_file::text || ':' || has_allergies::text || ':' || allergy_details
     from _r_safety),
  'true:true:ZZALLERGY current',
  'allergy data comes from the latest registration, never a superseded one');
select is(
  (select (emergency_contacts -> 0 ->> 'full_name') || ' | ' || (pickup_persons -> 0 ->> 'full_name')
     from _r_safety),
  'ZZEMERG Contact | ZZPICKUP Person',
  'emergency contacts and approved pickup persons are included');
select is(
  (select array_agg(distinct k order by k)
     from _r_safety, jsonb_array_elements(emergency_contacts || pickup_persons) c,
          jsonb_object_keys(c) k),
  array['full_name', 'phone', 'relationship'],
  'each contact carries only name, relationship, and phone');
select is(
  (select count(*)::int from _r_safety
    where row_to_json(_r_safety)::text ~* '(zzguard|zzmed|zzacc|zzref|zzsig|555-0199|family b)'),
  0,
  'no guardian contact, medical, accommodation, signature, STEP UP, or other family''s data');
select is(
  (select count(*)::int from public.educator_child_safety(:'p_draft')),
  0,
  'an assigned program with no confirmed child returns nothing');
select throws_ok(
  format($$ select * from public.educator_child_safety(%L) $$, :'p_clubs'),
  '42501', 'not authorized',
  'an unassigned program is refused');
select throws_ok(
  $$ select * from public.educator_child_safety('10000000-0000-4000-8000-0000000000aa') $$,
  '42501', 'not authorized',
  'a nonexistent program is refused identically (no enumeration)');
select is(
  (select (select count(*) from public.registration_submissions)
        + (select count(*) from public.registration_children)
        + (select count(*) from public.registration_child_health)
        + (select count(*) from public.registration_contacts)
        + (select count(*) from public.registration_selections)
        + (select count(*) from public.registration_step_up_requests)
        + (select count(*) from public.registration_document_acceptances)
        + (select count(*) from public.registration_acceptance_children)
        + (select count(*) from public.registration_document_versions))::int,
  0,
  'the educator still reads nothing from any restricted registration table directly');

-- An educator with no assignment at all: remove this educator's assignments.
reset role;
delete from public.educator_assignments where educator_user_id = :'educator';
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok(
  format($$ select * from public.educator_child_safety(%L) $$, :'p_tutoring'),
  '42501', 'not authorized',
  'an unassigned educator is refused on the very next call');

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';
select throws_ok(
  format($$ select * from public.educator_child_safety(%L) $$, :'p_tutoring'),
  '42501', 'not authorized',
  'an administrator uses the full record, not the educator function');


-- ===========================================================================
-- 9. ADMINISTRATOR — complete record and review queue
-- ===========================================================================
select is(
  (select h.has_medical_needs::text || ':' || h.medical_information || ':'
          || h.has_accommodation_needs::text || ':' || h.accommodation_information
     from public.registration_child_health h join _r2 r using (registration_id)),
  'true:ZZMED detail:true:ZZACC detail',
  'an administrator reads the complete health record');
select is(
  (select count(*)::int from public.registration_contacts c join _r2 r using (registration_id)
    where c.contact_kind = 'guardian' and c.phone = '555-0199'),
  1,
  'an administrator reads guardian contacts');

create temp table _r_queue on commit drop as
  select * from public.admin_step_up_review_queue();
select is((select count(*)::int from _r_queue), 3,
  'the review queue lists every STEP UP request');
select is(
  (select preferred_name || ':' || verification_state::text || ':' || reference
     from _r_queue limit 1),
  'Sample Student A2:pending_verification:ZZREF-A2',
  'open items come first, and administrators see the reference');
select is(
  (select selections -> 0 ->> 'enrollment_state' from _r_queue
    where preferred_name = 'Sample Student A2'),
  'approval_pending',
  'the queue shows each selection''s enrollment state for the ordinary review');

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select * from public.admin_step_up_review_queue() $$,
  '42501', 'not authorized',
  'a parent cannot read the review queue');
reset role;

select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'registration' and action = 'submitted'
      and changed_fields::text ~* '(zzguard|zzmed|zzacc|zzref|zzsig|zzallergy|zzemerg|zzpickup|555-01)'),
  0,
  'no registration audit payload carries a submitted value');

-- The sample-only and approval locks this slice must not weaken.
select ok(
  exists (select 1 from pg_constraint
           where conname = 'registration_document_versions_approval_locked'),
  'the document approval lock still stands');
select ok(
  exists (select 1 from pg_constraint
           where conname = 'registration_submissions_affirmation_unapproved'),
  'the unapproved-affirmation lock still stands');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'registration\_%' and c.relkind = 'r'
      and not exists (select 1 from pg_constraint k
                       where k.conrelid = c.oid and k.conname like '%sample_only')),
  0,
  'every registration table still carries its sample-only constraint');

select * from finish();
rollback;
