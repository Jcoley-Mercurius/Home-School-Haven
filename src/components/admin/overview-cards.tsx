import Link from "next/link"
import {
  BookOpen,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  Plus,
  Users,
  UserRound,
  ClipboardList,
} from "lucide-react"

import { SampleNote, SectionError } from "@/components/family/section-states"
import { ENROLLMENT_STATE } from "@/components/enrollment/enrollment-state"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardGlyph, CardTitle } from "@/components/ui/card"
import type { AttentionItem, AttentionResult } from "@/lib/admin/attention"
import type {
  AdminRead,
  EducatorSummary,
  EnrollmentSummary,
  FamilySummary,
  ProgramSummary,
} from "@/lib/admin/repository"
import type { EnrollmentState } from "@/lib/enrollment/repository"
import { cn } from "@/lib/utils"

/**
 * The operations overview's summary tiles, attention panel, and owner-authority
 * band (MDS-REF-009; MDS `custom.admin_operations` "Attention overview, program
 * operations, quick actions, payment/consent/content states, recent activity,
 * owner-authority reminder").
 *
 * `SectionError`, `EmptyState`, and `SampleNote` are imported from the family
 * area rather than reimplemented. Their own header says they exist "in one
 * place so they read the same everywhere", and an administrator and a parent
 * being told the same thing in the same words about the same failed read is the
 * point of that. They sit under `components/family/` for historical reasons
 * only; moving them would be churn unrelated to this slice.
 *
 * Every number below is a count of rows the administrator was authorized to
 * read. Nothing is estimated, padded, or seeded to make the page look busy
 * (DO-DONT: do not simulate data).
 */

/* --------------------------------------------------------------------------
   Summary tiles
   -------------------------------------------------------------------------- */

/** One labelled figure inside a summary tile. */
function Figure({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between gap-[var(--hsh-space-3)]">
      <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
        {label}
      </span>
      <span className="hsh-h4 text-[var(--hsh-text-primary)]">{value}</span>
    </div>
  )
}

/**
 * The shell every summary tile shares, so one failed read degrades one tile.
 * @param icon - The tile's quiet glyph.
 * @param title - Visible heading.
 * @param id - Heading id, referenced by the region's `aria-labelledby`.
 * @param state - The read this tile depends on.
 * @param children - Rendered only when the read succeeded.
 * @param footnote - Optional sample-data note.
 * @returns Summary tile.
 */
