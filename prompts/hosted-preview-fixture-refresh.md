# Implementation prompt — Hosted preview fixture refresh

Branch: `chore/preview-fixture-refresh` from `release/foundation-preview` (PR #26 merged there, not to `main`).
Requested 2026-09-18, to close the hosted-fixture follow-up recorded in
`prompts/public-offering-model.md` §11 and `prompts/closeout-slice-1-audit-fixes.md` §12
before Samantha signs in to the Vercel preview as a family, educator, or administrator.

## 1. Goal and scope

Make the sample data on the hosted preview project (`uedgcwoxyhtirsihvrnf`) match
`supabase/seed.sql`, so every signed-in review surface shows current offerings and every
trust state (pending, confirmed, waitlisted, canceled, full) has something to show.

**In scope:** one reconciliation statement added to `seed.sql`; one guarded, owner-run
`psql` apply of `seed.sql` to the hosted project; read-only verification queries; state records.

**Out of scope:** any schema, migration, RLS, or application-code change; any change to
published offering content; sample-account passwords; production; real-family data.

## 2. What the hosted project actually holds (read-only inspection, 2026-09-18)

`supabase migration list --linked`: all 21 migrations applied, including `20260916000000`.
`npm run db:types:check`: **passes** (it was blocked until the push).

| Table | Hosted today | `seed.sql` expects |
|---|---|---|
| programs | 15 rows, correct publication states | same |
| program demo config (capacity, waitlist, confirmation mode) | **none set** | Tutoring 12/waitlist, Sewing 8, Gardening instant, Monthly Clubs 1/full/waitlist, Ready Set Sensory 1/full |
| educator_assignments | **Art Lab (archived)** + draft fixture | Tutoring + draft fixture |
| families | A, B, and **"Sample Family Four"** (parent four completed setup on 2026-08-29) | A and B only; parents three and four must have no family |
| students | 3 | 3 |
| enrollments | **0** | 7 |
| program_sessions, session_attendance | **0** | 6, 1 |
| announcements, learning_resources | **0** | 4, 4 |
| inquiries | **0** | 4 |

So the gap is bigger than the earlier note said: hosted fixtures were loaded before the
dashboard, enrollment, schedule, and inquiry slices, and never refreshed. Today a reviewer
signing in as the educator lands on an archived program, a parent sees an empty dashboard,
and the admin enrollment and inquiry queues are empty.

## 3. Why re-running `seed.sql` alone is not enough

Every insert in `seed.sql` is `on conflict do nothing`. Re-running it **adds** the missing
enrollments, sessions, announcements, resources, attendance, and inquiries, applies the
capacity/confirmation `update`s, and removes Sample Family Four (the existing
parent three/four `delete`). It does **not** remove the educator's Art Lab assignment,
because nothing conflicts with it.

Fix: add a targeted delete to `seed.sql`, directly above the assignment insert, following
the parent three/four precedent already in the file:

```sql
-- Slice 1 moved the sample educator off Art Lab (0004), now archived. A re-seed
-- must put the fixture back, and `on conflict do nothing` cannot remove a row
-- nothing conflicts with.
delete from public.educator_assignments
  where educator_user_id = educator
    and program_id = '10000000-0000-4000-8000-000000000004';
```

Locally this is a no-op (`db:reset` never creates that row). On the hosted project it
removes exactly one row. No other seed change.

## 4. Applicable IDs

- MPS-RUL-007 (sanitized data only), MPS-REQ-008, MPS-ACC-019/020/021/028 targets (made
  reachable on hosted), DEC-024; `prompts/public-offering-model.md` §11 follow-up.
- MTS: Supabase is the system of record; `seed.sql` guarded by `hsh_seed_environment`
  (`supabase/README.md` "Deploying to preview"); MTS-CHG-008 hosted status.
- MDS: no visual change. Existing surfaces simply have their sample data.

## 5. Security, privacy, data

- Every row written is already in the repository, synthetic, `is_sample` where the schema
  requires it, on `example.com` addresses, and prefixed "Sample". No real person or child.
- Sample-account `auth.users` inserts are `do nothing`: **hosted passwords are not changed.**
- The agent does **not** hold or ask for the hosted database password. The owner runs the
  apply with their own connection string; it never goes into a file, the repo, or a log.
- Seeding bypasses `record_program_audit`, as all seeding does; the capacity and assignment
  changes on hosted will have no audit event. That is honest for fixtures (granted_by stays
  NULL, per the file's existing convention) and is recorded here rather than hidden.
- Deleting Sample Family Four removes one sample family with zero students and no enrollments.

## 6. Steps

**Agent:**
1. Branch from `release/foundation-preview`; add the delete in §3 to `seed.sql`.
2. `npm run db:reset` (gate on its `verified` line) and `npm run db:test` locally to prove
   the file still applies cleanly and every pgTAP assertion passes.
3. Commit; open a PR.

**Owner (WSL bash), after the PR is reviewed** — take the direct connection string from the
Supabase dashboard (Project Settings → Database), never from a file:

```bash
cd ~/home-school-haven && git checkout chore/preview-fixture-refresh
read -rs PREVIEW_DB_URL   # paste the connection string; nothing is echoed or saved
psql "$PREVIEW_DB_URL" -v ON_ERROR_STOP=1 \
  -v hsh_seed_environment=preview -f supabase/seed.sql
echo "psql exit: $?"
unset PREVIEW_DB_URL
```

A non-zero exit means stop and send me the error text (not the URL).

**Agent, after the owner's apply:** re-run the read-only inspection query from §2 via
`supabase db query --linked` and confirm every row in the right-hand column.

## 7. Rollback

The apply is idempotent and additive except for two deletes (the Art Lab assignment and
Sample Family Four). Neither is data anyone needs: both are sample fixtures that the seed
itself declares wrong. If the apply fails part-way, `ON_ERROR_STOP` stops it inside the
single `do $$ … $$` block, which Postgres rolls back as one statement; re-run after fixing.
To undo entirely, delete the rows by their fixed `5…`, `6…`, `7…`, `8…`, `a0…` IDs.

## 8. Checks

`npm run db:reset`, `npm run db:test`, `npm run db:types:check`, `format:check`. No build
or e2e run is needed: no application code changes. Post-apply hosted verification per §6.

## 9. Manual test on the Vercel preview (after apply)

- `sample.educator@example.com` → `/educator`: assigned program reads **Tutoring**, roster
  shows one confirmed student and not the payment-pending one.
- `sample.parent.one@example.com` → `/family`: Tutoring *payment pending* and Haven Days
  *confirmed* side by side; a canceled Haven Days session; Sample Student A2 approval pending.
- `sample.admin@example.com` → `/admin/enrollments` and `/admin/inquiries`: populated.
- `sample.parent.four@example.com` → lands in family setup (no family).

## 10. State records

- `mts/MTS-PROJECT-STATE.yaml` MTS-CHG-008: replace "NOT APPLIED as of 2026-09-17" with the
  applied state verified 2026-09-18, and mark `db:types:check` as **passed** on 2026-09-18.
- Record the fixture refresh (date, what changed, verification result) under MTS-CHG-008.
