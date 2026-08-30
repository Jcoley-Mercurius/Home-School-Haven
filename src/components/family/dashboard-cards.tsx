import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleAlert,
  ExternalLink,
  Heart,
  HeartHandshake,
  Megaphone,
} from "lucide-react"

import {
  EmptyState,
  SampleNote,
  SectionError,
} from "@/components/family/section-states"
import { EnrollmentStateBadge } from "@/components/family/enrollment-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardGlyph,
  CardTitle,
} from "@/components/ui/card"
import type { NextAction } from "@/lib/family/dashboard-state"
import type { Announcement, LearningResource } from "@/lib/family/content"
import type {
  EnrollmentRecord,
  SectionState,
} from "@/lib/enrollment/repository"
import { cn } from "@/lib/utils"

/**
 * The dashboard's section cards (MDS-REF-007; MDS `patterns.dashboard`
 * "Context header, next action, enrollment summary, schedule, announcements,
 * resources").
 *
 * Each card takes a `SectionState` rather than an array, so "we could not look"
 * renders differently from "there is nothing here" in every one of them. That
 * is not defensive coding; it is MPS-REQ-021's observable state and recovery
 * action, per section, so one failed query degrades one card instead of the
 * page.
 */

/** Shared card heading: quiet glyph, Lora title, optional sample marker. */
function SectionHeading({
  icon: Icon,
  title,
  id,
}: {
  icon: typeof BookOpen
  title: string
  id: string
}) {
  return (
    <div className="flex items-center gap-[var(--hsh-space-3)]">
      <CardGlyph>
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </CardGlyph>
      <CardTitle id={id}>{title}</CardTitle>
    </div>
  )
}

/**
 * The one next step (MDS-REF-007 "Your next step").
 * @param action - The derived action, or `null` when nothing needs attention.
 * @returns Next action card.
 */
