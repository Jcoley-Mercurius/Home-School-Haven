-- Foundation Release — close the `anon` EXECUTE surface on the invitation functions
--
-- MPS: MPS-REQ-011, MPS-REQ-004
-- MTS: SECURITY-ARCHITECTURE "Deny by default and apply least privilege"
--
-- WHY THIS IS A SECOND MIGRATION
--
-- `20260902170123_family_invitation_provisioning.sql` revokes these functions
-- from PUBLIC and grants EXECUTE to `authenticated`. That is correct on the
-- local stack. It is NOT sufficient on the hosted project, which carries
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON ROUTINES TO anon` — so a function
-- created there is granted to `anon` as it is created, and `revoke ... from
-- public` does not touch a grant made to `anon` by name. Verified against the
-- linked project:
--
--   has_function_privilege('anon', 'public.accept_family_invitation()',
--                          'EXECUTE')  ->  true
--
-- Neither function could actually do anything for `anon` — both derive the
-- caller from `auth.uid()`, which is NULL without a session, so acceptance
-- raises 28000 and the status read returns NULL. This closes the privilege
-- surface rather than a known escalation, which is the same reason
-- `20260828010906_foundation_least_privilege_grants.sql` exists.
--
-- It is a separate file because the provisioning migration is already applied
-- on both databases; a change to its body would never run.
--
-- SCOPE, STATED HONESTLY
--
-- This closes the two functions THIS slice created. The same hosted default
-- grants every other function in `public` to `anon` as well — 51 of 51 at the
-- time of writing. That is a pre-existing, project-wide condition that predates
-- this slice, and correcting it needs an allow-list (`public.submit_inquiry`
-- is deliberately anon-executable) plus the full authorization suite. Recorded
-- for HSH-PHASE-QA-01 rather than swept in here.
--
-- Idempotent and safe to re-run.
--
-- rollback:
--   grant execute on function public.accept_family_invitation() to anon;
--   grant execute on function public.family_invitation_status() to anon;
--   -- (Only to undo this file. Neither grant is wanted.)

revoke all on function public.accept_family_invitation() from anon;
revoke all on function public.family_invitation_status() from anon;

-- Belt and braces on the table as well. Already true on both databases; stated
-- so that a future default-privilege change cannot quietly open it.
revoke all on public.family_invitations from anon;
