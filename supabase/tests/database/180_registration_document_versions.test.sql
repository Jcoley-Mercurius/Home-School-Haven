-- Slice 2.5 — registration document versions and reacceptance
-- (DEC-029; MPS-RUL-009/010; MPS-REQ-002/003/006; MPS-ACC-003/006; GAP-014)
-- Prompt: prompts/registration-readiness.md §5.6, §10
--
-- WHAT THIS FILE PROVES
--
--   A. With the approval lock in place (the real state of every database):
--      nothing can be published, drafts stay presented, draft acceptances never
--      satisfy policy, and the renewal mechanics work against the presented
--      draft, idempotently, for the registration's own family only.
--   B. With the lock dropped INSIDE THIS FILE'S TRANSACTION ONLY (it is rolled
--      back at the end, and 170 independently asserts the lock stands):
--      publishing a new version requires fresh acceptance, editing a draft does
--      not, a draft acceptance never stands in for a published one, published
--      versions are frozen, and only the owner can publish.
--
-- No document text exists anywhere in this file or the database. References and
-- hashes below are obviously fake fixtures.

begin;
create extension if not exists pgtap with schema extensions;

select plan(52);

\set parent_a  '20000000-0000-4000-8000-00000000000a'
\set parent_b  '20000000-0000-4000-8000-00000000000b'
\set admin     '20000000-0000-4000-8000-000000000ad0'

\set doc_waiver   'd0000000-0000-4000-8000-000000000001'
\set doc_conduct  'd0000000-0000-4000-8000-000000000002'
\set doc_handbook 'd0000000-0000-4000-8000-000000000003'
\set doc_waiver_2 'd0000000-0000-4000-8000-000000000011'
\set doc_waiver_3 'd0000000-0000-4000-8000-000000000021'

\set key_d1 'e2000000-0000-4000-8000-0000000000d1'

\set sha_a 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
\set sha_b 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
\set sha_c 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'

create function public._d_waiver(version uuid)
returns jsonb language sql immutable as $$
  select jsonb_build_object('liability_waiver', jsonb_build_object(
    'version_id', version, 'typed_signature', 'ZZSIG Renewal'));
$$;
create function public._d_all(waiver uuid, conduct uuid, handbook uuid)
returns jsonb language sql immutable as $$
  select public._d_waiver(waiver) || jsonb_build_object(
    'code_of_conduct', jsonb_build_object('version_id', conduct, 'typed_signature', 'ZZSIG Conduct'),
    'parent_handbook', jsonb_build_object('version_id', handbook, 'acknowledged', true));
$$;
create function public._d_kinds(target uuid)
returns text language sql stable as $$
  select coalesce(string_agg(document_kind::text, ',' order by document_kind), '')
  from public.registration_documents_requiring_acceptance(target);
$$;
grant execute on function public._d_waiver(uuid) to authenticated;
grant execute on function public._d_all(uuid, uuid, uuid) to authenticated;
grant execute on function public._d_kinds(uuid) to authenticated;


-- ===========================================================================
-- A. THE LOCK STANDS
-- ===========================================================================
select ok(
  exists (select 1 from pg_constraint
           where conname = 'registration_document_versions_approval_locked'),
  'the approval lock is present at the start');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

create temp table _d1 on commit drop as
  select * from public.submit_family_registration(:'key_d1', jsonb_build_object(
    'authority_affirmed', true,
    'guardian_contacts', jsonb_build_array(jsonb_build_object(
      'full_name', 'Sample Guardian', 'phone', '555-0100', 'is_submitter', true)),
    'emergency_contacts', jsonb_build_array(jsonb_build_object(
      'full_name', 'Sample Emergency', 'relationship', 'Aunt', 'phone', '555-0101')),
    'pickup_persons', jsonb_build_array(jsonb_build_object(
      'full_name', 'Sample Pickup', 'relationship', 'Grandparent')),
    'children', jsonb_build_array(
      jsonb_build_object('student_id', '40000000-0000-4000-8000-000000000001',
        'has_allergies', false, 'has_medical_needs', false,
        'has_accommodation_needs', false, 'photo_video_permission', false,
        'selections', jsonb_build_array(jsonb_build_object(
          'program_id', '10000000-0000-4000-8000-000000000006'))),
      jsonb_build_object('student_id', '40000000-0000-4000-8000-000000000002',
        'has_allergies', false, 'has_medical_needs', false,
        'has_accommodation_needs', false, 'photo_video_permission', true,
        'selections', jsonb_build_array(jsonb_build_object(
          'program_id', '10000000-0000-4000-8000-000000000006')))),
    'documents', public._d_all(:'doc_waiver', :'doc_conduct', :'doc_handbook')));
