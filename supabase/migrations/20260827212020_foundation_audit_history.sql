-- Foundation Release — attributable history for material changes
--
-- MPS-REQ-024: preserve an attributable history of material administrative
-- changes to program state, pricing presentation, schedule, capacity, enrollment
-- state, educator assignment, consent version, and published content.
--
-- Consent-version and enrollment-state events are not emitted yet because those
-- entities do not exist in this release (MPS GAP-005 / GAP-010). The table shape
-- already carries them.
--
-- rollback:
--   drop trigger if exists educator_assignments_audit on public.educator_assignments;
--   drop trigger if exists programs_audit on public.programs;
--   drop function if exists public.record_educator_assignment_audit();
--   drop function if exists public.record_program_audit();
--   drop table if exists public.audit_events;

create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- NULL when the change was made by a migration, seed, or CLI operation rather
  -- than a signed-in actor. Recorded honestly rather than attributed to nobody.
  actor_user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changed_fields jsonb not null default '{}'::jsonb
);

create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, occurred_at desc);

comment on table public.audit_events is
  'Append-only attributable history (MPS-REQ-024). No UPDATE or DELETE is '
  'granted to any Data API role, and no RLS write policy exists.';

-- Append-only at the privilege level as well as the policy level.
revoke update, delete, truncate on public.audit_events from anon, authenticated;


-- ---------------------------------------------------------------------------
-- programs audit trigger
-- ---------------------------------------------------------------------------
-- Material fields only (MPS-REQ-024 "material administrative changes"). A typo
-- fix in `source` is not history-worthy; a price or publication change is.
create function public.record_program_audit()
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
    'checkout_url', 'educator', 'location', 'name', 'slug'
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

create trigger programs_audit
  after insert or update or delete on public.programs
  for each row execute function public.record_program_audit();


-- ---------------------------------------------------------------------------
-- educator assignment audit trigger
-- ---------------------------------------------------------------------------
create function public.record_educator_assignment_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      ((select auth.uid()), 'educator_assignment', new.program_id, 'assigned',
       jsonb_build_object('educator_user_id', new.educator_user_id));
    return new;
  end if;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, action, changed_fields)
  values
    ((select auth.uid()), 'educator_assignment', old.program_id, 'unassigned',
     jsonb_build_object('educator_user_id', old.educator_user_id));
  return old;
end;
$$;

revoke all on function public.record_educator_assignment_audit() from public;

create trigger educator_assignments_audit
  after insert or delete on public.educator_assignments
  for each row execute function public.record_educator_assignment_audit();
