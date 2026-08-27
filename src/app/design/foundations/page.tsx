import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import {
  Accessibility,
  BookOpen,
  Cross,
  Heart,
  Leaf,
  Sun,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardGlyph,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox, CheckboxRow } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Radio, RadioGroup, RadioRow } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TextLink } from "@/components/ui/text-link"

/**
 * Design QA surface for MDS-REF-003 (`mds/references/assets/design-foundations.png`).
 * Static sample copy only — no family, student, program, price, or enrollment data.
 *
 * Development-only: the route returns 404 in any production build. Owner
 * decision, 2026-08-27.
 */
export const metadata: Metadata = {
  title: "MDS Foundations — Home School Haven",
  robots: { index: false, follow: false },
}

const palette = [
  { name: "Logo Ivory", token: "--hsh-ivory-100", hex: "#F4F1EC" },
  { name: "Logo Ink", token: "--hsh-logo-ink", hex: "#292929" },
  { name: "Logo Coral", token: "--hsh-coral-500", hex: "#ED7D7C" },
  { name: "Forest 700", token: "--hsh-forest-700", hex: "#31483F" },
  { name: "Forest 600", token: "--hsh-forest-600", hex: "#3F5C50" },
  { name: "Forest 100", token: "--hsh-forest-100", hex: "#DDE7E1" },
  { name: "Forest 50", token: "--hsh-forest-50", hex: "#EFF4F1" },
  { name: "Coral 700", token: "--hsh-coral-700", hex: "#A84248" },
  { name: "Coral 100", token: "--hsh-coral-100", hex: "#F9E2E1" },
  { name: "Heritage Gold", token: "--hsh-gold-500", hex: "#B38A42" },
  { name: "Heritage Gold 100", token: "--hsh-gold-100", hex: "#EFE3C8" },
  { name: "Primary Text", token: "--hsh-ink-900", hex: "#1F2522" },
  { name: "Secondary Text", token: "--hsh-ink-700", hex: "#4F5954" },
  { name: "Border", token: "--hsh-neutral-200", hex: "#E2E5E2" },
  { name: "White", token: "--hsh-white", hex: "#FFFFFF" },
]

const displayRoles = [
  { label: "Display XL — Lora Semibold", spec: "56/64 desktop, 40/46 mobile" },
  { label: "Display LG — Lora Semibold", spec: "44/52 desktop, 34/40 mobile" },
  { label: "H1 — Lora Semibold", spec: "40/48 desktop, 32/38 mobile" },
  { label: "H2 — Lora Semibold", spec: "32/40 desktop, 28/35 mobile" },
  { label: "H3 — Lora Semibold", spec: "24/32" },
  { label: "H4 — Manrope Bold", spec: "20/28" },
]

const uiRoles = [
  { label: "Body Large — Manrope Regular", spec: "18/30" },
  { label: "Body — Manrope Regular", spec: "16/26" },
  { label: "Body Small — Manrope Regular", spec: "14/22" },
  { label: "Label — Manrope Semibold", spec: "14/20" },
  { label: "Caption — Manrope Medium", spec: "12/18" },
]

const spacingScale = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]

const radiusScale = [
  { value: "var(--hsh-radius-control)", label: "10px", role: "Controls" },
  { value: "var(--hsh-radius-card)", label: "14px", role: "Cards" },
  { value: "var(--hsh-radius-feature)", label: "20px", role: "Features" },
]

const principles = [
  { icon: Heart, text: "A Haven, Not Just a Platform" },
  { icon: Sun, text: "Warmth With Clarity" },
  { icon: Users, text: "Parent Trust Comes First" },
  { icon: Leaf, text: "Creativity Within Calm Structure" },
  { icon: Cross, text: "Faith Expressed Through Character" },
]

