-- Foundation Release — program announcement and learning-resource authoring
--
-- HSH-SLICE-CONTENT-01. MPS-REQ-004, 018, 019, 020, 024; MPS-RUL-003;
-- MPS-ACC-005, 029, 030, 031; MPS-WFL-006 main path steps 2 and 3.
-- Plan: prompts/program-announcements-resources.md
--
-- WHAT THIS ADDS
--
--   1. A four-state content lifecycle (draft, published, replaced, removed),
--      replacing the `published` boolean on both content tables.
--   2. A resource `kind` and the columns a stored file needs.
--   3. Eleven `security definer` authoring functions. Neither table gains a
--      direct write verb for any client role — the same posture
--      `20260830090000` established for `public.programs`.
--   4. Attributable history for every material content action.
--   5. The private `program-resources` Storage bucket and its object policies.
--
-- WHY THE BOOLEAN IS DROPPED RATHER THAN KEPT
--
-- MPS-REQ-020 requires one authoritative record. `published boolean` and
-- `state content_state` can disagree, and a surface reading the stale one would
-- tell a family something untrue about what an educator published. Two columns
-- that must agree is exactly the second copy that requirement forbids, so the
-- boolean goes and four policies, two indexes, one constraint, and two
-- application read modules are rewritten in the same change.
--
-- WHAT "REMOVED" MEANS HERE, AND WHY IT IS NOT A DELETE
--
-- Owner decision, 2026-08-31 (GAP-CONTENT-03). Retention, deletion, and
-- archival expectations are unanswered on the policy checklist (§11), so
-- removal revokes access and retains the record: the row stays, the storage
-- object stays, and NO client role holds `delete` on either. That is the
-- reversible choice; erasure is not, and inventing a retention rule is
-- forbidden by MPS-RUL-007 and AGENTS.md §6.
--
-- rollback:
--   drop policy if exists "program_resources_select_authorized" on storage.objects;
--   drop policy if exists "program_resources_insert_author" on storage.objects;
--   delete from storage.objects where bucket_id = 'program-resources';
--   delete from storage.buckets where id = 'program-resources';
--   drop trigger if exists announcements_audit on public.announcements;
--   drop trigger if exists learning_resources_audit on public.learning_resources;
--   drop function if exists public.record_announcement_audit();
--   drop function if exists public.record_learning_resource_audit();
--   drop function if exists public.content_create_announcement_draft(uuid, text, text);
--   drop function if exists public.content_update_announcement_draft(uuid, timestamptz, text, text);
--   drop function if exists public.content_publish_announcement(uuid, timestamptz);
--   drop function if exists public.content_replace_announcement(uuid, timestamptz, text, text);
--   drop function if exists public.content_remove_announcement(uuid, timestamptz);
--   drop function if exists public.content_create_resource_draft(uuid, text, text, public.resource_kind, text);
--   drop function if exists public.content_update_resource_draft(uuid, timestamptz, text, text, text);
--   drop function if exists public.content_attach_resource_file(uuid, timestamptz, text, text, bigint, text);
--   drop function if exists public.content_publish_resource(uuid, timestamptz);
--   drop function if exists public.content_replace_resource(uuid, timestamptz, text, text, text);
--   drop function if exists public.content_remove_resource(uuid, timestamptz);
--   drop function if exists private.content_may_author(uuid);
--   drop function if exists private.content_transition_allowed(public.content_state, public.content_state);
--   -- then restore `published boolean` from `state`, restore the four SELECT
--   -- policies and two indexes from 20260829170000, drop the added columns,
--   -- and drop the two enum types. LOSSY: `replaced` and `removed` collapse to
--   -- `published = false`, and a file-backed resource cannot be represented at
--   -- all by the pre-migration table (`url` is NOT NULL and must match
--   -- '^https?://'). See plan §17 — rolling back after files exist needs a
--   -- retention decision, not just a down-migration.


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
-- MPS-REQ-019 names create, publish, replace, and remove. `draft` is the state
-- a created item is in, so the four verbs need exactly these four states.
-- There is no `scheduled`: MDS lists one among the announcement component's
-- states, but no approved MPS requirement or workflow authorizes scheduling,
-- and a design state is not a product authorization.
create type public.content_state as enum (
  'draft', 'published', 'replaced', 'removed'
);

-- Exactly the five MDS `learning_resource` variants
-- (MDS-PROJECT-STATE.yaml:445). No sixth kind is invented here.
create type public.resource_kind as enum (
  'document', 'link', 'video', 'activity', 'download'
);


-- ---------------------------------------------------------------------------
-- The two policies that read `published`, dropped up front
-- ---------------------------------------------------------------------------
-- Postgres refuses to drop a column a policy depends on, and both family
-- policies test `published`. They are dropped here and recreated in terms of
-- `state` further down, so the window in which no family policy exists is
-- inside this transaction and never observable. Deny-by-default means the
-- window is closed, not open: with no policy, a family reads nothing.
drop policy "announcements_select_enrolled_family" on public.announcements;
drop policy "learning_resources_select_enrolled_family" on public.learning_resources;