grant select on _d1 to authenticated;

select is((select outcome from _d1), 'submitted', 'a registration accepts the presented drafts');
select is(public._d_kinds((select registration_id from _d1)), '',
  'nothing requires acceptance: the registration accepted every presented version');
select is(public.registration_policy_satisfied((select registration_id from _d1)), false,
  'draft acceptances never satisfy registration policy');
select is(
  (select outcome from public.renew_registration_documents((select registration_id from _d1),
     public._d_waiver(:'doc_waiver'))),
  'already_current',
  'renewing a version already accepted in its current status is a no-op');
select throws_ok(
  format($$ select public.owner_publish_registration_document(%L) $$, :'doc_waiver'),
  '42501', 'not authorized',
  'a parent cannot publish a document');
reset role;

-- An administrator is not the content owner.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';
select throws_ok(
  format($$ select public.owner_publish_registration_document(%L) $$, :'doc_waiver'),
  '42501', 'not authorized',
  'an administrator cannot publish a registration document (MPS-RUL-010)');
reset role;

-- The owner role, granted for this transaction only.
insert into public.user_roles (user_id, role) values (:'admin', 'owner');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';
select throws_ok(
  format($$ select public.owner_publish_registration_document(%L) $$, :'doc_waiver'),
  '22023', 'a published version needs its approved source reference and sha256',
  'a version without a source reference and hash cannot be published');
reset role;

-- Editing a DRAFT is allowed and changes nothing about an existing acceptance.
update public.registration_document_versions
  set content_reference = 'sample://not-a-real-document/waiver-v0',
      content_sha256 = :'sha_a',
      title = 'Sample liability waiver — draft, edited'
  where id = :'doc_waiver';

select is(
  (select count(*)::int || ':' || coalesce(min(a.document_sha256_at_acceptance), '<none>')
     from public.registration_document_acceptances a
    where a.registration_id = (select registration_id from _d1)
      and a.document_version_id = :'doc_waiver'),
  '1:<none>',
  'a draft edit leaves the existing acceptance and its snapshot untouched');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';
select is(public.owner_publish_registration_document(:'doc_waiver'), 'blocked_approval_locked',
  'while the lock stands, the owner''s publish is refused');
reset role;
select is(
  (select status::text from public.registration_document_versions where id = :'doc_waiver'),
  'draft', 'the refused publish changed nothing');
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'registration_document' and action = 'published'),
  0, 'and audited nothing');

-- A new draft of the waiver replaces the old draft (sample mode).
update public.registration_document_versions set status = 'retired' where id = :'doc_waiver';
insert into public.registration_document_versions
  (id, document_kind, version_label, title, content_reference, content_sha256)
values
  (:'doc_waiver_2', 'liability_waiver', 'sample-draft-v1',
   'Sample liability waiver — draft v1, not approved',
   'sample://not-a-real-document/waiver-v1', :'sha_b');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(public._d_kinds((select registration_id from _d1)), 'liability_waiver',
  'a newly presented waiver version requires acceptance');
select is(
  (select string_agg(id::text, ',' order by id) from public.registration_document_versions
    where document_kind = 'liability_waiver'),
  :'doc_waiver_2',
  'a parent sees only the presented waiver version');
select is(
  (select outcome from public.renew_registration_documents((select registration_id from _d1),
     public._d_waiver(:'doc_waiver'))),
  'blocked_document_version_stale',
  'renewing against a version that is no longer presented is refused');
select is(
  (select outcome from public.renew_registration_documents((select registration_id from _d1),
     public._d_waiver(:'doc_waiver_2'))),
  'renewed',
  'the family renews against the presented version');
select is(
  (select outcome from public.renew_registration_documents((select registration_id from _d1),
     public._d_waiver(:'doc_waiver_2'))),
  'already_current',
  'a retry of the renewal writes nothing');
select is(public._d_kinds((select registration_id from _d1)), '',
  'after renewal nothing requires acceptance');
