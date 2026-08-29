"use client"

import { useRef, useState, type ReactNode } from "react"
import {
  ArrowRight,
  Heart,
  House,
  Leaf,
  MessageCircle,
  type LucideIcon,
} from "lucide-react"

import { ContactForm } from "@/components/contact/contact-form"
import {
  Card,
  CardDescription,
  CardFooter,
  CardGlyph,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { contactPathways, type ContactPathway } from "@/content/contact"
import type { GuidanceRequestType } from "@/lib/contact/recorder"
import { cn } from "@/lib/utils"

/**
 * The interactive half of `/contact`: the four request pathways and the form
 * they set.
 *
 * The reference draws each pathway card with an arrow, implying four
 * destinations. None exists, and the review contains no broken links (owner
 * decision, 2026-08-27), so a card selects its request type on the form below
 * and moves focus there instead (D-C3). One piece of state owns the answer, so
 * the cards and the form's "What can we help with?" control can never disagree.
 *
 * The reassurance panel is passed in as `children` so its copy is rendered on
 * the server and never depends on hydration.
 */
const pathwayMarks: Record<ContactPathway["glyph"], LucideIcon> = {
  leaf: Leaf,
  house: House,
  message: MessageCircle,
  heart: Heart,
}

/* Existing glyph surface/ink pairs, already used on home, programs, about, and
   resources. The tone is decoration: the title and the selected word carry the
   meaning (DESIGN-SYSTEM.md §10). */
const pathwayTones: Record<ContactPathway["tone"], string> = {
  forest: "bg-[var(--hsh-surface-quiet)] text-[var(--hsh-forest-600)]",
  "gold-tint": "bg-[var(--hsh-gold-100)] text-[var(--hsh-gold-700)]",
  "coral-tint": "bg-[var(--hsh-coral-100)] text-[var(--hsh-coral-700)]",
  gold: "bg-[var(--hsh-gold-500)] text-[var(--hsh-surface-card)]",
}

function ContactRequest({ children }: { children: ReactNode }) {
  const [type, setType] = useState<GuidanceRequestType>("guidance")
  const [messageLength, setMessageLength] = useState(0)
  const [selectionNotice, setSelectionNotice] = useState("")
  const typeRef = useRef<HTMLSelectElement | null>(null)

  const choosePathway = (pathway: ContactPathway) => {
    setType(pathway.type)
    setSelectionNotice(
      `${pathway.title} selected. The form below is set to this request.`,
    )
    typeRef.current?.focus()
  }

  return (
    <>
      <section
        aria-labelledby="contact-pathways-heading"
        className="hsh-container hsh-container-public mt-[var(--hsh-space-10)] flex flex-col gap-[var(--hsh-space-5)]"
      >
        <h2 id="contact-pathways-heading" className="sr-only">
          Choose a request
        </h2>

        <p role="status" aria-live="polite" className="sr-only">
          {selectionNotice}
        </p>

        <ul className="grid gap-[var(--hsh-space-5)] sm:grid-cols-2 lg:grid-cols-4">
          {contactPathways.map((pathway) => {
            const Mark = pathwayMarks[pathway.glyph]
            const selected = pathway.type === type

            return (
              <li key={pathway.type} className="flex">
                {/* The card is a card and the action is a button inside it: a
                    heading is flow content and cannot live inside a button.
                    Same structure as the Resources category cards. */}
                <Card
                  className={cn(
                    "w-full gap-[var(--hsh-space-3)]",
                    selected
                      ? "border-[var(--hsh-forest-600)]"
                      : "border-[var(--hsh-border-default)]",
                  )}
                >
                  <CardHeader className="flex-row items-start gap-[var(--hsh-space-4)]">
                    <CardGlyph
                      className={cn("shrink-0", pathwayTones[pathway.tone])}
                    >
                      <Mark className="size-5" strokeWidth={1.75} />
                    </CardGlyph>
                    <div className="flex flex-col gap-[var(--hsh-space-2)]">
                      <CardTitle className="hsh-h4">{pathway.title}</CardTitle>
                      <CardDescription className="hsh-body-sm">
                        {pathway.description}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardFooter className="mt-auto justify-end">
                    {/* The state is a word as well as a border colour
                        (DESIGN-SYSTEM.md §10, DO-DONT.md "Trust states"). */}
                    <button
                      type="button"
                      data-slot="pathway-action"
                      aria-pressed={selected}
                      onClick={() => choosePathway(pathway)}
                      className={cn(
                        "hsh-label inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)]",
                        "rounded-[var(--hsh-radius-small)] px-[var(--hsh-space-2)] text-[var(--hsh-forest-700)]",
                        "transition-colors outline-none hover:text-[var(--hsh-forest-500)]",
                        "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
                        "focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)]",
                      )}
                    >
                      {selected ? "Selected" : "Choose"}
                      <span className="sr-only"> — {pathway.title}</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-5"
                        strokeWidth={1.75}
                      />
                    </button>
                  </CardFooter>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      <section
        aria-labelledby="contact-form-heading"
        className="hsh-container hsh-container-public mt-[var(--hsh-space-8)] grid gap-[var(--hsh-space-6)] lg:grid-cols-12 lg:items-start"
      >
        <h2 id="contact-form-heading" className="sr-only">
          Send a request
        </h2>

        <div className="lg:col-span-5">{children}</div>

        <div className="rounded-[var(--hsh-radius-feature)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-6)] shadow-[var(--hsh-shadow-card)] lg:col-span-7 lg:p-[var(--hsh-space-8)]">
          <ContactForm
            type={type}
            onTypeChange={setType}
            typeRef={typeRef}
            messageLength={messageLength}
            onMessageLengthChange={setMessageLength}
          />
        </div>
      </section>
    </>
  )
}

export { ContactRequest }
