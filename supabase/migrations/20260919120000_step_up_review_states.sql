-- Slice 2.5 — STEP UP review outcomes (enum values only)
--
-- MPS: DEC-028 (supersedes the evaluation clause of DEC-025); GAP-015 narrowed.
-- Prompt: prompts/registration-readiness.md §5.4 (approved 2026-09-19)
--
-- A separate migration because a value added by ALTER TYPE ... ADD VALUE
-- cannot be used inside the transaction that adds it. Everything that uses
-- these values — the transition table, the guard trigger, the admin RPC —
-- is in 20260919120100_registration_readiness.sql.
--
-- None of these is payment, a discount, a confirmation, or an enrollment.
-- `verified` hands the registration to the ordinary administrative enrollment
-- review; it changes no enrollment itself.
--
-- rollback:
--   Enum values cannot be dropped in place. While no row holds a new value
--   (true everywhere at the time of writing), recreate the type:
--     alter type public.step_up_verification_state rename to step_up_verification_state_old;
--     create type public.step_up_verification_state as enum ('pending_verification');
--     alter table public.registration_step_up_requests
--       alter column verification_state drop default,
--       alter column verification_state type public.step_up_verification_state
--         using verification_state::text::public.step_up_verification_state,
--       alter column verification_state set default 'pending_verification';
--     drop type public.step_up_verification_state_old;

alter type public.step_up_verification_state add value if not exists 'needs_information';
alter type public.step_up_verification_state add value if not exists 'verified';
alter type public.step_up_verification_state add value if not exists 'declined';
alter type public.step_up_verification_state add value if not exists 'canceled';
