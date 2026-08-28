-- Foundation Release — programs as the system of record
--
-- MPS: MPS-REQ-008, MPS-REQ-020, MPS-RUL-005
-- MTS: MTS-ARCHITECTURE-ADDENDUM "Course and program architecture"
--      (Supabase is the single source of truth; Sanity is deferred)
--
-- Column names mirror `src/content/programs.ts` exactly, so replacing the
-- staging module with these rows changes no component contract. Every
-- "published_*" column is text preserved as written by the source inventory;
-- an unpublished fact stays NULL and is never derived (import rule 3).
--
-- rollback:
--   drop trigger if exists programs_set_updated_at on public.programs;
--   drop function if exists public.set_updated_at();
--   drop table if exists public.programs;
--   drop type if exists public.program_publication_state;
--   drop type if exists public.availability_state;

-- Exactly the MDS enrollment_state availability vocabulary
-- (MDS-PROJECT-STATE components.enrollment_state).
create type public.availability_state as enum (
  'open', 'limited', 'waitlist', 'closed', 'unknown'
);

create type public.program_publication_state as enum (
  'draft', 'published', 'archived'
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,

  -- Published facts, preserved as written. NULL means "the source does not
  -- publish this", which the UI renders as "Contact for details" (QA-005).
  published_dates text,
  published_schedule text,
  published_duration text,
  published_session_length text,
  published_price text,
  published_registration_options text,
  summary text,
  audience text,
  format text,
  location text,
  educator text,
  enrollment_window text,

  availability public.availability_state not null default 'unknown',
  publication_state public.program_publication_state not null default 'draft',

  -- Program-specific external checkout handoff (MPS-REQ-013). A URL here is
  -- never evidence of payment or enrollment.
  checkout_url text,

  import_status text not null default 'import',
  source text not null,

  -- Details the source shows near the program without proving the association
  -- (QA-001, import rule 7). Retained for traceability, never rendered.
  unverified_details jsonb not null default '[]'::jsonb,

  -- Demo-only placeholder art. NULL once approved photography replaces it.
  image_src text,
  image_alt text,
  image_width integer,
  image_height integer,
  image_is_placeholder boolean not null default false,

  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint programs_import_status_check
    check (import_status in ('import', 'import-title-review-detail')),
  -- An image is either fully specified or absent; a half-filled image cannot
  -- render an accessible <img>.
  constraint programs_image_complete_check check (
    (image_src is null and image_alt is null
      and image_width is null and image_height is null)
    or
    (image_src is not null and image_alt is not null
      and image_width is not null and image_height is not null)
  ),
  constraint programs_unverified_details_is_array
    check (jsonb_typeof(unverified_details) = 'array')
);

create index programs_publication_state_idx
  on public.programs (publication_state, sort_order);

comment on table public.programs is
  'Authoritative published program truth across public, family, educator, and '
  'administrative surfaces (MPS-REQ-020).';


-- ---------------------------------------------------------------------------
-- educator assignments
-- ---------------------------------------------------------------------------
-- MPS-REQ-018: an educator reaches assigned programs and nothing else.
create table public.educator_assignments (
  educator_user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null,
  primary key (educator_user_id, program_id)
);

create index educator_assignments_program_idx
  on public.educator_assignments (program_id);

create function private.is_assigned_educator(target_program uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.educator_assignments ea
    where ea.educator_user_id = (select auth.uid())
      and ea.program_id = target_program
  );
$$;

revoke all on function private.is_assigned_educator(uuid) from public;
grant execute on function private.is_assigned_educator(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger families_set_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();
