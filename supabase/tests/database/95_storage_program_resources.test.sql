-- Foundation Release — the private program-resources bucket and its object
-- policies (MPS-REQ-004, MPS-REQ-019; MPS-ACC-005, MPS-ACC-030)
--
-- WHAT THIS FILE IS FOR
--
-- `src/lib/content/storage.ts` decides which signed URL the application asks
-- for. This file decides what Storage does when asked directly. Everything
-- below is asserted against `storage.objects` and `storage.buckets`, because a
-- file is not protected by the route that usually fetches it.
--
-- Six things are proven:
--
--   1. The bucket is PRIVATE. If this ever flips, every other control in this
--      file is decoration — a public bucket serves objects to anyone with a
--      URL, with no policy consulted.
--   2. An assigned educator and an administrator can read their program's
--      object.
--   3. An enrolled family can read it ONLY while the owning resource is
--      published.
--   4. A draft's and a removed resource's object are unreadable by a family
--      even with a perfectly correct path. This is proof obligation 13 — "old
--      application routes cannot expose removed content" — enforced in the
--      database rather than by the route.
--   5. An unenrolled family, an unassigned educator, and `anon` read nothing.
--   6. NO client role can delete an object. Removal revokes access; erasure is
--      a retention decision nobody has made (GAP-CONTENT-03).
--
-- The rows are inserted as `postgres` because the upload path is the
-- application's; what is under test is who can READ them afterwards.

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

\set admin    '20000000-0000-4000-8000-000000000ad0'
\set parent_a '20000000-0000-4000-8000-00000000000a'
\set parent_b '20000000-0000-4000-8000-00000000000b'
\set educator '20000000-0000-4000-8000-00000000000e'

\set art_lab '10000000-0000-4000-8000-000000000004'
\set sewing  '10000000-0000-4000-8000-000000000005'


-- ---------------------------------------------------------------------------
-- 1. The bucket is private. Everything else depends on this.
-- ---------------------------------------------------------------------------
select is(
  (select public from storage.buckets where id = 'program-resources'),
  false,
  'the program-resources bucket is PRIVATE — there is no public object URL'
);
select is(
  (select count(*)::int from storage.buckets where id = 'program-resources'),
  1,
  'the bucket exists'
);


-- ---------------------------------------------------------------------------
-- Fixtures: one published and one draft file resource on Art Lab, and one on
-- Sewing, which the educator does not hold and family A is not enrolled in.
-- ---------------------------------------------------------------------------
set local role postgres;

insert into public.learning_resources
  (id, program_id, title, kind, state, storage_path, file_name,
   file_size_bytes, content_type)
values
  ('70000000-0000-4000-8000-00000000aa01', :'art_lab'::uuid,
   'Published file', 'document', 'published',
   '10000000-0000-4000-8000-000000000004/70000000-0000-4000-8000-00000000aa01/a.pdf',
   'a.pdf', 1024, 'application/pdf'),
  ('70000000-0000-4000-8000-00000000aa02', :'art_lab'::uuid,
   'Draft file', 'document', 'draft',
   '10000000-0000-4000-8000-000000000004/70000000-0000-4000-8000-00000000aa02/b.pdf',
   'b.pdf', 1024, 'application/pdf'),
  ('70000000-0000-4000-8000-00000000aa03', :'sewing'::uuid,
   'Other program file', 'document', 'published',
   '10000000-0000-4000-8000-000000000005/70000000-0000-4000-8000-00000000aa03/c.pdf',
   'c.pdf', 1024, 'application/pdf');

insert into storage.objects (bucket_id, name, owner)
values
  ('program-resources',
   '10000000-0000-4000-8000-000000000004/70000000-0000-4000-8000-00000000aa01/a.pdf', null),
  ('program-resources',
   '10000000-0000-4000-8000-000000000004/70000000-0000-4000-8000-00000000aa02/b.pdf', null),
  ('program-resources',
   '10000000-0000-4000-8000-000000000005/70000000-0000-4000-8000-00000000aa03/c.pdf', null),
  -- An object with a perfectly well-formed path that NO resource row claims.
  -- A path is an index, not an authorization, and this is what proves it.
  ('program-resources',
   '10000000-0000-4000-8000-000000000004/70000000-0000-4000-8000-00000000aa99/orphan.pdf', null);


