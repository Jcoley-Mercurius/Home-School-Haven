-- Closeout Slice 1 — public offering model and factual content
--
-- MPS: MPS-REQ-008, MPS-REQ-016, MPS-REQ-020, MPS-REQ-024; MPS-RUL-005;
--      DEC-024 (owner evidence of 2026-09-14); import rules 1, 3, 7; QA-002
--      superseded, QA-007 opened.
-- MTS: Supabase is the system of record for programs; writes only through
--      authorized functions; attributable history through record_program_audit.
-- Prompt: prompts/public-offering-model.md
--
-- What this does, in order:
--
--   1. `public.offering_type` and a NULLABLE `programs.offering_type`. Nullable
--      because an administrator's new draft has no classification yet, and a
--      default would invent one.
--   2. Classifies and ARCHIVES the five offerings the 2026-09-14 evidence does
--      not support. Archived, never deleted: `archived` already exists, already
--      keeps a row away from anonymous RLS, and keeps every audit event.
--   3. Upserts the nine verified offerings by fixed id. On the hosted project
--      this updates …0002, …0005, …0006 and inserts the rest; on a fresh local
--      database it inserts all nine before `seed.sql` runs. Only content columns
--      are written on conflict, so capacity, waitlist, and confirmation mode
--      set by an administrator are left alone.
--   4. A published program must carry an offering type — as a constraint, and as
--      a readable refusal in `admin_set_program_publication`.
--   5. `admin_update_program_facts` accepts the offering type.
--   6. `offering_type` and `summary` join the audited material fields.
--
-- Every year is left out on purpose. Gardening's price stays NULL: the flyer
-- says $35/week and the email says $35 drop-in (QA-007).
--
-- rollback:
--   alter table public.programs drop constraint if exists programs_published_has_offering_type;
--   drop function if exists public.admin_update_program_facts(uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, text, public.availability_state, text, public.program_confirmation_mode, public.offering_type);
--   -- recreate admin_update_program_facts and record_program_audit from
--   -- 20260903000000_family_conversion_journey.sql, and
--   -- admin_set_program_publication from 20260830090000_admin_program_enrollment_operations.sql
--   update public.programs set publication_state = 'published'
--     where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
--                  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000007',
--                  '10000000-0000-4000-8000-000000000008');
--   -- Prior content of …0002, …0005, …0006 is recoverable from
--   -- audit_events.changed_fields ONLY for the columns record_program_audit
--   -- treats as material: name, slug, publication_state, availability,
--   -- published_price, published_registration_options, published_dates,
--   -- published_schedule, published_duration, published_session_length,
--   -- enrollment_window, checkout_url, educator, location, capacity,
--   -- waitlist_enabled, confirmation_mode, offering_type, summary.
--   --
--   -- The upsert above ALSO writes audience, import_status, source,
--   -- unverified_details, image_src, image_alt, image_width, image_height,
--   -- image_is_placeholder, and sort_order. None of those are audited, so their
--   -- prior values are NOT recoverable from the database after this runs.
--   -- The one that matters is Gardening (…0006): its previous
--   -- unverified_details, ["Two hours per session (association unproven)"]
--   -- (QA-001), is replaced by the QA-007 price conflict. That superseded
--   -- detail is preserved in mps/BETA-CONTENT-IMPORT-INVENTORY.md under
--   -- "Published program inventory (website capture, 2026-08-26)", which is
--   -- where to restore it from.
--   --
--   -- Whether those columns should join record_program_audit's material list is
--   -- an MPS-REQ-024 decision and is deliberately not made here.
--   delete from public.programs where id in ('10000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-00000000000a',
--     '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000c',
--     '10000000-0000-4000-8000-00000000000d', '10000000-0000-4000-8000-00000000000e');
--   alter table public.programs drop column if exists offering_type;
--   drop type if exists public.offering_type;


-- ---------------------------------------------------------------------------
-- 1. Taxonomy
-- ---------------------------------------------------------------------------
create type public.offering_type as enum (
  'haven_days', 'ready_set', 'individual_class', 'tutoring', 'monthly_club'
);

alter table public.programs add column offering_type public.offering_type;

comment on column public.programs.offering_type is
  'How Home School Haven offers this program (owner evidence 2026-09-14). NULL '
  'only on an unclassified draft; a published program must carry one.';


