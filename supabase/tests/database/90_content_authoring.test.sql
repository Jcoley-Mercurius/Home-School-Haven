-- Foundation Release — announcement and learning-resource authoring boundaries
-- (MPS-REQ-004, MPS-REQ-018, MPS-REQ-019, MPS-REQ-020, MPS-REQ-024;
--  MPS-RUL-003; MPS-ACC-005, MPS-ACC-029, MPS-ACC-030)
--
-- WHAT THIS FILE IS FOR
--
-- `src/lib/content/*` decides what an author is OFFERED. This file decides what
-- the database does when asked directly — by a forged request, by a refactor
-- that drops a guard, or by anyone holding a session and a PostgREST client.
-- Seven things are proven:
--
--   1. No client role can insert, update, or delete either content table
--      through the table itself. The only write path is a function.
--   2. Those functions refuse a parent, an unassigned educator, and `anon`,
--      and accept an assigned educator only for their OWN programs.
--   3. The program is taken from the STORED ROW: pairing a held program's id
--      with another program's content id widens nothing.
--   4. Every rejected lifecycle transition raises, and both terminal states
--      accept nothing at all.
--   5. A stale `expected_updated_at` refuses rather than overwriting.
--   6. A draft is invisible to an enrolled family; publishing reveals it;
--      replacing leaves the predecessor readable AS REPLACED; removing takes
--      it away.
--   7. The audit trail records every material action AND CONTAINS NO BODY TEXT.
--
-- (7) is the one worth stating twice. `audit_events` is append-only with no
-- UPDATE or DELETE granted to anyone, so anything written into it is written
-- forever. An announcement body is free text an educator typed, and MPS-RUL-003
-- keeps sensitive family matters private — so the test asserts the body is
-- ABSENT, not merely that the row exists.

begin;
create extension if not exists pgtap with schema extensions;

select plan(61);

\set admin    '20000000-0000-4000-8000-000000000ad0'
\set parent_a '20000000-0000-4000-8000-00000000000a'
\set educator '20000000-0000-4000-8000-00000000000e'
\set norole   '20000000-0000-4000-8000-0000000000f0'

-- Art Lab: the educator IS assigned, and family A holds enrollments.
\set art_lab '10000000-0000-4000-8000-000000000004'
-- Sewing: the educator is NOT assigned, and family A is NOT enrolled.
\set sewing  '10000000-0000-4000-8000-000000000005'

\set published_ann '60000000-0000-4000-8000-000000000001'
\set draft_ann     '60000000-0000-4000-8000-0000000000f1'
\set other_ann     '60000000-0000-4000-8000-0000000000f2'


-- ---------------------------------------------------------------------------
-- 1. No table write path exists for anybody
-- ---------------------------------------------------------------------------
-- Not "the row would be rejected" — the PRIVILEGE is absent, so these raise
-- rather than filtering to zero rows.
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select throws_ok(
  $$ insert into public.announcements (program_id, title, body)
       values ('10000000-0000-4000-8000-000000000004', 'x', 'y') $$,
  '42501', null,
  'an assigned educator cannot insert an announcement through the table'
);
select throws_ok(
  $$ update public.announcements set title = 'x' $$,
  '42501', null,
  'an assigned educator cannot update an announcement through the table'
);
select throws_ok(
  $$ delete from public.announcements $$,
  '42501', null,
  'an assigned educator cannot delete an announcement through the table'
);
select throws_ok(
  $$ insert into public.learning_resources (program_id, title, kind, url)
       values ('10000000-0000-4000-8000-000000000004', 'x', 'link', 'https://e.org') $$,
  '42501', null,
  'an assigned educator cannot insert a resource through the table'
);
select throws_ok(
  $$ update public.learning_resources set title = 'x' $$,
  '42501', null,
  'an assigned educator cannot update a resource through the table'
);
select throws_ok(
  $$ delete from public.learning_resources $$,
  '42501', null,
  'an assigned educator cannot delete a resource through the table'
);

-- Administrators too. Being an administrator is not a table privilege.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';
select throws_ok(
  $$ insert into public.announcements (program_id, title, body)
       values ('10000000-0000-4000-8000-000000000004', 'x', 'y') $$,
  '42501', null,
  'an administrator cannot insert an announcement through the table either'
);
select throws_ok(
  $$ delete from public.learning_resources $$,
  '42501', null,
  'an administrator cannot delete a resource through the table either'
);


