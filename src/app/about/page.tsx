import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Heart, Leaf, Sprout, User, Users } from "lucide-react"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { ValueBand } from "@/components/public/value-band"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardGlyph } from "@/components/ui/card"
import {
  aboutClosing,
  aboutHero,
  approachItems,
  communityGroups,
  communityIntro,
  faithPanel,
} from "@/content/about"
import {
  guidanceHref,
  heroImage,
  programsHref,
} from "@/content/foundation-content"

/**
 * Public About page (MPS-REQ-007, MPS-REQ-009, MPS-ACC-009, MPS-ACC-010;
 * DESIGN-SYSTEM.md §7 public shell, §8 responsive behavior).
 *
 * Composition follows `mds/references/proposed/public-about-proposed.png`. That
 * image is *proposed*, not canonical MDS: it carries no MDS-REF ID, so the
 * authority for every visual decision here remains the design specification, the
 * `--hsh-*` tokens, and the approved references. Promoting the image is an owner
 * governance action that has not happened.
 *
 * Copy provenance is unusual on this page and is recorded in
 * `src/content/about.ts`: the values band is import-inventory content, while the
 * heading, mission, approach, faith panel, and community cards are the owner's
 * own words, approved verbatim on 2026-08-28 ("Approved, but keep image copy").
 * Neither group may grow without its matching authority.
 *
 * Three parts of the image are deliberately not built, as recorded in
 * `prompts/public-about-page.md` §4: the decorative botanical illustration
 * (no such asset exists and §5 forbids generating one), photographic avatars on
 * the community cards (no approved photography exists), and the image's footer
 * composition (the implemented `SiteFooter` is already approved).
 *
 * Statically rendered with no `revalidate` and no data read — every string is a
 * module constant. See `src/app/programs/page.tsx` for why `revalidate` is
 * avoided across the public pages.
 */
export const metadata: Metadata = {
  title: "About — Home School Haven of SWFL",
  description:
    "Home School Haven is a Christ-centered homeschool community offering enrichment classes, hands-on workshops, small-group learning, and family support.",
}

/* One mark per approach item, in order, matching the proposed composition. */
const approachMarks = [Sprout, Users] as const

