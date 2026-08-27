import { Leaf, Sparkles, Sprout, Users } from "lucide-react"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { ProgramCard } from "@/components/program/program-card"
import { Button } from "@/components/ui/button"
import {
  featuredPrograms,
  positioning,
  values,
} from "@/content/foundation-content"

/**
 * Foundation Release public home page (MPS-REQ-007, MPS-REQ-009, MPS-ACC-007).
 * Composition follows MDS-REF-006; navigation behavior follows MDS-REF-005 §4.
 *
 * Content comes only from `mps/BETA-CONTENT-IMPORT-INVENTORY.md`. The page shows
 * no availability, capacity, or enrollment state, and carries no register, pay,
 * or checkout action — checkout is an external handoff handled elsewhere.
 *
 * Hero imagery: approved photography is not yet available, so the hero is
 * editorial rather than photographic (owner decision, 2026-08-27). Generated
 * people must never be presented as real students (DESIGN-SYSTEM.md §5).
 */

const valueMarks = [
  { icon: Sparkles, surface: "var(--hsh-coral-100)", ink: "var(--hsh-coral-700)" },
  { icon: Sprout, surface: "var(--hsh-forest-50)", ink: "var(--hsh-forest-600)" },
  { icon: Users, surface: "var(--hsh-gold-100)", ink: "var(--hsh-gold-700)" },
  { icon: Leaf, surface: "var(--hsh-forest-100)", ink: "var(--hsh-forest-600)" },
] as const

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-[var(--hsh-space-4)] focus:left-[var(--hsh-space-4)] focus:z-100 focus:rounded-[var(--hsh-radius-control)] focus:bg-[var(--hsh-surface-card)] focus:px-[var(--hsh-space-4)] focus:py-[var(--hsh-space-3)] focus:shadow-[var(--hsh-shadow-card)]"
      >
        Skip to main content
      </a>

      <SiteHeader />

      <main id="main" className="flex-1">
        {/* Editorial hero */}
        <section className="relative overflow-hidden bg-[var(--hsh-surface-page)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 size-[420px] rounded-full bg-[var(--hsh-surface-quiet)] opacity-70 blur-3xl"
          />
          <div className="hsh-container hsh-container-public relative grid gap-[var(--hsh-space-12)] py-[var(--hsh-space-12)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:py-[var(--hsh-space-20)]">
            <div className="flex flex-col gap-[var(--hsh-space-6)]">
              <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
                {positioning.eyebrow}
              </p>
              <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
                A place to learn, create, and belong.
              </h1>
              <p className="hsh-body-lg max-w-[52ch] text-[var(--hsh-text-secondary)]">
                {positioning.summary}
              </p>
              <p className="hsh-body max-w-[52ch] text-[var(--hsh-text-secondary)]">
                {positioning.learningCharacter}
              </p>
              <div className="flex flex-wrap gap-[var(--hsh-space-4)]">
                <Button variant="primary" size="lg" disabled>
                  Explore Programs
                  <span className="sr-only">— coming soon</span>
                </Button>
                <Button variant="secondary" size="lg" disabled>
                  Request Guidance
                  <span className="sr-only">— coming soon</span>
                </Button>
              </div>
            </div>

            {/* Reserved for approved photography. Samantha supplies released
                images before public launch; no generated people are used. */}
            <div className="relative flex min-h-[280px] items-end justify-center overflow-hidden rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-8)] lg:min-h-[420px]">
              <Leaf
                aria-hidden="true"
                className="absolute top-[12%] left-[14%] size-24 text-[var(--hsh-forest-500)] opacity-30"
                strokeWidth={1.75}
              />
              <Sprout
                aria-hidden="true"
                className="absolute right-[16%] bottom-[22%] size-32 text-[var(--hsh-forest-500)] opacity-25"
                strokeWidth={1.75}
              />
              <p className="hsh-caption relative text-center text-[var(--hsh-text-muted)]">
                Approved photography pending
              </p>
            </div>
          </div>
        </section>

        {/* Value band */}
        <section
          aria-labelledby="values-heading"
          className="hsh-container hsh-container-public"
        >
          <h2 id="values-heading" className="sr-only">
            What we value
          </h2>
          <ul className="grid gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-6)] sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => {
              const { icon: Icon, surface, ink } = valueMarks[index]
              return (
                <li
                  key={value}
                  className="hsh-body flex items-center gap-[var(--hsh-space-3)] text-[var(--hsh-text-primary)]"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: surface, color: ink }}
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  {value}
                </li>
              )
            })}
          </ul>
        </section>

        {/* Featured programs */}
        <section
          aria-labelledby="programs-heading"
          className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-8)] pt-[var(--hsh-space-16)]"
        >
          <div className="flex flex-col gap-[var(--hsh-space-3)] text-center">
            <h2
              id="programs-heading"
              className="hsh-h2 text-[var(--hsh-text-primary)]"
            >
              Find the right experience for your child
            </h2>
            <p className="hsh-body mx-auto max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              Published program details are shown as they appear today. Anything
              not published here is confirmed directly with Home School Haven.
            </p>
          </div>

          <ul className="grid gap-[var(--hsh-space-6)] sm:grid-cols-2 lg:grid-cols-3">
            {featuredPrograms.map((program) => (
              <li key={program.slug} className="flex">
                <ProgramCard program={program} />
              </li>
            ))}
          </ul>
        </section>

        {/* Guidance pathway */}
        <section
          aria-labelledby="guidance-heading"
          className="hsh-container hsh-container-public pt-[var(--hsh-space-12)]"
        >
          <div className="flex flex-col items-center gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] px-[var(--hsh-space-6)] py-[var(--hsh-space-10)] text-center md:flex-row md:justify-center md:text-left">
            <Leaf
              aria-hidden="true"
              className="size-8 text-[var(--hsh-forest-500)]"
              strokeWidth={1.75}
            />
            <h2
              id="guidance-heading"
              className="hsh-h3 text-[var(--hsh-text-primary)]"
            >
              Not sure where to begin?
            </h2>
            <Button variant="secondary" size="md" disabled>
              Request Guidance
              <span className="sr-only">— coming soon</span>
            </Button>
          </div>
        </section>

        {/* Community story */}
        <section
          aria-labelledby="community-heading"
          className="hsh-container hsh-container-public grid gap-[var(--hsh-space-8)] pt-[var(--hsh-space-16)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center"
        >
          <div className="flex flex-col gap-[var(--hsh-space-4)]">
            <h2
              id="community-heading"
              className="hsh-h2 text-[var(--hsh-text-primary)]"
            >
              A community that grows together
            </h2>
            <p className="hsh-body-lg max-w-[52ch] text-[var(--hsh-text-secondary)]">
              One trusted, Christ-centered place to discover programs,
              participate in meaningful learning, and stay connected.
            </p>
            <p className="hsh-body max-w-[52ch] text-[var(--hsh-text-secondary)]">
              {positioning.faithIdentity}
            </p>
          </div>

          {/* Reserved for approved photography, as above. */}
          <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-8)]">
            <Sprout
              aria-hidden="true"
              className="absolute left-[18%] size-28 text-[var(--hsh-forest-500)] opacity-25"
              strokeWidth={1.75}
            />
            <p className="hsh-caption relative text-[var(--hsh-text-muted)]">
              Approved photography pending
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