-- ---------------------------------------------------------------------------
-- 2. Offerings the 2026-09-14 evidence does not support — archived
-- ---------------------------------------------------------------------------
-- A no-op on an empty table. Classified first so their history stays legible.
update public.programs
set offering_type = case id
      when '10000000-0000-4000-8000-000000000001'::uuid then 'ready_set'::public.offering_type
      else 'individual_class'::public.offering_type
    end,
    publication_state = 'archived',
    sort_order = case id
      when '10000000-0000-4000-8000-000000000001'::uuid then 101
      when '10000000-0000-4000-8000-000000000003'::uuid then 102
      when '10000000-0000-4000-8000-000000000004'::uuid then 103
      when '10000000-0000-4000-8000-000000000007'::uuid then 104
      else 105
    end
where id in (
  '10000000-0000-4000-8000-000000000001',  -- Ready Set Prep & Learn
  '10000000-0000-4000-8000-000000000003',  -- Etiquette Series
  '10000000-0000-4000-8000-000000000004',  -- Art Lab
  '10000000-0000-4000-8000-000000000007',  -- Harvest Explorers
  '10000000-0000-4000-8000-000000000008'   -- History Explorers
);


-- ---------------------------------------------------------------------------
-- 3. Verified offerings — owner evidence of 2026-09-14
-- ---------------------------------------------------------------------------
insert into public.programs (
  id, slug, name, offering_type,
  published_dates, published_schedule, published_duration,
  published_session_length, published_price, published_registration_options,
  audience, summary,
  availability, publication_state, import_status, source, unverified_details,
  image_src, image_alt, image_width, image_height, image_is_placeholder,
  sort_order
) values
  ('10000000-0000-4000-8000-000000000002', 'haven-days-enrichment', 'Haven Days',
   'haven_days',
   'September–June', 'Tuesday, Wednesday, and Thursday, 9:00 AM–1:30 PM', null,
   null, 'One day $280/month; two days $550/month; three days $795/month', null,
   null, null,
   'unknown', 'published', 'import',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14',
   '[]'::jsonb,
   -- Demo-only art direction, unchanged from the 2026-08-27 owner decision; the
   -- release gate in scripts/check-demo-placeholders.mjs still governs it.
   '/placeholder/program-haven-days-enrichment.jpg',
   'Placeholder photo — demo only. Potted plants beside a window.',
   498, 474, true,
   1),
  ('10000000-0000-4000-8000-000000000009', 'ready-set-prep', 'Ready Set Prep',
   'ready_set',
   'August–May', 'Tuesday and Thursday, 9:15–11:30 AM', null,
   null, '$80/week', 'Ready Set Prep and Ready Set Learn combined: $140/week',
   'Ages 3–4', null,
   'unknown', 'published', 'import',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14',
   '[]'::jsonb, null, null, null, null, false, 2),
  ('10000000-0000-4000-8000-00000000000a', 'ready-set-learn', 'Ready Set Learn',
   'ready_set',
   'August–May', 'Tuesday and Thursday, 11:45 AM–2:00 PM', null,
   null, '$80/week', 'Ready Set Prep and Ready Set Learn combined: $140/week',
   'Ages 4–5', null,
   'unknown', 'published', 'import',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14',
   '[]'::jsonb, null, null, null, null, false, 3),
  ('10000000-0000-4000-8000-00000000000b', 'ready-set-sensory', 'Ready Set Sensory',
   'ready_set',
   null, 'Wednesday, 9:30–11:30 AM', null,
   null, '$45/week', null,
   'Ages 3–5', null,
   'unknown', 'published', 'import',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14',
   '[]'::jsonb, null, null, null, null, false, 4),
  ('10000000-0000-4000-8000-000000000005', 'sewing', 'Sewing',
   'individual_class',
   null, 'Wednesday, 4:45–6:15 PM', 'Eight weeks',
   null, '$45/week',
   '$20 non-refundable deposit when paying weekly; no deposit when paying in full',
   null, null,
   'unknown', 'published', 'import',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14',
   '[]'::jsonb, null, null, null, null, false, 5),
  ('10000000-0000-4000-8000-00000000000e', 'crochet', 'Crochet',
   'individual_class',
   'November', 'Mondays in November, 2:00–4:00 PM', 'Four weeks',
   null, '$250, including materials', null,
   null,
   'A beginner class. No experience is required, and there is a take-home project each week.',
   'unknown', 'published', 'import',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14',
   '[]'::jsonb, null, null, null, null, false, 6),
  ('10000000-0000-4000-8000-000000000006', 'gardening', 'Gardening',
   'individual_class',
   'October–June; no class during the final week of October',
   'Thursday, 2:15–3:15 PM', null,
   null, null, null,
   'Ages 5 and up', null,
   'unknown', 'published', 'import-title-review-detail',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14 (QA-007: price unresolved)',
   '["Price: the flyer states $35/week and the email states $35 drop-in (QA-007, unresolved)"]'::jsonb,
   null, null, null, null, false, 7),
  ('10000000-0000-4000-8000-00000000000c', 'tutoring', 'Tutoring',
   'tutoring',
   null, 'Tuesday, Wednesday, and Thursday', null,
   null, '$65/hour or $40/half-hour', null,
   'Kindergarten and up',
   'Academic skill building, homework help, and test preparation.',
   'unknown', 'published', 'import',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14',
   '[]'::jsonb, null, null, null, null, false, 8),
  ('10000000-0000-4000-8000-00000000000d', 'monthly-clubs', 'Monthly Clubs',
   'monthly_club',
   null, 'Thursday, 4:30–6:30 PM', null,
   null, '$100/month or $30 drop-in', null,
   null, 'The first club is Lego.',
   'unknown', 'published', 'import',
   'BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14',
   '[]'::jsonb, null, null, null, null, false, 9)