export default function AboutPage() {
  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* Editorial hero. Unlike the home hero, the photo stays an inset
            rounded panel inside the container at every viewport: the proposed
            composition draws it that way, and a second full-bleed hero would
            make About read as another home page. */}
        <section className="bg-[var(--hsh-surface-page)]">
          <div className="hsh-container hsh-container-public grid gap-[var(--hsh-space-10)] py-[var(--hsh-space-10)] lg:min-h-[440px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:py-[var(--hsh-space-16)]">
            <div className="flex flex-col gap-[var(--hsh-space-5)] lg:pr-[var(--hsh-space-8)]">
              <Breadcrumbs
                trail={[{ label: "Home", href: "/" }, { label: "About" }]}
              />
              <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
                {aboutHero.eyebrow}
              </p>
              <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
                {aboutHero.heading}
              </h1>
              <p className="hsh-body-lg max-w-[52ch] text-[var(--hsh-text-secondary)]">
                {aboutHero.summary}
              </p>
              <p className="hsh-body max-w-[52ch] text-[var(--hsh-text-secondary)]">
                {aboutHero.mission}
              </p>
              <div className="flex flex-wrap gap-[var(--hsh-space-4)]">
                <Button
                  variant="primary"
                  size="lg"
                  render={<Link href={programsHref} />}
                >
                  Explore Programs
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  render={<Link href={guidanceHref} />}
                >
                  Request Guidance
                </Button>
              </div>
            </div>

            {/* Demo-only placeholder art — see `public/placeholder/README.md`.
                Not approved photography; the children are not real students. */}
            <div className="relative min-h-[280px] overflow-hidden rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] lg:min-h-[420px]">
              <Image
                src={heroImage.src}
                alt={heroImage.alt}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* Values band — inventory content, identical to the home page */}
        <section
          aria-labelledby="values-heading"
          className="hsh-container hsh-container-public"
        >
          <h2 id="values-heading" className="sr-only">
            What we value
          </h2>
          <ValueBand />
        </section>

        {/* Approach and faith. Two columns from `lg` with the divider rule the
            proposed composition draws; stacked below, where a top border keeps
            the separation without a hairline running the wrong way. */}
        <div className="hsh-container hsh-container-public grid gap-[var(--hsh-space-10)] pt-[var(--hsh-space-16)] lg:grid-cols-2 lg:gap-[var(--hsh-space-12)]">
          <section
            aria-labelledby="approach-heading"
            className="flex flex-col gap-[var(--hsh-space-6)]"
          >
            <h2
              id="approach-heading"
              className="hsh-h2 text-[var(--hsh-text-primary)]"
            >
              Our approach
            </h2>
            <ul className="flex flex-col gap-[var(--hsh-space-6)]">
              {approachItems.map((item, index) => {
                const Icon = approachMarks[index]
                return (
                  <li
                    key={item.title}
                    className="flex items-start gap-[var(--hsh-space-4)]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-elevated)] text-[var(--hsh-forest-600)]"
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <div className="flex flex-col gap-[var(--hsh-space-2)]">
                      <h3 className="hsh-h4 text-[var(--hsh-text-primary)]">
                        {item.title}
                      </h3>
                      <p className="hsh-body max-w-[56ch] text-[var(--hsh-text-secondary)]">
                        {item.description}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section
            aria-labelledby="faith-heading"
            className="flex flex-col gap-[var(--hsh-space-5)] border-t border-[var(--hsh-border-default)] pt-[var(--hsh-space-10)] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-[var(--hsh-space-12)]"
          >
            <h2
              id="faith-heading"
              className="hsh-h2 text-[var(--hsh-text-primary)]"
            >
              {faithPanel.heading}
            </h2>
            <p className="hsh-body max-w-[56ch] text-[var(--hsh-text-secondary)]">
              {faithPanel.body}
            </p>
            {/* The image sets a decorative botanical illustration beside this
                quote. No such asset exists and none may be generated
                (DESIGN-SYSTEM.md §5), so the quiet leaf mark carries the same
                role. */}
            <figure className="flex items-start gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]">
              <Leaf
                aria-hidden="true"
                className="mt-1 size-6 shrink-0 text-[var(--hsh-forest-500)]"
                strokeWidth={1.75}
              />
              <div className="flex flex-col gap-[var(--hsh-space-2)]">
                <blockquote className="hsh-body text-[var(--hsh-text-primary)]">
                  &ldquo;{faithPanel.quote}&rdquo;
                </blockquote>
                <figcaption className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
                  {faithPanel.attribution}
                </figcaption>
              </div>
            </figure>
          </section>
        </div>

        {/* Community */}
        <section
          aria-labelledby="community-heading"
          className="mt-[var(--hsh-space-16)] bg-[var(--hsh-surface-elevated)] py-[var(--hsh-space-16)]"
        >
          <div className="hsh-container hsh-container-public flex flex-col gap-[var(--hsh-space-8)]">
            <div className="flex flex-col gap-[var(--hsh-space-3)] text-center">
              <h2
                id="community-heading"
                className="hsh-h2 text-[var(--hsh-text-primary)]"
              >
                {communityIntro.heading}
              </h2>
              <p className="hsh-body mx-auto max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                {communityIntro.summary}
              </p>
            </div>

            <ul className="grid gap-[var(--hsh-space-6)] sm:grid-cols-2 lg:grid-cols-4">
              {communityGroups.map((group) => (
                <li key={group.name} className="flex">
                  {/* No approved photography exists, so the card carries the
                      quiet glyph rather than a stock avatar. */}
                  <Card className="w-full flex-row items-start gap-[var(--hsh-space-4)]">
                    <CardGlyph className="size-11 bg-[var(--hsh-gold-100)] text-[var(--hsh-gold-700)]">
                      <User className="size-5" strokeWidth={1.75} />
                    </CardGlyph>
                    <div className="flex flex-col gap-[var(--hsh-space-2)]">
                      <h3 className="hsh-h4 text-[var(--hsh-text-primary)]">
                        {group.name}
                      </h3>
                      <CardDescription>{group.description}</CardDescription>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing pathway */}
        <section
          aria-labelledby="about-closing-heading"
          className="hsh-container hsh-container-public pt-[var(--hsh-space-12)]"
        >
          <div className="flex flex-col items-center gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] px-[var(--hsh-space-6)] py-[var(--hsh-space-10)] text-center md:flex-row md:justify-center md:text-left">
            <Heart
              aria-hidden="true"
              className="size-8 shrink-0 text-[var(--hsh-coral-700)]"
              strokeWidth={1.75}
            />
            <h2
              id="about-closing-heading"
              className="hsh-h3 text-[var(--hsh-text-primary)]"
            >
              {aboutClosing.prompt}
            </h2>
            <div className="flex flex-wrap justify-center gap-[var(--hsh-space-4)]">
              <Button
                variant="primary"
                size="md"
                render={<Link href={programsHref} />}
              >
                Explore Programs
              </Button>
              <Button
                variant="secondary"
                size="md"
                render={<Link href={guidanceHref} />}
              >
                Request Guidance
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
