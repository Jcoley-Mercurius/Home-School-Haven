-- Slice 2 — registration policy and data foundation
--
-- MPS: MPS-REQ-001/002/003/004/005/006/012/014/018/024; MPS-RUL-006/007/008/
--      009/010; MPS-ACC-002/003/005/018/023/028; MPS-WFL-002/003; DEC-025
--      (STEP UP is pending administrative verification, never payment, a
--      discount, or confirmed enrollment); EXC-002 (sample-only sensitive
--      registration infrastructure); GAP-005, GAP-010, GAP-014, GAP-015.
-- MTS: SECURITY-ARCHITECTURE mandatory controls; Supabase is the single system
--      of record; deny by default; attributable history; retry safety.
-- Prompt: prompts/registration-data-foundation.md (approved 2026-09-18)
--
-- WHAT THIS IS
--
-- The data and mutation contract a later one-step family registration will
-- use: one attributable submission covering several children, with contacts,
-- health information, program selections, document acceptance evidence, and
-- STEP UP requests. No UI reaches it in this slice.
--
-- NO SECOND AUTHORITY
--
--   * The family is derived from auth.uid(), never from the payload.
--   * A child is an existing `students` row or is created by the same rule as
--     add_student_to_own_family. `students` gains no columns.
--   * A selection's enrollment is created by the SAME evaluation
--     family_request_enrollment performs (now private.request_enrollment_core)
--     and a selection stores only its enrollment_id. It has no state of its
--     own: `enrollments.state` stays the one authority (MPS-REQ-014).
--
-- SAMPLE ONLY, AS CONSTRAINTS (EXC-002)
--
--   * `check (is_sample)` on every new table.
--   * `registration_submissions.authority_affirmation_version` can only be
--     'demo-unapproved-v0', as on `students` and `enrollments`.
--   * `registration_document_versions_approval_locked`: no document version
--     can be stored as `approved`. Placeholder or draft documents can therefore
--     never become qualifying acceptance evidence. Dropping this CHECK requires
--     an owner-approved migration carrying approved text (GAP-014).
--   * `step_up_verification_state` has exactly one value,
--     `pending_verification`. Outcomes are GAP-015 / GAP-010 decisions.
--
-- WRITES
--
-- No client role holds INSERT, UPDATE, or DELETE on any new table.
-- `public.submit_family_registration` is the only door. Evidence rows are
-- immutable (a BEFORE UPDATE trigger raises). DELETE is not blocked, because
-- family and student removal cascade and deletion policy is checklist §11,
-- which is unresolved.
--
-- rollback:
--   drop function if exists public.submit_family_registration(uuid, jsonb);
--   drop function if exists public.registration_policy_satisfied(uuid);
--   -- restore public.family_request_enrollment(uuid, uuid, boolean) verbatim
--   -- from 20260903000000_family_conversion_journey.sql, then:
--   drop function if exists private.request_enrollment_core(uuid, uuid, uuid, uuid);
--   drop table if exists public.registration_acceptance_children;
--   drop table if exists public.registration_document_acceptances;
--   drop table if exists public.registration_step_up_requests;
--   drop table if exists public.registration_selections;
--   drop table if exists public.registration_contacts;
--   drop table if exists public.registration_child_health;
--   drop table if exists public.registration_children;
--   drop table if exists public.registration_submissions;
--   drop table if exists public.registration_document_versions;
--   drop function if exists private.can_read_registration(uuid);
--   drop function if exists private.registration_evidence_immutable();
--   drop function if exists private.enforce_registration_child_family();
--   drop function if exists private.enforce_registration_selection_enrollment();
--   drop function if exists private.enforce_registration_acceptance_signer();
--   drop function if exists private.reg_fail(text);
--   drop function if exists private.reg_object(jsonb, text, text[]);
--   drop function if exists private.reg_text(jsonb, text, text, integer, boolean);
--   drop function if exists private.reg_bool(jsonb, text, text);
--   drop function if exists private.reg_uuid(jsonb, text, text);
--   drop function if exists private.reg_array(jsonb, text, text, integer, integer);
--   drop type if exists public.step_up_verification_state;
--   drop type if exists public.document_acceptance_method;
--   drop type if exists public.document_version_status;
--   drop type if exists public.registration_document_kind;
--   drop type if exists public.attendance_day;
--   drop type if exists public.registration_contact_kind;
--   -- Audit events with entity_type = 'registration' remain (append-only).
--   -- No hosted data exists: this migration has been applied only locally.


-- ===========================================================================
-- 1. Types
-- ===========================================================================
create type public.registration_contact_kind as enum ('guardian', 'emergency', 'pickup');

create type public.attendance_day as enum (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

create type public.registration_document_kind as enum (
  'liability_waiver', 'code_of_conduct', 'parent_handbook'
);

create type public.document_version_status as enum ('draft', 'approved', 'retired');

create type public.document_acceptance_method as enum ('signature', 'acknowledgment');

create type public.step_up_verification_state as enum ('pending_verification');

comment on type public.step_up_verification_state is
  'DEC-025: a STEP UP request awaits administrative verification. It is never '
  'payment, a discount, or confirmed enrollment. Verified and declined outcomes, '
  'and what they change, are GAP-015 / GAP-010 owner decisions and are added by '
  'a later migration.';


-- ===========================================================================
-- 2. Document versions
-- ===========================================================================
create table public.registration_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_kind public.registration_document_kind not null,
  version_label text not null,
  title text not null,
  status public.document_version_status not null default 'draft',
  -- A pointer to the approved source document. No body text is stored: this
  -- table must never become the place invented legal language lives.
  content_reference text,
  content_sha256 text,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete restrict,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  constraint registration_document_versions_sample_only check (is_sample),
  constraint registration_document_versions_label_length
    check (char_length(version_label) between 1 and 40),
  constraint registration_document_versions_title_length
    check (char_length(title) between 1 and 160),
  constraint registration_document_versions_reference_length
    check (content_reference is null or char_length(content_reference) between 1 and 500),
  constraint registration_document_versions_sha256
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint registration_document_versions_approval_paired
    check ((status = 'approved') = (approved_at is not null)),
  -- MPS-RUL-010 / GAP-014. No approved legal text exists, so no version may
  -- claim to be approved. Removed only by an owner-approved migration.
  constraint registration_document_versions_approval_locked
    check (status <> 'approved'),
  unique (document_kind, version_label),
  unique (id, document_kind)
);