-- ---------------------------------------------------------------------------
-- 2. The functions refuse everyone they should
-- ---------------------------------------------------------------------------
-- A parent.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  format($$ select public.content_create_announcement_draft(%L, 'x', 'y') $$, :'art_lab'),
  '42501', null,
  'a parent cannot author an announcement on a program their child attends'
);
select throws_ok(
  format($$ select public.content_create_resource_draft(%L, 'x', '', 'link', 'https://e.org') $$, :'art_lab'),
  '42501', null,
  'a parent cannot author a resource'
);

-- A signed-in account with no role at all.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-0000000000f0","role":"authenticated"}';
select throws_ok(
  format($$ select public.content_create_announcement_draft(%L, 'x', 'y') $$, :'art_lab'),
  '42501', null,
  'an account with no role cannot author'
);

-- An educator, on a program they are NOT assigned to. This is MPS-ACC-029.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok(
  format($$ select public.content_create_announcement_draft(%L, 'x', 'y') $$, :'sewing'),
  '42501', null,
  'an educator cannot author for a program they are not assigned to'
);
select throws_ok(
  format($$ select public.content_create_resource_draft(%L, 'x', '', 'link', 'https://e.org') $$, :'sewing'),
  '42501', null,
  'an educator cannot author a resource for an unassigned program'
);

-- Anonymous holds no execute privilege at all.
set local role anon;
set local request.jwt.claims = '';
select throws_ok(
  format($$ select public.content_create_announcement_draft(%L, 'x', 'y') $$, :'art_lab'),
  '42501', null,
  'an anonymous visitor cannot author'
);


-- ---------------------------------------------------------------------------
-- 3. An assigned educator CAN author, for their own program only
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select lives_ok(
  format($$ select public.content_create_announcement_draft(%L, 'Test draft', 'Body text alpha') $$, :'art_lab'),
  'an assigned educator authors an announcement on their own program'
);

create temporary table t_ann as
  select id, updated_at from public.announcements where title = 'Test draft';

select is(
  (select state::text from public.announcements
     where id = (select id from t_ann)),
  'draft',
  'a created announcement is a draft — nothing reaches a family on save'
);

select is(
  (select created_by from public.announcements where id = (select id from t_ann)),
  :'educator'::uuid,
  'the author is attributed to the acting educator, not to the definer'
);


-- ---------------------------------------------------------------------------
-- 4. The program comes from the stored row, not from a parameter
-- ---------------------------------------------------------------------------
-- `other_ann` lives on Sewing, which this educator does not hold. Every verb
-- takes only the CONTENT id, so there is no program parameter to forge, and the
-- row's OWN program is what gets checked.
--
-- The refusal is 42501 and so is the refusal for an id that never existed. The
-- functions are SECURITY DEFINER and therefore read past RLS, so distinguishing
-- the two would hand a direct PostgREST caller an oracle for which content ids
-- are real. The next two assertions are what prove they are indistinguishable.
select throws_ok(
  format($$ select public.content_publish_announcement(%L, now()) $$, :'other_ann'),
  '42501', null,
  'an educator cannot publish an announcement on a program they do not hold'
);
select throws_ok(
  format($$ select public.content_remove_announcement(%L, now()) $$, :'other_ann'),
  '42501', null,
  'an educator cannot remove an announcement on a program they do not hold'
);
select throws_ok(
  $$ select public.content_publish_announcement(
       '60000000-0000-4000-8000-00000000dead', now()) $$,
  '42501', null,
  'an id that never existed refuses identically — no existence oracle'
);


-- ---------------------------------------------------------------------------
-- 5. Optimistic concurrency
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ select public.content_update_announcement_draft(%L, %L, 'x', 'y') $$,
         (select id from t_ann), '2020-01-01T00:00:00Z'),
  'PT409', null,
  'a stale editor is refused rather than silently overwriting'
);
select throws_ok(
  format($$ select public.content_update_announcement_draft(%L, null, 'x', 'y') $$,
         (select id from t_ann)),
  'PT409', null,
  'a missing concurrency token is refused too — absence is not agreement'
);


