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

`seed.sql` is **not** applied by `db push`. To load sanitized fixtures into a
preview, run it deliberately:

```bash
psql "$PREVIEW_DB_URL" -f supabase/seed.sql
```

It refuses to run when `app.environment` is set to `production`.

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

---

## Sample accounts (local and preview only)

Every address is on the reserved `example.com` domain and every record is
synthetic (MPS-RUL-007). Password: `SampleFoundationReview2026`.

| Email | Role | Reaches |
|---|---|---|
| `sample.parent.one@example.com` | parent | Sample Family A |
| `sample.parent.two@example.com` | parent | Sample Family B |
| `sample.educator@example.com` | educator | Art Lab + the sample draft |
| `sample.admin@example.com` | admin | every program and the audit history |

## What is deliberately not modelled

| Missing | Why |
|---|---|
| `students` | MPS-RUL-006 permits only "approved minimum fields", and MPS GAP-005 leaves that list unconfirmed. Choosing columns here would be inventing child-data policy. |
| `consents` | MPS GAP-005: consent language, retention, and deletion policy are Samantha's to confirm. |
| `enrollments`, payment state | MPS GAP-010: financial policy and the authoritative checkout signal are unresolved. `programs.checkout_url` holds the external handoff link only, which is never evidence of payment. |
| Storage buckets | MTS IMPLEMENTATION-PLAN Phase 4, and gated on the upload-safety and R2 recovery controls. |

`tests/database/00_setup.test.sql` asserts these tables are absent, so their
arrival is a deliberate decision rather than a quiet one.