-- ---------------------------------------------------------------------------
-- announcements — lifecycle columns
-- ---------------------------------------------------------------------------
alter table public.announcements
  add column state public.content_state not null default 'draft',
  add column replaced_by_id uuid references public.announcements (id) on delete set null,
  add column replaced_at timestamptz,
  add column removed_at timestamptz,
  -- Staff attribution (MPS-REQ-019 "author attribution", MPS-REQ-024
  -- "attributable"). `on delete set null` so a closed account nulls the
  -- attribution rather than orphaning or deleting the content.
  add column created_by uuid references auth.users (id) on delete set null,
  add column updated_by uuid references auth.users (id) on delete set null;

update public.announcements
set state = (case when published then 'published' else 'draft' end)::public.content_state;

alter table public.announcements
  drop constraint announcements_published_has_time;

drop index if exists announcements_program_published_idx;

alter table public.announcements drop column published;

alter table public.announcements
  add constraint announcements_published_has_time
    check (state <> 'published' or published_at is not null),
  add constraint announcements_replaced_has_successor
    check (state <> 'replaced' or replaced_by_id is not null),
  add constraint announcements_removed_has_time
    check (state <> 'removed' or removed_at is not null);

create index announcements_program_state_idx
  on public.announcements (program_id, state, published_at desc);

comment on table public.announcements is
  'Program announcements (MPS-REQ-019, MPS-ACC-030). Program-scoped only: '
  'there is no family or student column, per MPS-RUL-003. Written solely '
  'through the public.content_* functions.';


-- ---------------------------------------------------------------------------
-- learning_resources — lifecycle, kind, and stored-file columns
-- ---------------------------------------------------------------------------
alter table public.learning_resources
  add column state public.content_state not null default 'draft',
  add column kind public.resource_kind not null default 'link',
  add column replaced_by_id uuid references public.learning_resources (id) on delete set null,
  add column replaced_at timestamptz,
  add column removed_at timestamptz,
  add column created_by uuid references auth.users (id) on delete set null,
  add column updated_by uuid references auth.users (id) on delete set null,
  -- The object key inside the private `program-resources` bucket. Unique so two
  -- rows cannot claim one object, which would make removal of one silently
  -- leave the other readable.
  add column storage_path text unique,
  add column file_name text,
  add column file_size_bytes bigint,
  add column content_type text;

update public.learning_resources
set state = (case when published then 'published' else 'draft' end)::public.content_state;

drop index if exists learning_resources_program_published_idx;

alter table public.learning_resources
  drop constraint learning_resources_url_scheme;

alter table public.learning_resources drop column published;

alter table public.learning_resources
  alter column url drop not null;

alter table public.learning_resources
  -- Retained from 20260829170000, now NULL-guarded. Anything but http(s) —
  -- `javascript:`, `data:` — must not be storable, so the renderer never has to
  -- defend against a scheme the database allowed.
  add constraint learning_resources_url_scheme
    check (url is null or url ~ '^https?://'),
  -- A resource is a link OR a stored file, never both and never neither. The
  -- renderer therefore never has to decide which of two populated columns to
  -- trust, and a file-backed resource cannot smuggle in an external URL.
  add constraint learning_resources_one_medium check (
    (kind in ('link', 'video', 'activity')
       and url is not null
       and storage_path is null
       and file_name is null
       and file_size_bytes is null
       and content_type is null)
    or
    (kind in ('document', 'download')
       and url is null
       and storage_path is not null
       and file_name is not null
       and file_size_bytes is not null
       and content_type is not null)
    or
    -- A file-backed DRAFT before its file is attached. Publishing is what
    -- requires the medium to be settled, and `content_publish_resource`
    -- refuses a draft that has neither.
    (kind in ('document', 'download')
       and state = 'draft'
       and url is null
       and storage_path is null)
  ),
  add constraint learning_resources_replaced_has_successor
    check (state <> 'replaced' or replaced_by_id is not null),
  add constraint learning_resources_removed_has_time
    check (state <> 'removed' or removed_at is not null),
  -- 10 MB, owner decision 2026-08-31 (GAP-CONTENT-02). In the database as well
  -- as in the form, because the form is not the control.
  add constraint learning_resources_file_size
    check (file_size_bytes is null
           or (file_size_bytes > 0 and file_size_bytes <= 10485760)),
  -- The approved allowlist, owner decision 2026-08-31 (GAP-CONTENT-01).
  -- Macro-bearing Office container formats, archives, and executables are
  -- excluded deliberately.
  add constraint learning_resources_content_type
    check (content_type is null
           or content_type in ('application/pdf', 'image/png',
                               'image/jpeg', 'text/plain'));

create index learning_resources_program_state_idx
  on public.learning_resources (program_id, state);

