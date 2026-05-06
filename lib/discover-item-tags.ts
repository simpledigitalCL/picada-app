import { inferTagsFromText } from '@/lib/place-match'
import type { PlaceTaggingMeta } from '@/lib/place-tagging-types'
import { slugDisplayFromAutomatedSlug } from '@/lib/place-tags-display'
import { getSupabaseServerClient } from '@/lib/supabase-server'

/** Objeto tipo ítem Discover (frontend o API) con campos mínimos para etiquetar. */
export type DiscoverTagged = {
  id: string
  provider: 'google_places' | 'openstreetmap'
  name: string
  address: string
  reviewsText?: string[]
  inferredTags?: string[]
  automatedSeedTags?: Array<{ slug: string; confidence_score: number; is_automated?: boolean }>
}

/**
 * Une etiquetas legadas por texto + slugs IA (misma regla que en /api/restaurants/discover).
 */
export function mergeInferredTagsForDiscover<T extends DiscoverTagged>(items: T[]): T[] {
  return items.map(item => {
    const legacy = inferTagsFromText([item.name, item.address, ...(item.reviewsText || [])])
    const fromSeeds =
      item.automatedSeedTags?.map(s => slugDisplayFromAutomatedSlug(s.slug)).filter(Boolean) || []
    return {
      ...item,
      inferredTags: [...new Set([...fromSeeds, ...legacy])],
    }
  })
}

/**
 * Para locales ya en caché/snapshot sin seeds en payload: lee tagging_meta desde places.
 */
export async function hydrateAutomatedSeedTagsFromPlacesDb<T extends DiscoverTagged>(items: T[]): Promise<T[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase || items.length === 0) return items

  const googleIds = [...new Set(items.filter(i => i.provider === 'google_places').map(i => i.id))]
  if (googleIds.length === 0) return items

  const { data } = await supabase
    .from('places')
    .select('external_id, tagging_meta')
    .in('external_id', googleIds)
    .in('provider', ['google', 'google_places'])

  const byExternal = new Map<string, PlaceTaggingMeta | undefined>()
  for (const row of data || []) {
    const r = row as { external_id?: string; tagging_meta?: unknown }
    const id = String(r.external_id || '')
    const meta =
      r.tagging_meta && typeof r.tagging_meta === 'object' ? (r.tagging_meta as PlaceTaggingMeta) : undefined
    if (id) byExternal.set(id, meta)
  }

  return items.map(item => {
    if (item.provider !== 'google_places') return item
    if (item.automatedSeedTags && item.automatedSeedTags.length > 0) return item
    const meta = byExternal.get(item.id)
    const tags = meta?.automated_seed?.tags
    if (!tags?.length) return item
    return {
      ...item,
      automatedSeedTags: tags.map(t => ({
        slug: t.slug,
        confidence_score: Number(t.confidence_score ?? 0),
        is_automated: t.is_automated !== false,
      })),
    }
  })
}
