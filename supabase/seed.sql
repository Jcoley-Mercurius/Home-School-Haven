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
--   * No student rows exist. MPS GAP-005 leaves the approved minimum student
--     fields and consent policy unconfirmed and MPS-RUL-006 forbids inventing
--     them, so the table is not modelled in this release.
--
-- This file is applied by `supabase db reset` against a LOCAL stack, and may be
-- applied to the private preview. It must never run against production.

-- Password hashing for the sample accounts below. pgcrypto lives in the
-- `extensions` schema on Supabase, and psql's search_path does not necessarily
-- include it, so `crypt` and `gen_salt` are schema-qualified at every call site.
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if coalesce(current_setting('app.environment', true), 'local') = 'production' then
    raise exception
      'supabase/seed.sql contains sample data and must not run against production';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
insert into public.programs (
  id, slug, name,
  published_dates, published_schedule, published_duration,
  published_session_length, published_price, published_registration_options,
  availability, publication_state, import_status, source, unverified_details,
  image_src, image_alt, image_width, image_height, image_is_placeholder,
  sort_order
) values
  (
    '10000000-0000-4000-8000-000000000001',
    'ready-set-prep-and-learn', 'Ready Set Prep & Learn',
    null, 'Tuesdays and Thursdays', null, null, null,
    'Fall registration offers 1-, 2-, or 3-day options across Enrichment or Ready Set Prep.',
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb, null, null, null, null, false, 1
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
    498, 474, true, 2
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'etiquette-series', 'Etiquette Series',
    null, null, null, null, null, null,
    'unknown', 'published', 'import-title-review-detail',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory (QA-001: date association unproven)',
    '["September 11–October 2 (association unproven)"]'::jsonb,
    null, null, null, null, false, 3
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
    456, 474, true, 4
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'sewing', 'Sewing',
    'September 15–October 5', null, null, 'Two hours per session', null, null,
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb, null, null, null, null, false, 5
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'gardening', 'Gardening',
    'September 3–September 24', null, null, null, null, null,
    'unknown', 'published', 'import-title-review-detail',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory (QA-001: session-length association unproven)',
    '["Two hours per session (association unproven)"]'::jsonb,
    null, null, null, null, false, 6
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
    474, 474, true, 7
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    'history-explorers', 'History Explorers',
    'September 3–October 15', null, null, '2.5 hours per session', null, null,
    'unknown', 'published', 'import',
    'BETA-CONTENT-IMPORT-INVENTORY — Published program inventory',
    '[]'::jsonb, null, null, null, null, false, 8
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
    '[]'::jsonb, null, null, null, null, false, 99
  );


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

  -- Assigned to exactly one published program and to the draft, so both
  -- "sees assigned" and "cannot see unassigned" are testable.
  insert into public.educator_assignments (educator_user_id, program_id) values
    (educator, '10000000-0000-4000-8000-000000000004'),
    (educator, '10000000-0000-4000-8000-0000000000ff')
  on conflict do nothing;
end;
$$;