const moodWords = [
  { text: "Nurturing", icon: Leaf },
  { text: "Christ-Centered", icon: Heart },
  { text: "Creative", icon: BookOpen },
  { text: "Community", icon: Users },
  { text: "Trusted", icon: Cross },
]

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-[var(--hsh-space-6)]">
      <h2 className="hsh-h4 tracking-wide text-[var(--hsh-text-primary)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function DesignFoundationsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="hsh-container hsh-container-operations flex flex-col gap-[var(--hsh-space-16)] py-[var(--hsh-space-12)]">
      <header className="flex flex-col gap-[var(--hsh-space-6)] border-b border-[var(--hsh-border-default)] pb-[var(--hsh-space-8)] md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-h1">Home School Haven — Mercurius Design System</h1>
          <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
            Core foundations · Implementation reference
          </p>
        </div>
        <Image
          src="/brand/home-school-haven-logo.png"
          alt="Home School Haven of SWFL"
          width={994}
          height={479}
          priority
          className="h-auto w-[220px]"
        />
      </header>

      <Section title="1. Identity &amp; mood">
        <div className="flex max-w-[var(--hsh-content-public)] flex-col gap-[var(--hsh-space-6)]">
          <div className="flex flex-col gap-[var(--hsh-space-6)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-8)]">
            <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              A warm boutique learning community where families grow together in
              faith, creativity, and confident homeschooling.
            </p>
            <ul className="flex flex-col gap-[var(--hsh-space-3)]">
              {moodWords.map(({ text, icon: Icon }) => (
                <li
                  key={text}
                  className="hsh-body flex items-center gap-[var(--hsh-space-3)] text-[var(--hsh-text-primary)]"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-5 text-[var(--hsh-forest-500)]"
                    strokeWidth={1.75}
                  />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-[var(--hsh-space-3)]">
            <span className="hsh-label rounded-[var(--hsh-radius-pill)] bg-[var(--hsh-forest-100)] px-[var(--hsh-space-4)] py-[var(--hsh-space-2)] text-[var(--hsh-forest-700)]">
              Calm
            </span>
            <span className="hsh-label rounded-[var(--hsh-radius-pill)] bg-[var(--hsh-coral-100)] px-[var(--hsh-space-4)] py-[var(--hsh-space-2)] text-[var(--hsh-coral-700)]">
              Welcoming
            </span>
            <span className="hsh-label rounded-[var(--hsh-radius-pill)] bg-[var(--hsh-gold-100)] px-[var(--hsh-space-4)] py-[var(--hsh-space-2)] text-[var(--hsh-gold-700)]">
              Trusted
            </span>
          </div>
        </div>
      </Section>

      <Section title="2. Color palette">
        <ul className="grid grid-cols-2 gap-[var(--hsh-space-6)] sm:grid-cols-3 lg:grid-cols-5">
          {palette.map((swatch) => (
            <li
              key={swatch.name}
              className="flex flex-col gap-[var(--hsh-space-2)]"
            >
              <div
                className="h-[88px] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)]"
                style={{ backgroundColor: `var(${swatch.token})` }}
              />
              <span className="hsh-label text-[var(--hsh-text-primary)]">
                {swatch.name}
              </span>
              <span className="hsh-caption text-[var(--hsh-text-muted)]">
                {swatch.hex}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="3. Typography">
        <div className="grid gap-[var(--hsh-space-10)] lg:grid-cols-2">
          <div className="flex flex-col gap-[var(--hsh-space-5)]">
            <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
              Lora — editorial / headings
            </p>
            <p className="hsh-display-lg text-[var(--hsh-text-primary)]">
              Inspire. Equip. Encourage.
            </p>
            <ul className="flex flex-col gap-[var(--hsh-space-2)]">
              {displayRoles.map((role) => (
                <li
                  key={role.label}
                  className="hsh-body-sm text-[var(--hsh-text-secondary)]"
                >
                  {role.label} — {role.spec}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-[var(--hsh-space-5)]">
            <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
              Manrope — UI / body / interface
            </p>
            <p className="hsh-h2 font-[family-name:var(--hsh-font-ui)] font-semibold text-[var(--hsh-text-primary)]">
              Learning together, living with purpose.
            </p>
            <ul className="flex flex-col gap-[var(--hsh-space-2)]">
              {uiRoles.map((role) => (
                <li
                  key={role.label}
                  className="hsh-body-sm text-[var(--hsh-text-secondary)]"
                >
                  {role.label} — {role.spec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="4. Spacing &amp; shape language">
        <div className="grid gap-[var(--hsh-space-10)] lg:grid-cols-2">
          <div className="flex flex-col gap-[var(--hsh-space-4)]">
            <p className="hsh-label text-[var(--hsh-text-primary)]">
              Spacing scale (multiples of 4px)
            </p>
            <ul className="flex flex-wrap items-end gap-[var(--hsh-space-4)]">
              {spacingScale.map((step) => (
                <li
                  key={step}
                  className="flex flex-col items-center gap-[var(--hsh-space-2)]"
                >
                  <span className="hsh-caption text-[var(--hsh-text-muted)]">
                    {step}
                  </span>
                  <span
                    className="block rounded-[var(--hsh-radius-small)] bg-[var(--hsh-forest-100)]"
                    style={{ width: step, height: step }}
                  />
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-[var(--hsh-space-4)]">
            <p className="hsh-label text-[var(--hsh-text-primary)]">
              Radius system
            </p>
            <ul className="flex flex-wrap items-end gap-[var(--hsh-space-6)]">
              {radiusScale.map((radius) => (
                <li
                  key={radius.label}
                  className="flex flex-col gap-[var(--hsh-space-2)]"
                >
                  <span
                    className="block size-[72px] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)]"
                    style={{ borderRadius: radius.value }}
                  />
                  <span className="hsh-caption text-[var(--hsh-text-muted)]">
                    {radius.label} · {radius.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="5. Component examples">
        <div className="grid gap-[var(--hsh-space-8)] lg:grid-cols-3">
          <div className="flex flex-col items-start gap-[var(--hsh-space-4)] [&>button]:w-[220px]">
            <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
              Buttons
            </p>
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="accent">Accent Button</Button>
            <Button variant="quiet">Quiet Button</Button>
            <Button variant="destructive">Destructive Button</Button>
            <Button variant="primary" loading>
              Saving
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <TextLink href="/design/foundations" tone="accent" withArrow>
              Text Link
            </TextLink>
          </div>

          <div className="flex flex-col gap-[var(--hsh-space-4)]">
            <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
              Cards
            </p>
            <Card>
              <CardHeader>
                <CardGlyph>
                  <Leaf aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </CardGlyph>
                <CardTitle>Creative Workshops</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Hands-on learning experiences that inspire curiosity and
                  confidence.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <TextLink href="/design/foundations" tone="accent" withArrow>
                  Explore More
                </TextLink>
              </CardFooter>
            </Card>
          </div>

          <div className="flex flex-col gap-[var(--hsh-space-5)]">
            <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
              Form controls
            </p>
            <Field>
              <FieldLabel>Label</FieldLabel>
              <Input placeholder="Input text" />
              <FieldDescription>
                Helper text stays visible; it is never compressed away.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Select</FieldLabel>
              <Select defaultValue={null}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option-one">Option one</SelectItem>
                  <SelectItem value="option-two">Option two</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="flex flex-col gap-[var(--hsh-space-2)]">
              <p className="hsh-label text-[var(--hsh-text-primary)]">Checkbox</p>
              <CheckboxRow>
                <Checkbox defaultChecked />I agree to the terms.
              </CheckboxRow>
            </div>

            <fieldset className="flex flex-col gap-[var(--hsh-space-2)]">
              <legend className="hsh-label text-[var(--hsh-text-primary)]">
                Radio options
              </legend>
              <RadioGroup defaultValue="option-one">
                <RadioRow>
                  <Radio value="option-one" />
                  Option one
                </RadioRow>
                <RadioRow>
                  <Radio value="option-two" />
                  Option two
                </RadioRow>
              </RadioGroup>
            </fieldset>
          </div>
        </div>
      </Section>

      <Section title="6. Principles">
        <ul className="grid gap-[var(--hsh-space-4)] sm:grid-cols-2 lg:grid-cols-3">
          {principles.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="hsh-body flex items-center gap-[var(--hsh-space-4)] text-[var(--hsh-text-primary)]"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--hsh-surface-quiet)] text-[var(--hsh-forest-600)]"
              >
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </Section>

      <footer className="flex items-center gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-pill)] bg-[var(--hsh-surface-elevated)] px-[var(--hsh-space-6)] py-[var(--hsh-space-4)]">
        <Accessibility
          aria-hidden="true"
          className="size-6 text-[var(--hsh-forest-700)]"
          strokeWidth={1.75}
        />
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          WCAG 2.2 AA · States never rely on color alone
        </p>
      </footer>
    </div>
  )
}
