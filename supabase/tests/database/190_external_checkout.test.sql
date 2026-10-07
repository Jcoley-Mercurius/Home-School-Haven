-- Slice 4 — external checkout activation (MPS-REQ-013, MPS-REQ-024,
-- MPS-RUL-005; prompts/external-checkout-payment-truth.md §4, §7, §8)
--
-- What this file proves, at the layer that holds when no application code is
-- involved:
--
--   1. The activation stored exactly the recorded destinations, by fixed id,
--      and left Tutoring and every archived program NULL.
--   2. The allowlist accepts Home School Haven's own GoDaddy checkout and
--      refuses every other form: another merchant, a query string, a fragment,
--      http, a lookalike host, the classes page.
--   3. The table constraint refuses an unapproved destination even from a
--      write path that bypasses `admin_update_program_facts`.
--   4. Only an administrator can change a checkout link. A parent, an
--      educator, a no-role account, and anon are refused.
--   5. A checkout-link change is audited with its actor, and the activation
--      itself left an audit event per program.
--   6. Nothing about the activation created an enrollment, a payment state, or
--      a STEP UP row.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

\set admin    '20000000-0000-4000-8000-000000000ad0'
\set parent_a '20000000-0000-4000-8000-00000000000a'
\set educator '20000000-0000-4000-8000-00000000000e'
\set norole   '20000000-0000-4000-8000-0000000000f0'
\set tutoring '10000000-0000-4000-8000-00000000000c'
\set crochet  '10000000-0000-4000-8000-00000000000e'
\set biz      '2bf1b322-d362-4d5d-a4a7-5e5791473f14'


