import Image from "next/image"
import {
  BookOpen,
  CircleCheck,
  CircleMinus,
  ExternalLink,
  UserRound,
  UserRoundX,
} from "lucide-react"

import { SectionError } from "@/components/family/section-states"
import { Badge } from "@/components/ui/badge"
import { Card, CardGlyph, CardTitle } from "@/components/ui/card"
import type {
  AdminRead,
  ProgramOperationsRow,
  PublicationState,
} from "@/lib/admin/repository"

/**
 * Program operations (MDS-REF-009 "Programs" table; MDS `components.table`
 * variant `standard`, and `responsive.rules.grid` "Operational tables transform
 * to labeled record cards when column integrity cannot be preserved").
 *
 * WHY THERE ARE TWO RENDERINGS AND NOT ONE SCROLLING TABLE
 *
 * Four columns of operational meaning do not survive 375 px. Compressing them
 * would produce the unreadable horizontal squeeze `components.table` forbids,
 * and a horizontally scrolling table hides columns behind a gesture. So below
 * `sm` the same rows render as record cards where every field carries its own
 * visible label — no column meaning is lost, it is just re-laid out. Only one
 * of the two is in the accessibility tree at a time, so a screen-reader user is
 * not offered the same nine programs twice.
 *
 * WHAT IS MISSING FROM THE REFERENCE, AND WHY
 *
 * MDS-REF-009 draws a fifth column, NEXT ACTION, holding Review and View
 * buttons and a row chevron. Every one of those targets is a route that does
 * not exist in this release. A button that navigates nowhere implies an
 * available workflow, so the column is omitted and recorded as deviation D-AO2;
 * it returns with the program detail slice.
 *
 * WHAT THE COLUMNS DO AND DO NOT CLAIM
 *
 * "Registration path" reports whether a program-specific external checkout URL
 * is published. It is not a payment state and not an enrollment state
 * (MPS-REQ-013). "Educator" reports whether an assignment row exists, not
 * whether anyone has taught anything. No capacity, price, or availability
 * figure is inferred anywhere.
 */

/** Approved publication vocabulary, each with an icon and an explicit label. */
const PUBLICATION = {
  published: { tone: "open", label: "Published", icon: CircleCheck },
  draft: { tone: "neutral", label: "Draft", icon: CircleMinus },
  archived: { tone: "neutral", label: "Archived", icon: CircleMinus },
} as const satisfies Record<
  PublicationState,
  { tone: "open" | "neutral"; label: string; icon: typeof CircleCheck }
>

function PublicationBadge({ state }: { state: PublicationState }) {
  const { tone, label, icon: Icon } = PUBLICATION[state]
  return (
    <Badge tone={tone}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {label}
    </Badge>
  )
}

function EducatorBadge({ assigned }: { assigned: boolean }) {
  return assigned ? (
    <Badge tone="open">
      <UserRound aria-hidden="true" strokeWidth={1.75} />
      Assigned
    </Badge>
  ) : (
    <Badge tone="limited">
      <UserRoundX aria-hidden="true" strokeWidth={1.75} />
      Not assigned
    </Badge>
  )
}

function RegistrationPath({ hasCheckoutUrl }: { hasCheckoutUrl: boolean }) {
  return hasCheckoutUrl ? (
    <span className="hsh-body-sm inline-flex items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
      <ExternalLink
        aria-hidden="true"
        className="size-4 shrink-0"
        strokeWidth={1.75}
      />
      External checkout
    </span>
  ) : (
    <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
      No checkout link published
    </span>
  )
}

/**
 * The program's thumbnail, or a quiet glyph when the source publishes none.
 *
 * `programs_image_complete_check` allows imagery to be absent entirely, and
 * `image_is_placeholder` marks the demo art that approved photography will
 * replace. Neither is invented here (deviation D-AO4).
 */
function ProgramThumbnail({ program }: { program: ProgramOperationsRow }) {
  if (!program.image) {
    return (
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-quiet)] text-[var(--hsh-forest-500)]"
      >
        <BookOpen className="size-5" strokeWidth={1.75} />
      </span>
    )
  }

  return (
    <Image
      /* The program name is already the row header beside it, so repeating it
         here would announce every program twice. */
      alt=""
      src={program.image.src}
      width={program.image.width}
      height={program.image.height}
      className="size-10 shrink-0 rounded-[var(--hsh-radius-small)] object-cover"
    />
  )
}

