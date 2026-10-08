/**
 * Environment contract (MTS INTEGRATION-MANIFEST "Environment-variable
 * contract").
 *
 * The behavior under test is the deliberate asymmetry in `supabaseConfig()`:
 * *absent* configuration is a supported state that must not throw, because the
 * Foundation preview has to render public pages before a Supabase project
 * exists — but *malformed* configuration must throw, because degrading a typo
 * to the offline catalog would present staged content as live data.
 *
 * Run with: npm run test:unit
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isSupabaseConfigured,
  isDemoPreview,
  releaseTarget,
  siteUrl,
  supabaseConfig,
} from "../src/lib/env.ts"

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "HSH_RELEASE_TARGET",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
]

/** Runs `body` with exactly `env` set for the keys above. */
function withEnv(env: Record<string, string>, body: () => void) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))
  for (const key of KEYS) delete process.env[key]
  Object.assign(process.env, env)
  try {
    body()
  } finally {
    for (const key of KEYS) delete process.env[key]
    for (const [key, value] of Object.entries(saved)) {
      if (value !== undefined) process.env[key] = value
    }
  }
}

const VALID_KEY = "sb_publishable_0123456789abcdefghij"

test("no configuration is a supported state, not an error", () => {
  withEnv({}, () => {
    assert.equal(supabaseConfig(), null)
    assert.equal(isSupabaseConfigured(), false)
  })
})

test("complete configuration validates", () => {
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY,
    },
    () => {
      assert.deepEqual(supabaseConfig(), {
        url: "https://example.supabase.co",
        publishableKey: VALID_KEY,
      })
      assert.equal(isSupabaseConfigured(), true)
    },
  )
})

test("a legacy anon key name is accepted", () => {
  // Supabase projects created before the publishable-key migration show an
  // "anon public" key. Copying that name must not look like a broken project.
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID_KEY,
    },
    () => {
      assert.equal(supabaseConfig()?.publishableKey, VALID_KEY)
      assert.equal(isSupabaseConfigured(), true)
    },
  )
})

test("the publishable key wins when both names are set", () => {
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_stale_key_left_behind_00000",
    },
    () => assert.equal(supabaseConfig()?.publishableKey, VALID_KEY),
  )
})

test("a placeholder value is rejected, not passed to Supabase", () => {
  // `.env.local` ships with `your_anon_key` until a real key is pasted in.
  // Failing loudly here beats an opaque 401 from the Auth server later.
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "your_anon_key",
    },
    () => assert.throws(supabaseConfig, /partially set or malformed/),
  )
})

test("half-set configuration throws instead of silently falling back", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }, () => {
    assert.throws(supabaseConfig, /partially set or malformed/)
  })
})

test("a malformed URL throws", () => {
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY,
    },
    () => {
      assert.throws(supabaseConfig, /partially set or malformed/)
    },
  )
})

test("the failure message never echoes the offending value", () => {
  // A mistyped secret pasted into the wrong variable must not reach a log.
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url-sb_secret_leaked",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY,
    },
    () => {
      try {
        supabaseConfig()
        assert.fail("expected a throw")
      } catch (error) {
        assert.ok(!(error as Error).message.includes("sb_secret_leaked"))
      }
    },
  )
})

test("release target defaults to local and recognises preview and production", () => {
  withEnv({}, () => assert.equal(releaseTarget(), "local"))
  withEnv({ HSH_RELEASE_TARGET: "preview" }, () =>
    assert.equal(releaseTarget(), "preview"),
  )
  withEnv({ VERCEL_ENV: "production" }, () =>
    assert.equal(releaseTarget(), "production"),
  )
  // An unrecognised value must not be treated as production.
  withEnv({ HSH_RELEASE_TARGET: "prod" }, () =>
    assert.equal(releaseTarget(), "local"),
  )
})

test("the Demo Preview switch needs both signals, and cannot arm in production", () => {
  // Both together, on a Vercel preview: the only case that arms it.
  withEnv({ VERCEL_ENV: "preview", HSH_RELEASE_TARGET: "demo" }, () =>
    assert.equal(isDemoPreview(), true),
  )

  // Either alone is not enough.
  withEnv({ VERCEL_ENV: "preview" }, () => assert.equal(isDemoPreview(), false))
  withEnv({ HSH_RELEASE_TARGET: "demo" }, () =>
    assert.equal(isDemoPreview(), false),
  )
  withEnv({}, () => assert.equal(isDemoPreview(), false))

  // The demo marker must never change how a production deploy renders.
  withEnv({ VERCEL_ENV: "production", HSH_RELEASE_TARGET: "demo" }, () =>
    assert.equal(isDemoPreview(), false),
  )
})

test("site URL prefers the explicit value and drops a trailing slash", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://review.example.com/" }, () =>
    assert.equal(siteUrl(), "https://review.example.com"),
  )
  withEnv({ VERCEL_URL: "preview.vercel.app" }, () =>
    assert.equal(siteUrl(), "https://preview.vercel.app"),
  )
  withEnv({}, () => assert.equal(siteUrl(), "http://127.0.0.1:3000"))
})