select is(
  (select a.acceptance_method::text || ':' || a.signer_user_id::text || ':'
          || a.document_status_at_acceptance::text || ':' || a.document_sha256_at_acceptance
          || ':' || (select count(*) from public.registration_acceptance_children ac
                      where ac.acceptance_id = a.id)::text
     from public.registration_document_acceptances a
    where a.registration_id = (select registration_id from _d1)
      and a.document_version_id = :'doc_waiver_2'),
  'signature:' || :'parent_a' || ':draft:' || :'sha_b' || ':2',
  'the renewal records method, signer, status, content hash, and both children');
select is(
  (select count(*)::int from public.registration_document_acceptances
    where registration_id = (select registration_id from _d1)),
  4, 'the original acceptance is kept beside the renewal');
select is(public.registration_policy_satisfied((select registration_id from _d1)), false,
  'a renewed draft acceptance still never satisfies policy');
select throws_ok(
  $$ select * from public.renew_registration_documents((select registration_id from _d1),
       '{"parent_handbook": {"version_id": "d0000000-0000-4000-8000-000000000003",
         "acknowledged": true, "typed_signature": "x"}}'::jsonb) $$,
  '22023', 'invalid registration payload: documents.parent_handbook has an unknown field',
  'a handbook renewal cannot carry a signature');
select throws_ok(
  $$ select * from public.renew_registration_documents((select registration_id from _d1), '{}'::jsonb) $$,
  '22023', 'invalid registration payload: documents',
  'a renewal must name at least one document');
select throws_ok(
  $$ select * from public.renew_registration_documents((select registration_id from _d1),
       '{"code_of_conduct": {"version_id": "d0000000-0000-4000-8000-000000000002"}}'::jsonb) $$,
  '22023', 'invalid registration payload: documents.code_of_conduct.typed_signature',
  'a Code of Conduct renewal needs a signature');

-- Another family.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select throws_ok(
  $$ select * from public.renew_registration_documents((select registration_id from _d1),
       public._d_waiver('d0000000-0000-4000-8000-000000000011')) $$,
  '42501', 'not authorized',
  'another family cannot renew this registration');
select throws_ok(
  $$ select * from public.renew_registration_documents('00000000-0000-4000-8000-000000000000',
       public._d_waiver('d0000000-0000-4000-8000-000000000011')) $$,
  '42501', 'not authorized',
  'a nonexistent registration is refused identically');
select is(public._d_kinds((select registration_id from _d1)), '',
  'another family learns nothing from the requiring-acceptance check');
reset role;

select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'registration' and action = 'documents_renewed'
      and actor_user_id = :'parent_a'
      and changed_fields::text !~* 'zzsig'),
  1, 'the renewal is audited once, attributed, and without the signature');


-- ===========================================================================
-- B. MECHANICS AFTER A HYPOTHETICAL LIFT (this transaction only)
-- ===========================================================================
alter table public.registration_document_versions
  drop constraint registration_document_versions_approval_locked;

update public.registration_document_versions
  set content_reference = 'sample://not-a-real-document/' || document_kind::text || '-v0',
      content_sha256 = :'sha_a'
  where id in (:'doc_conduct', :'doc_handbook');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';
select is(
  public.owner_publish_registration_document(:'doc_waiver_2') || ',' ||
  public.owner_publish_registration_document(:'doc_conduct') || ',' ||
  public.owner_publish_registration_document(:'doc_handbook'),
  'published,published,published',
  'the owner publishes all three versions');
select is(public.owner_publish_registration_document(:'doc_waiver_2'), 'unchanged',
  'publishing an already published version is unchanged');
select throws_ok(
  format($$ select public.owner_publish_registration_document(%L) $$, :'doc_waiver'),
  '23514', 'only a draft can be published',
  'a retired version cannot be published');
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(public.registration_policy_satisfied((select registration_id from _d1)), false,
  'acceptances made while the versions were drafts do not count once they are published');
select is(public._d_kinds((select registration_id from _d1)),
  'liability_waiver,code_of_conduct,parent_handbook',
  'every published version requires fresh acceptance');
select is(
  (select outcome from public.renew_registration_documents((select registration_id from _d1),
     public._d_all(:'doc_waiver_2', :'doc_conduct', :'doc_handbook'))),
  'renewed', 'the family accepts the published versions');
