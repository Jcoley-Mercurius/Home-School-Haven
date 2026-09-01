import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /* Server-action requests cap at 1 MB by default
         (`next/dist/docs/01-app/02-guides/server-actions.md`), which is below
         any plausible worksheet. Raised to the approved 10 MB file limit
         (GAP-CONTENT-02, owner decision 2026-08-31) plus room for the
         multipart envelope and the form's other fields.

         This is a TRANSPORT ceiling, not the rule. The rule is enforced three
         times below it: the action measures the real byte length,
         `content_attach_resource_file` re-checks it inside the writing
         transaction, and `learning_resources_file_size` is a column
         constraint. Raising this number alone would let a larger request
         arrive and still be refused. */
      bodySizeLimit: "12mb",
    },
  },
}

export default nextConfig
