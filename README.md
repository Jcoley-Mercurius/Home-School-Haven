This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load Lora and Manrope, the approved MDS typefaces.

## Supabase

Data, identity, and authorization live in Supabase. The app runs **without it** —
public pages fall back to the committed staging catalog in
`src/content/programs.ts` — so you can work on public surfaces with no
credentials at all.

To run the authenticated surfaces you need a database. Full setup, the schema and
authorization model, sample accounts, migration and rollback procedure:
**[`supabase/README.md`](supabase/README.md)**.

```bash
# Hosted project (current setup)
supabase link --project-ref <ref>
supabase db push                             # apply migrations
psql "$PREVIEW_DB_URL" -v ON_ERROR_STOP=1 \
  -v hsh_seed_environment=preview -f supabase/seed.sql   # sanitized fixtures
npm run db:types                             # regenerate database types

# Local stack instead (needs Docker)
npm run db:start
npm run db:reset       # migrations + sanitized seed
npm run db:test        # pgTAP authorization tests
```

The project is linked to the hosted Supabase project `Home-School-Haven`
(`uedgcwoxyhtirsihvrnf`). All five migrations are applied there, the sanitized
seed is loaded, and `npm run db:types` / `db:types:check` run against
`--linked`, not `--local`.

> `npm run db:test` (the pgTAP authorization suite) still needs a local stack,
> which needs Docker. Those assertions remain unexecuted. The equivalent
> boundary has been verified against the live project by signing in as each
> seeded role and probing the REST API directly — see the finding notes in
> `mts/INTEGRATION-MANIFEST.md`.

## Authentication

Provisioned accounts only — there is no self-service sign-up (`enable_signup =
false`, enforced at the Auth server), and students never sign in.

| Route | What it does |
|---|---|
| `/sign-in` | Password sign-in; every failure reads the same, so the form is not an account oracle |
| `/forgot-password` | Requests a recovery email; the same confirmation for a known and an unknown address |
| `/auth/confirm` | Verifies an emailed link on the server and redirects; never renders |
| `/reset-password` | Choose a new password; reachable only from a verified recovery link |
| `/link-expired` | Expired, used, or invalid link, with a route to a new one |

Recovery emails use the committed templates in `supabase/templates/`, which
build their link from the token hash pointed at `/auth/confirm` rather than the
default confirmation URL. The default returns tokens in the URL fragment, which
the server cannot read — the session could then only be established by
client-side JavaScript holding a recovery token.

Exercising the full round trip needs a mailbox, so it needs the **local** stack:

```bash
npm run db:start && npm run db:reset
# point .env.local at the local stack, then:
npm run dev
# request a reset, then read the email at http://127.0.0.1:54324 (Mailpit)
```

> Do not run the recovery round trip against the hosted project. It emails a
> real address through a sender limited to two per hour
> (`[auth.rate_limit] email_sent`). The Playwright tests that send email detect
> Mailpit and skip loudly when it is absent, for that reason.

**Delivery is not production-ready.** Resend + Supabase custom SMTP is approved
but not configured (`mts/INTEGRATION-MANIFEST.md`). Until it is, hosted email
uses Supabase's shared sender. That is an activation gate, not a code gap.

## Checks

```bash
npm run format:check   # Prettier
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run build          # production build
npm run test:unit      # node:test — env contract, program mapping, release gate
npm run build          # local/demo build (use HSH_RELEASE_TARGET=production for production)
npm run test:unit      # node:test (release gate)
npm run test:e2e       # Playwright + @axe-core/playwright
npm run db:test        # pgTAP RLS tests          (needs a running database)
npm run db:advisors    # Supabase security advisors (needs a running database)
npm run db:types:check # database type drift       (needs a running database)
```

The cross-role authorization tests in `tests/e2e/authorization.spec.ts` skip
themselves when no Supabase project is configured. A skipped test is not a
passing one — run them with a seeded local stack before trusting the boundary.

`npm run test:e2e` builds and serves the app on port 3100 itself. If a stale
`next start -p 3100` is already running it will be reused and you will test the
old build — kill it first:

```bash
pkill -f "next start -p 3100"
```

To refresh the visual baselines after an intended design change:

```bash
npx playwright test --workers=1 --update-snapshots
```

### Known follow-up: CI browser dependencies

`npx playwright install chromium` works here, but `--with-deps` needs root and
was not run. A CI image must install the Chromium system libraries itself, e.g.:

```bash
npx playwright install-deps chromium   # or apt-get the libs in the base image
npx playwright install chromium
```

## Demo placeholder imagery

The photography currently on the site is **demo-only placeholder art** so the
owner can review layout. It is not approved photography, it does not show real
students, and it is deliberately a little soft — these are layout comps, not
final print-quality images.

**Production deploys are blocked while it is present.** `scripts/check-demo-placeholders.mjs`
runs as `prebuild` and fails the build when the target is production:

```bash
npm run build                              # demo build — allowed, warns
HSH_RELEASE_TARGET=production npm run build  # blocked
```

The production target is detected from `HSH_RELEASE_TARGET=production` or
Vercel's own `VERCEL_ENV=production`, so no configuration is needed on Vercel —
preview deploys build, production deploys fail until the assets are replaced.

To ship for real: follow `public/placeholder/README.md`, update the image
records consumed as `heroImage`, `communityImage`, and each program's `image`
with the new source, metadata, and placeholder state, then delete
`public/placeholder/`. Do not bypass the gate.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# Home-School-Haven