select is(public.registration_policy_satisfied((select registration_id from _d1)), true,
  'acceptance of every published version satisfies policy');
select is(
  (select count(*)::int from public.registration_document_acceptances
    where registration_id = (select registration_id from _d1)
      and document_status_at_acceptance = 'approved'),
  3, 'the published acceptances are new rows beside the draft ones');
reset role;

-- The next waiver version is DRAFTED and EDITED while v1 stays published.
insert into public.registration_document_versions
  (id, document_kind, version_label, title, content_reference, content_sha256)
values
  (:'doc_waiver_3', 'liability_waiver', 'sample-draft-v2',
   'Sample liability waiver — draft v2', 'sample://not-a-real-document/waiver-v2', :'sha_c');
update public.registration_document_versions
  set title = 'Sample liability waiver — draft v2, spelling corrected', content_sha256 = :'sha_a'
  where id = :'doc_waiver_3';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(public.registration_policy_satisfied((select registration_id from _d1)), true,
  'drafting and editing the next version does not invalidate the existing acceptance');
select is(public._d_kinds((select registration_id from _d1)), '',
  'and does not ask for renewal');
select is(
  (select string_agg(id::text, ',' order by id) from public.registration_document_versions
    where document_kind = 'liability_waiver'),
  :'doc_waiver_2',
  'a parent sees the published version, never the draft in preparation');
reset role;

select throws_ok(
  format($$ update public.registration_document_versions set title = 'Changed'
            where id = %L $$, :'doc_waiver_2'),
  '55000', 'a published or retired document version cannot be edited',
  'a published version cannot be edited, even by the owner role');
select throws_ok(
  format($$ update public.registration_document_versions set status = 'draft', approved_at = null
            where id = %L $$, :'doc_waiver_2'),
  '55000', 'a published or retired document version cannot be edited',
  'a published version cannot return to draft');
select throws_ok(
  format($$ update public.registration_document_versions set title = 'Changed'
            where id = %L $$, :'doc_waiver'),
  '55000', 'a published or retired document version cannot be edited',
  'a retired version is frozen');
select throws_ok(
  format($$ update public.registration_document_versions set document_kind = 'code_of_conduct'
            where id = %L $$, :'doc_waiver_3'),
  '55000', 'document version identity is immutable',
  'a draft cannot change which document it is');

-- Publishing v2 — even a spelling-only change — requires fresh acceptance.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';
select is(public.owner_publish_registration_document(:'doc_waiver_3'), 'published',
  'the owner publishes the next waiver version');
reset role;

select is(
  (select string_agg(id::text || ':' || status::text, ',' order by id)
     from public.registration_document_versions where document_kind = 'liability_waiver'),
  :'doc_waiver' || ':retired,' || :'doc_waiver_2' || ':retired,' || :'doc_waiver_3' || ':approved',
  'publishing retires the previous version');
select is(
  (select (changed_fields ->> 'retired_version_id') || ':' || actor_user_id::text
     from public.audit_events
    where entity_type = 'registration_document' and entity_id = :'doc_waiver_3'),
  :'doc_waiver_2' || ':' || :'admin',
  'the publication is audited with the version it retired and the owner who published');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(public.registration_policy_satisfied((select registration_id from _d1)), false,
  'a newly published version invalidates the previous acceptance');
select is(public._d_kinds((select registration_id from _d1)), 'liability_waiver',
  'only the republished document requires renewal');
select is(
  (select outcome from public.renew_registration_documents((select registration_id from _d1),
     public._d_waiver(:'doc_waiver_3'))),
  'renewed', 'the family re-accepts the new version');
select is(public.registration_policy_satisfied((select registration_id from _d1)), true,
  'policy is satisfied again after reacceptance');
select is(
  (select document_sha256_at_acceptance from public.registration_document_acceptances
    where registration_id = (select registration_id from _d1)
      and document_version_id = :'doc_waiver_3'),
  :'sha_a',
  'the acceptance snapshots the hash of the text that was published');
reset role;

select is(
  (select count(*)::int from public.audit_events
    where entity_type in ('registration', 'registration_document')
      and changed_fields::text ~* 'zzsig'),
  0, 'no document audit event carries a signature');

select * from finish();
rollback;