-- ===========================================================================
-- 1. The stored mappings
-- ===========================================================================
select results_eq(
  $$ select id::text, checkout_url from public.programs
       where checkout_url is not null order by id $$,
  $$ values
     ('10000000-0000-4000-8000-000000000002', 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/0342bb2d-f9c2-4573-a196-943'),
     ('10000000-0000-4000-8000-000000000005', 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/568b1ef2-952a-499b-878a-599'),
     ('10000000-0000-4000-8000-000000000006', 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/cd911575-37c3-4e2e-ad66-1b2'),
     ('10000000-0000-4000-8000-000000000009', 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/1232e79c-3492-461d-a305-eb1'),
     ('10000000-0000-4000-8000-00000000000a', 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/1232e79c-3492-461d-a305-eb1'),
     ('10000000-0000-4000-8000-00000000000b', 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/f5bbc6ae-3bb3-424e-a014-24a'),
     ('10000000-0000-4000-8000-00000000000d', 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/7fa2bfc8-430f-48e3-8ea7-c01'),
     ('10000000-0000-4000-8000-00000000000e', 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/a8c851d1-9461-426f-924d-7c5') $$,
  'exactly the eight recorded mappings are stored, and nothing else'
);
select is(
  (select checkout_url from public.programs where id = :'tutoring'::uuid),
  null,
  'Tutoring has no checkout action on the source page and stays NULL'
);
select is(
  (select count(*)::int from public.programs
    where publication_state <> 'published' and checkout_url is not null),
  0,
  'no archived or draft program was given a checkout link'
);
select is(
  (select count(*)::int from public.programs
    where checkout_url ~ '[?#]'),
  0,
  'no stored checkout link carries a query string or fragment'
);
select is(
  (select count(*)::int from public.programs
    where checkout_url like '%homeschoolhaven.org/classes%'),
  0,
  'the source page is never stored as a checkout destination'
);


-- ===========================================================================
-- 2. The allowlist
-- ===========================================================================
select ok(
  private.is_approved_checkout_url(
    'https://poynt.godaddy.com/checkout/' || :'biz' || '/cd911575-37c3-4e2e-ad66-1b2'),
  'Home School Haven''s own GoDaddy checkout is approved'
);
select ok(
  private.is_approved_checkout_url('https://pay.homeschoolhaven.org/sewing'),
  'the existing pay.homeschoolhaven.org form is still approved'
);
select ok(
  not private.is_approved_checkout_url(
    'https://poynt.godaddy.com/checkout/00000000-0000-4000-8000-000000000000/x'),
  'another merchant''s checkout on the same host is refused'
);
select ok(
  not private.is_approved_checkout_url(
    'https://poynt.godaddy.com/checkout/' || :'biz' || '/x?sourceApp=wam.paybutton'),
  'a query string is refused, even GoDaddy''s own source tag'
);
select ok(
  not private.is_approved_checkout_url(
    'https://poynt.godaddy.com/checkout/' || :'biz' || '/x#student'),
  'a fragment is refused'
);
select ok(
  not private.is_approved_checkout_url(
    'http://poynt.godaddy.com/checkout/' || :'biz' || '/x'),
  'http is refused'
);
select ok(
  not private.is_approved_checkout_url(
    'https://poynt.godaddy.com.evil.com/checkout/' || :'biz' || '/x'),
  'a lookalike host is refused'
);
select ok(
  not private.is_approved_checkout_url(
    'https://poynt.godaddy.com/checkout/' || :'biz' || '/x/student-name'),
  'an extra path segment is refused'
);
select ok(
  not private.is_approved_checkout_url('https://www.godaddy.com/'),
  'a generic GoDaddy address is refused: the allowlist is not "any GoDaddy URL"'
);
select ok(
  not private.is_approved_checkout_url('https://homeschoolhaven.org/classes'),
  'the classes page itself is refused'
);


-- ===========================================================================
-- 3. The table constraint holds for a write path that skips the function
-- ===========================================================================
-- This runs as the migration owner, which is exactly the path (seed, service
-- role, a future function) the constraint exists for.
select throws_ok(
  $$ update public.programs set checkout_url = 'https://evil.example.com/pay'
       where id = '10000000-0000-4000-8000-00000000000c' $$,
  '23514',
  null,
  'the table refuses an unapproved destination even without the admin function'
);
select throws_ok(
  $$ update public.programs
       set checkout_url = 'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/x?student=abc'
       where id = '10000000-0000-4000-8000-00000000000c' $$,
  '23514',
  null,
  'the table refuses a checkout link carrying a query string'
);


-- ===========================================================================
-- 4. Who may change a checkout link
-- ===========================================================================
set local role authenticated;

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-00000000000e',
       (select updated_at from public.programs
          where id = '10000000-0000-4000-8000-00000000000e'),
       'Crochet', '', '', '', '', '', '', '', '', '', '', 'unknown',
       'https://pay.homeschoolhaven.org/x', 'administrator_approval',
       'individual_class') $$,
  '42501', null,
  'a parent cannot change a checkout link'
);
select throws_ok(
  $$ update public.programs set checkout_url = null
       where id = '10000000-0000-4000-8000-00000000000e' $$,
  '42501', null,
  'a parent cannot write a checkout link directly'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-00000000000e',
       (select updated_at from public.programs
          where id = '10000000-0000-4000-8000-00000000000e'),
       'Crochet', '', '', '', '', '', '', '', '', '', '', 'unknown',
       'https://pay.homeschoolhaven.org/x', 'administrator_approval',
       'individual_class') $$,
  '42501', null,
  'an educator cannot change a checkout link'
);

-- Editable user metadata claiming a role grants nothing.
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-0000000000f0","role":"authenticated","user_metadata":{"role":"admin"}}';
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-00000000000e',
       (select updated_at from public.programs
          where id = '10000000-0000-4000-8000-00000000000e'),
       'Crochet', '', '', '', '', '', '', '', '', '', '', 'unknown',
       'https://pay.homeschoolhaven.org/x', 'administrator_approval',
       'individual_class') $$,
  '42501', null,
  'a no-role account claiming admin in user metadata cannot change a checkout link'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-00000000000e', now(),
       'Crochet', '', '', '', '', '', '', '', '', '', '', 'unknown',
       'https://pay.homeschoolhaven.org/x', 'administrator_approval',
       'individual_class') $$,
  '42501', null,
  'anon cannot change a checkout link'
);
-- Anon may read a published program's checkout link: it is public content,
-- exactly as the classes page publishes it.
select is(
  (select checkout_url from public.programs where slug = 'crochet'),
  'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/a8c851d1-9461-426f-924d-7c5',
  'anon reads a published program''s checkout link'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-00000000000e',
       (select updated_at from public.programs
          where id = '10000000-0000-4000-8000-00000000000e'),
       'Crochet', '', '', '', '', '', '', '', '', '', '', 'unknown',
       'https://poynt.godaddy.com/checkout/00000000-0000-4000-8000-000000000000/x',
       'administrator_approval', 'individual_class') $$,
  '22023', null,
  'an administrator cannot save another merchant''s checkout'
);
select throws_ok(
  $$ select public.admin_update_program_facts(
       '10000000-0000-4000-8000-00000000000e',
       (select updated_at from public.programs
          where id = '10000000-0000-4000-8000-00000000000e'),
       'Crochet', '', '', '', '', '', '', '', '', '', '', 'unknown',
       'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/a8c851d1-9461-426f-924d-7c5?parent=x',
       'administrator_approval', 'individual_class') $$,
  '22023', null,
  'an administrator cannot save a checkout link carrying family data'
);

-- The approved change: clear, then restore, Crochet's link.
select is(
  public.admin_update_program_facts(
    :'crochet'::uuid,
    (select updated_at from public.programs where id = :'crochet'::uuid),
    'Crochet', '', '', '', '', '', '', '', '', '', '', 'unknown',
    '', 'administrator_approval', 'individual_class'),
  'updated',
  'an administrator can clear a checkout link (a rotating class ends)'
);
select is(
  (select checkout_url from public.programs where id = :'crochet'::uuid),
  null,
  'a cleared checkout link is NULL, never the empty string'
);
select is(
  public.admin_update_program_facts(
    :'crochet'::uuid,
    (select updated_at from public.programs where id = :'crochet'::uuid),
    'Crochet', '', '', '', '', '', '', '', '', '', '', 'unknown',
    'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/a8c851d1-9461-426f-924d-7c5',
    'administrator_approval', 'individual_class'),
  'updated',
  'an administrator can set an approved GoDaddy checkout link'
);


-- ===========================================================================
-- 5. Attributable history
-- ===========================================================================
select is(
  (select count(*)::int from public.audit_events
    where entity_type = 'program' and entity_id = :'crochet'::uuid
      and actor_user_id = :'admin'::uuid
      and changed_fields ? 'checkout_url'),
  2,
  'each checkout-link change is audited with the administrator as actor'
);
select is(
  (select changed_fields -> 'checkout_url' ->> 'to'
     from public.audit_events
    where entity_type = 'program' and entity_id = :'crochet'::uuid
      and actor_user_id = :'admin'::uuid
      and changed_fields ? 'checkout_url'
    order by occurred_at desc, id desc limit 1),
  'https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/a8c851d1-9461-426f-924d-7c5',
  'the audit records the new destination'
);

reset role;
select is(
  (select count(distinct entity_id)::int from public.audit_events
    where entity_type = 'program' and actor_user_id is null
      and changed_fields -> 'checkout_url' ->> 'from' is null
      and changed_fields -> 'checkout_url' ->> 'to' like 'https://poynt.godaddy.com/checkout/%'),
  8,
  'the activation itself left one audit event per activated program'
);


-- ===========================================================================
-- 6. The activation created no payment or enrollment truth
-- ===========================================================================
select is(
  (select count(*)::int from public.registration_step_up_requests),
  0,
  'no STEP UP request exists'
);
select is(
  (select count(*)::int from public.enrollments where state = 'payment_pending'
     and id not in ('50000000-0000-4000-8000-000000000001')),
  0,
  'no enrollment was moved to payment_pending (only the seeded sample holds it)'
);
select ok(
  not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'programs'
       and column_name ~ '(coupon|discount|payment|transaction)'),
  'programs carries no coupon, discount, payment, or transaction column'
);

select * from finish();
rollback;
