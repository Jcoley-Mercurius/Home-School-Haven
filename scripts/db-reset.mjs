/**
 * Local database reset, verified.
 *
 * Wraps `supabase db reset` because the bare command is not trustworthy on a
 * slow machine, in two distinct ways:
 *
 *  1. It exits NON-ZERO when the storage container misses its health check,
 *     even though every migration and the seed applied correctly. Treating that
 *     exit code as failure means aborting a run that actually succeeded.
 *  2. Started while containers are still restarting from (1), it can abort
 *     during "Recreating database..." BEFORE seeding, and still look like it
 *     ran. That leaves an EMPTY database, and whatever runs next fails for
 *     reasons that have nothing to do with the code under test — which is
 *     exactly the "a check that did not run must not read as a pass" problem
 *     AGENTS.md §12 warns about.
 *
 * So the exit code is not the signal. The signal is the seeded data: this waits
 * for the containers to be healthy, resets, then asks the database whether the
 * fixtures are actually there, and retries when they are not.
 *
 *   npm run db:reset
 *
 * Refuses to touch anything but a local stack. See `assertLocalStack`.
 */

import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"

const DB = {
  host: "127.0.0.1",
  port: "54322",
  user: "postgres",
  database: "postgres",
  password: "postgres",
}

const STORAGE_CONTAINER = "supabase_storage_home-school-haven"

/** Canonical values that `supabase/seed.sql` is expected to leave behind. */
const EXPECTED = [
  {
    query: `select string_agg(id::text || '=' || email, ',' order by id)
      from auth.users;`,
    expected:
      "20000000-0000-4000-8000-00000000000a=sample.parent.one@example.com," +
      "20000000-0000-4000-8000-00000000000b=sample.parent.two@example.com," +
      "20000000-0000-4000-8000-00000000000c=sample.parent.three@example.com," +
      "20000000-0000-4000-8000-00000000000d=sample.parent.four@example.com," +
      "20000000-0000-4000-8000-00000000000e=sample.educator@example.com," +
      "20000000-0000-4000-8000-000000000ad0=sample.admin@example.com",
    label: "users",
  },
  {
    query: `select string_agg(id::text || '=' || state::text, ',' order by id)
      from public.enrollments;`,
    /* 0005 is the confirmed Art Lab enrollment the roster slice added, so
       MPS-ACC-028 has a target: it is the only confirmed enrollment inside a
       program the sample educator is actually assigned to. */
    expected:
      "50000000-0000-4000-8000-000000000001=payment_pending," +
      "50000000-0000-4000-8000-000000000002=confirmed," +
      "50000000-0000-4000-8000-000000000003=approval_pending," +
      "50000000-0000-4000-8000-000000000004=waitlisted," +
      "50000000-0000-4000-8000-000000000005=confirmed",
    label: "enrollments",
  },
  {
    query: `select string_agg(slug || '=' || publication_state::text, ',' order by slug)
      from public.programs;`,
    expected:
      "art-lab=published,etiquette-series=published,gardening=published," +
      "harvest-explorers=published,haven-days-enrichment=published," +
      "history-explorers=published,ready-set-prep-and-learn=published," +
      "sample-unpublished-draft=draft,sewing=published",
    label: "programs",
  },
]

const API_URL = "http://127.0.0.1:54321"

const ATTEMPTS = 3
const HEALTH_TIMEOUT_MS = 120_000
const API_TIMEOUT_MS = 60_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Run a scalar query against the local database.
 * @param {string} query - A single SQL statement returning one value.
 * @returns {string|null} The value, or null when the database is unreachable.
 */
function scalar(query) {
  const result = spawnSync(
    "psql",
    [
      "-h",
      DB.host,
      "-p",
      DB.port,
      "-U",
      DB.user,
      "-d",
      DB.database,
      "-At",
      "-c",
      query,
    ],
    { encoding: "utf8", env: { ...process.env, PGPASSWORD: DB.password } },
  )
  if (result.status !== 0) return null
  return result.stdout.trim()
}

/**
 * Refuse to run against anything but the local stack.
 *
 * `supabase db reset` drops and recreates the database. Pointed at a linked
 * project it would destroy the sanitized review environment, so this checks
 * that the local Postgres is the one answering before anything is dropped.
 * @returns {void}
 */
function assertLocalStack() {
  /* Connectivity IS the check: a hosted Supabase database is not reachable on
     127.0.0.1:54322, and `supabase db reset` without `--linked` only ever
     touches the local stack. (`show port` was the wrong probe -- it reports the
     port inside the container, 5432, not the published one.) */
  if (scalar("select 1;") !== "1") {
    console.error(
      `Refusing to reset: nothing is answering as the local Supabase stack on ` +
        `${DB.host}:${DB.port}. Run \`npm run db:start\` first. This command ` +
        `drops and recreates the database and must never be aimed at a linked ` +
        `project.`,
    )
    process.exit(1)
  }
}

/**
 * Wait for the storage container to report healthy.
 *
 * A reset started while it is restarting is the one that silently skips
 * seeding.
 * @returns {Promise<void>}
 */
async function waitForContainers() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    const status = spawnSync(
      "docker",
      ["inspect", "-f", "{{.State.Health.Status}}", STORAGE_CONTAINER],
      { encoding: "utf8" },
    )
    if ((status.stdout ?? "").trim() === "healthy") return
    await sleep(2_000)
  }
  throw new Error(
    `${STORAGE_CONTAINER} did not become healthy within ${HEALTH_TIMEOUT_MS}ms`,
  )
}

