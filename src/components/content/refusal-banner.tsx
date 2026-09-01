import { Alert } from "@/components/ui/alert"

/**
 * Why a lifecycle move did not happen (MPS-REQ-021).
 *
 * Publishing and removing are `void` server actions that redirect, so they
 * carry no form state to hold a message. A refused move used to redirect back
 * to an unchanged page, leaving the author to infer from an unchanged badge
 * that anything had happened — which is exactly the "no observable state, no
 * stated recovery" MPS-REQ-021 rules out.
 *
 * The action appends a short token; this turns it back into a sentence. The
 * sentence lives here rather than in the URL because a URL is logged, shared,
 * and kept in history, and text put there is text that escapes the page.
 *
 * An unrecognised token renders nothing. A `?refused=` someone typed by hand
 * must not be able to put arbitrary claims in front of an author.
 */
const REFUSAL_MESSAGES: Record<string, { title: string; body: string }> = {
  stale: {
    title: "Nothing was changed",
    body: "Someone else changed this while you were looking at it. Reload the page to see their version, then try again.",
  },
  gone: {
    title: "Nothing was changed",
    body: "This is no longer available. It may have been removed, or your access to it may have changed.",
  },
  refused: {
    title: "That change was refused",
    body: "This item is not in a state that allows it. Anything that needs your attention is shown above.",
  },
  failed: {
    title: "Nothing was changed",
    body: "Something went wrong on our side. Nothing was saved — please try again.",
  },
}

/**
 * Render the refusal for a `?refused=` token, if it names one.
 * @param props.token - The search-parameter value, untrusted.
 * @returns The banner, or nothing.
 */
function RefusalBanner({ token }: { token: string | undefined }) {
  const message = token ? REFUSAL_MESSAGES[token] : undefined
  if (!message) return null

  return (
    /* Assertive: the page otherwise looks exactly as it did before the click,
       so a screen-reader user has no other signal that the move was refused. */
    <Alert tone="warning" title={message.title} live="assertive">
      {message.body}
    </Alert>
  )
}

export { RefusalBanner }