comment on table public.learning_resources is
  'Program learning resources (MPS-REQ-019). A resource is either an external '
  'link or a file in the private program-resources bucket, never both. Written '
  'solely through the public.content_* functions.';


-- ---------------------------------------------------------------------------
-- SELECT policies, restated in terms of `state`
-- ---------------------------------------------------------------------------
-- The audiences are unchanged from 20260829170000. Only the published test
-- changes, from a boolean column to an explicit state equality.
--
-- A family sees `published` and `replaced`, and neither `draft` nor `removed`.
-- Keeping `replaced` readable is deliberate (plan D-C2): MPS-ACC-030 asks for a
-- truthful current state, and withdrawing a notice a family already read is not
-- a truthful state, it is a disappearance. `removed` is different — that is
-- what removal means, and it is the state families lose.
create policy "announcements_select_enrolled_family"
  on public.announcements for select
  to authenticated
  using (
    state in ('published', 'replaced')
    and private.family_has_enrollment_in(program_id)
  );

create policy "learning_resources_select_enrolled_family"
  on public.learning_resources for select
  to authenticated
  using (
    state in ('published', 'replaced')
    and private.family_has_enrollment_in(program_id)
  );

-- The educator and administrator SELECT policies are unchanged and are NOT
-- recreated: neither ever referenced `published`, so both keep working and
-- both continue to show every state, which is what authoring requires.


