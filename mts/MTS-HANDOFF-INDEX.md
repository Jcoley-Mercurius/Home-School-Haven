# Home School Haven MTS v1.0 Handoff

**Status:** MTS v1.0 fully approved; repository inspection is the active next gate  
**Target:** Private, sanitized Foundation Release review

## Approved core

- Next.js App Router with TypeScript
- Vercel deployment
- Supabase Auth, Postgres, Row Level Security, and private Storage
- Resend for authentication and transactional email using the controlled domain
- Supabase as the Foundation Release system of record for programs, enrollment, roles, announcements, and learning resources
- No Sanity dependency in Foundation Release

## Package

- `MTS-PROJECT-STATE.yaml` — canonical decisions, capabilities, risks, gaps, research, and gate state.
- `TECHNOLOGY-BLUEPRINT.md` — approved architecture and boundaries.
- `CAPABILITY-MATRIX.md` — capability-to-technology mapping.
- `INTEGRATION-MANIFEST.md` — integration and environment contract awaiting repository path reconciliation.
- `SECURITY-ARCHITECTURE.md` — data, trust, authorization, secrets, privacy, and recovery controls.
- `IMPLEMENTATION-PLAN.md` — staged build and validation sequence.
- `qa/MTS-QA.md` — architecture, security, integration, operations, and synchronization checks.
- `MTS-SELECTION-RECORD.md` and `MTS-ARCHITECTURE-ADDENDUM.md` — dated provider research, approved selections, and decision rationale.

PostHog, Turnstile, R2, the staged Supabase plan, the constrained UI/testing layer, manual checkout reconciliation, and the decision to defer Sanity, Sentry, and runtime AI are approved. Repository compatibility still determines exact package versions, paths, and implementation order. Technology approval does not clear the MPS policy gates for real-family activation.