-- One version of each kind is presented at a time.
create unique index registration_document_versions_one_current
  on public.registration_document_versions (document_kind)
  where status <> 'retired';

comment on table public.registration_document_versions is
  'Versioned registration documents (liability waiver, Code of Conduct, Parent '
  'Handbook). Holds titles and references only, never legal text. No version '
  'can be approved while registration_document_versions_approval_locked stands '
  '(GAP-014).';


-- ===========================================================================
-- 3. Submissions and children
-- ===========================================================================
create table public.registration_submissions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  submitted_by uuid not null references auth.users (id) on delete restrict,
  idempotency_key uuid not null,
  -- sha256 of the canonical payload, so a reused key with a different payload
  -- is recognised as a conflict rather than silently replayed.
  request_fingerprint text not null,
  authority_affirmation_version text not null default 'demo-unapproved-v0',
  submitted_at timestamptz not null default now(),
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  constraint registration_submissions_sample_only check (is_sample),
  constraint registration_submissions_affirmation_unapproved
    check (authority_affirmation_version = 'demo-unapproved-v0'),
  constraint registration_submissions_fingerprint
    check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registration_submissions_one_per_key
    unique (submitted_by, idempotency_key)
);

create index registration_submissions_family_idx
  on public.registration_submissions (family_id, submitted_at desc);

comment on table public.registration_submissions is
  'One attributable family registration submission (SAMPLE ONLY, EXC-002). '
  'Written only by submit_family_registration; immutable once written.';


create table public.registration_children (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null
    references public.registration_submissions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_student boolean not null,
  -- Combined photo/video Yes/No. The media-release language behind it is
  -- checklist §8 and unapproved, so this records a sample preference only.
  photo_video_permission boolean not null,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  constraint registration_children_sample_only check (is_sample),
  unique (registration_id, student_id),
  unique (id, registration_id)
);

create index registration_children_student_idx
  on public.registration_children (student_id);


-- ===========================================================================
-- 4. Restricted child health
-- ===========================================================================
create table public.registration_child_health (
  registration_child_id uuid primary key,
  registration_id uuid not null,
  has_allergies boolean not null,
  allergy_details text,
  medical_information text,
  accommodation_information text,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  foreign key (registration_child_id, registration_id)
    references public.registration_children (id, registration_id) on delete cascade,
  constraint registration_child_health_sample_only check (is_sample),
  -- Explicit Yes/No: details exist exactly when the answer is Yes.
  constraint registration_child_health_allergy_details_match
    check (has_allergies = (allergy_details is not null)),
  constraint registration_child_health_allergy_length
    check (allergy_details is null or char_length(allergy_details) between 1 and 1000),
  constraint registration_child_health_medical_length
    check (medical_information is null or char_length(medical_information) between 1 and 1000),
  constraint registration_child_health_accommodation_length
    check (accommodation_information is null
           or char_length(accommodation_information) between 1 and 1000)
);

create index registration_child_health_registration_idx
  on public.registration_child_health (registration_id);

comment on table public.registration_child_health is
  'RESTRICTED. Allergy, medical, and accommodation information for one child in '
  'one submission. Family and administrator read only; never reachable by an '
  'educator; never copied into audit_events. SAMPLE ONLY.';