-- ---------------------------------------------------------------------------
-- 6. Field bounds are enforced in the database, not only in the form
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ select public.content_create_announcement_draft(%L, '', 'body') $$, :'art_lab'),
  '22023', null,
  'an empty title is refused'
);
select throws_ok(
  format($$ select public.content_create_announcement_draft(%L, repeat('x', 161), 'body') $$, :'art_lab'),
  '22023', null,
  'an over-long title is refused'
);
select throws_ok(
  format($$ select public.content_create_announcement_draft(%L, 'ok', '') $$, :'art_lab'),
  '22023', null,
  'an empty body is refused'
);
select throws_ok(
  format($$ select public.content_create_resource_draft(%L, 'ok', '', 'link', 'javascript:alert(1)') $$, :'art_lab'),
  '22023', null,
  'a javascript: URL is not storable, so no renderer has to defend against one'
);
select throws_ok(
  format($$ select public.content_create_resource_draft(%L, 'ok', '', 'link', '') $$, :'art_lab'),
  '22023', null,
  'a link resource with no address is refused'
);
select throws_ok(
  format($$ select public.content_create_resource_draft(%L, 'ok', '', 'document', 'https://e.org') $$, :'art_lab'),
  '22023', null,
  'a file resource carrying a web address is refused — one medium, never two'
);


-- ---------------------------------------------------------------------------
-- 6b. A real in-place edit, which is also what exercises the audit trigger
-- ---------------------------------------------------------------------------
-- This block exists because of DEFECT-C1. The audit trigger built its list of
-- changed field names with `changed || 'body'`, which makes Postgres resolve
-- `anyarray || anyarray` and try to parse the untyped literal as an array —
-- 22P02, raised inside an AFTER trigger, which aborts the UPDATE that fired it.
-- Every in-place edit failed, and no test caught it because the suite only ever
-- created, published, replaced, and removed. It never simply EDITED.
select lives_ok(
  format($$ select public.content_update_announcement_draft(%L, (select updated_at from public.announcements where id = %L), 'Test draft', 'Body text alpha edited') $$,
         (select id from t_ann), (select id from t_ann)),
  'a draft can actually be edited in place'
);
select is(
  (select body from public.announcements where id = (select id from t_ann)),
  'Body text alpha edited',
  'the edit is stored'
);
/* `audit_events` carries an administrator-only select policy, so the educator
   this block is acting as reads none of it — which is correct, and is why the
   assertion switches role rather than relaxing the policy. */
set local role postgres;
select is(
  (select changed_fields -> 'changed' from public.audit_events
     where entity_type = 'announcement'
       and entity_id = (select id from t_ann)
       and action = 'updated'
     order by occurred_at desc limit 1),
  '["body"]'::jsonb,
  'the audit row names the field that changed — and names ONLY the field'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

-- Put the body back, so the assertions further down still describe what they
-- were written against.
select lives_ok(
  format($$ select public.content_update_announcement_draft(%L, (select updated_at from public.announcements where id = %L), 'Test draft', 'Body text alpha') $$,
         (select id from t_ann), (select id from t_ann)),
  'and edited back'
);


-- ---------------------------------------------------------------------------
-- 7. The lifecycle, including every edge that must NOT exist
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.content_publish_announcement(%L, %L) $$,
         (select id from t_ann), (select updated_at from t_ann)),
  'a draft publishes'
);

select is(
  (select state::text from public.announcements where id = (select id from t_ann)),
  'published',
  'the published state is recorded'
);
select isnt(
  (select published_at from public.announcements where id = (select id from t_ann)),
  null,
  'a published announcement carries a publication time — it can be ordered honestly'
);

-- Publishing twice is not a transition that exists.
select throws_ok(
  format($$ select public.content_publish_announcement(%L, (select updated_at from public.announcements where id = %L)) $$,
         (select id from t_ann), (select id from t_ann)),
  '22023', null,
  'a published announcement cannot be published again'
);

-- Editing published text in place is refused: revision is replacement.
select throws_ok(
  format($$ select public.content_update_announcement_draft(%L, (select updated_at from public.announcements where id = %L), 'new', 'new') $$,
         (select id from t_ann), (select id from t_ann)),
  '22023', null,
  'a published announcement cannot be edited in place'
);

select lives_ok(
  format($$ select public.content_replace_announcement(%L, (select updated_at from public.announcements where id = %L), 'Successor', 'Body text beta') $$,
         (select id from t_ann), (select id from t_ann)),
  'a published announcement is replaced'
);

select is(
  (select state::text from public.announcements where id = (select id from t_ann)),
  'replaced',
  'the predecessor is marked replaced, not overwritten'
);
select is(
  (select body from public.announcements where id = (select id from t_ann)),
  'Body text alpha',
  'the predecessor keeps its ORIGINAL text — replaced must be truthful'
);
select isnt(
  (select replaced_by_id from public.announcements where id = (select id from t_ann)),
  null,
  'the predecessor points forward to its successor'
);
select is(
  (select state::text from public.announcements
     where id = (select replaced_by_id from public.announcements where id = (select id from t_ann))),
  'draft',
  'the successor starts as a draft — publishing it is a separate decision'
);

