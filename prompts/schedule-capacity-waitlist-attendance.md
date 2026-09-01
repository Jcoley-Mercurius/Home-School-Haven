# HSH-SLICE-ADM-04 — Schedule, Capacity, Waitlist, and Attendance Foundation

## 1. Goal and scope

Give Samantha a demonstrable, accurate program schedule and the participant
operations that sit on it, consistently across the administrator, educator,
family, and public surfaces.

In scope: program schedule sessions with real dates and times; the approved
reschedule / cancellation / completion session states; program-specific
capacity; waitlist presentation over the existing `waitlisted` enrollment
state; calendar-ready data; roster consistency; minimum-information attendance;
attributable history for all of it.

Out of scope, per the request and per absent approved policy: automated
waitlist promotion, waitlist payment, refunds/credits/transfers, automated
cancellation policy, attendance notifications, Resend workflows, Course
Builder, assignments and grading, new roster fields, real-family activation.

## 2. Authority traced

| ID | What it authorizes here |
| --- | --- |
| MPS-REQ-012 | Capacity and waitlist are evaluated before payment; a full waitlist-enabled program yields `waitlisted`, not payment. |
| MPS-REQ-014 | One authoritative enrollment state across family, roster, admin. Attendance and waitlist read it; neither forks it. |
| MPS-REQ-015 | The family dashboard shows enrollments, waitlists, schedules, and program changes. |
| MPS-REQ-016 | Administrators maintain program state with history preserved. |
| MPS-REQ-017 | Administrators manage enrollment state and accurate rosters; educators gain no organization-level control. |
| MPS-REQ-020 | Schedule, availability, and status stay consistent across public, family, educator, admin. |
| MPS-REQ-024 | Attributable history for material schedule, capacity, and enrollment-state changes. |
| MPS-RUL-001 | Per-program confirmation mode. Still unimplementable — GAP-ADMIN-006 carried, no change here. |
| MPS-RUL-002 | Capacity behavior is program-specific; waitlisting collects no payment. |
| MPS-RUL-005 | Only an administrator or the owner publishes program, availability, registration, or cancellation changes. |
| MPS-ACC-018/019/020 | Blocking states identified; approval-pending is not confirmed; full + waitlist ⇒ `waitlisted`, no payment. |
| MPS-ACC-025 | Rescheduled / canceled / waitlisted / pending / completed replaces stale guidance without erasing history. |
| MPS-ACC-026/027/028 | Lifecycle transitions attributable; educator refused publishing authority; a student appears exactly once with only approved fields. |
| MPS-ACC-031 | Public and authenticated views show consistent current information after a material change. |
| MPS-FEA-011, MPS-FEA-012 | Attendance tracking and capacity/waitlist management — approved, Should priority, REL-BETA-001. |
| MPS-WFL-005 | "Add verified details, schedule, capacity…"; alternate paths Full-with-waitlist, Full-without-waitlist, Rescheduled, Canceled. |
| MPS-WFL-006 | Educator main path "View assigned schedule and roster". |
| MPS-WFL-007 | States upcoming / active / changed / canceled / completed; notification method "Present current state in dashboard". |
| MDS `schedule_item` | variants [class, event, deadline, cancelled, rescheduled]; states [upcoming, today, completed, changed, cancelled]; sizes [compact, standard, agenda]. This is the approved session vocabulary. |
| MDS `enrollment_state` | `waitlist` = "Join waitlist; do not imply enrollment"; `limited_spaces` = "Limited availability; exact capacity only when verified". |
| MTS CAP (attendance) | "Assignment-scoped Supabase attendance records when retained in Should scope". |
| MTS CAP (capacity/waitlist) | "Supabase-backed program-specific capacity and waitlist state"; constraints "program-specific behavior", "waitlist is not enrollment". |

## 3. Repository evidence inspected

- `supabase/migrations/20260827212017_foundation_programs.sql` — `programs` holds
  only free-text `published_*` schedule facts; no session, date, capacity, or
  seat column exists anywhere.
