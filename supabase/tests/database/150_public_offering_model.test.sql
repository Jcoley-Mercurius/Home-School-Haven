-- Closeout Slice 1 — public offering model (owner evidence of 2026-09-14;
-- MPS-REQ-008, MPS-REQ-016, MPS-REQ-020, MPS-REQ-024; MPS-RUL-005)
--
-- Migration: 20260916000000_public_offering_model.sql

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

\set admin     '20000000-0000-4000-8000-000000000ad0'
\set draft     '10000000-0000-4000-8000-0000000000ff'
\set sewing    '10000000-0000-4000-8000-000000000005'
\set gardening '10000000-0000-4000-8000-000000000006'

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select enum_has_labels(
  'public', 'offering_type',
  array['haven_days', 'ready_set', 'individual_class', 'tutoring', 'monthly_club'],
  'offering_type holds exactly the five approved groups, in order'
);
select col_is_null(
  'public', 'programs', 'offering_type',
  'offering_type is nullable, so an unclassified draft needs no invented value'
);

-- ---------------------------------------------------------------------------
-- anon (public visitor): the reconciled catalog
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select string_agg(slug || '=' || offering_type::text, ',' order by sort_order)
     from public.programs),
  'haven-days-enrichment=haven_days,ready-set-prep=ready_set,'
  'ready-set-learn=ready_set,ready-set-sensory=ready_set,'
  'sewing=individual_class,crochet=individual_class,'
  'gardening=individual_class,tutoring=tutoring,monthly-clubs=monthly_club',
  'anon reads the nine verified offerings, each classified, in catalog order'
);
select is(
  (select count(*)::int from public.programs
    where slug in ('ready-set-prep-and-learn', 'etiquette-series', 'art-lab',
                   'harvest-explorers', 'history-explorers')),
  0,
  'no archived offering is visible to a public visitor'
);
select is(
  (select published_price from public.programs where slug = 'gardening'),
  null,
  'Gardening publishes no price while the flyer and email disagree (QA-007)'
);
select is(
  (select published_price from public.programs where slug = 'haven-days-enrichment'),
  'One day $280/month; two days $550/month; three days $795/month',
  'Haven Days publishes its verified monthly prices'
);
select is(
  (select count(*)::int from public.programs
    where concat_ws(' ', published_dates, published_schedule, published_duration,
                    published_price, published_registration_options, audience,
                    summary) ~ '(19|20)[0-9]{2}'),
  0,
  'no published offering fact carries a year'
);

reset role;

-- ---------------------------------------------------------------------------
-- Stale offerings are archived, not deleted
-- ---------------------------------------------------------------------------
select is(
  (select string_agg(slug || '=' || publication_state::text, ',' order by slug)
     from public.programs
    where slug in ('ready-set-prep-and-learn', 'etiquette-series', 'art-lab',
                   'harvest-explorers', 'history-explorers')),
  'art-lab=archived,etiquette-series=archived,harvest-explorers=archived,'
  'history-explorers=archived,ready-set-prep-and-learn=archived',
  'the five unsupported offerings still exist, archived'
);

-- ---------------------------------------------------------------------------
-- A published program must carry an offering type
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ update public.programs set offering_type = null where id = %L $$,
         :'sewing'),
  '23514', null,
  'the table itself refuses a published program with no offering type'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000ad0","role":"authenticated"}';

-- An unclassified draft may be saved.
select is(
  public.admin_update_program_facts(
    :'draft'::uuid,
    (select updated_at from public.programs where id = :'draft'::uuid),
    'Sample Unpublished Draft (test fixture)', 'A sample summary.',
    '', '', '', '', '', '', '', '', '', 'unknown', '', 'administrator_approval',
    null),
  'updated',
  'an administrator may leave a draft unclassified'
);
select throws_ok(
  format($$ select public.admin_set_program_publication(%L,
            'published', (select updated_at from public.programs where id = %L)) $$,
         :'draft', :'draft'),
  '22023',
  'a program needs an offering type before it can be published',
  'publishing an unclassified draft is refused with a sentence an administrator can act on'
);
select throws_ok(
  format($$ select public.admin_update_program_facts(%L,
            (select updated_at from public.programs where id = %L),
            'Sewing', '', '', '', '', '', '', '', '', '', '', 'unknown', '',
            'administrator_approval', null) $$,
         :'sewing', :'sewing'),
  '22023',
  'a published program needs an offering type',
  'a published program cannot be declassified through the facts form'
);

-- Classify and publish: the path works end to end.
select is(
  public.admin_update_program_facts(
    :'draft'::uuid,
    (select updated_at from public.programs where id = :'draft'::uuid),
    'Sample Unpublished Draft (test fixture)', 'A sample summary.',
    '', '', '', '', '', '', '', '', '', 'unknown', '', 'administrator_approval',
    'monthly_club'),
  'updated',
  'an administrator can classify a draft'
);
select is(
  public.admin_set_program_publication(
    :'draft'::uuid, 'published',
    (select updated_at from public.programs where id = :'draft'::uuid)),
  'updated',
  'a classified draft with a summary can be published'
);

-- MPS-REQ-024: the classification change is attributable history.
select is(
  (select changed_fields -> 'offering_type' ->> 'to'
     from public.audit_events
    where entity_type = 'program' and entity_id = :'draft'::uuid
      and changed_fields ? 'offering_type'
    order by occurred_at desc, id desc limit 1),
  'monthly_club',
  'an offering type change is recorded in the audit trail'
);
select is(
  (select actor_user_id from public.audit_events
    where entity_type = 'program' and entity_id = :'draft'::uuid
      and changed_fields ? 'offering_type'
    order by occurred_at desc, id desc limit 1),
  :'admin'::uuid,
  'the audit event names the administrator who made it'
);

select * from finish();
rollback;
