-- Foundation Release — sanitized local/preview seed
--
-- MPS-RUL-007 and AGENTS.md §11: the Foundation Review runs on sample or
-- sanitized data only. Nothing below describes a real family, child, educator,
-- or owner.
--
--   * Program rows are real PUBLISHED content from
--     `mps/BETA-CONTENT-IMPORT-INVENTORY.md`, identical to the staging module in
--     `src/content/programs.ts`. Unpublished facts stay NULL (import rule 3).
--   * People are synthetic: every address is on the reserved `example.com`
--     domain (RFC 2606) and every name is prefixed "Sample".
--   * Student rows are demo fixtures, added under the owner decision of
--     2026-08-29 while MPS GAP-005 is open (deviation D-FF1). Every one is
--     `is_sample`, which the table's check constraint makes mandatory, and
--     carries the `demo-unapproved-v0` affirmation version. No name below
--     belongs to a real child.
--
-- This file is applied by `npm run db:reset` against a LOCAL stack, and may be
-- applied deliberately to the private preview. It must never run against
-- production. Both workflows must supply `hsh_seed_environment` to psql; the
-- SQL in this file cannot declare its own environment.

\set ON_ERROR_STOP on

\if :{?hsh_seed_environment}
select :'hsh_seed_environment' in ('local', 'preview')
  as hsh_seed_environment_allowed \gset
\else
\set hsh_seed_environment_allowed false
\endif

\if :hsh_seed_environment_allowed
\else
do $$
begin
  raise exception
    'Refusing sanitized seed: invoke psql with -v hsh_seed_environment=local or preview.';
end;
$$;
\endif

-- Password hashing for the sample accounts below. pgcrypto lives in the
-- `extensions` schema on Supabase, and psql's search_path does not necessarily
-- include it, so `crypt` and `gen_salt` are schema-qualified at every call site.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
insert into public.programs (
  id, slug, name,
  published_dates, published_schedule, published_duration,
  published_session_length, published_price, published_registration_options,
  availability, publication_state, import_status, source, unverified_details,
  image_src, image_alt, image_width, image_height, image_is_placeholder,
  sort_order, summary
) values
  (
    '10000000-0000-4000-8000-000000000001',
    'ready-set-prep-and-learn', 'Ready Set Prep & Learn',
    null, 'Tuesdays and Thursdays', null, null, null,
    'Fall registration offers 1-, 2-, or 3-day options across Enrichment or Ready Set Prep.',
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb, null, null, null, null, false, 1, null
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'haven-days-enrichment', 'Haven Days Enrichment',
    'September 2026–June 2027', null, null, null, null,
    'Fall registration offers 1-, 2-, or 3-day options.',
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb,
    '/placeholder/program-haven-days-enrichment.jpg',
    'Placeholder photo — demo only. Potted plants beside a window.',
    498, 474, true, 2, null
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'etiquette-series', 'Etiquette Series',
    null, null, null, null, null, null,
    'unknown', 'published', 'import-title-review-detail',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory (QA-001: date association unproven)',
    '["September 11–October 2 (association unproven)"]'::jsonb,
    null, null, null, null, false, 3, null
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'art-lab', 'Art Lab',
    'August 22–September 26, 2026', null, null, null, null, null,
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb,
    '/placeholder/program-art-lab.jpg',
    'Placeholder photo — demo only. Watercolour paints and brushes on a table.',
    456, 474, true, 4, null
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'sewing', 'Sewing',
    'September 15–October 5', null, null, 'Two hours per session', null, null,
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb, null, null, null, null, false, 5, null
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'gardening', 'Gardening',
    'September 3–September 24', null, null, null, null, null,
    'unknown', 'published', 'import-title-review-detail',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory (QA-001: session-length association unproven)',
    '["Two hours per session (association unproven)"]'::jsonb,
    null, null, null, null, false, 6, null
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    'harvest-explorers', 'Harvest Explorers',
    'August 20–September 24', null, 'Six weeks', null, '$180 for all six weeks', null,
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb,
    '/placeholder/program-harvest-explorers.jpg',
    'Placeholder photo — demo only. A woven basket with a eucalyptus sprig.',
    474, 474, true, 7, null
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    'history-explorers', 'History Explorers',
    'September 3–October 15', null, null, '2.5 hours per session', null, null,
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb, null, null, null, null, false, 8, null
  ),
  -- Sample draft. Its only purpose is to give the "a visitor cannot see an
  -- unpublished program" test a target. It is not real published content, which
  -- its name states plainly.
  (
    '10000000-0000-4000-8000-0000000000ff',
    'sample-unpublished-draft', 'Sample Unpublished Draft (test fixture)',
    null, null, null, null, null, null,
    'unknown', 'draft', 'import',
    'Sample data — not published content',
    '[]'::jsonb, null, null, null, null, false, 99,
    -- The only seeded summary. `admin_set_program_publication` refuses to
    -- publish a program with no summary (MPS-ACC-008/009), and this fixture is
    -- the row the publish/unpublish paths exercise, so without one that flow
    -- cannot be tested at all. It invents no published copy: it says in words
    -- that it is a sample and that nothing has been published here. Every real
    -- program keeps `summary` NULL, which is what the approved inventory says
    -- (import rule 3, and `UNPUBLISHED` in src/content/programs.ts).
    'Sample draft record for the Foundation Review. Home School Haven has not '
    'published a summary for this program.'
  )