-- ---------------------------------------------------------------------------
-- 2. An assigned educator reads their own program's objects, both states
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'program-resources'
       and name like :'art_lab' || '/%'),
  2,
  'an assigned educator reads their program''s objects, published and draft'
);
select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'program-resources'
       and name like :'sewing' || '/%'),
  0,
  'an assigned educator reads NO object for a program they do not hold'
);
select is(
  (select count(*)::int from storage.objects
     where name like '%orphan.pdf'),
  0,
  'an object no resource row claims is readable by nobody — a path is not authorization'
);


-- ---------------------------------------------------------------------------
-- 3. An administrator reads every program's objects
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

select is(
  (select count(*)::int from storage.objects where bucket_id = 'program-resources'),
  3,
  'an administrator reads every claimed object, and still not the orphan'
);


-- ---------------------------------------------------------------------------
-- 4. An enrolled family reads the PUBLISHED object and nothing else
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from storage.objects
     where name like '%/70000000-0000-4000-8000-00000000aa01/%'),
  1,
  'an enrolled family reads the published resource''s object'
);
select is(
  (select count(*)::int from storage.objects
     where name like '%/70000000-0000-4000-8000-00000000aa02/%'),
  0,
  'an enrolled family cannot read a DRAFT resource''s object, correct path and all'
);
select is(
  (select count(*)::int from storage.objects
     where name like :'sewing' || '/%'),
  0,
  'an enrolled family reads no object for a program it is not enrolled in'
);


-- ---------------------------------------------------------------------------
-- 5. Removal revokes the file, immediately, in the same transaction
-- ---------------------------------------------------------------------------
-- This is proof obligation 13. The application route stops serving because the
-- state changed; the OBJECT stops being readable because the policy joins back
-- to the row. Neither depends on the other.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select lives_ok(
  $$ select public.content_remove_resource(
       '70000000-0000-4000-8000-00000000aa01',
       (select updated_at from public.learning_resources
          where id = '70000000-0000-4000-8000-00000000aa01')) $$,
  'an assigned educator removes the published file resource'
);

set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select count(*)::int from storage.objects
     where name like '%/70000000-0000-4000-8000-00000000aa01/%'),
  0,
  'the family loses the FILE the moment the resource is removed'
);
select is(
  (select count(*)::int from public.learning_resources
     where id = '70000000-0000-4000-8000-00000000aa01'),
  0,
  'and loses the record with it'
);

-- The object itself is retained. Removal revokes; it does not erase.
set local role postgres;
select is(
  (select count(*)::int from storage.objects
     where name like '%/70000000-0000-4000-8000-00000000aa01/%'),
  1,
  'the OBJECT is retained — removal revokes access, it does not delete the file'
);


-- ---------------------------------------------------------------------------
-- 6. An unenrolled family and an anonymous visitor read nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'program-resources'
       and name like :'art_lab' || '/%'),
  0,
  'a family with no enrollment in the program reads none of its objects'
);

set local role anon;
set local request.jwt.claims = '';
select is(
  (select count(*)::int from storage.objects where bucket_id = 'program-resources'),
  0,
  'an anonymous visitor reads nothing in the private bucket'
);


-- ---------------------------------------------------------------------------
-- 7. No client role can delete an object, and none can write one freely
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';

select is(
  (select count(*)::int from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'program_resources%' and cmd = 'DELETE'),
  0,
  'NO delete policy exists on the bucket for any client role'
);
select is(
  (select count(*)::int from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'program_resources%' and cmd = 'UPDATE'),
  0,
  'no update policy either — an object is written once'
);

-- An upload that names no existing draft matches no policy.
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
       values ('program-resources',
               '10000000-0000-4000-8000-000000000004/70000000-0000-4000-8000-00000000bb01/x.pdf') $$,
  '42501', null,
  'an upload that belongs to no draft is refused — no orphan can be created'
);

-- And an upload under a program the educator does not hold is refused even
-- though the path is well formed.
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
       values ('program-resources',
               '10000000-0000-4000-8000-000000000005/70000000-0000-4000-8000-00000000aa03/x.pdf') $$,
  '42501', null,
  'an upload under an unassigned program is refused'
);

select * from finish();
rollback;