/**
 * Mark the database before reset so old fixtures cannot satisfy verification.
 * The reset must remove this table before its new fixture is accepted.
 * @param {string} marker - Unique marker for this reset attempt.
 * @returns {boolean} Whether the marker was written and read back.
 */
function markResetAttempt(marker) {
  const result = spawnSync(
    "psql",
    [
      "-h",
      DB.host,
      "-p",
      DB.port,
      "-U",
      DB.user,
      "-d",
      DB.database,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `create table if not exists public._hsh_reset_freshness (
         marker uuid primary key
       );
       truncate public._hsh_reset_freshness;
       insert into public._hsh_reset_freshness values ('${marker}'::uuid);`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: DB.password },
      stdio: "inherit",
    },
  )
  return (
    result.status === 0 &&
    scalar("select marker::text from public._hsh_reset_freshness;") === marker
  )
}

/**
 * Run the local reset without its automatic seed step.
 * @returns {ReturnType<typeof spawnSync>} The completed CLI process.
 */
function resetDatabase() {
  const result = spawnSync(
    "supabase",
    ["db", "reset", "--local", "--no-seed"],
    { encoding: "utf8" },
  )
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  return result
}

/**
 * The one known false-negative exit from the CLI that verification may overrule.
 * SQL and migration errors are never treated as storage health failures.
 * @param {ReturnType<typeof spawnSync>} result - The completed reset process.
 * @returns {boolean} Whether only the known storage health check failed.
 */
function isStorageHealthFailure(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  return (
    result.status !== 0 &&
    output.includes(
      `${STORAGE_CONTAINER}: container is not ready: unhealthy`,
    ) &&
    !/SQLSTATE|At statement:|failed to apply migration/i.test(output) &&
    !/^ERROR:/m.test(output)
  )
}

/** Apply the sanitized seed through its externally supplied local marker. */
function applySeed() {
  return spawnSync(
    "psql",
    [
      "-h",
      DB.host,
      "-p",
      DB.port,
      "-U",
      DB.user,
      "-d",
      DB.database,
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "hsh_seed_environment=local",
      "-f",
      "supabase/seed.sql",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: DB.password },
      stdio: "inherit",
    },
  ).status
}

/**
 * Whether this reset removed its freshness marker and restored exact fixtures.
 * @returns {{ok: boolean, detail: string}} The verdict and what was verified.
 */
function verifySeed() {
  const seen = [
    {
      label: "reset",
      expected: "fresh",
      query: `select case
        when to_regclass('public._hsh_reset_freshness') is null then 'fresh'
        else 'stale'
      end;`,
    },
    ...EXPECTED,
  ].map((row) => ({
    ...row,
    actual: scalar(row.query),
  }))
  const ok = seen.every((row) => row.actual === row.expected)
  const detail = seen
    .map((row) =>
      row.actual === row.expected
        ? `${row.label}=canonical`
        : `${row.label}=${row.actual === null ? "unreachable" : "mismatch"}`,
    )
    .join(" ")
  return { ok, detail }
}

/**
 * Wait until the API gateway is serving again, not just until the rows exist.
 *
 * `supabase db reset` restarts the containers, so for a few seconds afterwards
 * Postgres answers while PostgREST and Auth do not. A caller that starts
 * immediately gets a failed `user_roles` read, and `getViewer()` maps an empty
 * result to "no roles" -- so an administrator signs in and lands on /account
 * ("Your account is not set up yet") instead of /admin. That is a cold-start
 * artifact, but it fails a test suite as convincingly as a real defect.
 * @returns {Promise<void>}
 */
async function waitForApi() {
  const deadline = Date.now() + API_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const [auth, rest] = await Promise.all([
        fetch(`${API_URL}/auth/v1/health`),
        fetch(`${API_URL}/rest/v1/`, { headers: { apikey: "probe" } }),
      ])
      /* PostgREST answers 401 to an unauthenticated probe, which still proves
         it is up; anything below 500 means it is serving. */
      if (auth.ok && rest.status < 500) return
    } catch {
      /* Not listening yet. */
    }
    await sleep(1_000)
  }
  console.warn(
    `db:reset: the API did not report ready within ${API_TIMEOUT_MS}ms; ` +
      `continuing, but the first request after this may see a cold start.`,
  )
}

async function main() {
  assertLocalStack()

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    await waitForContainers()

    const marker = randomUUID()
    if (!markResetAttempt(marker)) {
      throw new Error("Could not write the reset freshness marker")
    }

    const reset = resetDatabase()
    const storageHealthFailure = isStorageHealthFailure(reset)
    if (reset.status !== 0 && !storageHealthFailure) {
      throw reset.error ?? new Error(`supabase db reset exited ${reset.status}`)
    }

    if (applySeed() !== 0) {
      throw new Error("The sanitized seed command failed")
    }

    const { ok, detail } = verifySeed()
    if (ok) {
      await waitForApi()
      console.log(`db:reset verified — ${detail}`)
      return
    }
    console.warn(
      `db:reset attempt ${attempt}/${ATTEMPTS} did not seed (${detail})`,
    )
    if (attempt < ATTEMPTS) await sleep(10_000)
  }

  console.error(
    `db:reset failed after ${ATTEMPTS} attempts: the seed did not land. The ` +
      `database is NOT in a known state — do not run tests against it.`,
  )
  process.exit(1)
}

await main()