on conflict (id) do update set
  slug                           = excluded.slug,
  name                           = excluded.name,
  offering_type                  = excluded.offering_type,
  published_dates                = excluded.published_dates,
  published_schedule             = excluded.published_schedule,
  published_duration             = excluded.published_duration,
  published_session_length       = excluded.published_session_length,
  published_price                = excluded.published_price,
  published_registration_options = excluded.published_registration_options,
  audience                       = excluded.audience,
  summary                        = excluded.summary,
  publication_state              = excluded.publication_state,
  import_status                  = excluded.import_status,
  source                         = excluded.source,
  unverified_details             = excluded.unverified_details,
  image_src                      = excluded.image_src,
  image_alt                      = excluded.image_alt,
  image_width                    = excluded.image_width,
  image_height                   = excluded.image_height,
  image_is_placeholder           = excluded.image_is_placeholder,
  sort_order                     = excluded.sort_order;


-- ---------------------------------------------------------------------------
-- 4. A published program carries an offering type
-- ---------------------------------------------------------------------------
-- Added after the backfill so it validates the reconciled rows. If a hosted
-- project holds some other published program with no type, this fails the
-- migration rather than guessing a classification for it.
alter table public.programs
  add constraint programs_published_has_offering_type
  check (publication_state <> 'published' or offering_type is not null);

