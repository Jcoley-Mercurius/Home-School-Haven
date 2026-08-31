"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Student } from "@/lib/family/repository"

/**
 * Parent-controlled student selector (MDS `components.family_student_selector`,
 * variant `dropdown`; MDS-REF-007's "Viewing: …" control).
 *
 * WHAT THIS IS NOT
 *
 * Changing the selection changes which of the parent's own children the
 * dashboard is describing. It creates no session, no credential, and no student
 * identity of any kind — students have no independent Foundation Release login
 * (ACT-002), and nothing here could give them one.
 *
 * WHY IT IS A GET FORM
 *
 * A plain form means the whole thing works without JavaScript, is operable from
 * the keyboard by construction, and leaves the server rendering the page with
 * the selection already applied. The submit button is always present and
 * labelled rather than being a JavaScript-only affordance; `onValueChange` just
 * saves the extra press for people who have JavaScript.
 *
 * WHY THE ID TRAVELS IN THE URL
 *
 * `?student=<uuid>` is an opaque identifier and carries no name, grade, or
 * relationship. It is never an authorization input: `selectStudent()` checks it
 * against the RLS-returned list and falls back silently when it does not match,
 * so an id from another family behaves exactly like an id that never existed.
 * Analytics runs on public routes only and never sees it.
 *
 * Only rendered when the family has more than one student — a selector over one
 * option is a control with nothing to control.
 */
function StudentSelector({
  students,
  selectedId,
}: {
  students: Student[]
  selectedId: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  /* Controlled, and submitted from an effect rather than from inside
     `onValueChange`.
     `requestSubmit()` called directly in the change handler runs BEFORE React
     has re-rendered the hidden input the Select writes its value into, so the
     form submitted the PREVIOUS selection: the URL gained `?student=` (the old
     id), the server resolved it to the child already in view, and choosing a
     different child appeared to do nothing at all. Submitting once the new
     value has been committed is what makes the control actually change the
     view. */
  const [value, setValue] = useState(selectedId)
  const pendingSubmit = useRef(false)

  useEffect(() => {
    if (!pendingSubmit.current) return
    pendingSubmit.current = false
    formRef.current?.requestSubmit()
  }, [value])

  if (students.length < 2) return null

  return (
    <form
      ref={formRef}
      method="GET"
      action="/family"
      className="flex items-end gap-[var(--hsh-space-2)]"
    >
      <div className="flex flex-col gap-[var(--hsh-space-1)]">
        <label
          htmlFor="student-selector"
          className="hsh-label text-[var(--hsh-text-secondary)]"
        >
          Viewing
        </label>
        {/* `items` is what lets the trigger show the child's name. Without it
            Base UI's `Select.Value` renders the raw value, so the control read
            "40000000-0000-4000-8000-000000000001" — a database identifier shown
            to a parent in place of their own child's name. */}
        <Select
          name="student"
          value={value}
          items={students.map((student) => ({
            value: student.id,
            label: student.preferredName,
          }))}
          onValueChange={(next: string | null) => {
            if (next === null) return
            pendingSubmit.current = true
            setValue(next)
          }}
        >
          <SelectTrigger
            id="student-selector"
            className="min-w-[180px]"
            aria-label="Viewing student"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {students.map((student) => (
              <SelectItem key={student.id} value={student.id}>
                {student.preferredName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kept visible rather than hidden behind `noscript`: it is the control
          that makes the selector operable when JavaScript has not loaded, and
          a submit button nobody can see is a submit button nobody can use. */}
      <Button type="submit" variant="secondary" size="md">
        View
      </Button>
    </form>
  )
}

export { StudentSelector }
