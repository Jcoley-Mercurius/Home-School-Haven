# Demo placeholder release gate — Foundation Demo Preview exception

## Goal and scope

The Vercel build for the Foundation Demo Preview failed at `prebuild`:
`scripts/check-demo-placeholders.mjs` blocked the deploy because three generated
placeholder images remain in `public/placeholder/`. The deployment came from
`main`, which Vercel treats as the **Production Branch**, so `VERCEL_ENV` was
`production` and the gate did exactly what it exists to do.

In scope: the gate's environment contract, its tests, and the documentation that
records the temporary exception.

Out of scope, explicitly: the placeholder images themselves, `src/content/programs.ts`,
any application code, and any weakening of the production block.

## Applicable approved state

- AGENTS.md §7 — approved MDS imagery only; generated art direction is not
  approved photography.
- `mds/specification/DESIGN-SYSTEM.md` §5, `DO-DONT.md` — imagery rules.
- Owner decision 2026-08-27 — placeholders authorized for demo review only.
- AGENTS.md §11 — safeguards are not bypassed to get a deploy out.
- `prompts/vercel-preview-deployment.md` Blocker 1 — preview, not production, is
  the correct target while placeholders exist.

## Repository evidence inspected

- `scripts/check-demo-placeholders.mjs` — production detected from
  `HSH_RELEASE_TARGET=production` **or** `VERCEL_ENV=production`; every other
  environment (including a bare local build) is allowed with a warning. There is
  no opt-in: a preview passes silently by default.
- `tests/release-gate.test.mjs` — four cases, run by `npm run test:unit`.
- `package.json` — `prebuild` runs the gate before `next build`.
- `public/placeholder/` — `README.md` plus three `program-*.jpg`.
- `src/lib/env.ts` — `releaseTarget()` reads the same two variables; not changed
  by this work.
- `README.md` §"Demo placeholder imagery" — the deployment documentation.

## Change

Replace the implicit allow-by-default with an explicit, narrow exception.

| `VERCEL_ENV` | `HSH_ALLOW_DEMO_PLACEHOLDERS` | Result |
|---|---|---|
| `production` | anything, including `true` | **fail** |
| `preview` | `true` | pass, with a loud warning |
| `preview` | unset / any other value | **fail** |
| `development` or any unexpected value | anything | **fail** |
| unset, and not running on Vercel | — | local build: pass with warning |

- `HSH_RELEASE_TARGET=production` keeps failing, so the existing local safeguard
  and `src/lib/env.ts` convention stay aligned. An unexpected
  `HSH_RELEASE_TARGET` value fails.
- The flag is compared to the exact string `true`; `TRUE`, `1`, `yes` fail.
- The production check runs first and has no escape, so the flag can never
  override it.
- An allowed preview build prints a warning naming the assets as generated art
  direction that is not approved student photography.

Local builds without `VERCEL_ENV` stay allowed: they deploy nothing, and
`npm run build` / `npm run dev` must keep working for development. "Running on
Vercel" is detected from `VERCEL_ENV` or `VERCEL` being set, so a Vercel build
can never fall into the local path.

## Files

- `scripts/check-demo-placeholders.mjs` — gate logic and messaging.
- `tests/release-gate.test.mjs` — the four required cases plus the flag-casing,
  unknown-value, and local cases.
- `public/placeholder/README.md` — record the Preview exception.
- `README.md` — deployment documentation for the exception and the flag.
- `.env.example` — name the flag with its constraints.

## Security and privacy

No secret is read, logged, or added. The flag is a build-time boolean with no
runtime effect and is never sent to the browser. The production safeguard is
strengthened, not weakened: the previous behavior allowed *any* non-production
environment silently; this requires an explicit opt-in.

## Rollback

Revert the commit. The gate returns to its previous behavior; no data, schema,
or deployment state is involved.

## Checks

- `node --test tests/release-gate.test.mjs`
- `npm run test:unit`
- `npm run lint`, `npm run typecheck`, `npm run format:check`
- `npm run build` under: `VERCEL_ENV=production` (+flag), `VERCEL_ENV=preview`
  (with and without flag), and bare local.

## External setup required by the owner

Set `HSH_ALLOW_DEMO_PLACEHOLDERS=true` on the Vercel **Preview** environment
only. Do not set it on Production. Deploy the Foundation Demo from a branch that
is not the Production Branch, or change the Production Branch, so the deployment
runs as a preview.