- `supabase/migrations/20260829170000_family_dashboard_records.sql` —
  `enrollment_state` enum is the MPS-WFL-003 list verbatim and already contains
  `waitlisted`; `enrollments_one_per_student_program` guarantees roster
  uniqueness; every record table carries `check (is_sample)`.
- `supabase/migrations/20260830090000_admin_program_enrollment_operations.sql` —
  every write is a `security definer` function with `private.is_admin()`,
  a transition table, an `expected_updated_at` concurrency token, a mandatory
  note, and distinguishable SQLSTATEs. No table write grant survives.
- `supabase/migrations/20260827212020_foundation_audit_history.sql` —
  `audit_events` is append-only; `record_program_audit()` diffs a `material`
  column array.
- `src/lib/educator/roster.ts`, `src/lib/educator/workspace-state.ts`,
  `src/lib/admin/roster-state.ts` — the educator's only door to a child's name
  is the `public.educator_roster_students` security-barrier view exposing
  `program_id` and `preferred_name`. It carries **no student id**.
- `src/app/(portal)/educator/schedule/page.tsx`,
  `src/components/educator/schedule-section.tsx` — currently render published
  text and say plainly that no schedule model exists (deviation D-EW2).
- `src/app/calendar/page.tsx`, `src/content/calendar.ts` — the public calendar
  plots an entry only where the source publishes a day **and** a year, and
  records that a Supabase calendar entity does not yet exist.
- `src/lib/admin/transitions.ts` — the application-side mirror of the SQL
  transition tables, pinned by `tests/admin-transitions.test.mts`.

## 4. Decisions and their authority

### 4.1 Session state vocabulary — no invention

Stored states are only the ones a person decides:

```
scheduled → rescheduled | canceled | completed
rescheduled → rescheduled | canceled | completed
canceled → (terminal)
completed → (terminal)
```

`upcoming`, `today`, and `active` are **derived from the clock at render time**
and never stored, because they are not decisions. MDS `schedule_item.states`
supplies the presentation for all five; `changed` renders a `rescheduled`
session. This is MPS-WFL-005's alternate paths and MPS-WFL-007's states read
together; no state outside those two approved lists is introduced.

`canceled` and `completed` here are **session** states. Program-level
`canceled`/`completed` remain blocked by GAP-ADMIN-005 and this slice does not
touch `program_publication_state`.

### 4.2 Sessions do not replace published text

`published_dates` / `published_schedule` / `published_session_length` remain the
published source-of-truth for the public catalog and are untouched. A session is
administrator-authored **verified** detail (MPS-WFL-005 step 2). Where a program
has sessions they are shown in addition to the published text, never as a
correction of it, and no session is derived from published text — that would be
the invention BETA-CONTENT-IMPORT-INVENTORY rule 3 forbids. A session carries a
day and a year, which is precisely the condition `src/content/calendar.ts`
already requires before plotting anything.

### 4.3 Capacity — the capability, not the numbers

`programs.capacity integer null` and `programs.waitlist_enabled boolean not null
default false`.

- `NULL` capacity means "not established" and produces **no numeric claim
  anywhere** — the same NULL discipline every `published_*` column uses, and
  the MDS `limited_spaces` rule "exact capacity only when verified".
- This closes the *capability* half of GAP-ADMIN-004. The per-program **numbers**
  remain Samantha's under checklist §1 and stay unanswered; `supabase/seed.sql`
  sets capacity only on sanitized sample programs, flagged as demo values.
- Capacity is written by a function that touches **only `public.programs`**. It
  cannot create or remove an enrollment because it does not name the
  `enrollments` table. Lowering capacity below the confirmed count is permitted
  and returns `'updated_over_capacity'`, which the UI states plainly; nothing is
  auto-cancelled, because choosing who loses a place is a policy decision MPS
  does not define.
- `availability` stays an administrator-set state. A remaining-seat figure is
  computed for display only, only when capacity is set, and never rewrites
  `availability`.