function SummaryTile<T>({
  icon: Icon,
  title,
  id,
  state,
  children,
  footnote,
}: {
  icon: typeof BookOpen
  title: string
  id: string
  state: AdminRead<T>
  children: (data: T) => React.ReactNode
  footnote?: string
}) {
  return (
    <Card role="region" aria-labelledby={id}>
      <div className="flex items-center gap-[var(--hsh-space-3)]">
        <CardGlyph>
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </CardGlyph>
        <CardTitle id={id}>{title}</CardTitle>
      </div>
      <CardContent>
        {state.status === "ready" ? (
          <>
            {children(state.data)}
            {footnote ? <SampleNote>{footnote}</SampleNote> : null}
          </>
        ) : state.status === "unavailable" ? (
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Operational records are not connected in this review environment
            yet.
          </p>
        ) : (
          <SectionError>
            We could not load this summary just now. Nothing was changed —
            please refresh in a moment.
          </SectionError>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * The four operational summaries: programs, enrollments, families, educators.
 *
 * These replace MDS-REF-009's top row of four navigation cards. The reference's
 * cards each carry a "View Programs →" style link into a destination that does
 * not exist yet (deviation D-AO1/D-AO3), so the composition is preserved and
 * the dead links are not.
 *
 * @param programs - Program publication counts.
 * @param enrollments - Enrollment counts by authoritative state.
 * @param families - Family and student-profile counts.
 * @param educators - Educator account and assignment counts.
 * @returns The summary tile row.
 */
function SummaryTiles({
  programs,
  enrollments,
  families,
  educators,
}: {
  programs: AdminRead<ProgramSummary>
  enrollments: AdminRead<EnrollmentSummary>
  families: AdminRead<FamilySummary>
  educators: AdminRead<EducatorSummary>
}) {
  return (
    <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:grid-cols-2 sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-4 lg:gap-[var(--hsh-grid-gap-desktop)]">
      <SummaryTile
        icon={BookOpen}
        title="Programs"
        id="summary-programs-heading"
        state={programs}
      >
        {(data) => (
          <>
            <Figure label="All programs" value={data.total} />
            <Figure label="Published" value={data.published} />
            <Figure label="Draft" value={data.draft} />
            <Figure label="Archived" value={data.archived} />
          </>
        )}
      </SummaryTile>

      <SummaryTile
        icon={ClipboardList}
        title="Enrollments"
        id="summary-enrollments-heading"
        state={enrollments}
        footnote="Every enrollment record in this review is a sanitized sample. None of them is evidence that anyone has paid."
      >
        {(data) => (
          <>
            <Figure label="All records" value={data.total} />
            {/* Only states that actually occur, labelled with exactly the words
                the family sees for the same state (MPS-ACC-022). A state at
                zero is not news and would pad the tile. */}
            {(Object.keys(data.byState) as EnrollmentState[])
              .filter((state) => data.byState[state] > 0)
              .map((state) => (
                <Figure
                  key={state}
                  label={ENROLLMENT_STATE[state].label}
                  value={data.byState[state]}
                />
              ))}
          </>
        )}
      </SummaryTile>

      <SummaryTile
        icon={Users}
        title="Families"
        id="summary-families-heading"
        state={families}
        footnote="Sanitized sample families and student profiles. No real child or family record exists in this environment."
      >
        {(data) => (
          <>
            <Figure label="Family accounts" value={data.families} />
            <Figure label="Student profiles" value={data.students} />
          </>
        )}
      </SummaryTile>

      <SummaryTile
        icon={UserRound}
        title="Educators"
        id="summary-educators-heading"
        state={educators}
      >
        {(data) => (
          <>
            <Figure label="Educator accounts" value={data.educatorAccounts} />
            <Figure label="Program assignments" value={data.assignments} />
            <Figure
              label="Published, no educator"
              value={data.publishedWithoutEducator}
            />
          </>
        )}
      </SummaryTile>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Attention
   -------------------------------------------------------------------------- */

/**
 * Approved semantic treatment per tone (MDS-REF-009 "approved warning, blocked,
 * and information semantics").
 *
 * Each entry carries an icon and a badge tone, and every rendered item also
 * carries its explicit text label — so the tone is reinforcement, never the
 * only carrier of meaning (DO-DONT "Pair every meaningful status color with an
 * icon and explicit label").
 */
const ATTENTION_TONE = {
  warning: {
    icon: CircleAlert,
    badge: "pending",
    iconColor: "text-[var(--hsh-warning)]",
  },
  blocked: {
    icon: CircleX,
    badge: "waitlist",
    iconColor: "text-[var(--hsh-coral-700)]",
  },
  information: {
    icon: Info,
    badge: "info",
    iconColor: "text-[var(--hsh-info)]",
  },
} as const satisfies Record<
  AttentionItem["tone"],
  {
    icon: typeof CircleAlert
    badge: "pending" | "waitlist" | "info"
    iconColor: string
  }
>

/**
 * One attention row: icon, explicit label, plain sentence, and a count.
 *
 * There is no action here, deliberately. These are workflow states, and this
 * release confirms no payment, approves no consent, and changes no record from
 * a dashboard card.
 *
 * @param item - The derived item.
 * @returns Attention row.
 */
function AttentionRow({ item }: { item: AttentionItem }) {
  const { icon: Icon, badge, iconColor } = ATTENTION_TONE[item.tone]

  return (
    <li className="flex items-start gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-4)]">
      <Icon
        aria-hidden="true"
        className={cn("mt-[2px] size-5 shrink-0", iconColor)}
        strokeWidth={1.75}
      />
      {/* The badge sits beside the text from `sm` up and below it on mobile.
          Keeping it alongside at 390 px squeezed the sentence to one or two
          words per line — and the sentence being squeezed was the consent one,
          which is exactly the language DO-DONT forbids compressing. */}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--hsh-space-2)] sm:flex-row sm:items-start sm:justify-between sm:gap-[var(--hsh-space-4)]">
        <div className="flex min-w-0 flex-col gap-[var(--hsh-space-1)]">
          <p className="hsh-label text-[var(--hsh-text-primary)]">
            {item.label}
          </p>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {item.detail}
          </p>
        </div>
        {/* The unit travels with the number, so the figure never has to be
            interpreted from its position in the row. */}
        <Badge tone={badge} className="shrink-0 self-start whitespace-nowrap">
          {item.count} {item.unit}
        </Badge>
      </div>
    </li>
  )
}

/**
 * Items requiring attention (MDS-REF-009 "Attention").
 * @param state - The derived attention result.
 * @returns Attention panel.
 */
function AttentionPanel({ state }: { state: AdminRead<AttentionResult> }) {
  return (
    <Card role="region" aria-labelledby="attention-heading">
      <div className="flex items-center gap-[var(--hsh-space-3)]">
        <CardGlyph>
          <CircleAlert
            aria-hidden="true"
            className="size-5"
            strokeWidth={1.75}
          />
        </CardGlyph>
        <CardTitle id="attention-heading">Needs attention</CardTitle>
      </div>

      <CardContent>
        {state.status === "unavailable" ? (
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Operational records are not connected in this review environment
            yet.
          </p>
        ) : state.status === "failed" ? (
          <SectionError>
            We could not run these checks just now. Nothing was changed — please
            refresh in a moment.
          </SectionError>
        ) : (
          <>
            {/* Partial and empty must not look alike: one says we finished
                looking, the other says we did not. */}
            {state.data.incomplete ? (
              <SectionError>
                Some checks could not run, so this list is incomplete. Please
                refresh in a moment.
              </SectionError>
            ) : null}

            {state.data.items.length > 0 ? (
              <ul className="flex flex-col gap-[var(--hsh-space-3)]">
                {state.data.items.map((item) => (
                  <AttentionRow key={item.category} item={item} />
                ))}
              </ul>
            ) : state.data.incomplete ? null : (
              <div className="flex items-start gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-5)]">
                <CircleCheck
                  aria-hidden="true"
                  className="mt-[2px] size-5 shrink-0 text-[var(--hsh-success)]"
                  strokeWidth={1.75}
                />
                <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                  Nothing needs attention right now. Every check ran and found
                  no pending payment verification, blocked enrollment, missing
                  educator assignment, or program awaiting content review.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   Quick actions
   -------------------------------------------------------------------------- */

/**
 * Quick Actions (MDS-REF-009 "Quick Actions" panel).
 *
 * The reference draws four: New Program Draft, Import Website Content, Review
 * Enrollments, and Manage Educators. The administrator-operations-foundation
 * slice omitted the whole panel as deviation D-AO1, because every target was a
 * route that did not exist and a control that leads nowhere implies an
 * available workflow.
 *
 * Two of the four now exist, so the panel returns with exactly those two.
 * Import Website Content and Manage Educators stay out until their slices build
 * them — D-AO1 is narrowed, not resolved.
 *
 * These are links, not actions. Nothing on the overview changes a record.
 *
 * @returns Quick actions panel.
 */
function QuickActions() {
  const actions = [
    {
      href: "/admin/programs/new",
      icon: Plus,
      label: "New program draft",
      description: "Start a program. It stays invisible until you publish it.",
    },
    {
      href: "/admin/enrollments",
      icon: Users,
      label: "Review enrollments",
      description: "Every enrollment and its current authoritative state.",
    },
  ]

  return (
    <section
      aria-labelledby="quick-actions-heading"
      className="flex h-fit flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] shadow-[var(--hsh-shadow-card)]"
    >
      <h2
        id="quick-actions-heading"
        className="hsh-h4 text-[var(--hsh-text-primary)]"
      >
        Quick Actions
      </h2>
      <ul className="flex list-none flex-col gap-[var(--hsh-space-2)] p-0">
        {actions.map((action) => (
          <li key={action.href}>
            <Link
              href={action.href}
              className="flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] px-[var(--hsh-space-4)] py-[var(--hsh-space-3)] transition-colors outline-none hover:bg-[var(--hsh-forest-50)] focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-solid"
            >
              <action.icon
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--hsh-forest-600)]"
                strokeWidth={1.75}
              />
              <span className="flex min-w-0 flex-col">
                <span className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                  {action.label}
                </span>
                <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                  {action.description}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="ml-auto size-5 shrink-0 text-[var(--hsh-text-muted)]"
                strokeWidth={1.75}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Owner authority
   -------------------------------------------------------------------------- */

/**
 * The owner-authority framing (MDS-REF-009 approved rule; MPS-RUL-005,
 * ACT-004, ACT-006).
 *
 * It states in words what this release cannot yet enforce in code: an
 * administrator is a delegated operational actor, Samantha Dodson holds final
 * authority, and external checkout is not payment confirmation. The delegated /
 * owner distinction is not modelled as a permission difference anywhere,
 * because no approved requirement defines one (MPS-GAP-ADMIN-002), so saying it
 * plainly is the most the approved state supports.
 *
 * @returns Owner authority band.
 */
function OwnerAuthorityBand() {
  return (
    <aside
      aria-label="Authority and environment"
      className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)] sm:flex-row sm:items-start sm:gap-[var(--hsh-space-6)]"
    >
      <Info
        aria-hidden="true"
        className="mt-[3px] size-5 shrink-0 text-[var(--hsh-info)]"
        strokeWidth={1.75}
      />
      <p className="hsh-body-sm text-[var(--hsh-text-secondary)] sm:flex-1">
        This is a private beta environment with sample data. Continuing to
        external checkout is a handoff to Home School Haven&rsquo;s payment
        provider — it is not payment confirmation, and payment activity is not
        confirmed enrollment.
      </p>
      <p className="hsh-body-sm text-[var(--hsh-text-secondary)] sm:flex-1 sm:border-l sm:border-[var(--hsh-border-default)] sm:pl-[var(--hsh-space-6)]">
        Samantha Dodson remains the final decision owner. Administrators hold
        delegated operational authority, and only an administrator or Samantha
        publishes program, price, availability, registration, or cancellation
        changes.
      </p>
    </aside>
  )
}

export { AttentionPanel, OwnerAuthorityBand, QuickActions, SummaryTiles }
