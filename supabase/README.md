# Supabase — Foundation Release

Data, identity, and authorization for the Home School Haven Foundation Release.
All commands are WSL/Ubuntu bash.

Approved by MTS: `TECHNOLOGY-BLUEPRINT.md`, `SECURITY-ARCHITECTURE.md`,
`IMPLEMENTATION-PLAN.md` Phase 1.

---

## What is here

| Path | Purpose |
|---|---|
| `config.toml` | Local stack configuration. Self-service sign-up is **off**; email confirmation is **on**; minimum password length is 12. |
| `migrations/` | Versioned, additive migrations. Each carries a commented `-- rollback:` block. |
| `seed.sql` | Sanitized local/preview fixtures. Real published program content; synthetic people. |
| `tests/database/` | pgTAP authorization tests — positive and negative, per role. |

## Running the pgTAP tests without Docker

`npm run db:test` needs the local stack. When Docker is unavailable, the test
files can be run straight against a database with `psql` — each one wraps
itself in `begin … rollback`, including its own `create extension`, so it
leaves nothing behind:

```bash
for f in supabase/tests/database/*.test.sql; do
  echo "### $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f" | grep -E "^ (not )?ok "
done
```

Check both the `not ok` lines **and** the exit code: a file that raises stops
early, and the assertions after the error never run at all.

## Requirements

The Supabase CLI drives a **local stack in Docker**. Docker is required and is
not currently installed in this workspace:

```bash
sudo apt-get update && sudo apt-get install -y docker.io
sudo usermod -aG docker "$USER"
# then close and reopen the WSL session so the group takes effect
docker run --rm hello-world   # verify
```

---

## Local workflow

```bash
npm run db:start           # start the local stack (Postgres, Auth, Studio)
npm run db:reset           # apply every migration, then seed.sql
npm run db:types           # regenerate src/lib/supabase/database.types.ts
npm run db:test            # run the pgTAP authorization tests
npm run db:advisors        # Supabase security and performance advisors
```

Then point the app at the local stack:

```bash
cp .env.example .env.local
supabase status            # copy the API URL and the publishable key
npm run dev
```

### Changing the schema

Never hand-invent a migration filename:

```bash
supabase migration new <descriptive_name>
# edit the generated file, then
npm run db:reset && npm run db:test && npm run db:types
```

Iterate against the running database with `supabase db query` while exploring,
and write the finished SQL into the migration file. Do not use `apply_migration`
to iterate — it writes a history entry on every call.

---

## Deploying to preview

```bash
supabase login
supabase link --project-ref <preview-project-ref>
supabase db push           # apply migrations
```

Automatic seeding is disabled so fixture loading always uses an explicit,
guarded workflow. To load sanitized fixtures into a preview, run the file
deliberately with its psql-only marker and **always use `ON_ERROR_STOP`**:

```bash
psql "$PREVIEW_DB_URL" -v ON_ERROR_STOP=1 \
  -v hsh_seed_environment=preview -f supabase/seed.sql
echo "psql exit: $?"
```

The seed script only executes when psql receives `hsh_seed_environment` as
`local` or `preview`. The SQL file never sets that marker itself, and Supabase's
linked seed runner cannot supply it. `npm run db:reset` supplies `local` only
after verifying the fixed local database address.

The file also forces `ON_ERROR_STOP` internally; the command repeats it
defensively. Without that behavior psql reports an error and carries on, so a
partial seed looks like a successful one. That is not hypothetical: the
programs insert lacked an `on conflict` clause, so on a second run the file died
at the programs block and silently skipped every account, role grant, family,
and student after it. The insert is idempotent now, but the stop-on-error guard
still ensures failures are visible.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
Vercel, **scoped to Preview only**. Local, preview, and production credentials
stay separate (TECHNOLOGY-BLUEPRINT "Environment boundary").

---

## Rolling back

Every migration is additive — none drops or rewrites existing data — so a
rollback is a schema reversal, not a data recovery.

* **Local:** `npm run db:reset` rebuilds from scratch.
* **Deployed:** run the `-- rollback:` block from the head of the migration file,
  in reverse migration order, then delete the corresponding row from
  `supabase_migrations.schema_migrations`.

Verify with `supabase migration list --linked`.

---

## The authorization model

Two independent enforcement layers, and both are required:

1. **RLS**, defined in `migrations/*_foundation_rls_policies.sql`. Deny by
   default: an absent policy is a denial. `user_roles` and `audit_events` have
   no client write policy at all, so a role cannot be granted and history cannot
   be rewritten through the Data API by anyone.
2. **Server guards**, in `src/lib/auth/guards.ts`. Each protected page
   re-derives identity and role from the verified session before it queries
   anything.

Roles live in `public.user_roles`, never in `auth.users.raw_user_meta_data`,
which the user can edit themselves.

Helper functions live in the `private` schema, which is deliberately absent from
`config.toml`'s `api.schemas` and so is unreachable through the Data API.

### Granting a role

There is no UI and no client path for this by design. Use the SQL editor or
`psql` as a privileged operator:

```sql
insert into public.user_roles (user_id, role, granted_by)
values ('<user-uuid>', 'educator', '<granting-admin-uuid>');
```

`public.app_role` also defines `owner`, and `isAdmin()` in
`src/lib/auth/session.ts` accepts it, but no account holds it and no approved
requirement distinguishes owner-only from delegated-administrator authority in
the Foundation Release (MPS-GAP-ADMIN-002). Until one does, an administrator and
the owner have the same reach, and the operations overview states the
distinction in words rather than enforcing one it has not been given.

### What the administrator operations overview reads

`/admin` performs exactly seven reads, all of them permitted by existing
`*_select_admin` policies with existing grants — the slice added no migration,
no policy, and no privilege:

| Table | Selected | Why not more |
|---|---|---|
| `programs` | identity, publication state, checkout presence, import flag, published-detail nullability, imagery | — |
| `educator_assignments` | `educator_user_id`, `program_id` | — |
| `enrollments` | `state` only | An aggregate needs no note, student, or family, and what is never read cannot leak. |
| `families` | `id` only | Counted, never named. |
| `students` | `affirmation_version` only | The consent signal. No name, grade, or relationship. |
| `user_roles` | `role` only | Counted, never attributed. |
| `audit_events` | time, entity type, action, whether an actor is attributed | `changed_fields` holds enum labels and is not rendered. |

`supabase/tests/database/60_rls_admin_overview.test.sql` runs each of these as an
administrator, a parent, an educator, an account with no role grant, and a caller
whose JWT metadata falsely claims `admin`.

---

## Sample accounts (local and preview only)

Every address is on the reserved `example.com` domain and every record is
synthetic (MPS-RUL-007).

| Email | Role | Reaches |
|---|---|---|
| `sample.parent.one@example.com` | parent | Sample Family A |
| `sample.parent.two@example.com` | parent | Sample Family B |
| `sample.parent.three@example.com` | parent | No family — the `family_incomplete` state |
| `sample.parent.four@example.com` | parent | No family — the account the end-to-end suite completes setup with |
| `sample.educator@example.com` | educator | Art Lab + the sample draft |
| `sample.admin@example.com` | admin | every program and the audit history |

Passwords are set during local seeding only and are not documented here.

## What is deliberately not modelled

| Missing | Why |
|---|---|
| `consents` | MPS GAP-005: consent language, retention, and deletion policy are Samantha's to confirm. |
| An authoritative payment record | MPS GAP-010: financial policy and the trustworthy checkout signal are unresolved. `public.enrollments` stores an enrollment *state* that an authorized human set; nothing stores or infers a payment outcome. `programs.checkout_url` holds the external handoff link only, which is never evidence of payment. |
| Administrator provisioning | MPS-GAP-ADMIN-001: no approved requirement or workflow defines who grants an administrator role, through what authorized path, or what evidence is retained. Granting one is the manual operation below. |
| Storage buckets | MTS IMPLEMENTATION-PLAN Phase 4, and gated on the upload-safety and R2 recovery controls. |

`tests/database/00_setup.test.sql` asserts these tables are absent, so their
arrival is a deliberate decision rather than a quiet one.

## `students` — a demo table, on purpose

`students` used to be on the list above. It exists now under an explicit owner
decision of 2026-08-29 (deviation D-FF1 in
`prompts/family-foundation-vertical-slice.md`), taken while MPS GAP-005 is still
open. Samantha has not confirmed the approved minimum fields (checklist §7) or
the consent and guardian-authority language (checklist §6).

Two CHECK constraints hold that boundary instead of a comment:

* `students_sample_only` — `is_sample` must be true. A non-sample student row
  cannot be stored at all while the policy is unconfirmed (MPS-RUL-007).
* `students_affirmation_unapproved` — `affirmation_version` must be
  `demo-unapproved-v0`. No row can record that Samantha-approved language was
  accepted, because no approved version string is storable (MPS-RUL-010).

Columns are preferred name, grade level, and guardian relationship. Legal name,
date of birth, allergies, medical needs, accommodations, emergency contacts,
authorized pickup, and photographs are absent, and
`tests/database/25_family_setup.test.sql` asserts each one stays absent
(MPS-RUL-006).

Before real-family activation, re-derive the field set and the affirmation from
Samantha's answers and replace both constraints deliberately.

## Family writes

`families`, `family_members`, and `students` have **no client write policy** at
any verb. Every write arrives through a SECURITY DEFINER function that derives
the caller from `auth.uid()` rather than from an argument:

| Function | Guarantee |
|---|---|
| `create_family_for_current_user(text)` | Requires the `parent` role. Returns the existing family on a repeat call; a unique index on `family_members.user_id` is the backstop under concurrency. |
| `add_student_to_own_family(text, text, text)` | Family is derived from the caller's membership, never passed in. Returns the existing profile when the same preferred name is resubmitted. |
| `remove_student_from_own_family(uuid)` | Deletes only within the caller's own family, and answers the same way for another family's id as for one that never existed. |

An RLS INSERT policy was deliberately not used: one that let a caller insert
their own `user_id` into `family_members` would also let them insert themselves
into any family id they could guess.