### 4.4 Waitlist — presentation over an existing state

No new enrollment state and no change to `enrollment_transition_allowed`.
`waitlisted` and the manual `waitlisted → confirmed` decision already exist and
already carry a mandatory note and an audit row.

Added: a per-program waitlist list, ordered by `state_changed_at` — the factual
moment the record was placed on the waitlist — labelled in the UI as *the order
they were placed, not an order of promotion*. No automation, no payment, no
notification, no position column.

### 4.5 Attendance — minimum information, and one open gap

**GAP-ADMIN-010 (new): MPS approves attendance tracking (MPS-FEA-011) but
defines no attendance status vocabulary.** There is no approved meaning for
absent, excused, tardy, or late, and no approved reason or note field.

Narrowest model that records something true without inventing a vocabulary:

- `session_attendance (session_id, enrollment_id, recorded_at, recorded_by)`.
- A row means **"recorded present at this session"**. No row means **"not
  recorded"**, which the UI says in those words and never renders as "absent".
- No status column, no reason, no note, no minutes-late. Each would be a policy
  vocabulary MPS does not supply.
- Keyed on `enrollment_id`, **never `student_id`**. An educator therefore never
  receives an identifier for a child. `EDUCATOR_ROSTER_COLUMNS` is not widened,
  extended, or copied; a separate security-barrier view
  `public.educator_session_roster` exposes `(session_id, enrollment_id,
  preferred_name, attended)` for assigned programs and confirmed enrollments
  only, with its own allowlist constant bound at compile time the same way.
- Recording is permitted to an assigned educator and to an administrator
  (MPS-FEA-011 outcomes OUT-EDU-001, OUT-ADM-001; MTS "assignment-scoped").
  A record may be added and removed; both are audited.

If the owner prefers, the alternative is to defer attendance entirely and report
GAP-ADMIN-010 alone. Recorded here so the choice is explicit.

## 5. Migration

`supabase/migrations/20260902000000_schedule_capacity_waitlist_attendance.sql`

1. `create type public.session_state as enum ('scheduled','rescheduled','canceled','completed')`.
2. `create table public.program_sessions` — id, program_id (fk restrict), title,
   starts_at timestamptz not null, ends_at timestamptz not null, location text
   null, state, `rescheduled_from timestamptz null`, `change_note text null`,
   `is_sample boolean not null default true check (is_sample)`, created_at,
   updated_at; `check (ends_at > starts_at)`; `check (state <> 'rescheduled' or rescheduled_from is not null)`;
   index on `(program_id, starts_at)` and on `(starts_at)`.
3. `alter table public.programs add column capacity integer null check (capacity is null or capacity >= 0), add column waitlist_enabled boolean not null default false`.
4. `create table public.session_attendance` — session_id (fk cascade),
   enrollment_id (fk cascade), recorded_at, recorded_by (fk auth.users set
   null), primary key (session_id, enrollment_id). Trigger enforcing that the
   enrollment's `program_id` equals the session's `program_id` **and** the
   enrollment is `confirmed`, mirroring `enforce_enrollment_family_matches_student`.
5. `create view public.educator_session_roster with (security_barrier)` joining
   sessions → enrollments → students → `educator_assignments` on
   `(select auth.uid())`, filtered to `state = 'confirmed'`, selecting
   `session_id, enrollment_id, preferred_name, attended`. No student id, no
   family id, no grade.
6. RLS, deny-by-default, select-only, no client write grant on any new table:
   - `program_sessions`: admin (all); assigned educator (assigned program);
     family with an enrollment in the program (`private.family_has_enrollment_in`,
     already exists); `anon` + `authenticated` for sessions of a **published**
     program — this is what makes the public calendar honest.
   - `session_attendance`: admin; assigned educator. No family policy — MPS
     defines no family attendance visibility (recorded in §9).
