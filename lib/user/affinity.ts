import { getSupabaseServerClient } from '@/lib/supabase-server'
import type { PlaceTaggingMeta } from '@/lib/place-tagging-types'

export type AffinityEventType = 'view' | 'save' | 'review'

const EVENT_WEIGHT: Record<AffinityEventType, number> = {
  view: 1,
  save: 2,
  review: 3,
}

type SeedTag = { slug?: string; confidence_score?: number }

function topPlaceTags(meta: PlaceTaggingMeta | null | undefined, limit = 5): Array<{ slug: string; confidence: number }> {
  const raw = meta?.automated_seed?.tags || []
  const normalized = raw
    .map((t: SeedTag) => ({
      slug: String(t?.slug || '').toLowerCase().trim(),
      confidence: Math.max(0, Math.min(1, Number(t?.confidence_score || 0))),
    }))
    .filter(t => Boolean(t.slug))
    .sort((a, b) => b.confidence - a.confidence)
  return normalized.slice(0, limit)
}

/**
 * Incrementa afinidad del usuario usando los top tags del local.
 * - userId: auth user id
 * - placeId: id de places (uuid)
 * - eventType: view/save/review
 */
export async function trackUserPlaceAffinity(input: {
  userId: string
  placeId: string
  eventType?: AffinityEventType
}) {
  const userId = String(input.userId || '').trim()
  const placeId = String(input.placeId || '').trim()
  const eventType = input.eventType || 'view'
  if (!userId || !placeId) return { ok: false, reason: 'missing_input' as const }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { ok: false, reason: 'supabase_not_configured' as const }

  const { data: placeRow } = await supabase
    .from('places')
    .select('id, tagging_meta')
    .eq('id', placeId)
    .maybeSingle()

  const taggingMeta = (placeRow?.tagging_meta && typeof placeRow.tagging_meta === 'object')
    ? (placeRow.tagging_meta as PlaceTaggingMeta)
    : null
  const topTags = topPlaceTags(taggingMeta, 5)
  if (topTags.length === 0) return { ok: true, tracked: 0, tags: [] as string[] }

  const slugs = topTags.map(t => t.slug)
  const { data: existingRows } = await supabase
    .from('user_tag_affinity')
    .select('tag_slug, weight')
    .eq('user_id', userId)
    .in('tag_slug', slugs)

  const current = new Map<string, number>()
  for (const row of (existingRows || []) as Array<{ tag_slug: string; weight: number }>) {
    const slug = String(row.tag_slug || '').toLowerCase().trim()
    if (!slug) continue
    current.set(slug, Number(row.weight || 0))
  }

  const base = EVENT_WEIGHT[eventType]
  const now = new Date().toISOString()
  const payload = topTags.map(t => ({
    user_id: userId,
    tag_slug: t.slug,
    weight: Number(current.get(t.slug) || 0) + Math.max(1, Math.round(base * Math.max(0.35, t.confidence))),
    updated_at: now,
  }))

  const { error } = await supabase
    .from('user_tag_affinity')
    .upsert(payload, { onConflict: 'user_id,tag_slug' })

  if (error) return { ok: false, reason: 'upsert_failed' as const, error: error.message }
  return { ok: true, tracked: payload.length, tags: payload.map(p => p.tag_slug) }
}