-- ---------------------------------------------------------------------------
-- private.content_may_author
-- ---------------------------------------------------------------------------
-- The authoring predicate, stated once.
--
-- MPS-REQ-019 says "permitted educators and administrators". MPS-WFL-006's only
-- preconditions are an active account and an existing assignment, and the owner
-- confirmed on 2026-08-31 that actively assigned means permitted
-- (GAP-CONTENT-04). If a further per-educator grant is ever approved, it is an
-- additional clause in THIS function and nothing else changes.
--
-- MPS-RUL-005 is not breached by an educator publishing here. That rule
-- reserves publishing a program, price, availability, registration state, or
-- cancellation to an administrator, and says in the same sentence that
-- "educators may contribute content within assigned programs". Program
-- publication controls are untouched by this migration.
create function private.content_may_author(target_program uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or private.is_assigned_educator(target_program);
$$;

revoke all on function private.content_may_author(uuid) from public;
grant execute on function private.content_may_author(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- private.content_transition_allowed
-- ---------------------------------------------------------------------------
-- The lifecycle as data rather than as scattered `if` statements, in the same
-- shape as `private.enrollment_transition_allowed`.
--
-- `replaced` and `removed` are TERMINAL. Un-removing is a restoration with
-- retention implications nobody has approved (GAP-CONTENT-03), and un-replacing
-- would orphan a successor that families may already have read.
create function private.content_transition_allowed(
  from_state public.content_state,
  to_state public.content_state
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (from_state, to_state) in (
    ('draft',     'published'),  -- publish
    ('draft',     'removed'),    -- discard a draft
    ('published', 'replaced'),   -- superseded by a revision
    ('published', 'removed')     -- withdrawn
  );
$$;

revoke all on function private.content_transition_allowed(
  public.content_state, public.content_state) from public;
grant execute on function private.content_transition_allowed(
  public.content_state, public.content_state) to authenticated;


-- ---------------------------------------------------------------------------
-- Announcement authoring
-- ---------------------------------------------------------------------------
-- Every function below opens with the same two checks and the same reasoning:
--
--   * `private.content_may_author()` inside the writing transaction. The route
--     guard and the server action both check first, but a server action is a
--     public HTTP endpoint that can be invoked without ever loading the page
--     whose guard would have refused. This check is the one that cannot be
--     skipped.
--   * the program is read FROM THE STORED ROW, never from a parameter, on every
--     verb except create. A caller who holds one program cannot pass its id
--     alongside another program's content id and have the pair believed.
--
-- `expected_updated_at` is the same optimistic-concurrency contract
-- `admin_update_program_facts` uses: a stale editor is refused with 40001
-- rather than silently overwriting a colleague's edit.

create function public.content_create_announcement_draft(
  target_program uuid,
  announcement_title text,
  announcement_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  trimmed_title text := btrim(coalesce(announcement_title, ''));
  trimmed_body text := btrim(coalesce(announcement_body, ''));
begin
  if not private.content_may_author(target_program) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.programs p where p.id = target_program) then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  if char_length(trimmed_title) not between 1 and 160 then
    raise exception 'title must be 1 to 160 characters' using errcode = '22023';
  end if;

  if char_length(trimmed_body) not between 1 and 4000 then
    raise exception 'announcement must be 1 to 4000 characters'
      using errcode = '22023';
  end if;

  -- A created announcement is a DRAFT. Publishing is a separate, separately
  -- audited decision, so nothing reaches a family because someone pressed save.
  insert into public.announcements
    (program_id, title, body, state, created_by, updated_by)
  values
    (target_program, trimmed_title, trimmed_body, 'draft',
     (select auth.uid()), (select auth.uid()))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.content_create_announcement_draft(uuid, text, text) from public;
grant execute on function public.content_create_announcement_draft(uuid, text, text) to authenticated;


create function public.content_update_announcement_draft(
  target_id uuid,
  expected_updated_at timestamptz,
  announcement_title text,
  announcement_body text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.announcements%rowtype;
  trimmed_title text := btrim(coalesce(announcement_title, ''));
  trimmed_body text := btrim(coalesce(announcement_body, ''));
begin
  select * into current_row from public.announcements
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  /* PT409, NOT 40001, AND THE DIFFERENCE IS NOT COSMETIC.

     `admin_update_program_facts` raises 40001 for this. PostgREST treats
     SQLSTATE class 40 (transaction rollback) as a TRANSIENT UPSTREAM
     condition: it swallows the message and answers "The upstream server is
     timing out" with NO `code` field, so a caller cannot tell a stale write
     from a dead database and reports "something went wrong" for what is
     actually a recoverable conflict. Verified against the local stack.

     `PTxxx` is PostgREST's pass-through convention: the code survives and the
     response is HTTP 409, which is what a stale write is. */
  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'announcement changed since it was loaded'
      using errcode = 'PT409';
  end if;

  -- Editing a PUBLISHED announcement in place would change what a family
  -- already read with no record that it changed. Revision after publication is
  -- `content_replace_announcement`, which preserves the original.
  if current_row.state <> 'draft' then
    raise exception 'only a draft can be edited; publish a replacement instead'
      using errcode = '22023';
  end if;

  if char_length(trimmed_title) not between 1 and 160 then
    raise exception 'title must be 1 to 160 characters' using errcode = '22023';
  end if;

  if char_length(trimmed_body) not between 1 and 4000 then
    raise exception 'announcement must be 1 to 4000 characters'
      using errcode = '22023';
  end if;

  update public.announcements
  set title = trimmed_title,
      body = trimmed_body,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return 'updated';
end;
$$;

revoke all on function public.content_update_announcement_draft(uuid, timestamptz, text, text) from public;
grant execute on function public.content_update_announcement_draft(uuid, timestamptz, text, text) to authenticated;


create function public.content_publish_announcement(
  target_id uuid,
  expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.announcements%rowtype;
begin
  select * into current_row from public.announcements
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'announcement changed since it was loaded'
      using errcode = 'PT409';
  end if;

  if not private.content_transition_allowed(current_row.state, 'published') then
    raise exception 'a % announcement cannot be published', current_row.state
      using errcode = '22023';
  end if;

  update public.announcements
  set state = 'published',
      published_at = now(),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return 'published';
end;
$$;

revoke all on function public.content_publish_announcement(uuid, timestamptz) from public;
grant execute on function public.content_publish_announcement(uuid, timestamptz) to authenticated;


-- Replace: one transaction, two rows, no overwrite.
--
-- The successor is a DRAFT on the same program; the predecessor becomes
-- `replaced` and points forward. The predecessor is never mutated in place
-- because MPS-ACC-030 requires the replaced state to be truthful, which is
-- impossible if the original text is gone.
create function public.content_replace_announcement(
  target_id uuid,
  expected_updated_at timestamptz,
  announcement_title text,
  announcement_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.announcements%rowtype;
  new_id uuid;
  trimmed_title text := btrim(coalesce(announcement_title, ''));
  trimmed_body text := btrim(coalesce(announcement_body, ''));
begin
  select * into current_row from public.announcements
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'announcement changed since it was loaded'
      using errcode = 'PT409';
  end if;

  if not private.content_transition_allowed(current_row.state, 'replaced') then
    raise exception 'a % announcement cannot be replaced', current_row.state
      using errcode = '22023';
  end if;

  if char_length(trimmed_title) not between 1 and 160 then
    raise exception 'title must be 1 to 160 characters' using errcode = '22023';
  end if;

  if char_length(trimmed_body) not between 1 and 4000 then
    raise exception 'announcement must be 1 to 4000 characters'
      using errcode = '22023';
  end if;

  insert into public.announcements
    (program_id, title, body, state, created_by, updated_by)
  values
    (current_row.program_id, trimmed_title, trimmed_body, 'draft',
     (select auth.uid()), (select auth.uid()))
  returning id into new_id;

  update public.announcements
  set state = 'replaced',
      replaced_by_id = new_id,
      replaced_at = now(),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return new_id;
end;
$$;

revoke all on function public.content_replace_announcement(uuid, timestamptz, text, text) from public;
grant execute on function public.content_replace_announcement(uuid, timestamptz, text, text) to authenticated;


-- Remove: a state change and an access revocation. NOT a delete.
-- See the header (GAP-CONTENT-03, owner decision 2026-08-31).
create function public.content_remove_announcement(
  target_id uuid,
  expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.announcements%rowtype;
begin
  select * into current_row from public.announcements
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'announcement changed since it was loaded'
      using errcode = 'PT409';
  end if;

  if not private.content_transition_allowed(current_row.state, 'removed') then
    raise exception 'a % announcement cannot be removed', current_row.state
      using errcode = '22023';
  end if;

  update public.announcements
  set state = 'removed',
      removed_at = now(),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return 'removed';
end;
$$;

revoke all on function public.content_remove_announcement(uuid, timestamptz) from public;
grant execute on function public.content_remove_announcement(uuid, timestamptz) to authenticated;


-- ---------------------------------------------------------------------------
-- Learning-resource authoring
-- ---------------------------------------------------------------------------
-- Same authorization and concurrency contract as the announcement functions.
-- The difference is the medium: a `link`, `video`, or `activity` carries an
-- external URL, while a `document` or `download` carries an object in the
-- private bucket. `learning_resources_one_medium` makes the two exclusive, and
-- these functions are what keep a caller from arriving at a state the
-- constraint would reject.

create function public.content_create_resource_draft(
  target_program uuid,
  resource_title text,
  resource_description text,
  resource_kind public.resource_kind,
  resource_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  trimmed_title text := btrim(coalesce(resource_title, ''));
  trimmed_description text := nullif(btrim(coalesce(resource_description, '')), '');
  trimmed_url text := nullif(btrim(coalesce(resource_url, '')), '');
  file_backed boolean := resource_kind in ('document', 'download');
begin
  if not private.content_may_author(target_program) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.programs p where p.id = target_program) then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  if char_length(trimmed_title) not between 1 and 160 then
    raise exception 'title must be 1 to 160 characters' using errcode = '22023';
  end if;

  if trimmed_description is not null
     and char_length(trimmed_description) > 600 then
    raise exception 'description must be 600 characters or fewer'
      using errcode = '22023';
  end if;

  if file_backed then
    -- A file-backed resource takes no URL, ever. Accepting one "just in case"
    -- would give a file-backed row a second medium the renderer might follow.
    if trimmed_url is not null then
      raise exception 'a file resource does not take a web address'
        using errcode = '22023';
    end if;
  else
    if trimmed_url is null then
      raise exception 'a link resource needs a web address' using errcode = '22023';
    end if;
    if trimmed_url !~ '^https?://' then
      raise exception 'a web address must start with http:// or https://'
        using errcode = '22023';
    end if;
    if char_length(trimmed_url) > 2000 then
      raise exception 'web address must be 2000 characters or fewer'
        using errcode = '22023';
    end if;
  end if;

  insert into public.learning_resources
    (program_id, title, description, kind, url, state, created_by, updated_by)
  values
    (target_program, trimmed_title, trimmed_description, resource_kind,
     trimmed_url, 'draft', (select auth.uid()), (select auth.uid()))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.content_create_resource_draft(
  uuid, text, text, public.resource_kind, text) from public;
grant execute on function public.content_create_resource_draft(
  uuid, text, text, public.resource_kind, text) to authenticated;


-- Register an uploaded object against its draft.
--
-- WHY THE PATH IS CHECKED HERE AND NOT ONLY IN THE APPLICATION
--
-- The application derives the path and never accepts one from a browser. This
-- function assumes neither. It requires the path to begin with the resource's
-- OWN program id and to contain the resource's OWN id, so a caller reaching
-- PostgREST by hand cannot bind an object that lives under one program to a row
-- that lives under another — which is how a family enrolled in program A would
-- otherwise be handed a file belonging to program B.
create function public.content_attach_resource_file(
  target_id uuid,
  expected_updated_at timestamptz,
  object_path text,
  original_file_name text,
  object_size_bytes bigint,
  object_content_type text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.learning_resources%rowtype;
  trimmed_name text := btrim(coalesce(original_file_name, ''));
begin
  select * into current_row from public.learning_resources
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'resource changed since it was loaded' using errcode = 'PT409';
  end if;

  if current_row.state <> 'draft' then
    raise exception 'a file can only be attached to a draft' using errcode = '22023';
  end if;

  if current_row.kind not in ('document', 'download') then
    raise exception 'only a document or download resource holds a file'
      using errcode = '22023';
  end if;

  if object_path is null
     or object_path <> current_row.program_id::text || '/' || target_id::text
                       || substring(object_path from '/[^/]*$') then
    raise exception 'file location does not belong to this resource'
      using errcode = '22023';
  end if;

  if trimmed_name = '' or char_length(trimmed_name) > 255 then
    raise exception 'file name must be 1 to 255 characters' using errcode = '22023';
  end if;

  -- Size and type are constrained on the column as well. Raising here gives the
  -- author a sentence they can act on instead of a constraint-violation code.
  if object_size_bytes is null or object_size_bytes <= 0
     or object_size_bytes > 10485760 then
    raise exception 'file must be larger than 0 and no more than 10 MB'
      using errcode = '22023';
  end if;

  if object_content_type is null
     or object_content_type not in ('application/pdf', 'image/png',
                                    'image/jpeg', 'text/plain') then
    raise exception 'file must be a PDF, PNG, JPEG, or plain text file'
      using errcode = '22023';
  end if;

  update public.learning_resources
  set storage_path = object_path,
      file_name = trimmed_name,
      file_size_bytes = object_size_bytes,
      content_type = object_content_type,
      url = null,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return 'attached';
end;
$$;

revoke all on function public.content_attach_resource_file(
  uuid, timestamptz, text, text, bigint, text) from public;
grant execute on function public.content_attach_resource_file(
  uuid, timestamptz, text, text, bigint, text) to authenticated;


create function public.content_update_resource_draft(
  target_id uuid,
  expected_updated_at timestamptz,
  resource_title text,
  resource_description text,
  resource_url text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.learning_resources%rowtype;
  trimmed_title text := btrim(coalesce(resource_title, ''));
  trimmed_description text := nullif(btrim(coalesce(resource_description, '')), '');
  trimmed_url text := nullif(btrim(coalesce(resource_url, '')), '');
begin
  select * into current_row from public.learning_resources
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'resource changed since it was loaded' using errcode = 'PT409';
  end if;

  if current_row.state <> 'draft' then
    raise exception 'only a draft can be edited; publish a replacement instead'
      using errcode = '22023';
  end if;

  if char_length(trimmed_title) not between 1 and 160 then
    raise exception 'title must be 1 to 160 characters' using errcode = '22023';
  end if;

  if trimmed_description is not null
     and char_length(trimmed_description) > 600 then
    raise exception 'description must be 600 characters or fewer'
      using errcode = '22023';
  end if;

  -- The kind is not editable. Switching a link into a file (or back) would
  -- strand an uploaded object or a published address; the honest move is a new
  -- resource, which is one action away.
  if current_row.kind in ('document', 'download') then
    if trimmed_url is not null then
      raise exception 'a file resource does not take a web address'
        using errcode = '22023';
    end if;
  else
    if trimmed_url is null then
      raise exception 'a link resource needs a web address' using errcode = '22023';
    end if;
    if trimmed_url !~ '^https?://' then
      raise exception 'a web address must start with http:// or https://'
        using errcode = '22023';
    end if;
    if char_length(trimmed_url) > 2000 then
      raise exception 'web address must be 2000 characters or fewer'
        using errcode = '22023';
    end if;
  end if;

  update public.learning_resources
  set title = trimmed_title,
      description = trimmed_description,
      url = case when current_row.kind in ('document', 'download')
                 then null else trimmed_url end,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return 'updated';
end;
$$;

revoke all on function public.content_update_resource_draft(
  uuid, timestamptz, text, text, text) from public;
grant execute on function public.content_update_resource_draft(
  uuid, timestamptz, text, text, text) to authenticated;


create function public.content_publish_resource(
  target_id uuid,
  expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.learning_resources%rowtype;
begin
  select * into current_row from public.learning_resources
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'resource changed since it was loaded' using errcode = 'PT409';
  end if;

  if not private.content_transition_allowed(current_row.state, 'published') then
    raise exception 'a % resource cannot be published', current_row.state
      using errcode = '22023';
  end if;

  -- Publishing a file-backed draft with no file attached would put an entry in
  -- front of a family that leads nowhere. The medium must be settled first.
  if current_row.kind in ('document', 'download')
     and current_row.storage_path is null then
    raise exception 'attach a file before publishing this resource'
      using errcode = '22023';
  end if;

  update public.learning_resources
  set state = 'published',
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return 'published';
end;
$$;

revoke all on function public.content_publish_resource(uuid, timestamptz) from public;
grant execute on function public.content_publish_resource(uuid, timestamptz) to authenticated;


-- The successor is a draft carrying the predecessor's kind. A replacement file
-- is uploaded to the successor, so the predecessor's object is never
-- overwritten and a family reading the old entry still gets the old file until
-- the new one is published.
create function public.content_replace_resource(
  target_id uuid,
  expected_updated_at timestamptz,
  resource_title text,
  resource_description text,
  resource_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.learning_resources%rowtype;
  new_id uuid;
  trimmed_title text := btrim(coalesce(resource_title, ''));
  trimmed_description text := nullif(btrim(coalesce(resource_description, '')), '');
  trimmed_url text := nullif(btrim(coalesce(resource_url, '')), '');
  file_backed boolean;
begin
  select * into current_row from public.learning_resources
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'resource changed since it was loaded' using errcode = 'PT409';
  end if;

  if not private.content_transition_allowed(current_row.state, 'replaced') then
    raise exception 'a % resource cannot be replaced', current_row.state
      using errcode = '22023';
  end if;

  file_backed := current_row.kind in ('document', 'download');

  if char_length(trimmed_title) not between 1 and 160 then
    raise exception 'title must be 1 to 160 characters' using errcode = '22023';
  end if;

  if trimmed_description is not null
     and char_length(trimmed_description) > 600 then
    raise exception 'description must be 600 characters or fewer'
      using errcode = '22023';
  end if;

  if file_backed then
    if trimmed_url is not null then
      raise exception 'a file resource does not take a web address'
        using errcode = '22023';
    end if;
  else
    if trimmed_url is null then
      raise exception 'a link resource needs a web address' using errcode = '22023';
    end if;
    if trimmed_url !~ '^https?://' then
      raise exception 'a web address must start with http:// or https://'
        using errcode = '22023';
    end if;
  end if;

  insert into public.learning_resources
    (program_id, title, description, kind, url, state, created_by, updated_by)
  values
    (current_row.program_id, trimmed_title, trimmed_description,
     current_row.kind, trimmed_url, 'draft',
     (select auth.uid()), (select auth.uid()))
  returning id into new_id;

  update public.learning_resources
  set state = 'replaced',
      replaced_by_id = new_id,
      replaced_at = now(),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return new_id;
end;
$$;

revoke all on function public.content_replace_resource(
  uuid, timestamptz, text, text, text) from public;
grant execute on function public.content_replace_resource(
  uuid, timestamptz, text, text, text) to authenticated;


-- Removal revokes access to the row AND, through the object policy below, to
-- the file. The object itself is retained (GAP-CONTENT-03).
create function public.content_remove_resource(
  target_id uuid,
  expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.learning_resources%rowtype;
begin
  select * into current_row from public.learning_resources
    where id = target_id for update;

  /* NOT FOUND AND NOT YOURS ARE THE SAME ANSWER, DELIBERATELY.

     This function is SECURITY DEFINER, so the SELECT above reads past RLS and
     finds rows this caller cannot see. Reporting "no such row" for a fake id
     and "not authorized" for a real one would hand a direct PostgREST caller an
     oracle for which content ids exist. One refusal for both. */
  if not found or not private.content_may_author(current_row.program_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if expected_updated_at is null
     or current_row.updated_at is distinct from expected_updated_at then
    raise exception 'resource changed since it was loaded' using errcode = 'PT409';
  end if;

  if not private.content_transition_allowed(current_row.state, 'removed') then
    raise exception 'a % resource cannot be removed', current_row.state
      using errcode = '22023';
  end if;

  update public.learning_resources
  set state = 'removed',
      removed_at = now(),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_id;

  return 'removed';
end;
$$;

revoke all on function public.content_remove_resource(uuid, timestamptz) from public;
grant execute on function public.content_remove_resource(uuid, timestamptz) to authenticated;


-- ---------------------------------------------------------------------------
-- Attributable history (MPS-REQ-024)
-- ---------------------------------------------------------------------------
-- The TRIGGER is the writer, not the RPCs. An authoring function that forgot to
-- log still logs, and a write that somehow reached the table another way is
-- recorded too.
--
-- WHAT `changed_fields` MAY CARRY, AND WHAT IT MAY NOT
--
-- `record_enrollment_audit` set the precedent: "no student name, no family
-- name, no email. `changed_fields` holds enum labels, which are not private
-- data." The same reasoning bites harder here, because an announcement body is
-- free text an educator typed. MPS-RUL-003 keeps sensitive family matters
-- private, and the safe assumption is that free text MAY contain something that
-- should not be duplicated into an append-only table nobody can redact.
--
-- So the audit row records the state transition, the program, and the NAMES of
-- the fields that changed. It never records title text, body text, description
-- text, a storage path, a file name, or a signed URL. That an announcement's
-- body changed is the auditable fact MPS-REQ-024 asks for; what it said is not,
-- and recording it cannot be undone.

create function public.record_announcement_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  /* `array_append`, never `changed || 'body'`. The `||` operator resolves
     `anyarray || anyarray` first and tries to parse the untyped literal as an
     array, which fails with 22P02 "malformed array literal" and aborts the
     UPDATE that fired the trigger — so an audit-trail bug becomes a write
     outage. Found by probing a real two-writer edit. */
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'announcement', new.id, 'created',
            jsonb_build_object('program_id', new.program_id,
                               'state', new.state));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'announcement', old.id, 'deleted',
            jsonb_build_object('program_id', old.program_id,
                               'state', old.state));
    return old;
  end if;

  if new.state is distinct from old.state then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'announcement', new.id, new.state::text,
            jsonb_build_object('program_id', new.program_id,
                               'from', old.state, 'to', new.state)
            || case when new.replaced_by_id is distinct from old.replaced_by_id
                    then jsonb_build_object('replaced_by', new.replaced_by_id)
                    else '{}'::jsonb end);
    return new;
  end if;

  if new.title is distinct from old.title then changed := array_append(changed, 'title'); end if;
  if new.body is distinct from old.body then changed := array_append(changed, 'body'); end if;

  if array_length(changed, 1) is not null then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'announcement', new.id, 'updated',
            jsonb_build_object('program_id', new.program_id,
                               'changed', to_jsonb(changed)));
  end if;

  return new;
end;
$$;

revoke all on function public.record_announcement_audit() from public;

create trigger announcements_audit
  after insert or update or delete on public.announcements
  for each row execute function public.record_announcement_audit();


create function public.record_learning_resource_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'learning_resource', new.id, 'created',
            jsonb_build_object('program_id', new.program_id,
                               'state', new.state, 'kind', new.kind));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'learning_resource', old.id, 'deleted',
            jsonb_build_object('program_id', old.program_id,
                               'state', old.state));
    return old;
  end if;

  if new.state is distinct from old.state then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'learning_resource', new.id, new.state::text,
            jsonb_build_object('program_id', new.program_id,
                               'from', old.state, 'to', new.state)
            || case when new.replaced_by_id is distinct from old.replaced_by_id
                    then jsonb_build_object('replaced_by', new.replaced_by_id)
                    else '{}'::jsonb end);
    return new;
  end if;

  -- A file arriving or changing is a material action in its own right
  -- (MPS-REQ-024, "Resource uploaded or changed"). The PATH is not recorded:
  -- it is the object key, and an append-only table is the wrong place for one.
  if new.storage_path is distinct from old.storage_path then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'learning_resource', new.id, 'file_attached',
            jsonb_build_object('program_id', new.program_id,
                               'content_type', new.content_type,
                               'file_size_bytes', new.file_size_bytes));
    return new;
  end if;

  if new.title is distinct from old.title then changed := array_append(changed, 'title'); end if;
  if new.description is distinct from old.description then changed := array_append(changed, 'description'); end if;
  if new.url is distinct from old.url then changed := array_append(changed, 'url'); end if;

  if array_length(changed, 1) is not null then
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values ((select auth.uid()), 'learning_resource', new.id, 'updated',
            jsonb_build_object('program_id', new.program_id,
                               'changed', to_jsonb(changed)));
  end if;

  return new;
end;
$$;

revoke all on function public.record_learning_resource_audit() from public;

create trigger learning_resources_audit
  after insert or update or delete on public.learning_resources
  for each row execute function public.record_learning_resource_audit();


-- ---------------------------------------------------------------------------
-- Private Storage — the program-resources bucket
-- ---------------------------------------------------------------------------
-- MTS INTEGRATION-MANIFEST: "Private program-scoped resources; signed access."
-- `public = false`, so there is no public object URL to leak and
-- `getPublicUrl` is never a valid call against this bucket.
--
-- PATH SHAPE: <program_id>/<resource_id>/<random>.<ext>
--
-- The leading program id is what lets these policies be expressed at all, but a
-- path is an INDEX, NOT AN AUTHORIZATION. Every policy below joins the object
-- name back to `learning_resources.storage_path` and authorizes against THAT
-- row's program and state. An object whose path claims a program it is not
-- registered under matches nothing and is readable by nobody.
insert into storage.buckets (id, name, public)
values ('program-resources', 'program-resources', false)
on conflict (id) do update set public = false;

-- Read: an administrator, an assigned educator, or an eligible family whose
-- program's resource is PUBLISHED.
--
-- Because the join is to the owning row, a `draft` or `removed` resource's
-- object is unreadable by a family even with a perfectly correct path — which
-- is proof obligation 13, enforced in the database rather than by the route.
create policy "program_resources_select_authorized"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'program-resources'
    and exists (
      select 1
      from public.learning_resources r
      where r.storage_path = storage.objects.name
        and (
          private.content_may_author(r.program_id)
          or (
            r.state = 'published'
            and private.family_has_enrollment_in(r.program_id)
          )
        )
    )
  );

-- Write: an administrator or an assigned educator, uploading against a DRAFT
-- that already exists and whose program matches the path's leading segment.
--
-- Requiring the row first is deliberate. An upload that cannot name an existing
-- draft it belongs to has no reason to exist, and allowing one would let an
-- authorized educator fill a bucket with objects nothing references and nothing
-- can find to remove.
create policy "program_resources_insert_author"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'program-resources'
    and exists (
      select 1
      from public.learning_resources r
      where r.state = 'draft'
        and r.kind in ('document', 'download')
        and private.content_may_author(r.program_id)
        and storage.objects.name like r.program_id::text || '/' || r.id::text || '/%'
    )
  );

-- No UPDATE policy: an object is written once. A replacement is a new object
-- under a new resource, which is what `content_replace_resource` produces.
--
-- No DELETE policy for any client role, by owner decision (GAP-CONTENT-03).
-- Removal revokes access; erasure is a retention decision that has not been
-- made. Nothing here can be used to erase a file, including by its author.
--
-- Nothing at all for `anon`: an unauthenticated request matches no policy on a
-- private bucket and is refused.