7. Write functions, each `security definer`, `set search_path = ''`, with
   `expected_updated_at` where a row is updated, and the established SQLSTATE
   vocabulary (42501 / P0002 / 40001 / 23514 / 22023):
   - `admin_create_program_session(program_id, title, starts_at, ends_at, location)` → uuid
   - `admin_update_program_session(id, expected_updated_at, title, starts_at, ends_at, location, change_note)` → text
     (a `starts_at`/`ends_at` change sets `state = 'rescheduled'`, stores the
     previous start in `rescheduled_from`, and **requires** `change_note`)
   - `admin_set_session_state(id, next_state, note, expected_updated_at)` → text,
     gated by `private.session_transition_allowed`
   - `admin_set_program_capacity(id, expected_updated_at, capacity, waitlist_enabled)`
     → `'updated' | 'unchanged' | 'updated_over_capacity'`
   - `record_session_attendance(session_id, enrollment_id)` /
     `clear_session_attendance(session_id, enrollment_id)` → text, permitted to
     `private.is_admin()` **or** `private.is_assigned_educator(session.program_id)`
8. Audit: `program_sessions` and `session_attendance` triggers writing
   `audit_events` (`entity_type` `'program_session'`, `'session_attendance'`);
   `capacity` and `waitlist_enabled` appended to `record_program_audit`'s
   `material` array. Attendance audit payload carries `enrollment_id` only —
   never a name (MPS-REQ-024 vs. the child-data rule).
9. `revoke insert, update, delete` from `authenticated` on every new table, and
   nothing at all to `anon` beyond the two published-session selects.
10. Rollback block at the top of the file, in the established form.

`supabase/seed.sql` gains sanitized sessions for sample programs (a past
completed one, an upcoming one, one rescheduled, one canceled), sample capacity
and `waitlist_enabled` on two programs, one waitlisted enrollment, and one
attendance record — every row `is_sample`.

## 6. Application changes

| Area | Files | Change |
| --- | --- | --- |
| Session vocabulary | `src/lib/schedule/sessions.ts` (new) | Pure module, no `server-only`: session transition table mirroring the SQL one, `derivePresentationState(session, now)` → upcoming/today/completed/changed/cancelled, MDS variant mapping. Node-testable, as `admin/transitions.ts` is. |
| Reads | `src/lib/schedule/repository.ts` (new) | `listProgramSessions`, `listAssignedSessions`, `listFamilySessions`, `listPublishedSessions` — the same `{status: 'unavailable' \| 'failed' \| 'ready'}` shape used everywhere. |
| Capacity | `src/lib/admin/capacity.ts` (new) | `summarizeCapacity(capacity, confirmedCount, waitlistedCount)` → seats remaining, over-capacity flag, or "not established". Pure. |
| Waitlist | `src/lib/admin/roster.ts` | Extend the existing admin roster read with the waitlist list ordered by `state_changed_at`. No new enrollment query path. |
| Attendance | `src/lib/educator/attendance.ts` (new) | Reads `educator_session_roster` through an allowlist constant bound at compile time; `EDUCATOR_ROSTER_COLUMNS` untouched. |
| Admin UI | `src/app/(portal)/admin/programs/[programId]/` + `actions.ts`, `form-state.ts` | Schedule section (list, create, edit, reschedule, cancel, complete) and a capacity section. Reuses `Dialog`, `Field`, `Input`, `Button`, the existing concurrency-token + mandatory-note pattern, `list-skeleton`, empty and conflict states. |
| Admin schedule | `src/app/(portal)/admin/schedule/page.tsx` (new), `admin-portal-shell.tsx` | The MDS-named Schedule destination; agenda across all programs. Narrows deviation D-AO3. |
| Educator | `src/app/(portal)/educator/schedule/page.tsx`, `src/components/educator/schedule-section.tsx` | Dated sessions alongside the published facts; deviation D-EW2 retired where sessions exist and retained where they do not. |
| Educator attendance | `src/app/(portal)/educator/programs/[programId]/page.tsx` + new `attendance` action | Per-session present/not-recorded toggles for confirmed children, by preferred name. |
| Family | `src/app/(portal)/family/schedule/page.tsx`, `src/components/family/dashboard-cards.tsx` | Dated sessions per enrollment with `changed`/`cancelled` shown against the prior time, which is MPS-ACC-025 and MPS-WFL-007's "Present current state in dashboard". |
| Public | `src/app/calendar/page.tsx`, `src/content/calendar.ts`, `src/app/programs/[slug]/page.tsx` | Published programs' sessions merged into the month grid alongside the existing inventory entries. `CalendarEntry` is the shape already documented as what "a row will provide". |
| Components | `src/components/schedule/session-item.tsx`, `session-list.tsx` (new) | MDS `schedule_item`: variants class/event/cancelled/rescheduled, sizes compact/standard/agenda, states upcoming/today/completed/changed/cancelled. Status meaning carried in text, never colour alone. Table→card at the approved breakpoints. |