-- ===========================================================================
-- 5. Contacts: guardian, emergency, approved pickup
-- ===========================================================================
create table public.registration_contacts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null
    references public.registration_submissions (id) on delete cascade,
  contact_kind public.registration_contact_kind not null,
  full_name text not null,
  relationship text,
  phone text,
  email text,
  is_submitter boolean not null default false,
  sort_order smallint not null,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  constraint registration_contacts_sample_only check (is_sample),
  constraint registration_contacts_name_length
    check (char_length(full_name) between 1 and 120),
  constraint registration_contacts_relationship_length
    check (relationship is null or char_length(relationship) between 1 and 40),
  constraint registration_contacts_relationship_required
    check (contact_kind = 'guardian' or relationship is not null),
  constraint registration_contacts_phone_shape
    check (phone is null
           or (char_length(phone) between 7 and 32 and phone ~ '^[0-9+(). -]+$')),
  constraint registration_contacts_phone_required
    check (contact_kind = 'pickup' or phone is not null),
  constraint registration_contacts_email_guardian_only
    check (email is null
           or (contact_kind = 'guardian' and char_length(email) <= 254
               and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  constraint registration_contacts_submitter_is_guardian
    check (not is_submitter or contact_kind = 'guardian'),
  unique (registration_id, contact_kind, sort_order)
);

create unique index registration_contacts_one_submitter
  on public.registration_contacts (registration_id)
  where is_submitter;

comment on table public.registration_contacts is
  'RESTRICTED. Guardian, emergency, and approved-pickup contacts for one '
  'submission, minimum necessary fields. Family and administrator read only. '
  'SAMPLE ONLY.';


-- ===========================================================================
-- 6. Selections
-- ===========================================================================
create table public.registration_selections (
  id uuid primary key default gen_random_uuid(),
  registration_child_id uuid not null,
  registration_id uuid not null,
  program_id uuid not null references public.programs (id) on delete restrict,
  -- The one enrollment this selection created. State lives there, not here.
  enrollment_id uuid not null unique
    references public.enrollments (id) on delete cascade,
  attendance_days public.attendance_day[] not null default '{}',
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  foreign key (registration_child_id, registration_id)
    references public.registration_children (id, registration_id) on delete cascade,
  constraint registration_selections_sample_only check (is_sample),
  constraint registration_selections_days_bounded
    check (cardinality(attendance_days) <= 7),
  unique (registration_child_id, program_id)
);

create index registration_selections_registration_idx
  on public.registration_selections (registration_id);
create index registration_selections_program_idx
  on public.registration_selections (program_id);

comment on table public.registration_selections is
  'A child''s program, class, club, or tutoring selection and attendance days. '
  'Carries no state: the referenced enrollment is the single authority '
  '(MPS-REQ-014). SAMPLE ONLY.';


-- ===========================================================================
-- 7. STEP UP requests
-- ===========================================================================
create table public.registration_step_up_requests (
  registration_child_id uuid primary key,
  registration_id uuid not null,
  -- RESTRICTED. Whatever reference the family supplies. Never copied into
  -- audit_events.
  reference text,
  verification_state public.step_up_verification_state not null
    default 'pending_verification',
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  foreign key (registration_child_id, registration_id)
    references public.registration_children (id, registration_id) on delete cascade,
  constraint registration_step_up_requests_sample_only check (is_sample),
  constraint registration_step_up_requests_reference_length
    check (reference is null or char_length(reference) between 1 and 64)
);

create index registration_step_up_requests_registration_idx
  on public.registration_step_up_requests (registration_id);

comment on table public.registration_step_up_requests is
  'STEP UP selection for one child, pending administrative verification '
  '(DEC-025). No payment, price, discount, or enrollment-state column exists '
  'here by design. SAMPLE ONLY.';


-- ===========================================================================
-- 8. Acceptance evidence
-- ===========================================================================
create table public.registration_document_acceptances (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null
    references public.registration_submissions (id) on delete cascade,
  document_version_id uuid not null,
  document_kind public.registration_document_kind not null,
  acceptance_method public.document_acceptance_method not null,
  -- Always the submitting parent or guardian. Students have no login and no
  -- column here could name one.
  signer_user_id uuid not null references auth.users (id) on delete restrict,
  typed_signature text,
  accepted_at timestamptz not null default now(),
  -- What the version was when it was accepted. Today always `draft`.
  document_status_at_acceptance public.document_version_status not null,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  foreign key (document_version_id, document_kind)
    references public.registration_document_versions (id, document_kind)
    on delete restrict,
  constraint registration_document_acceptances_sample_only check (is_sample),
  constraint registration_document_acceptances_signature_length
    check (typed_signature is null or char_length(typed_signature) between 1 and 120),
  -- The handbook is acknowledged, never signed. The waiver and the Code of
  -- Conduct are signed by the parent or guardian.
  constraint registration_document_acceptances_method_matches_kind
    check (
      (document_kind = 'parent_handbook'
         and acceptance_method = 'acknowledgment' and typed_signature is null)
      or
      (document_kind in ('liability_waiver', 'code_of_conduct')
         and acceptance_method = 'signature' and typed_signature is not null)
    ),
  unique (registration_id, document_kind),
  unique (id, registration_id)
);

create index registration_document_acceptances_version_idx
  on public.registration_document_acceptances (document_version_id);


create table public.registration_acceptance_children (
  acceptance_id uuid not null,
  registration_child_id uuid not null,
  registration_id uuid not null,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),

  primary key (acceptance_id, registration_child_id),
  foreign key (acceptance_id, registration_id)
    references public.registration_document_acceptances (id, registration_id)
    on delete cascade,
  foreign key (registration_child_id, registration_id)
    references public.registration_children (id, registration_id) on delete cascade,
  constraint registration_acceptance_children_sample_only check (is_sample)
);

create index registration_acceptance_children_child_idx
  on public.registration_acceptance_children (registration_child_id);
create index registration_acceptance_children_registration_idx
  on public.registration_acceptance_children (registration_id);


-- ===========================================================================
-- 9. Consistency and immutability triggers
-- ===========================================================================
create function private.enforce_registration_child_family()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.students s
    join public.registration_submissions r on r.family_id = s.family_id
    where s.id = new.student_id and r.id = new.registration_id
  ) then
    raise exception 'registration child does not belong to the submitting family'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger registration_children_family_matches
  before insert on public.registration_children
  for each row execute function private.enforce_registration_child_family();


create function private.enforce_registration_selection_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.enrollments e
    join public.registration_children c on c.student_id = e.student_id
    where e.id = new.enrollment_id
      and e.program_id = new.program_id
      and c.id = new.registration_child_id
  ) then
    raise exception 'selection enrollment does not match its child and program'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger registration_selections_enrollment_matches
  before insert on public.registration_selections
  for each row execute function private.enforce_registration_selection_enrollment();


create function private.enforce_registration_acceptance_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.registration_submissions r
    where r.id = new.registration_id and r.submitted_by = new.signer_user_id
  ) then
    raise exception 'acceptance signer must be the submitting parent or guardian'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger registration_document_acceptances_signer_is_submitter
  before insert on public.registration_document_acceptances
  for each row execute function private.enforce_registration_acceptance_signer();


create function private.registration_evidence_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'registration evidence is immutable' using errcode = '55000';
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'registration_submissions', 'registration_children',
    'registration_child_health', 'registration_contacts',
    'registration_selections', 'registration_step_up_requests',
    'registration_document_acceptances', 'registration_acceptance_children'
  ] loop
    execute format(
      'create trigger %I before update on public.%I '
      'for each row execute function private.registration_evidence_immutable()',
      t || '_immutable', t);
  end loop;
end;
$$;


-- ===========================================================================
-- 10. Read helper
-- ===========================================================================
create function private.can_read_registration(target_registration uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.registration_submissions r
    where r.id = target_registration
      and (private.is_family_member(r.family_id) or private.is_admin())
  );
$$;