-- Both terminal states accept nothing.
select throws_ok(
  format($$ select public.content_remove_announcement(%L, (select updated_at from public.announcements where id = %L)) $$,
         (select id from t_ann), (select id from t_ann)),
  '22023', null,
  'a replaced announcement cannot be removed — terminal means terminal'
);
select throws_ok(
  format($$ select public.content_replace_announcement(%L, (select updated_at from public.announcements where id = %L), 'a', 'b') $$,
         (select id from t_ann), (select id from t_ann)),
  '22023', null,
  'a replaced announcement cannot be replaced again'
);

select is(
  (select private.content_transition_allowed('removed', 'draft')),
  false,
  'nothing comes back from removed — un-removing is a retention decision'
);
select is(
  (select private.content_transition_allowed('removed', 'published')),
  false,
  'a removed announcement cannot be quietly republished'
);
select is(
  (select private.content_transition_allowed('draft', 'replaced')),
  false,
  'a draft cannot be replaced — there is nothing published to supersede'
);


-- ---------------------------------------------------------------------------
-- 8. What a family sees, at each state
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.announcements where id = (select id from t_ann)),
  1,
  'an enrolled family reads the replaced announcement, marked as replaced'
);
select is(
  (select count(*)::int from public.announcements a
     where a.id = (select p.replaced_by_id from public.announcements p
                     where p.id = (select id from t_ann))),
  0,
  'an enrolled family does NOT read the unpublished successor'
);

select is(
  (select count(*)::int from public.announcements where id = :'draft_ann'::uuid),
  0,
  'an enrolled family reads no draft, on any of its own programs'
);
select is(
  (select count(*)::int from public.announcements where id = :'other_ann'::uuid),
  0,
  'a family reads nothing on a program it is not enrolled in'
);


-- ---------------------------------------------------------------------------
-- 9. Removal revokes family access
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select lives_ok(
  format($$ select public.content_remove_announcement(%L, (select updated_at from public.announcements where id = %L)) $$,
         :'published_ann', :'published_ann'),
  'an assigned educator removes a published announcement'
);

set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select count(*)::int from public.announcements where id = :'published_ann'::uuid),
  0,
  'the family loses a removed announcement immediately, with no sign-out'
);

-- But the record itself is retained. Removal is not deletion (GAP-CONTENT-03).
set local role postgres;
select is(
  (select count(*)::int from public.announcements where id = :'published_ann'::uuid),
  1,
  'the removed record is RETAINED — removal revokes access, it does not erase'
);
select isnt(
  (select removed_at from public.announcements where id = :'published_ann'::uuid),
  null,
  'removal is timestamped'
);


-- ---------------------------------------------------------------------------
-- 10. Attribution, and the body text that must never be in it
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.audit_events
     where entity_type = 'announcement'
       and entity_id = (select id from t_ann)
       and action = 'published'),
  1,
  'publishing writes exactly one audit row'
);
select is(
  (select actor_user_id from public.audit_events
     where entity_type = 'announcement'
       and entity_id = (select id from t_ann)
       and action = 'published'),
  :'educator'::uuid,
  'the audit row names the acting educator, not the definer'
);
select is(
  (select count(*)::int from public.audit_events
     where entity_type = 'announcement'
       and entity_id = (select id from t_ann)
       and action = 'replaced'),
  1,
  'replacement is recorded as its own material action'
);
select is(
  (select count(*)::int from public.audit_events
     where entity_type = 'announcement'
       and entity_id = :'published_ann'::uuid
       and action = 'removed'),
  1,
  'removal is recorded as its own material action'
);

-- THE ONE THAT MATTERS. `audit_events` grants no UPDATE or DELETE to anyone, so
-- anything written here is written forever.
select is(
  (select count(*)::int from public.audit_events
     where changed_fields::text like '%Body text alpha%'
        or changed_fields::text like '%Body text beta%'),
  0,
  'no audit row contains announcement body text'
);
-- And the edits made above are recorded as field NAMES, never as content.
select is(
  (select bool_and(changed_fields ? 'changed') from public.audit_events
     where entity_type = 'announcement'
       and entity_id = (select id from t_ann)
       and action = 'updated'),
  true,
  'every recorded edit names which fields changed'
);

select * from finish();
rollback;