Component order honored: REUSE (`Dialog`, `Field`, `Badge`, `Alert`, `Card`,
`PublicationBadge`, `EnrollmentState`, admin list/skeleton/empty patterns) →
COMPOSE (schedule sections from those) → EXTEND (none) → CREATE (`session_item`
only, which MDS already specifies and which no file implements).

## 7. Security and privacy

- Every write is a server function behind `private.is_admin()` or
  `private.is_assigned_educator()`; no client role holds a write verb on any new
  table. A manipulated `programId`, `sessionId`, or `enrollmentId` in a URL
  reaches the same check and is refused identically to a non-existent id, so
  existence is never confirmed.
- An educator reaches a child only as `preferred_name` through a
  security-barrier view; no student id, family id, grade level, or guardian
  field exists to be read.
- Attendance audit payloads carry ids, never names.
- No payment field, no capacity-driven enrollment mutation, no waitlist ordering
  authority, no notification.
- All new rows are `is_sample`-constrained.

## 8. Checks

Formatting/lint on changed files; `npm run typecheck`; `npm run db:reset` +
`npm run db:test` with new pgTAP file
`supabase/tests/database/100_schedule_capacity_attendance.test.sql` covering
session RLS per role, published-vs-draft anon visibility, capacity write
isolation from `enrollments`, the over-capacity return, attendance
authorization and the confirmed/program-match trigger, the educator view's
column set, direct-id denial for each role, and audit rows for every material
change; `npm run test:unit` for the session transition/derivation and capacity
modules; targeted Playwright specs for the admin schedule + capacity flow, the
educator attendance flow, the family schedule state, and one authorization
denial per role; one axe + keyboard/focus smoke at desktop/tablet/mobile;
`npm run build` before merge.

Deferred to HSH-PHASE-QA-01: full Docker regression, complete Playwright role
matrix, full accessibility audit, complete visual comparison, full MPS
acceptance matrix.

## 9. Gaps to report, not resolve

| ID | Gap | Owner |
| --- | --- | --- |
| GAP-ADMIN-010 (new) | MPS-FEA-011 approves attendance but defines no attendance status vocabulary, reason field, or correction rule. Only "recorded present" / "not recorded" is implemented. | MPS |
| GAP-ADMIN-011 (new) | No approved waitlist ordering, priority, or promotion rule. Placement order is shown as a fact; promotion stays a manual administrative decision. | MPS |
| GAP-ADMIN-012 (new) | No approved rule for what happens to confirmed enrollments when capacity is lowered below the confirmed count. Nothing is changed; the condition is surfaced. | MPS |
| GAP-ADMIN-013 (new) | No approved family visibility rule for attendance. No family RLS policy on `session_attendance`. | MPS |
| GAP-ADMIN-004 (narrowed) | The capacity *capability* now exists; the per-program *numbers* remain checklist §1 and unanswered. | MPS content |
| GAP-ADMIN-005 (carried) | Program-level `canceled`/`completed` still require the family notification nothing provides. Session-level cancellation is presented in the family dashboard, which MPS-WFL-007 names as a notification method; the program-level state is not added. | MPS + MTS |
| GAP-ADMIN-006 (carried) | MPS-RUL-001 confirmation mode still has no column. MPS-ACC-019 remains unsatisfiable and is not claimed. | MPS + MTS |
| GAP-ADMIN-002/003/007/008/009 (carried) | Unchanged. | MPS |
| MDS-GAP-SCHED-001 (new) | MDS specifies `schedule_item` variants, sizes, and states but no canonical reference image for an agenda or a session list. Built from tokens and the component rules. | MDS |