/** Desktop and tablet: a real table with real header associations. */
function ProgramTable({ programs }: { programs: ProgramOperationsRow[] }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Every program, with its publication state, educator assignment, and
          registration path.
        </caption>
        <thead>
          <tr className="border-b border-[var(--hsh-border-strong)]">
            <th
              scope="col"
              className="hsh-caption px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] tracking-[0.06em] text-[var(--hsh-text-muted)] uppercase"
            >
              Program
            </th>
            <th
              scope="col"
              className="hsh-caption px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] tracking-[0.06em] text-[var(--hsh-text-muted)] uppercase"
            >
              Publication
            </th>
            <th
              scope="col"
              className="hsh-caption px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] tracking-[0.06em] text-[var(--hsh-text-muted)] uppercase"
            >
              Educator
            </th>
            <th
              scope="col"
              className="hsh-caption px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] tracking-[0.06em] text-[var(--hsh-text-muted)] uppercase"
            >
              Registration path
            </th>
          </tr>
        </thead>
        <tbody>
          {programs.map((program) => (
            <tr
              key={program.id}
              className="border-b border-[var(--hsh-border-default)] last:border-b-0"
            >
              <th
                scope="row"
                className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] font-normal"
              >
                <span className="flex items-center gap-[var(--hsh-space-3)]">
                  <ProgramThumbnail program={program} />
                  <span className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                    {program.name}
                  </span>
                </span>
              </th>
              <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                <PublicationBadge state={program.publicationState} />
              </td>
              <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                <EducatorBadge assigned={program.educatorAssigned} />
              </td>
              <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                <RegistrationPath hasCheckoutUrl={program.hasCheckoutUrl} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Mobile: the same rows as labeled record cards. Every field keeps its label. */
function ProgramRecordCards({
  programs,
}: {
  programs: ProgramOperationsRow[]
}) {
  return (
    <ul className="flex flex-col gap-[var(--hsh-space-3)] sm:hidden">
      {programs.map((program) => (
        <li
          key={program.id}
          className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-4)]"
        >
          <div className="flex items-center gap-[var(--hsh-space-3)]">
            <ProgramThumbnail program={program} />
            <p className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
              {program.name}
            </p>
          </div>

          <dl className="flex flex-col gap-[var(--hsh-space-3)]">
            <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-2)]">
              <dt className="hsh-caption tracking-[0.06em] text-[var(--hsh-text-muted)] uppercase">
                Publication
              </dt>
              <dd>
                <PublicationBadge state={program.publicationState} />
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-2)]">
              <dt className="hsh-caption tracking-[0.06em] text-[var(--hsh-text-muted)] uppercase">
                Educator
              </dt>
              <dd>
                <EducatorBadge assigned={program.educatorAssigned} />
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-2)]">
              <dt className="hsh-caption tracking-[0.06em] text-[var(--hsh-text-muted)] uppercase">
                Registration path
              </dt>
              <dd>
                <RegistrationPath hasCheckoutUrl={program.hasCheckoutUrl} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  )
}

/**
 * Program operations section.
 * @param state - The authorized program read.
 * @returns Program operations card.
 */
function ProgramOperations({
  state,
}: {
  state: AdminRead<ProgramOperationsRow[]>
}) {
  return (
    <Card role="region" aria-labelledby="programs-heading">
      <div className="flex items-center gap-[var(--hsh-space-3)]">
        <CardGlyph>
          <BookOpen aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </CardGlyph>
        <CardTitle id="programs-heading">Programs</CardTitle>
      </div>

      {state.status === "unavailable" ? (
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          Program records are not connected in this review environment yet.
        </p>
      ) : state.status === "failed" ? (
        <SectionError>
          We could not load programs just now. Nothing was changed — please
          refresh in a moment.
        </SectionError>
      ) : state.data.length === 0 ? (
        <div className="rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-5)]">
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            No programs exist yet. Creating one is not part of this review.
          </p>
        </div>
      ) : (
        <>
          <ProgramTable programs={state.data} />
          <ProgramRecordCards programs={state.data} />
        </>
      )}
    </Card>
  )
}

export { ProgramOperations }