-- Without this the whole file stops here on any re-run: the programs insert
-- raises a duplicate key, and every statement after it -- the sample accounts,
-- role grants, families, students, and educator assignments -- never executes.
-- That is exactly how a re-seed came to look like it had succeeded while
-- silently adding nothing. Every other insert in this file is already
-- idempotent; this one was the outlier.
--
-- `do nothing` rather than `do update`: this file seeds fixtures, and quietly
-- rewriting published program content on an unrelated re-seed would be a
-- surprise. To refresh program content, reset the rows deliberately.
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Sample accounts
-- ---------------------------------------------------------------------------
-- Local-stack convenience only. This password exists nowhere else in the
-- repository, is never used by a deployed environment, and every account it
-- opens holds only sample data.
do $$
declare
  sample_password text := 'SampleFoundationReview2026';
  parent_a  uuid := '20000000-0000-4000-8000-00000000000a';
  parent_b  uuid := '20000000-0000-4000-8000-00000000000b';
  -- Two parents holding the role and NO family, so the family_incomplete state
  -- of MPS-WFL-002 is reachable without mutating parents A or B.
  --
  -- Two rather than one because completing setup consumes the fixture. parent_c
  -- is used by the tests that must *stay* family-less -- validation, keyboard,
  -- accessibility, screenshots -- and parent_d by the one test that actually
  -- completes setup. Sharing a single account made those tests order-dependent:
  -- whichever ran after the completion test found a family already there.
  parent_c  uuid := '20000000-0000-4000-8000-00000000000c';
  parent_d  uuid := '20000000-0000-4000-8000-00000000000d';
  educator  uuid := '20000000-0000-4000-8000-00000000000e';
  admin     uuid := '20000000-0000-4000-8000-000000000ad0';
  family_a  uuid := '30000000-0000-4000-8000-00000000000a';
  family_b  uuid := '30000000-0000-4000-8000-00000000000b';
  account   record;