## 10. Deviations

| ID | Deviation | Reason |
| --- | --- | --- |
| D-SC1 | `upcoming`/`today`/`completed` are derived from the clock rather than stored. | They are not decisions; storing them would require a job nothing approves and would go stale. |
| D-SC2 | Session states are stored for the four administrative decisions only; MDS's `today` and `active` are presentation. | MDS owns presentation; MPS owns state. |
| D-SC3 | Every session time is interpreted and displayed in `America/New_York` and labelled ET, for every viewer wherever they are. | Home School Haven operates in Cape Coral (MPS-PROJECT-STATE `geography`). Parsing or formatting in "whatever zone the runtime is in" would make the same submission mean different instants in development and production, and would produce a server/client hydration mismatch. A per-viewer zone would need an approved decision about whose clock a program's time is stated in, and MPS makes none. |
| D-SC4 | The public catalog and calendar render session dates with no Today/Upcoming characterisation. | Both are statically rendered; a clock-derived badge would be baked at build time and could describe a day that has since passed. |
| D-SC5 | Public surfaces show capacity as the existing availability STATE, not as a number. | MDS `limited_spaces` is "exact capacity only when verified", and checklist §1 leaves Home School Haven's real capacities unconfirmed. Publishing a seat count to visitors is a product decision MPS does not authorize. |
| D-EW2 (narrowed) | The educator schedule still shows published text where a program has no sessions. | Unchanged where nothing was authored. |
| D-FD1 (narrowed) | The family schedule now shows real dates where sessions exist and published text where they do not. | Same rule, more data. |

## 10a. Findings raised during implementation

| ID | Finding | Disposition |
| --- | --- | --- |
| DEFECT-SC1 | `src/components/layout/portal-shell.tsx` — the mobile "More" navigation row overflowed the viewport by 78 px once the administrator area reached four More destinations, scrolling the whole page body sideways. Found by the existing `admin-programs` responsive test. | **Fixed in this slice.** The row now scrolls inside its own container (DESIGN-SYSTEM §8), with `shrink-0` so labels and 44 px targets are not compressed instead. |
| DEFECT-SC2 | `src/lib/auth/session.ts` — `getViewer()` maps a failed `user_roles` read to an empty role list, discarding the error. A transient read failure is therefore indistinguishable from "no roles granted", and a signed-in parent or administrator is silently shown "Your account is not set up yet". Fails in the deny direction, so it is not an access hole. | **Reported, not fixed.** Pre-existing and outside this slice; changing viewer semantics is an authentication-foundation decision. Reproduced as an intermittent failure of the first cross-role sign-in in `authorization.spec.ts`, which also reproduces when an unrelated pre-existing route is added to that file's list — so it is not caused by this slice. |
| DEFECT-SC3 | Every new form initially paired `FieldLabel` with a native `<textarea>` that had no `id`, leaving the control with no accessible name. | **Fixed in this slice**, matching the note already recorded in `enrollment-drawer.tsx`. Base UI `Input` self-registers; a native `<textarea>` does not. |

## 11. Rollback

Single migration; the file's rollback block drops the two tables, the view, the
enum, the six functions, the three triggers, and the two `programs` columns in
dependency order. No existing column, policy, grant, or enum value is altered
or removed, so a rollback restores the pre-slice state exactly. Application
changes are additive and behind the presence of session rows.

## 12. Owner setup required

None. No external account, plan, credential, or production configuration
changes.
