# Home School Haven Foundation Implementation Plan

## Phase 0 — Reconcile the repository

Read `AGENTS.md`, MPS v1.0, MDS v1.0, and MTS v1.0. Inspect manifests, routes, styles, components, schemas, migrations, tests, deployment configuration, and environment-variable names. Classify existing technology and UI as KEEP, EXTEND/MODIFY, REPLACE, DEPRECATE, or UNKNOWN. Produce the plan before editing.

## Phase 1 — Establish foundations

Reconcile Next.js/TypeScript and Vercel conventions. Implement approved MDS tokens, fonts, shells, shared primitives, responsive behavior, and accessibility foundations. Establish environment validation, Supabase client/server boundaries, migrations, generated types, sanitized seeds, and CI checks.

## Phase 2 — Public discovery

Import verified website content and program-specific checkout URLs. Build public purpose, program catalog/detail, educator, contact, inquiry, tour, guidance, and private assistance paths. Preserve truthful empty, loading, failure, and submission states.

## Phase 3 — Identity and family experience

Implement parent authentication, family setup, sanitized student profiles, duplicate/recovery behavior, program eligibility checks, checkout handoff, pending enrollment/payment states, and the family dashboard.

## Phase 4 — Educator and administration

Implement assigned-program educator access, rosters with minimum approved fields, announcements/resources, and administrator program/enrollment/assignment operations with attributable history. Do not implement the future Course Builder.

## Phase 5 — Validate Samantha's walkthrough

Run MPS acceptance, MDS visual/responsive/accessibility QA, MTS architecture/security checks, and exact manual paths. Deploy a private Vercel preview with sanitized fixtures. Record Samantha's feedback as approved change, gap, defect, or future idea without silently changing scope.

## Activation gate

Do not activate real-family use until owner policy is approved, checkout truth is reconciled, RLS/access tests pass, email and DNS are verified, abuse controls are in place, backup and restore are tested, and all critical/major findings are resolved or explicitly accepted.

Every phase must include reversible migrations, rollback notes, tests actually run, external setup still required, and a completion report.