function NextActionCard({ action }: { action: NextAction | null }) {
  if (!action) {
    return (
      <Card
        role="region"
        aria-labelledby="next-action-heading"
        className="bg-[var(--hsh-surface-quiet)]"
      >
        <CardTitle id="next-action-heading">Your next step</CardTitle>
        <CardContent>
          <p className="hsh-body text-[var(--hsh-text-secondary)]">
            Nothing needs your attention right now.
          </p>
        </CardContent>
      </Card>
    )
  }

  const attention = action.tone === "attention"

  return (
    <Card
      role="region"
      aria-labelledby="next-action-heading"
      className={cn(
        attention
          ? "border-[var(--hsh-gold-500)] bg-[var(--hsh-gold-100)]"
          : "bg-[var(--hsh-surface-quiet)]",
      )}
    >
      <div className="flex items-center gap-[var(--hsh-space-3)]">
        <CardGlyph
          className={
            attention
              ? "bg-[var(--hsh-gold-700)] text-[var(--hsh-text-inverse)]"
              : undefined
          }
        >
          <CircleAlert
            aria-hidden="true"
            className="size-5"
            strokeWidth={1.75}
          />
        </CardGlyph>
        <CardTitle id="next-action-heading">Your next step</CardTitle>
      </div>

      <CardContent>
        {/* The state is named in text as well as by the warm surface, so it
            does not depend on colour (DESIGN-SYSTEM.md §10). */}
        <p className="hsh-h4 text-[var(--hsh-text-primary)]">{action.title}</p>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          {action.body}
        </p>
      </CardContent>

      <CardFooter>
        <Button
          variant="primary"
          size="md"
          render={<Link href={action.href} />}
        >
          {action.linkLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * Enrollment summary (MPS-REQ-015, MPS-ACC-024, MPS-ACC-025).
 * @param state - The section read.
 * @param heading - Visible card heading.
 * @param viewAllHref - Where the full list lives, when this is the summary.
 * @returns Enrollments card.
 */
function EnrollmentsCard({
  state,
  heading = "Enrollments",
  viewAllHref,
}: {
  state: SectionState<EnrollmentRecord>
  heading?: string
  viewAllHref?: string
}) {
  return (
    <Card role="region" aria-labelledby="enrollments-heading">
      <SectionHeading
        icon={BookOpen}
        title={heading}
        id="enrollments-heading"
      />

      <CardContent>
        {state.status === "unavailable" || state.status === "failed" ? (
          <SectionError>
            {state.status === "unavailable"
              ? "Enrollment records are not connected in this review environment yet."
              : "We could not load your enrollments just now. Nothing was lost — please refresh in a moment."}
          </SectionError>
        ) : state.items.length === 0 ? (
          <EmptyState title="No registrations yet">
            <p>
              When your family registers for a program, it will appear here with
              its current state.
            </p>
            <Button
              variant="secondary"
              size="md"
              render={<Link href="/programs" />}
            >
              Browse Programs
            </Button>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-[var(--hsh-space-3)]">
            {state.items.map((enrollment) => (
              <li
                key={enrollment.id}
                className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-[var(--hsh-space-2)]">
                  <p className="hsh-h4 text-[var(--hsh-text-primary)]">
                    {enrollment.program ? (
                      <Link
                        href={`/programs/${enrollment.program.slug}`}
                        className="text-[var(--hsh-text-link)] underline-offset-4 hover:underline"
                      >
                        {enrollment.program.name}
                      </Link>
                    ) : (
                      "Program details are not available"
                    )}
                  </p>
                  <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                    {enrollment.studentName}
                  </p>
                </div>
                {/* The sentence is always shown, never only the badge. The
                    pending states are the ones most easily misread as success,
                    and a badge alone invites exactly that (DO-DONT). */}
                <EnrollmentStateBadge state={enrollment.state} withSentence />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {viewAllHref && state.status === "ready" && state.items.length > 0 ? (
        <CardFooter>
          <Link
            href={viewAllHref}
            className="hsh-label inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-link)] underline-offset-4 hover:underline"
          >
            View all enrollments
            <ArrowRight
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  )
}

/**
 * Upcoming schedule (MPS-REQ-015, MPS-REQ-020).
 *
 * DEVIATION D-FD1 — no dated sessions.
 *
 * MDS-REF-007 draws "Today's Schedule — Sample Class · 10:00 AM". The
 * authoritative `programs` rows publish free-text schedules like "Tuesdays and
 * Thursdays" and no dated sessions, because the source publishes none. Import
 * rule 3 and DO-DONT forbid inventing a date, a time, or a location, and written
 * MDS state outranks generated imagery. So this card shows the published text
 * verbatim, "Contact for details" where the source publishes nothing, and one
 * sentence saying dated sessions have not been published.
 *
 * @param state - The section read.
 * @param heading - Visible card heading.
 * @param viewAllHref - Where the full list lives.
 * @returns Schedule card.
 */
function ScheduleCard({
  state,
  heading = "Schedule",
  viewAllHref,
}: {
  state: SectionState<EnrollmentRecord>
  heading?: string
  viewAllHref?: string
}) {
  const active =
    state.status === "ready"
      ? state.items.filter((enrollment) => enrollment.state !== "canceled")
      : []

  return (
    <Card role="region" aria-labelledby="schedule-heading">
      <SectionHeading
        icon={CalendarDays}
        title={heading}
        id="schedule-heading"
      />

      <CardContent>
        {state.status === "unavailable" || state.status === "failed" ? (
          <SectionError>
            {state.status === "unavailable"
              ? "Schedule information is not connected in this review environment yet."
              : "We could not load your schedule just now. Nothing was lost — please refresh in a moment."}
          </SectionError>
        ) : active.length === 0 ? (
          <EmptyState title="Nothing scheduled">
            <p>
              Once a registration is in place, the program&rsquo;s published
              schedule will appear here.
            </p>
          </EmptyState>
        ) : (
          <>
            <ul className="flex flex-col gap-[var(--hsh-space-3)]">
              {active.map((enrollment) => (
                <li
                  key={enrollment.id}
                  className="flex flex-col gap-[var(--hsh-space-1)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
                >
                  <p className="hsh-h4 text-[var(--hsh-text-primary)]">
                    {enrollment.program?.name ??
                      "Program details are not available"}
                  </p>
                  <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                    {enrollment.program?.publishedSchedule ??
                      "Contact for details"}
                  </p>
                  <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
                    {enrollment.studentName}
                  </p>
                </li>
              ))}
            </ul>
            <SampleNote>
              Home School Haven has not published dated sessions for these
              programs, so no times or locations are shown. Contact them for
              details.
            </SampleNote>
          </>
        )}
      </CardContent>

      {viewAllHref && active.length > 0 ? (
        <CardFooter>
          <Link
            href={viewAllHref}
            className="hsh-label inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-link)] underline-offset-4 hover:underline"
          >
            View full schedule
            <ArrowRight
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  )
}

/**
 * Announcements scoped to the family's own programs (MPS-ACC-030).
 * @param state - The section read.
 * @param heading - Visible card heading.
 * @param viewAllHref - Where the full list lives.
 * @returns Announcements card.
 */
function AnnouncementsCard({
  state,
  heading = "Announcements",
  viewAllHref,
}: {
  state: SectionState<Announcement>
  heading?: string
  viewAllHref?: string
}) {
  return (
    <Card role="region" aria-labelledby="announcements-heading">
      <SectionHeading
        icon={Megaphone}
        title={heading}
        id="announcements-heading"
      />

      <CardContent>
        {state.status === "unavailable" || state.status === "failed" ? (
          <SectionError>
            {state.status === "unavailable"
              ? "Announcements are not connected in this review environment yet."
              : "We could not load announcements just now. Nothing was lost — please refresh in a moment."}
          </SectionError>
        ) : state.items.length === 0 ? (
          <EmptyState title="No announcements">
            <p>
              Announcements from your family&rsquo;s programs will appear here.
            </p>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-[var(--hsh-space-3)]">
            {state.items.map((announcement) => (
              <li
                key={announcement.id}
                className="flex flex-col gap-[var(--hsh-space-1)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
              >
                <p className="hsh-h4 text-[var(--hsh-text-primary)]">
                  {announcement.title}
                </p>
                {announcement.programName ? (
                  <p className="hsh-caption text-[var(--hsh-text-muted)]">
                    {announcement.programName}
                  </p>
                ) : null}
                <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                  {announcement.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {viewAllHref && state.status === "ready" && state.items.length > 0 ? (
        <CardFooter>
          <Link
            href={viewAllHref}
            className="hsh-label inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-link)] underline-offset-4 hover:underline"
          >
            View all announcements
            <ArrowRight
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  )
}

/**
 * Published learning resources for the family's programs.
 *
 * Links only. Private Storage with scoped signed access is approved but is a
 * slice of its own, so nothing here reads a stored file. Every link is
 * `rel="noopener noreferrer"` and says it opens elsewhere, because a resource
 * leaving the platform should say so as plainly as checkout does.
 *
 * @param state - The section read.
 * @param heading - Visible card heading.
 * @param viewAllHref - Where the full list lives.
 * @returns Resources card.
 */
function ResourcesCard({
  state,
  heading = "Learning Resources",
  viewAllHref,
}: {
  state: SectionState<LearningResource>
  heading?: string
  viewAllHref?: string
}) {
  return (
    <Card role="region" aria-labelledby="resources-heading">
      <SectionHeading icon={Heart} title={heading} id="resources-heading" />

      <CardContent>
        {state.status === "unavailable" || state.status === "failed" ? (
          <SectionError>
            {state.status === "unavailable"
              ? "Learning resources are not connected in this review environment yet."
              : "We could not load learning resources just now. Nothing was lost — please refresh in a moment."}
          </SectionError>
        ) : state.items.length === 0 ? (
          <EmptyState title="No resources yet">
            <p>
              Learning resources published for your family&rsquo;s programs will
              appear here.
            </p>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-[var(--hsh-space-3)]">
            {state.items.map((resource) => (
              <li
                key={resource.id}
                className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
              >
                <p className="hsh-h4 text-[var(--hsh-text-primary)]">
                  {resource.title}
                </p>
                {resource.description ? (
                  <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                    {resource.description}
                  </p>
                ) : null}
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hsh-label inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-link)] underline-offset-4 hover:underline"
                >
                  View resource
                  <ExternalLink
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.75}
                  />
                  <span className="sr-only">
                    {" "}
                    — {resource.title}, opens in a new tab
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {viewAllHref && state.status === "ready" && state.items.length > 0 ? (
        <CardFooter>
          <Link
            href={viewAllHref}
            className="hsh-label inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-link)] underline-offset-4 hover:underline"
          >
            Browse all resources
            <ArrowRight
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  )
}

/**
 * The assistance pathway MDS-REF-007 places at the foot of the dashboard
 * (MDS `components.assistance_request`, MPS-REQ-009/010, MPS-WFL-004).
 *
 * Dignified, private, and promising nothing. It routes to the existing contact
 * path rather than introducing a second request form, and it makes no claim
 * about eligibility, cost, or outcome — those are manual decisions under
 * Samantha's authority (MPS-RUL-004), and this card must not look like the
 * start of an automated one.
 *
 * @returns Assistance card.
 */
function AssistanceCard() {
  return (
    <Card role="region" aria-labelledby="assistance-heading">
      <SectionHeading
        icon={HeartHandshake}
        title="Need help?"
        id="assistance-heading"
      />
      <CardContent>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          We&rsquo;re here for you. Reach out privately and Home School Haven
          will respond with care.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="secondary" size="md" render={<Link href="/contact" />}>
          Request Assistance
        </Button>
      </CardFooter>
    </Card>
  )
}

export {
  AssistanceCard,
  NextActionCard,
  EnrollmentsCard,
  ScheduleCard,
  AnnouncementsCard,
  ResourcesCard,
}
