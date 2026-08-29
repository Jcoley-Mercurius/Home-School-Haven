/**
 * The single return-destination allow-list.
 *
 * An open redirect on an authentication surface is a phishing primitive: a link
 * to our own sign-in page that lands the visitor on someone else's password
 * form, with our domain in the part of the URL they were taught to check.
 *
 * This rule used to be written three times — in `guards.ts`, in
 * `sign-in/page.tsx`, and in `sign-in/actions.ts`. The recovery round trip
 * needs it in two more places (`next` on `/auth/confirm`, and the destination
 * carried through `/forgot-password`). Five hand-copied allow-lists is how one
 * of them eventually drifts, so there is now exactly one, and it is unit-tested
 * against hostile input in `tests/auth-return-to.test.mts`.
 *
 * Accepted: a relative, single-slash, same-origin path. Everything else becomes
 * `/account`, which routes by server-derived role.
 */

/** Where a rejected or absent destination goes: role routing decides the rest. */
export const DEFAULT_RETURN_TO = "/account"

/* A control character can truncate a header or smuggle a second line into one.
   Written as escapes so the pattern stays readable in a diff. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_RETURN_TO

  /* Reject rather than strip: a destination containing a control character is
     not a destination this application generated. */
  if (CONTROL_CHARACTERS.test(raw)) return DEFAULT_RETURN_TO

  if (!raw.startsWith("/")) return DEFAULT_RETURN_TO

  /* `//evil.example` is a protocol-relative URL. A browser resolves it to a
     different origin even though it looks like a path. */
  if (raw.startsWith("//")) return DEFAULT_RETURN_TO

  /* A backslash is normalised to `/` by browsers before the origin is resolved,
     so `/\evil.example` and `/\/evil.example` are off-site too — and that form
     survives a naive check that only looks for a double slash. No legitimate
     route in this application contains one. */
  if (raw.includes("\\")) return DEFAULT_RETURN_TO

  return raw
}
