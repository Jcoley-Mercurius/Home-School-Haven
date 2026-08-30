/**
 * Announcement and learning-resource reads for the authenticated viewer.
 *
 * Neither query filters by program. It does not need to: the RLS policies added
 * in `20260829170000_family_dashboard_records.sql` return only rows that are
 * `published` **and** attached to a program this viewer's family holds a
 * non-cancelled enrollment in. Writing that rule here as well would put the
 * family boundary in two places, one of which could drift.
 *
 * There are no write functions. Authoring announcements and resources is
 * MPS-REQ-019 and belongs to the educator and administrator work; neither table
 * has a client write policy or privilege.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { SectionState } from "@/lib/enrollment/repository"

export type Announcement = {
  id: string
  title: string
  body: string
  publishedAt: string | null
  programId: string
  programName: string | null
}

export type LearningResource = {
  id: string
  title: string
  description: string | null
  /** Always `http(s)`; the table's check constraint is what guarantees it. */
  url: string
  programId: string
  programName: string | null
}

/**
 * Published announcements for the programs the viewer's family is enrolled in.
 * @param limit - Optional cap, for the dashboard summary card.
 * @returns The authorized announcements, or a state explaining why not.
 */
export async function getFamilyAnnouncements(
  limit?: number,
): Promise<SectionState<Announcement>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  let query = supabase
    .from("announcements")
    .select("id,title,body,published_at,program_id,programs(name)")
    .order("published_at", { ascending: false })

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      publishedAt: row.published_at,
      programId: row.program_id,
      programName: row.programs?.name ?? null,
    })),
  }
}

/**
 * Published learning resources for the programs the family is enrolled in.
 * @param limit - Optional cap, for the dashboard summary card.
 * @returns The authorized resources, or a state explaining why not.
 */
export async function getFamilyResources(
  limit?: number,
): Promise<SectionState<LearningResource>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  let query = supabase
    .from("learning_resources")
    .select("id,title,description,url,program_id,programs(name)")
    .order("title")

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      url: row.url,
      programId: row.program_id,
      programName: row.programs?.name ?? null,
    })),
  }
}
