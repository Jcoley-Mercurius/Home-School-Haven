/**
 * Authorized download for a private program-resource file (MPS-REQ-004,
 * MPS-REQ-019, MPS-ACC-030).
 *
 * This route is the ONLY way a file in `program-resources` reaches anyone. The
 * bucket is private, so there is no public URL to fall back to, and every
 * response here is a redirect to a URL minted seconds earlier for this one
 * request.
 *
 * WHAT HAPPENS ON EVERY REQUEST, IN ORDER
 *
 *   1. the resource id's shape is checked, so a malformed id never reaches a
 *      query;
 *   2. the viewer is re-derived from verified JWT claims;
 *   3. the resource is read — through RLS, so a viewer who may not see the row
 *      gets nothing here regardless of what this code then does;
 *   4. its state is checked: a family may download only a PUBLISHED resource,
 *      while an author may reach their own draft to check it;
 *   5. a signed URL is minted with the VIEWER'S OWN session, so the
 *      `storage.objects` policies decide independently whether it may exist at
 *      all;
 *   6. the URL goes into a `Location` header and nowhere else.
 *
 * REMOVAL TAKES EFFECT HERE IMMEDIATELY
 *
 * A removed resource's state fails (4) and its object fails the select policy
 * at (5), so this route stops serving the moment removal is recorded — proof
 * obligation 13. What removal cannot do is recall a signed URL already handed
 * out: Supabase signed URLs are not revocable. That is why the TTL is 60
 * seconds and why the URL is never persisted anywhere. Recorded as RISK-C1
 * rather than described as revocation, because it is not revocation.
 *
 * EVERY REFUSAL IS THE SAME REFUSAL
 *
 * Malformed, nonexistent, unauthorized, unpublished, removed, and
 * file-less all return 404. A distinguishable "forbidden" would tell a prober
 * which resource ids are real.
 */

import { notFound, redirect } from "next/navigation"

import { requireViewer } from "@/lib/auth/guards"
import { isUuid, mayAuthorForProgram } from "@/lib/content/authority"
import { getResource } from "@/lib/content/resources"
import { createSignedResourceUrl } from "@/lib/content/storage"
import { isFamilyVisible } from "@/lib/content/lifecycle"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"

/* A signed URL is minted per request and must never be cached, by us or by
   anything between us and the browser. */
export const dynamic = "force-dynamic"

/**
 * Authorize, then redirect to a fresh short-lived signed URL.
 * @param _request - The incoming request. Nothing is read from it: a query
 *   string or header carrying a path, a program, or a role would be exactly the
 *   client-supplied authorization this route must not have.
 * @param context - The route parameters.
 * @returns A redirect, or a 404.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ resourceId: string }> },
): Promise<Response> {
  const { resourceId } = await context.params

  if (!isUuid(resourceId)) notFound()
  if (!isSupabaseConfigured()) notFound()

  const viewer = await requireViewer(`/resources/${resourceId}/file`)

  const resource = await getResource(resourceId)
  /* Either it does not exist or this viewer may not read it. The two are the
     same answer on purpose. */
  if (!resource || !resource.hasFile) notFound()

  const mayAuthor = await mayAuthorForProgram(viewer, resource.programId)

  /* An author may open their own draft to check what they are about to
     publish. Anyone else gets only what a family may see, and `removed` is
     excluded for everybody — including its author, because the file has been
     withdrawn and a withdrawn file that its author can still fetch is not
     withdrawn. */
  const permitted = mayAuthor
    ? resource.state !== "removed"
    : isFamilyVisible(resource.state) && resource.state !== "replaced"

  if (!permitted) notFound()

  /* Re-read the path through RLS rather than carrying it in the mapped record:
     `ResourceRecord` deliberately drops `storage_path` so no object key can
     reach a browser, and this is the one place that needs it back. */
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("learning_resources")
    .select("storage_path")
    .eq("id", resourceId)
    .maybeSingle()

  if (error || !data?.storage_path) notFound()

  const signed = await createSignedResourceUrl(data.storage_path)
  if (!signed) notFound()

  /* `redirect` throws, so nothing after this line runs and the URL never
     reaches a log, a template, or a response body. */
  redirect(signed)
}
