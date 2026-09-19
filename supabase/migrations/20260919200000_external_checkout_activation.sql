-- Slice 4 — external checkout activation and payment truth
--
-- MPS: MPS-REQ-013, MPS-REQ-020, MPS-REQ-024; MPS-RUL-005; import rules 1, 4, 5;
--      DEC-033 (checkout, not registration); GAP-015 stays open.
-- MTS: INTEGRATION-MANIFEST "External checkout"; SECURITY-ARCHITECTURE "keep
--      private data out of URLs".
-- Prompt: prompts/external-checkout-payment-truth.md (§4 is the source evidence)
--
-- Source: every "Register & Pay" / "Pay Now" action on
-- https://homeschoolhaven.org/classes, which Samantha Dodson confirmed is the
-- approved checkout, inspected in a real browser on 2026-09-19. Each button is
-- a GoDaddy pay button (`href="#"`) that opens
-- https://poynt.godaddy.com/checkout/<business-id>/<short-name>?sourceApp=wam.paybutton
-- in an in-page frame, with no HTTP redirect. The bare URL, without GoDaddy's
-- constant `sourceApp` tag, loads the same checkout top-level; it is what is
-- stored, because a stored checkout link carries no query string.
--
-- What this does, in order:
--
--   1. `private.is_approved_checkout_url` — the one SQL allowlist. It keeps the
--      existing pay.homeschoolhaven.org rule and adds poynt.godaddy.com ONLY
--      under Home School Haven's own GoDaddy business path. Not "any GoDaddy
--      URL": another merchant's checkout on the same host is refused.
--   2. `admin_update_program_facts` uses it. Signature and body are otherwise
--      unchanged from 20260916000000_public_offering_model.sql.
--   3. `programs_checkout_url_approved` — the same rule as a table constraint,
--      so no write path (seed, service role, a future function) can store an
--      unapproved destination.
--   4. Sets the eight exact mappings, by fixed id, only where `checkout_url` is
--      still NULL and the program is published. Idempotent, never overwrites an
--      administrator's value, and audited by `record_program_audit` because
--      `checkout_url` is a material field. Tutoring (…000c) has no checkout
--      action on the source page and stays NULL. Ready Set Prep (…0009) and
--      Ready Set Learn (…000a) share one checkout, which names both classes.
--      Nothing else — price, availability, dates, capacity, confirmation mode —
--      is touched.
--
-- rollback (in order):
--   update public.programs p set checkout_url = null
--   from (values
--     ('10000000-0000-4000-8000-000000000002'::uuid, 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/0342bb2d-f9c2-4573-a196-943'),
--     ('10000000-0000-4000-8000-000000000009'::uuid, 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/1232e79c-3492-461d-a305-eb1'),
--     ('10000000-0000-4000-8000-00000000000a'::uuid, 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/1232e79c-3492-461d-a305-eb1'),
--     ('10000000-0000-4000-8000-00000000000b'::uuid, 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/f5bbc6ae-3bb3-424e-a014-24a'),
--     ('10000000-0000-4000-8000-00000000000e'::uuid, 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/a8c851d1-9461-426f-924d-7c5'),
--     ('10000000-0000-4000-8000-000000000005'::uuid, 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/568b1ef2-952a-499b-878a-599'),
--     ('10000000-0000-4000-8000-000000000006'::uuid, 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/cd911575-37c3-4e2e-ad66-1b2'),
--     ('10000000-0000-4000-8000-00000000000d'::uuid, 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/7fa2bfc8-430f-48e3-8ea7-c01')
--   ) as v(id, url)
--   where p.id = v.id and p.checkout_url = v.url;
--   alter table public.programs drop constraint if exists programs_checkout_url_approved;
--   -- re-create public.admin_update_program_facts from
--   -- 20260916000000_public_offering_model.sql §5 (inline pay.homeschoolhaven.org regex)
--   drop function if exists private.is_approved_checkout_url(text);
--   -- The clears are themselves audited; the activation events stay in
--   -- audit_events as history.


-- ---------------------------------------------------------------------------
-- 1. The allowlist
-- ---------------------------------------------------------------------------
create function private.is_approved_checkout_url(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate ~ '^https://pay\.homeschoolhaven\.org(/[A-Za-z0-9._~/-]*)?$'
      or candidate ~ '^https://poynt\.godaddy\.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/[A-Za-z0-9-]+$'
$$;

comment on function private.is_approved_checkout_url(text) is
  'The approved external checkout destinations (prompts/external-checkout-payment-truth.md §4): '
  'https pay.homeschoolhaven.org, or Home School Haven''s own GoDaddy checkout path on '
  'poynt.godaddy.com. No query string, no fragment, no other merchant.';


-- ---------------------------------------------------------------------------
-- 2. admin_update_program_facts — same signature, allowlist from §1
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_program_facts(
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
     and not private.is_approved_checkout_url(clean_checkout) then
    raise exception 'checkout link must be Home School Haven''s own https GoDaddy checkout (poynt.godaddy.com/checkout/…) or pay.homeschoolhaven.org address, with no query string'
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


-- ---------------------------------------------------------------------------
-- 3. The same rule on the table
-- ---------------------------------------------------------------------------
-- Every existing value is NULL (no checkout URL has ever been set), so this
-- validates immediately. If a hosted project holds some other value, the
-- migration fails here rather than keeping a destination nobody approved.
alter table public.programs
  add constraint programs_checkout_url_approved
  check (checkout_url is null or private.is_approved_checkout_url(checkout_url));


-- ---------------------------------------------------------------------------
-- 4. The exact mappings (prompt §4)
-- ---------------------------------------------------------------------------
update public.programs as p
set checkout_url = v.url
from (values
  -- Haven Days Enrichment — "Register & Pay"
  ('10000000-0000-4000-8000-000000000002'::uuid,
   'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/0342bb2d-f9c2-4573-a196-943'),
  -- Ready Set Prep & Learn — "Pay Now"; one checkout naming both classes
  ('10000000-0000-4000-8000-000000000009'::uuid,
   'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/1232e79c-3492-461d-a305-eb1'),
  ('10000000-0000-4000-8000-00000000000a'::uuid,
   'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/1232e79c-3492-461d-a305-eb1'),
  -- Ready Set Sensory — "PAY NOW"
  ('10000000-0000-4000-8000-00000000000b'::uuid,
   'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/f5bbc6ae-3bb3-424e-a014-24a'),
  -- Beginners Crocheting Class — "Pay Now"
  ('10000000-0000-4000-8000-00000000000e'::uuid,
   'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/a8c851d1-9461-426f-924d-7c5'),
  -- Sewing ( EVENING CLASS) — "Pay Now"
  ('10000000-0000-4000-8000-000000000005'::uuid,
   'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/568b1ef2-952a-499b-878a-599'),
  -- Gardening Club — "PAY NOW"
  ('10000000-0000-4000-8000-000000000006'::uuid,
   'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/cd911575-37c3-4e2e-ad66-1b2'),
  -- MONTHLY THEMED CLUBS — "PAY NOW"
  ('10000000-0000-4000-8000-00000000000d'::uuid,
   'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/7fa2bfc8-430f-48e3-8ea7-c01')
) as v(id, url)
where p.id = v.id
  and p.checkout_url is null
  and p.publication_state = 'published';