begin
  for account in
    select * from (values
      (parent_a,  'sample.parent.one@example.com',   'Sample Parent One'),
      (parent_b,  'sample.parent.two@example.com',   'Sample Parent Two'),
      (parent_c,  'sample.parent.three@example.com', 'Sample Parent Three'),
      (parent_d,  'sample.parent.four@example.com',  'Sample Parent Four'),
      (educator,  'sample.educator@example.com',     'Sample Educator'),
      (admin,     'sample.admin@example.com',        'Sample Administrator')
    ) as t(user_id, email, display_name)
  loop
    -- The token columns below are nullable in Postgres but GoTrue scans them
    -- into non-nullable Go strings. Leaving them NULL makes every sign-in fail
    -- with "Database error querying schema", so they are set to '' explicitly.
    -- `phone` stays NULL: it is unique, and '' would collide across accounts.
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      account.user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      account.email,
      extensions.crypt(sample_password, extensions.gen_salt('bf')),
      now(),
      -- Role is NOT stored here. app_metadata is not the authorization source;
      -- public.user_roles is (see the identity migration).
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now(),
      '', '', '', '', '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), account.user_id, account.user_id::text, 'email',
      jsonb_build_object('sub', account.user_id::text, 'email', account.email,
                         'email_verified', true),
      now(), now(), now()
    )
    on conflict do nothing;

    -- The on_auth_user_created trigger inserted the profile; name it.
    update public.profiles
      set display_name = account.display_name
      where id = account.user_id;
  end loop;

  -- Role grants. granted_by is NULL: these came from a seed script, not from an
  -- authenticated administrator, and the audit model records that honestly.
  insert into public.user_roles (user_id, role) values
    (parent_a, 'parent'),
    (parent_b, 'parent'),
    (parent_c, 'parent'),
    (parent_d, 'parent'),
    (educator, 'educator'),
    (admin,    'admin')
  on conflict do nothing;

  -- Two separate families, so "parent A cannot read family B" is testable.
  insert into public.families (id, name) values
    (family_a, 'Sample Family A'),
    (family_b, 'Sample Family B')
  on conflict do nothing;

  insert into public.family_members (family_id, user_id, member_role) values
    (family_a, parent_a, 'primary_guardian'),
    (family_b, parent_b, 'primary_guardian')
  on conflict do nothing;

  -- parent_c and parent_d must always start with NO family -- that is the
  -- entire point of these fixtures. The end-to-end suite completes setup for
  -- parent_d, so a re-seed has to put the fixture back rather than inherit
  -- whatever state the last run happened to leave. `on conflict do nothing`
  -- cannot express that: the row it must remove is one nothing else will
  -- conflict with. Cascades take the membership and any student rows with it.
  delete from public.families f
    where exists (
      select 1 from public.family_members m
      where m.family_id = f.id and m.user_id in (parent_c, parent_d)
    );

  -- Demo student profiles (D-FF1). Family A has two so "each child is
  -- distinguishable" is testable; family B has one so "parent A cannot read
  -- family B's children" is testable. Preferred name, grade, and relationship
  -- only -- no legal name, date of birth, medical, or emergency information
  -- (MPS-RUL-006).
  insert into public.students
    (id, family_id, preferred_name, grade_level, guardian_relationship) values
    ('40000000-0000-4000-8000-000000000001', family_a,
     'Sample Student A1', 'Grade 3', 'Parent'),
    ('40000000-0000-4000-8000-000000000002', family_a,
     'Sample Student A2', 'Grade 6', 'Parent'),
    ('40000000-0000-4000-8000-000000000003', family_b,
     'Sample Student B1', 'Grade 1', 'Parent')
  on conflict do nothing;

  -- Assigned to exactly one published program and to the draft, so both
  -- "sees assigned" and "cannot see unassigned" are testable.
  insert into public.educator_assignments (educator_user_id, program_id) values
    (educator, '10000000-0000-4000-8000-000000000004'),
    (educator, '10000000-0000-4000-8000-0000000000ff')
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Enrollments (sample)
  -- -------------------------------------------------------------------------
  -- Chosen so the dashboard's trust states are demonstrable rather than
  -- described. MDS-REF-007 is named for its pending-payment warning, so family
  -- A carries exactly that alongside a confirmed enrollment: the two states
  -- must be distinguishable side by side, and only one of them may read as
  -- success.
  --
  -- Family B's row exists so "parent A reads none of family B's enrollments"
  -- has a target. Every row is is_sample, which the table's check constraint
  -- makes mandatory. No row here is evidence that anyone paid anything.
  insert into public.enrollments
    (id, family_id, student_id, program_id, state, state_note) values
    -- Art Lab, payment verification pending. Not confirmed enrollment.
    ('50000000-0000-4000-8000-000000000001', family_a,
     '40000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000004', 'payment_pending',
     'Sample record. Awaiting verification by an authorized administrator.'),
    -- Haven Days Enrichment, confirmed by an authorized administrator.
    ('50000000-0000-4000-8000-000000000002', family_a,
     '40000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000002', 'confirmed',
     'Sample record.'),
    -- The second child, so per-student context is demonstrable.
    ('50000000-0000-4000-8000-000000000003', family_a,
     '40000000-0000-4000-8000-000000000002',
     '10000000-0000-4000-8000-000000000007', 'approval_pending',
     'Sample record.'),
    -- Family B. The cross-family denial target.
    ('50000000-0000-4000-8000-000000000004', family_b,
     '40000000-0000-4000-8000-000000000003',
     '10000000-0000-4000-8000-000000000005', 'waitlisted',
     'Sample record. A waitlist place is not enrollment.'),
    -- Art Lab, confirmed. The ONLY confirmed enrollment inside a program the
    -- sample educator is assigned to, and it exists so MPS-ACC-028 has a
    -- target. Before it, the educator was assigned to 0004 and 00ff while the
    -- one confirmed enrollment sat in 0002, which the educator does not hold --
    -- so "the assigned educator sees the roster" and "the unassigned educator
    -- does not" were both untestable, and the roster boundary could not be
    -- proven either way.
    --
    -- Pairing it with the payment_pending row above on the SAME program is the
    -- other half of the point: program 0004 now carries one confirmed and one
    -- unconfirmed child, so the roster page must show them apart on one screen
    -- and the educator policy must return exactly one of them.
    ('50000000-0000-4000-8000-000000000005', family_a,
     '40000000-0000-4000-8000-000000000002',
     '10000000-0000-4000-8000-000000000004', 'confirmed',
     'Sample record. Confirmed by an authorized administrator; not a payment.')
  on conflict (id) do nothing;

  -- -------------------------------------------------------------------------
  -- Announcements and learning resources (sample)
  -- -------------------------------------------------------------------------
  -- Copy is deliberately generic. An announcement that named a date, a room, a
  -- price, or a policy would be inventing a published fact (import rule 3,
  -- DO-DONT "Trust states"). Each row states that it is a sample.
  --
  -- Coverage: one published row family A can reach, one unpublished row it must
  -- not, and one row on a program only family B is enrolled in, which it must
  -- not reach either.
  insert into public.announcements
    (id, program_id, title, body, state, published_at) values
    ('60000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000004',
     'Sample announcement — welcome to the review',
     'This is sample content for the Foundation Review. Home School Haven has '
     'not published a real announcement here yet.',
     'published', now() - interval '2 days'),
    ('60000000-0000-4000-8000-000000000002',
     '10000000-0000-4000-8000-000000000002',
     'Sample announcement — what this space is for',
     'Program announcements from Home School Haven will appear here. This entry '
     'is sample content for the Foundation Review.',
     'published', now() - interval '9 days'),
    -- A draft: proves the state filter, not the family boundary.
    ('60000000-0000-4000-8000-0000000000f1',
     '10000000-0000-4000-8000-000000000004',
     'Sample unpublished announcement (test fixture)',
     'Never visible to a family. Present so the draft state is testable.',
     'draft', null),
    -- Family B only: proves the family boundary, not the published filter.
    ('60000000-0000-4000-8000-0000000000f2',
     '10000000-0000-4000-8000-000000000005',
     'Sample announcement for another family (test fixture)',
     'Present so cross-family announcement denial is testable.',
     'published', now() - interval '1 day')
  on conflict (id) do nothing;

  insert into public.learning_resources
    (id, program_id, title, description, kind, url, state) values
    ('70000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000002',
     'Sample resource — Home School Haven resource library',
     'Sample content for the Foundation Review, linking to the published '
     'public resource page.',
     'link', 'https://www.homeschoolhaven.org/', 'published'),
    ('70000000-0000-4000-8000-000000000002',
     '10000000-0000-4000-8000-000000000004',
     'Sample resource — program information',
     'Sample content for the Foundation Review.',
     'link', 'https://www.homeschoolhaven.org/', 'published'),
    ('70000000-0000-4000-8000-0000000000f1',
     '10000000-0000-4000-8000-000000000004',
     'Sample unpublished resource (test fixture)',
     'Never visible to a family. Present so the draft state is testable.',
     'link', 'https://www.homeschoolhaven.org/', 'draft'),
    ('70000000-0000-4000-8000-0000000000f2',
     '10000000-0000-4000-8000-000000000005',
     'Sample resource for another family (test fixture)',
     'Present so cross-family resource denial is testable.',
     'link', 'https://www.homeschoolhaven.org/', 'published')
  on conflict (id) do nothing;
  -- -------------------------------------------------------------------------
  -- Program sessions, capacity, and attendance (sample)
  -- -------------------------------------------------------------------------
  -- SAMPLE, and titled so. A session carries a real date and a real time, so a
  -- seeded one that borrowed a program's published range would manufacture the
  -- exact fact import rule 3 forbids. Every title below says "Sample session",
  -- and every time is relative to `now()` so the fixture stays meaningful
  -- whenever it is reset rather than drifting into the past.
  --
  -- Coverage is chosen so each state and each boundary has a target:
  --   0001 upcoming, on Art Lab (0004) -- the program the sample educator holds
  --        and the one confirmed enrollment sits in, so the attendance and
  --        roster paths have somewhere to run;
  --   0002 completed, on Art Lab, and the one carrying an attendance record;
  --   0003 rescheduled, on Art Lab, so "changed" is visible with the time it
  --        moved from;
  --   0004 canceled, on Nature Explorers (0002), which family A holds through a
  --        different enrollment;
  --   00f1 on the unpublished draft fixture (00ff), so "a visitor sees no
  --        session of an unpublished program" has a target;
  --   00f2 on Sewing (0005), which only family B holds, so cross-family denial
  --        has a target.
  insert into public.program_sessions
    (id, program_id, title, starts_at, ends_at, location, state,
     rescheduled_from, change_note) values
    ('80000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000004',
     'Sample session — Art Lab meeting',
     now() + interval '7 days', now() + interval '7 days 2 hours',
     'Sample location', 'scheduled', null, null),
    ('80000000-0000-4000-8000-000000000002',
     '10000000-0000-4000-8000-000000000004',
     'Sample session — Art Lab meeting',
     now() - interval '7 days', now() - interval '7 days' + interval '2 hours',
     'Sample location', 'completed', null,
     'Sample record. This session has been marked complete.'),
    ('80000000-0000-4000-8000-000000000003',
     '10000000-0000-4000-8000-000000000004',
     'Sample session — Art Lab meeting',
     now() + interval '21 days', now() + interval '21 days 2 hours',
     'Sample location', 'rescheduled', now() + interval '14 days',
     'Sample record. Moved one week later so a changed session is reviewable.'),
    ('80000000-0000-4000-8000-000000000004',
     '10000000-0000-4000-8000-000000000002',
     'Sample session — Nature Explorers meeting',
     now() + interval '10 days', now() + interval '10 days 2 hours',
     'Sample location', 'canceled', null,
     'Sample record. Called off so a canceled session is reviewable. No '
     'refund, credit, or transfer is decided here.'),
    ('80000000-0000-4000-8000-0000000000f1',
     '10000000-0000-4000-8000-0000000000ff',
     'Sample session on an unpublished program (test fixture)',
     now() + interval '5 days', now() + interval '5 days 1 hour',
     null, 'scheduled', null, null),
    ('80000000-0000-4000-8000-0000000000f2',
     '10000000-0000-4000-8000-000000000005',
     'Sample session for another family (test fixture)',
     now() + interval '9 days', now() + interval '9 days 1 hour',
     null, 'scheduled', null, null)
  on conflict (id) do nothing;

  -- Sample capacity. These are DEMO NUMBERS, not Home School Haven's confirmed
  -- capacities: checklist §1 is unanswered and GAP-ADMIN-004 remains open for
  -- the numbers themselves. Every other program keeps `capacity` NULL, which
  -- means "not established" and renders as no numeric claim at all.
  --
  -- Art Lab (0004) carries capacity with a waitlist enabled; Sewing (0005)
  -- carries capacity with the waitlist off, so "full without waitlist" and
  -- "full with waitlist" both have a target (MPS-WFL-005 alternate paths).
  update public.programs
  set capacity = 12, waitlist_enabled = true
  where id = '10000000-0000-4000-8000-000000000004';

  update public.programs
  set capacity = 8, waitlist_enabled = false
  where id = '10000000-0000-4000-8000-000000000005';

  -- -------------------------------------------------------------------------
  -- Conversion-journey fixtures (MPS-WFL-003)
  -- -------------------------------------------------------------------------
  -- MPS-ACC-019, 020, and 021 each need a program that actually behaves that
  -- way; describing the behaviour in a comment is not a target a test can
  -- reach. These are DEMO configurations, exactly as the capacities above are:
  -- Home School Haven has confirmed no confirmation mode and no capacity for
  -- any program (checklist §1, GAP-ADMIN-004, GAP-ADMIN-006).
  --
  -- Every other program keeps the `administrator_approval` default, which is
  -- itself the MPS-ACC-019 target: a registration for one becomes
  -- approval_pending and reaches no payment path.

  -- Gardening (0006): instant confirmation, no capacity. The MPS-ACC-021
  -- target -- an eligible registration becomes `started` and the external
  -- handoff is offered. Its checkout_url is still NULL, so the handoff renders
  -- its truthful "registration link not published" state (F-1).
  update public.programs
  set confirmation_mode = 'instant'
  where id = '10000000-0000-4000-8000-000000000006';

  -- History Explorers (0008): one place, taken, waitlist ON. The MPS-ACC-020
  -- target -- a family joining becomes `waitlisted` and no payment is
  -- collected.
  update public.programs
  set capacity = 1, waitlist_enabled = true, confirmation_mode = 'instant'
  where id = '10000000-0000-4000-8000-000000000008';

  -- Etiquette Series (0003): one place, taken, waitlist OFF. MPS-WFL-003's
  -- "Program full without waitlist" -- blocked, with nothing recorded and no
  -- payment started.
  update public.programs
  set capacity = 1, waitlist_enabled = false, confirmation_mode = 'instant'
  where id = '10000000-0000-4000-8000-000000000003';

  -- The confirmed places that make those two programs full. They belong to
  -- family B, so family A's registrations meet a genuinely full program rather
  -- than one this fixture emptied for them. `confirmed` is the only state that
  -- occupies a place (GAP-FAM-001).
  insert into public.enrollments
    (id, family_id, student_id, program_id, state, state_note) values
    ('50000000-0000-4000-8000-000000000006', family_b,
     '40000000-0000-4000-8000-000000000003',
     '10000000-0000-4000-8000-000000000008', 'confirmed',
     'Sample record. Occupies the single demo place.'),
    ('50000000-0000-4000-8000-000000000007', family_b,
     '40000000-0000-4000-8000-000000000003',
     '10000000-0000-4000-8000-000000000003', 'confirmed',
     'Sample record. Occupies the single demo place.')
  on conflict (id) do nothing;

  -- One attendance record: the confirmed Art Lab enrollment, at the completed
  -- session. Its absence on every other pairing is "not recorded", which is not
  -- a claim of absence (GAP-ADMIN-010).
  insert into public.session_attendance (session_id, enrollment_id) values
    ('80000000-0000-4000-8000-000000000002',
     '50000000-0000-4000-8000-000000000005')
  on conflict (session_id, enrollment_id) do nothing;

  -- -------------------------------------------------------------------------
  -- Inquiries (sample)
  -- -------------------------------------------------------------------------
  -- Invented people, `@example.com` addresses reserved by RFC 2606, and no
  -- real phone number (MPS-RUL-007). No message names a child, a price, an
  -- amount, a policy, or a promise, because a sample that did would put words
  -- into Home School Haven's mouth and put a made-up family circumstance into
  -- a screenshot (MPS-RUL-010, MPS-RUL-006).
  --
  -- Coverage: one of each pathway, and four of the six review states so the
  -- queue, the state badges, and the transition buttons all have something to
  -- render. `submission_token` is a fixed UUID per row so re-seeding is
  -- idempotent the same way the public form's retry is.
  --
  -- Written directly rather than through `public.submit_inquiry`, because a
  -- seed is not a submission: these carry chosen references, chosen times, and
  -- chosen states, none of which that function permits a caller to set.
  insert into public.inquiries
    (id, reference, type, submitted_at, state, state_changed_at,
     owner_user_id, contact_name, contact_email, contact_phone, program_id,
     message, submission_token) values
    ('a0000000-0000-4000-8000-000000000001', 'HSH-SAMPLE1', 'assistance',
     now() - interval '2 days', 'submitted', now() - interval '2 days',
     null, 'Sample Parent One', 'sample.one@example.com', null,
     '10000000-0000-4000-8000-000000000002',
     'Sample request for the Foundation Review. A family would describe their '
     'situation here and ask what support might be possible.',
     'a1000000-0000-4000-8000-000000000001'),
    ('a0000000-0000-4000-8000-000000000002', 'HSH-SAMPLE2', 'guidance',
     now() - interval '5 days', 'under_review', now() - interval '1 day',
     '20000000-0000-4000-8000-000000000ad0', 'Sample Parent Two',
     'sample.two@example.com', null, null,
     'Sample request for the Foundation Review. A family would ask which '
     'program suits their child here.',
     'a1000000-0000-4000-8000-000000000002'),
    ('a0000000-0000-4000-8000-000000000003', 'HSH-SAMPLE3', 'visit',
     now() - interval '9 days', 'awaiting_family', now() - interval '6 days',
     '20000000-0000-4000-8000-000000000ad0', 'Sample Parent Three',
     'sample.three@example.com', '555-0100',
     '10000000-0000-4000-8000-000000000004',
     'Sample request for the Foundation Review. A family would ask about '
     'visiting here.',
     'a1000000-0000-4000-8000-000000000003'),
    ('a0000000-0000-4000-8000-000000000004', 'HSH-SAMPLE4', 'question',
     now() - interval '20 days', 'closed', now() - interval '18 days',
     '20000000-0000-4000-8000-000000000ad0', 'Sample Parent Four',
     'sample.four@example.com', null, null,
     'Sample request for the Foundation Review. A general question would be '
     'written here, and this one has been answered and closed.',
     'a1000000-0000-4000-8000-000000000004')
  on conflict (id) do nothing;
end;
$$;