-- ===========================================================================
-- 11. Payload validators
-- ===========================================================================
-- Every failure names a PATH, never a value, so no submitted name, phone,
-- health detail, signature, or reference can reach an error message or log.
create function private.reg_fail(path text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'invalid registration payload: %', path using errcode = '22023';
end;
$$;

create function private.reg_object(val jsonb, path text, allowed text[])
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if val is null or jsonb_typeof(val) <> 'object' then
    perform private.reg_fail(path);
  end if;
  if exists (select 1 from jsonb_object_keys(val) k where not (k = any (allowed))) then
    -- The unknown key is not echoed: it is client-controlled text.
    perform private.reg_fail(path || ' has an unknown field');
  end if;
  return val;
end;
$$;

create function private.reg_text(
  obj jsonb, key text, path text, max_len integer, required boolean
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb := obj -> key;
  t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then perform private.reg_fail(path || '.' || key); end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'string' then
    perform private.reg_fail(path || '.' || key);
  end if;
  t := nullif(btrim(v #>> '{}'), '');
  if t is null then
    if required then perform private.reg_fail(path || '.' || key); end if;
    return null;
  end if;
  if char_length(t) > max_len then
    perform private.reg_fail(path || '.' || key);
  end if;
  return t;
end;
$$;

create function private.reg_bool(obj jsonb, key text, path text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(obj -> key) is distinct from 'boolean' then
    perform private.reg_fail(path || '.' || key);
  end if;
  return (obj ->> key)::boolean;
end;
$$;

create function private.reg_uuid(obj jsonb, key text, path text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(obj -> key) is distinct from 'string'
     or (obj ->> key) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform private.reg_fail(path || '.' || key);
  end if;
  return (obj ->> key)::uuid;
end;
$$;

create function private.reg_array(
  obj jsonb, key text, path text, min_len integer, max_len integer
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb := obj -> key;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    v := '[]'::jsonb;
  end if;
  if jsonb_typeof(v) <> 'array'
     or jsonb_array_length(v) < min_len
     or jsonb_array_length(v) > max_len then
    perform private.reg_fail(path || '.' || key);
  end if;
  return v;
end;
$$;


-- ===========================================================================
-- 12. Shared enrollment core (refactor of family_request_enrollment)
-- ===========================================================================
-- Steps 3–8 of family_request_enrollment, moved here verbatim so the
-- registration contract uses the SAME MPS-REQ-012 evaluation rather than a
-- second copy that could drift. Authorization and the guardian-authority check
-- stay with each caller. Not reachable through the Data API: `private` is not
-- exposed and EXECUTE is revoked from PUBLIC.
create function private.request_enrollment_core(
  caller uuid,
  student_family uuid,
  target_student uuid,
  target_program uuid
)
returns table (
  outcome text,
  enrollment_id uuid,
  state public.enrollment_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  program_row public.programs%rowtype;
  existing public.enrollments%rowtype;
  confirmed_count integer;
  resolved_state public.enrollment_state;
  created uuid;
begin
  select * into program_row
  from public.programs
  where id = target_program
  for update;

  if not found or program_row.publication_state <> 'published' then
    return query select 'blocked_unavailable'::text, null::uuid,
                        null::public.enrollment_state;
    return;
  end if;

  if program_row.availability = 'closed' then
    return query select 'blocked_closed'::text, null::uuid,
                        null::public.enrollment_state;
    return;
  end if;

  select * into existing
  from public.enrollments e
  where e.student_id = target_student
    and e.program_id = target_program;

  if found then
    return query select 'duplicate'::text, existing.id, existing.state;
    return;
  end if;

  if program_row.capacity is not null then
    select count(*) into confirmed_count
    from public.enrollments e
    where e.program_id = target_program
      and e.state = 'confirmed';

    if confirmed_count >= program_row.capacity then
      if not program_row.waitlist_enabled then
        return query select 'blocked_full'::text, null::uuid,
                            null::public.enrollment_state;
        return;
      end if;
      resolved_state := 'waitlisted';
    end if;
  end if;

  if resolved_state is null then
    resolved_state := case program_row.confirmation_mode
      when 'administrator_approval' then 'approval_pending'::public.enrollment_state
      else 'started'::public.enrollment_state
    end;
  end if;

  begin
    insert into public.enrollments
      (family_id, student_id, program_id, state, state_changed_at,
       authority_affirmation_version, authority_affirmed_at, requested_by)
    values
      (student_family, target_student, target_program, resolved_state, now(),
       'demo-unapproved-v0', now(), caller)
    returning id into created;
  exception
    when unique_violation then
      select * into existing
      from public.enrollments e
      where e.student_id = target_student
        and e.program_id = target_program;
      return query select 'duplicate'::text, existing.id, existing.state;
      return;
  end;

  return query select resolved_state::text, created, resolved_state;
end;
$$;

comment on function private.request_enrollment_core(uuid, uuid, uuid, uuid) is
  'The MPS-REQ-012 evaluation shared by family_request_enrollment and '
  'submit_family_registration. Can only write started, approval_pending, or '
  'waitlisted. Callers must authorize and check guardian authority first.';


-- family_request_enrollment keeps its signature, authorization, and guardian-
-- authority check; the evaluation is the shared core. Behavior is unchanged,
-- which 110_family_conversion_journey.test.sql proves.
create or replace function public.family_request_enrollment(
  target_student uuid,
  target_program uuid,
  authority_affirmed boolean
)
returns table (
  outcome text,
  enrollment_id uuid,
  state public.enrollment_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  student_family uuid;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select s.family_id into student_family
  from public.students s
  where s.id = target_student;

  if student_family is null
     or not private.is_family_member(student_family)
     or not private.has_role('parent') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if authority_affirmed is not true then
    return query select 'blocked_authority'::text, null::uuid,
                        null::public.enrollment_state;
    return;
  end if;

  return query
    select c.outcome, c.enrollment_id, c.state
    from private.request_enrollment_core(
      caller, student_family, target_student, target_program) c;
end;
$$;


-- ===========================================================================
-- 13. registration_policy_satisfied
-- ===========================================================================
-- The hook a later eligibility check must use. True only when all three
-- documents were accepted against APPROVED versions. While the approval lock
-- stands it is always false: a draft acceptance never qualifies.
create function public.registration_policy_satisfied(target_registration uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select count(distinct a.document_kind) = 3
  from public.registration_document_acceptances a
  join public.registration_document_versions v on v.id = a.document_version_id
  where a.registration_id = target_registration
    and a.document_status_at_acceptance = 'approved'
    and v.status = 'approved';
$$;


-- ===========================================================================
-- 14. submit_family_registration
-- ===========================================================================
-- The only write path. See prompts/registration-data-foundation.md §5.6.
--
-- Payload (snake_case JSON):
--   authority_affirmed   boolean, must be true
--   guardian_contacts    1–2 of {full_name, phone, email?, relationship?, is_submitter}
--   emergency_contacts   0–4 of {full_name, relationship, phone}
--   pickup_persons       0–6 of {full_name, relationship, phone?}
--   children             1–10 of {student_id | new_student{preferred_name,
--                        grade_level?, guardian_relationship?}, has_allergies,
--                        allergy_details?, medical_information?,
--                        accommodation_information?, photo_video_permission,
--                        step_up?{selected, reference?},
--                        selections 1–10 of {program_id, attendance_days?}}
--   documents            {liability_waiver{version_id, typed_signature},
--                         code_of_conduct{version_id, typed_signature},
--                         parent_handbook{version_id, acknowledged: true}}
--
-- Outcomes: submitted, replayed, idempotency_conflict, blocked_authority,
-- blocked_documents_unavailable, blocked_document_version_stale,
-- blocked_unavailable, blocked_closed, blocked_full, blocked_duplicate.
-- A blocked submission writes nothing, so the same key may be retried.
create function public.submit_family_registration(
  idempotency_key uuid,
  payload jsonb
)
returns table (
  outcome text,
  registration_id uuid,
  blocker_child_index integer,
  blocker_program_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  fam uuid;
  fingerprint text;
  prior public.registration_submissions%rowtype;
  reg_id uuid;

  guardians jsonb;
  emergencies jsonb;
  pickups jsonb;
  kids jsonb;
  docs jsonb;
  item jsonb;
  sub jsonb;
  sels jsonb;
  days jsonb;
  path text;
  i integer;
  j integer;
  submitter_count integer := 0;
  has_allergy boolean;
  step_up jsonb;
  referenced_family uuid;

  doc_kind public.registration_document_kind;
  doc_version uuid;
  current_version public.registration_document_versions%rowtype;
  version_ids uuid[] := '{}';

  child_ids uuid[] := '{}';
  student_ids uuid[] := '{}';
  created_count integer := 0;
  step_up_count integer := 0;
  selection_count integer := 0;
  sid uuid;
  cid uuid;
  created_flag boolean;
  clean_name text;
  sel record;
  core record;
  acc_id uuid;

  err_msg text;
  err_detail text;
  err_hint text;
begin
  -- 1. Identity, role, and family: all from the session.
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not private.has_role('parent') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select fm.family_id into fam
  from public.family_members fm
  where fm.user_id = caller
  limit 1;
  if fam is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if submit_family_registration.idempotency_key is null then
    perform private.reg_fail('idempotency_key');
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    perform private.reg_fail('payload');
  end if;

  -- 2. Idempotency, before anything else is evaluated.
  fingerprint := encode(sha256(convert_to(payload::text, 'UTF8')), 'hex');

  select * into prior
  from public.registration_submissions r
  where r.submitted_by = caller
    and r.idempotency_key = submit_family_registration.idempotency_key;

  if found then
    if prior.request_fingerprint = fingerprint then
      return query select 'replayed'::text, prior.id, null::integer, null::uuid;
    else
      return query select 'idempotency_conflict'::text, null::uuid,
                          null::integer, null::uuid;
    end if;
    return;
  end if;

  -- 3. Shape. Everything is validated before anything is written.
  perform private.reg_object(payload, 'payload', array[
    'authority_affirmed', 'guardian_contacts', 'emergency_contacts',
    'pickup_persons', 'children', 'documents']);

  guardians := private.reg_array(payload, 'guardian_contacts', 'payload', 1, 2);
  for i in 0 .. jsonb_array_length(guardians) - 1 loop
    path := format('guardian_contacts[%s]', i);
    item := private.reg_object(guardians -> i, path, array[
      'full_name', 'phone', 'email', 'relationship', 'is_submitter']);
    perform private.reg_text(item, 'full_name', path, 120, true);
    perform private.reg_text(item, 'phone', path, 32, true);
    perform private.reg_text(item, 'email', path, 254, false);
    perform private.reg_text(item, 'relationship', path, 40, false);
    if private.reg_bool(item, 'is_submitter', path) then
      submitter_count := submitter_count + 1;
    end if;
  end loop;
  if submitter_count <> 1 then
    perform private.reg_fail('guardian_contacts needs exactly one submitter');
  end if;

  emergencies := private.reg_array(payload, 'emergency_contacts', 'payload', 0, 4);
  for i in 0 .. jsonb_array_length(emergencies) - 1 loop
    path := format('emergency_contacts[%s]', i);
    item := private.reg_object(emergencies -> i, path,
                               array['full_name', 'relationship', 'phone']);
    perform private.reg_text(item, 'full_name', path, 120, true);
    perform private.reg_text(item, 'relationship', path, 40, true);
    perform private.reg_text(item, 'phone', path, 32, true);
  end loop;

  pickups := private.reg_array(payload, 'pickup_persons', 'payload', 0, 6);
  for i in 0 .. jsonb_array_length(pickups) - 1 loop
    path := format('pickup_persons[%s]', i);
    item := private.reg_object(pickups -> i, path,
                               array['full_name', 'relationship', 'phone']);
    perform private.reg_text(item, 'full_name', path, 120, true);
    perform private.reg_text(item, 'relationship', path, 40, true);
    perform private.reg_text(item, 'phone', path, 32, false);
  end loop;

  kids := private.reg_array(payload, 'children', 'payload', 1, 10);
  for i in 0 .. jsonb_array_length(kids) - 1 loop
    path := format('children[%s]', i);
    item := private.reg_object(kids -> i, path, array[
      'student_id', 'new_student', 'has_allergies', 'allergy_details',
      'medical_information', 'accommodation_information',
      'photo_video_permission', 'step_up', 'selections']);

    if (item ? 'student_id') = (item ? 'new_student') then
      perform private.reg_fail(path || ' needs exactly one of student_id or new_student');
    end if;
    if item ? 'student_id' then
      perform private.reg_uuid(item, 'student_id', path);
    else
      sub := private.reg_object(item -> 'new_student', path || '.new_student',
        array['preferred_name', 'grade_level', 'guardian_relationship']);
      perform private.reg_text(sub, 'preferred_name', path || '.new_student', 80, true);
      perform private.reg_text(sub, 'grade_level', path || '.new_student', 40, false);
      perform private.reg_text(sub, 'guardian_relationship', path || '.new_student', 40, false);
    end if;

    has_allergy := private.reg_bool(item, 'has_allergies', path);
    if has_allergy
       <> (private.reg_text(item, 'allergy_details', path, 1000, false) is not null) then
      perform private.reg_fail(path || '.allergy_details');
    end if;
    perform private.reg_text(item, 'medical_information', path, 1000, false);
    perform private.reg_text(item, 'accommodation_information', path, 1000, false);
    perform private.reg_bool(item, 'photo_video_permission', path);

    if item ? 'step_up' and jsonb_typeof(item -> 'step_up') <> 'null' then
      step_up := private.reg_object(item -> 'step_up', path || '.step_up',
                                    array['selected', 'reference']);
      if not private.reg_bool(step_up, 'selected', path || '.step_up')
         and private.reg_text(step_up, 'reference', path || '.step_up', 64, false)
             is not null then
        perform private.reg_fail(path || '.step_up.reference');
      end if;
      perform private.reg_text(step_up, 'reference', path || '.step_up', 64, false);
    end if;

    sels := private.reg_array(item, 'selections', path, 1, 10);
    for j in 0 .. jsonb_array_length(sels) - 1 loop
      sub := private.reg_object(sels -> j, format('%s.selections[%s]', path, j),
                                array['program_id', 'attendance_days']);
      perform private.reg_uuid(sub, 'program_id', format('%s.selections[%s]', path, j));
      days := private.reg_array(sub, 'attendance_days',
                                format('%s.selections[%s]', path, j), 0, 7);
      if exists (
           select 1 from jsonb_array_elements(days) d
           where jsonb_typeof(d) <> 'string'
              or not ((d #>> '{}') = any (enum_range(null::public.attendance_day)::text[]))
         )
         or (select count(distinct d) from jsonb_array_elements(days) d)
            <> jsonb_array_length(days) then
        perform private.reg_fail(format('%s.selections[%s].attendance_days', path, j));
      end if;
    end loop;
    if (select count(distinct s ->> 'program_id') from jsonb_array_elements(sels) s)
       <> jsonb_array_length(sels) then
      perform private.reg_fail(path || '.selections repeats a program');
    end if;
  end loop;

  docs := private.reg_object(payload -> 'documents', 'documents',
    array['liability_waiver', 'code_of_conduct', 'parent_handbook']);
  perform private.reg_object(docs -> 'liability_waiver', 'documents.liability_waiver',
                             array['version_id', 'typed_signature']);
  perform private.reg_uuid(docs -> 'liability_waiver', 'version_id', 'documents.liability_waiver');
  perform private.reg_text(docs -> 'liability_waiver', 'typed_signature',
                           'documents.liability_waiver', 120, true);
  perform private.reg_object(docs -> 'code_of_conduct', 'documents.code_of_conduct',
                             array['version_id', 'typed_signature']);
  perform private.reg_uuid(docs -> 'code_of_conduct', 'version_id', 'documents.code_of_conduct');
  perform private.reg_text(docs -> 'code_of_conduct', 'typed_signature',
                           'documents.code_of_conduct', 120, true);
  -- No typed_signature key is allowed here: an acknowledgment is not a signature.
  perform private.reg_object(docs -> 'parent_handbook', 'documents.parent_handbook',
                             array['version_id', 'acknowledged']);
  perform private.reg_uuid(docs -> 'parent_handbook', 'version_id', 'documents.parent_handbook');
  if private.reg_bool(docs -> 'parent_handbook', 'acknowledged',
                      'documents.parent_handbook') is not true then
    perform private.reg_fail('documents.parent_handbook.acknowledged');
  end if;

  -- 4. Guardian authority (MPS-RUL-008).
  if private.reg_bool(payload, 'authority_affirmed', 'payload') is not true then
    return query select 'blocked_authority'::text, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- Referenced students must be this family's. Another family's child and a
  -- child that never existed get the identical refusal (no membership oracle).
  for i in 0 .. jsonb_array_length(kids) - 1 loop
    if kids -> i ? 'student_id' then
      referenced_family := null;
      select s.family_id into referenced_family
      from public.students s
      where s.id = (kids -> i ->> 'student_id')::uuid;
      if referenced_family is null or referenced_family <> fam then
        raise exception 'not authorized' using errcode = '42501';
      end if;
    end if;
  end loop;

  -- 5. Documents: the version the family saw must be the one presented now.
  foreach doc_kind in array enum_range(null::public.registration_document_kind) loop
    doc_version := (docs -> doc_kind::text ->> 'version_id')::uuid;
    select * into current_version
    from public.registration_document_versions v
    where v.document_kind = doc_kind and v.status <> 'retired';
    if not found then
      return query select 'blocked_documents_unavailable'::text, null::uuid,
                          null::integer, null::uuid;
      return;
    end if;
    if current_version.id <> doc_version then
      return query select 'blocked_document_version_stale'::text, null::uuid,
                          null::integer, null::uuid;
      return;
    end if;
    version_ids := version_ids || current_version.id;
  end loop;

  -- 6. Atomic body. A blocked selection raises HR001, which rolls back every
  --    row written in this block, including the submission itself.
  begin
    begin
      insert into public.registration_submissions
        (family_id, submitted_by, idempotency_key, request_fingerprint)
      values
        (fam, caller, submit_family_registration.idempotency_key, fingerprint)
      returning id into reg_id;
    exception
      when unique_violation then
        -- A concurrent retry with the same key committed first.
        select * into prior
        from public.registration_submissions r
        where r.submitted_by = caller
          and r.idempotency_key = submit_family_registration.idempotency_key;
        if prior.request_fingerprint = fingerprint then
          return query select 'replayed'::text, prior.id, null::integer, null::uuid;
        else
          return query select 'idempotency_conflict'::text, null::uuid,
                              null::integer, null::uuid;
        end if;
        return;
    end;

    -- Children, their health, and STEP UP.
    for i in 0 .. jsonb_array_length(kids) - 1 loop
      item := kids -> i;
      created_flag := false;

      if item ? 'student_id' then
        sid := (item ->> 'student_id')::uuid;
      else
        sub := item -> 'new_student';
        clean_name := private.reg_text(sub, 'preferred_name', 'new_student', 80, true);
        sid := null;
        select s.id into sid
        from public.students s
        where s.family_id = fam and lower(s.preferred_name) = lower(clean_name)
        limit 1;
        if sid is null then
          begin
            insert into public.students
              (family_id, preferred_name, grade_level, guardian_relationship)
            values
              (fam, clean_name,
               private.reg_text(sub, 'grade_level', 'new_student', 40, false),
               private.reg_text(sub, 'guardian_relationship', 'new_student', 40, false))
            returning id into sid;
            created_flag := true;
            created_count := created_count + 1;
          exception
            when unique_violation then
              select s.id into sid
              from public.students s
              where s.family_id = fam and lower(s.preferred_name) = lower(clean_name)
              limit 1;
          end;
        end if;
      end if;

      begin
        insert into public.registration_children
          (registration_id, student_id, created_student, photo_video_permission)
        values
          (reg_id, sid, created_flag, (item ->> 'photo_video_permission')::boolean)
        returning id into cid;
      exception
        when unique_violation then
          perform private.reg_fail(format('children[%s] repeats another child', i));
      end;

      child_ids := child_ids || cid;
      student_ids := student_ids || sid;

      insert into public.registration_child_health
        (registration_child_id, registration_id, has_allergies, allergy_details,
         medical_information, accommodation_information)
      values
        (cid, reg_id, (item ->> 'has_allergies')::boolean,
         private.reg_text(item, 'allergy_details', 'child', 1000, false),
         private.reg_text(item, 'medical_information', 'child', 1000, false),
         private.reg_text(item, 'accommodation_information', 'child', 1000, false));

      step_up := item -> 'step_up';
      if step_up is not null and jsonb_typeof(step_up) = 'object'
         and (step_up ->> 'selected')::boolean then
        insert into public.registration_step_up_requests
          (registration_child_id, registration_id, reference)
        values
          (cid, reg_id, private.reg_text(step_up, 'reference', 'step_up', 64, false));
        step_up_count := step_up_count + 1;
      end if;
    end loop;

    -- Contacts.
    for i in 0 .. jsonb_array_length(guardians) - 1 loop
      item := guardians -> i;
      insert into public.registration_contacts
        (registration_id, contact_kind, full_name, relationship, phone, email,
         is_submitter, sort_order)
      values
        (reg_id, 'guardian',
         private.reg_text(item, 'full_name', 'contact', 120, true),
         private.reg_text(item, 'relationship', 'contact', 40, false),
         private.reg_text(item, 'phone', 'contact', 32, true),
         private.reg_text(item, 'email', 'contact', 254, false),
         (item ->> 'is_submitter')::boolean, i);
    end loop;
    for i in 0 .. jsonb_array_length(emergencies) - 1 loop
      item := emergencies -> i;
      insert into public.registration_contacts
        (registration_id, contact_kind, full_name, relationship, phone, sort_order)
      values
        (reg_id, 'emergency',
         private.reg_text(item, 'full_name', 'contact', 120, true),
         private.reg_text(item, 'relationship', 'contact', 40, true),
         private.reg_text(item, 'phone', 'contact', 32, true), i);
    end loop;
    for i in 0 .. jsonb_array_length(pickups) - 1 loop
      item := pickups -> i;
      insert into public.registration_contacts
        (registration_id, contact_kind, full_name, relationship, phone, sort_order)
      values
        (reg_id, 'pickup',
         private.reg_text(item, 'full_name', 'contact', 120, true),
         private.reg_text(item, 'relationship', 'contact', 40, true),
         private.reg_text(item, 'phone', 'contact', 32, false), i);
    end loop;

    -- Selections, in program order so concurrent submissions lock program
    -- rows in the same order and cannot deadlock each other.
    for sel in
      select (c.ord - 1)::integer as child_index,
             (s.value ->> 'program_id')::uuid as program_id,
             coalesce(nullif(s.value -> 'attendance_days', 'null'::jsonb),
                      '[]'::jsonb) as days
      from jsonb_array_elements(kids) with ordinality as c(value, ord)
      cross join lateral jsonb_array_elements(c.value -> 'selections') as s(value)
      order by 2, 1
    loop
      select * into core
      from private.request_enrollment_core(
        caller, fam, student_ids[sel.child_index + 1], sel.program_id) rc;

      if core.outcome in ('blocked_unavailable', 'blocked_closed', 'blocked_full') then
        raise exception using errcode = 'HR001', message = core.outcome,
          detail = sel.child_index::text, hint = sel.program_id::text;
      elsif core.outcome = 'duplicate' then
        raise exception using errcode = 'HR001', message = 'blocked_duplicate',
          detail = sel.child_index::text, hint = sel.program_id::text;
      end if;

      insert into public.registration_selections
        (registration_child_id, registration_id, program_id, enrollment_id,
         attendance_days)
      values
        (child_ids[sel.child_index + 1], reg_id, sel.program_id, core.enrollment_id,
         coalesce(
           (select array_agg(d::public.attendance_day order by d::public.attendance_day)
            from jsonb_array_elements_text(sel.days) d),
           '{}'));
      selection_count := selection_count + 1;
    end loop;

    -- Acceptance evidence. Signer is always the caller; every child is covered.
    foreach doc_kind in array enum_range(null::public.registration_document_kind) loop
      select * into current_version
      from public.registration_document_versions v
      where v.id = (docs -> doc_kind::text ->> 'version_id')::uuid;

      insert into public.registration_document_acceptances
        (registration_id, document_version_id, document_kind, acceptance_method,
         signer_user_id, typed_signature, document_status_at_acceptance)
      values
        (reg_id, current_version.id, doc_kind,
         case when doc_kind = 'parent_handbook'
              then 'acknowledgment'::public.document_acceptance_method
              else 'signature'::public.document_acceptance_method end,
         caller,
         case when doc_kind = 'parent_handbook' then null
              else private.reg_text(docs -> doc_kind::text, 'typed_signature',
                                    'document', 120, true) end,
         current_version.status)
      returning id into acc_id;

      insert into public.registration_acceptance_children
        (acceptance_id, registration_child_id, registration_id)
      select acc_id, c, reg_id from unnest(child_ids) as c;
    end loop;

    -- Attributable history: counts and ids only, never a submitted value.
    insert into public.audit_events
      (actor_user_id, entity_type, entity_id, action, changed_fields)
    values
      (caller, 'registration', reg_id, 'submitted', jsonb_build_object(
        'child_count', cardinality(child_ids),
        'created_student_count', created_count,
        'selection_count', selection_count,
        'guardian_contact_count', jsonb_array_length(guardians),
        'emergency_contact_count', jsonb_array_length(emergencies),
        'pickup_person_count', jsonb_array_length(pickups),
        'step_up_count', step_up_count,
        'document_version_ids', to_jsonb(version_ids),
        'is_sample', true));
  exception
    when sqlstate 'HR001' then
      get stacked diagnostics
        err_msg = message_text,
        err_detail = pg_exception_detail,
        err_hint = pg_exception_hint;
      return query select err_msg, null::uuid, err_detail::integer, err_hint::uuid;
      return;
  end;

  return query select 'submitted'::text, reg_id, null::integer, null::uuid;
end;
$$;

comment on function public.submit_family_registration(uuid, jsonb) is
  'The only write path for family registration (SAMPLE ONLY). Derives family '
  'and role from the session, is idempotent per (caller, idempotency_key), is '
  'atomic across children and selections, creates enrollments only through '
  'private.request_enrollment_core, and never writes confirmed or payment '
  'states. Errors name payload paths, never values.';


-- ===========================================================================
-- 15. Function privileges
-- ===========================================================================
revoke all on function private.enforce_registration_child_family() from public;
revoke all on function private.enforce_registration_selection_enrollment() from public;
revoke all on function private.enforce_registration_acceptance_signer() from public;
revoke all on function private.registration_evidence_immutable() from public;
revoke all on function private.reg_fail(text) from public;
revoke all on function private.reg_object(jsonb, text, text[]) from public;
revoke all on function private.reg_text(jsonb, text, text, integer, boolean) from public;
revoke all on function private.reg_bool(jsonb, text, text) from public;
revoke all on function private.reg_uuid(jsonb, text, text) from public;
revoke all on function private.reg_array(jsonb, text, text, integer, integer) from public;
revoke all on function private.request_enrollment_core(uuid, uuid, uuid, uuid) from public;

revoke all on function private.can_read_registration(uuid) from public;
grant execute on function private.can_read_registration(uuid) to authenticated;

revoke all on function public.registration_policy_satisfied(uuid) from public, anon;
grant execute on function public.registration_policy_satisfied(uuid) to authenticated;

revoke all on function public.submit_family_registration(uuid, jsonb) from public, anon;
grant execute on function public.submit_family_registration(uuid, jsonb) to authenticated;

-- create or replace keeps existing grants; restated so the surface is explicit.
revoke all on function public.family_request_enrollment(uuid, uuid, boolean) from public, anon;
grant execute on function public.family_request_enrollment(uuid, uuid, boolean) to authenticated;


-- ===========================================================================
-- 16. RLS — deny by default
-- ===========================================================================
alter table public.registration_document_versions enable row level security;
alter table public.registration_submissions enable row level security;
alter table public.registration_children enable row level security;
alter table public.registration_child_health enable row level security;
alter table public.registration_contacts enable row level security;
alter table public.registration_selections enable row level security;
alter table public.registration_step_up_requests enable row level security;
alter table public.registration_document_acceptances enable row level security;
alter table public.registration_acceptance_children enable row level security;

-- A parent reads the version currently presented; an administrator reads all.
-- Educators and visitors read none.
create policy "registration_document_versions_select_parent"
  on public.registration_document_versions for select
  to authenticated
  using (status <> 'retired' and private.has_role('parent'));

create policy "registration_document_versions_select_admin"
  on public.registration_document_versions for select
  to authenticated
  using (private.is_admin());

create policy "registration_submissions_select_own_family"
  on public.registration_submissions for select
  to authenticated
  using (private.is_family_member(family_id));

create policy "registration_submissions_select_admin"
  on public.registration_submissions for select
  to authenticated
  using (private.is_admin());

-- Every child table: readable exactly when its submission is. Administrator
-- read of health and contacts is read-only and sample-only (owner decision of
-- 2026-09-18); real-family staff access is checklist §9.
do $$
declare
  t text;
begin
  foreach t in array array[
    'registration_children', 'registration_child_health',
    'registration_contacts', 'registration_selections',
    'registration_step_up_requests', 'registration_document_acceptances',
    'registration_acceptance_children'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (private.can_read_registration(registration_id))',
      t || '_select_family_or_admin', t);
  end loop;
end;
$$;

-- No INSERT, UPDATE, or DELETE policy for any client role, and nothing for
-- anon. No educator policy on any registration table.


-- ===========================================================================
-- 17. Table privileges — last, after every DDL statement (DEFECT-FF1)
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'registration_document_versions', 'registration_submissions',
    'registration_children', 'registration_child_health',
    'registration_contacts', 'registration_selections',
    'registration_step_up_requests', 'registration_document_acceptances',
    'registration_acceptance_children'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated, public', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;