-- The same rule, as a sentence an administrator can act on. Otherwise unchanged
-- from 20260830090000_admin_program_enrollment_operations.sql.
create or replace function public.admin_set_program_publication(
  target_id uuid,
  next_state public.program_publication_state,
  expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.programs%rowtype;
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into current_row from public.programs where id = target_id for update;

  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'program changed since it was loaded' using errcode = '40001';
  end if;

  if current_row.publication_state = next_state then
    return 'unchanged';
  end if;

  if not private.program_publication_transition_allowed(
       current_row.publication_state, next_state) then
    raise exception 'transition from % to % is not approved',
      current_row.publication_state, next_state using errcode = '23514';
  end if;

  if next_state = 'published'
     and (current_row.summary is null or btrim(current_row.summary) = '') then
    raise exception 'a program needs a summary before it can be published'
      using errcode = '22023';
  end if;

  if next_state = 'published' and current_row.offering_type is null then
    raise exception 'a program needs an offering type before it can be published'
      using errcode = '22023';
  end if;

  update public.programs
  set publication_state = next_state
  where id = target_id;

  return 'updated';
end;
$$;


-- ---------------------------------------------------------------------------
-- 5. admin_update_program_facts — offering type joins the signature
-- ---------------------------------------------------------------------------
-- Dropped and replaced rather than overloaded, for the reason recorded in
-- 20260903000000_family_conversion_journey.sql. The body is unchanged apart from
-- the new column. NULL is accepted: a draft may stay unclassified, and the
-- publish path above is what refuses it.
drop function if exists public.admin_update_program_facts(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text,
  text, text, public.availability_state, text, public.program_confirmation_mode);

create function public.admin_update_program_facts(
  target_id uuid,
  expected_updated_at timestamptz,
  program_name text,
  program_summary text,
  program_audience text,
  program_format text,
  program_location text,
  program_educator text,
  program_dates text,
  program_schedule text,
  program_duration text,
  program_session_length text,
  program_price text,
  program_availability public.availability_state,
  program_checkout_url text,
  program_confirmation_mode public.program_confirmation_mode,
  program_offering_type public.offering_type
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.programs%rowtype;
  trimmed_name text := btrim(coalesce(program_name, ''));
  clean_checkout text := nullif(btrim(coalesce(program_checkout_url, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if trimmed_name = '' or char_length(trimmed_name) > 160 then
    raise exception 'program name must be 1 to 160 characters'
      using errcode = '22023';
  end if;

  if program_confirmation_mode is null then
    raise exception 'confirmation mode is required' using errcode = '22023';
  end if;

  if clean_checkout is not null
     and clean_checkout !~ '^https://pay\.homeschoolhaven\.org(/[A-Za-z0-9._~/-]*)?$' then
    raise exception 'checkout link must be an https pay.homeschoolhaven.org address with no query string'
      using errcode = '22023';
  end if;

  select * into current_row from public.programs where id = target_id for update;

  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'program changed since it was loaded' using errcode = '40001';
  end if;

  if program_offering_type is null and current_row.publication_state = 'published' then
    raise exception 'a published program needs an offering type'
      using errcode = '22023';
  end if;

  update public.programs
  set name                     = trimmed_name,
      summary                  = nullif(btrim(coalesce(program_summary, '')), ''),
      audience                 = nullif(btrim(coalesce(program_audience, '')), ''),
      format                   = nullif(btrim(coalesce(program_format, '')), ''),
      location                 = nullif(btrim(coalesce(program_location, '')), ''),
      educator                 = nullif(btrim(coalesce(program_educator, '')), ''),
      published_dates          = nullif(btrim(coalesce(program_dates, '')), ''),
      published_schedule       = nullif(btrim(coalesce(program_schedule, '')), ''),
      published_duration       = nullif(btrim(coalesce(program_duration, '')), ''),
      published_session_length = nullif(btrim(coalesce(program_session_length, '')), ''),
      published_price          = nullif(btrim(coalesce(program_price, '')), ''),
      availability             = program_availability,
      checkout_url             = clean_checkout,
      confirmation_mode        = program_confirmation_mode,
      offering_type            = program_offering_type
  where id = target_id;

  return 'updated';
end;
$$;

revoke all on function public.admin_update_program_facts(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text,
  text, text, public.availability_state, text,
  public.program_confirmation_mode, public.offering_type) from public;
grant execute on function public.admin_update_program_facts(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text,
  text, text, public.availability_state, text,
  public.program_confirmation_mode, public.offering_type) to authenticated;


-- ---------------------------------------------------------------------------
-- 6. record_program_audit — offering type and summary are material
-- ---------------------------------------------------------------------------
-- Otherwise unchanged from 20260903000000_family_conversion_journey.sql.
create or replace function public.record_program_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed jsonb := '{}'::jsonb;
  material text[] := array[
    'publication_state', 'published_price', 'published_registration_options',
    'published_dates', 'published_schedule', 'published_duration',
    'published_session_length', 'availability', 'enrollment_window',
    'checkout_url', 'educator', 'location', 'name', 'slug',
    'capacity', 'waitlist_enabled', 'confirmation_mode',
    'offering_type', 'summary'
  ];
  field text;
  old_json jsonb;
  new_json jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'program', new.id, 'created',
       jsonb_build_object('publication_state', new.publication_state));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'program', old.id, 'deleted',
       jsonb_build_object('slug', old.slug));
    return old;
  end if;

  old_json := to_jsonb(old);
  new_json := to_jsonb(new);

  foreach field in array material loop
    if old_json -> field is distinct from new_json -> field then
      changed := changed || jsonb_build_object(
        field,
        jsonb_build_object('from', old_json -> field, 'to', new_json -> field)
      );
    end if;
  end loop;

  if changed <> '{}'::jsonb then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'program', new.id, 'updated', changed);
  end if;

  return new;
end;
$$;

revoke all on function public.record_program_audit() from public;
