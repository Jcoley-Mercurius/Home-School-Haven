# Home School Haven Integration Manifest

**Status:** Approved service contract; repository mapping pending inspection

Do not invent paths. During the first Codex pass, replace each `INSPECT` item with evidenced paths and commands.

| Area | Approved contract | Repository mapping |
|---|---|---|
| Next.js application | App Router + TypeScript | `INSPECT` |
| Styling | Consume `mds/tokens/tokens.css` or map tokens exactly into existing conventions | `INSPECT` |
| Supabase client/server utilities | Separate browser-safe and server-only clients | `INSPECT` |
| Database schema/migrations | Versioned migrations; generated TS types | `INSPECT` |
| RLS policies/tests | Deny-by-default family, assignment, and admin controls | `INSPECT` |
| Storage | Private program-scoped resources; signed access | `INSPECT` |
| Resend | Server-only transactional delivery and custom SMTP | `INSPECT` |
| External checkout | Program-specific URL handoff and explicit pending state | `INSPECT` |
| CI and E2E | Typecheck, lint, unit/integration, Playwright, accessibility, visual checks | `INSPECT` |

## Environment-variable contract

Record names only after inspecting repository conventions. Expected purposes include public Supabase URL/client key, server-only Supabase privileged credential when strictly necessary, Resend credential, canonical application URL, and environment identity. Never place private credentials in `NEXT_PUBLIC_*`, client bundles, source, logs, documentation, or test fixtures.

## Integration rules

- Validate all external and form input at the server boundary.
- Treat external checkout responses and redirects as untrusted.
- Use idempotency for enrollment, payment reconciliation, invitations, and email-triggering mutations.
- Verify any future webhook signature and handle replay, ordering, retries, and timeouts.
- Keep private data out of URLs and analytics.
- Record external DNS, Supabase, Resend, and Vercel setup as explicit human-owned steps.
