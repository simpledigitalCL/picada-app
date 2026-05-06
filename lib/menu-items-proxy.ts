import type { UnifiedContentPayload } from '@/lib/content-model'

type LegacyMenuItemPayload = {
  place_name?: string
  item_name?: string
  rating?: number
  review_text?: string
  photo_url?: string | null
  metadata?: Record<string, unknown>
}

export function menuItemToUnifiedPayload(input: LegacyMenuItemPayload): UnifiedContentPayload {
  const userId = String(input.metadata?.user_id || 'legacy-anon')
  const username = String(input.metadata?.display_name || 'legacy_user')
  const tags = Array.isArray(input.metadata?.tags) ? input.metadata?.tags : []
  const moods = Array.isArray(input.metadata?.moods) ? input.metadata?.moods : []
  const category = String(input.metadata?.category || 'experiencia')
  const inferredEntry = input.photo_url ? 'media' : 'review'
  const entry = String(input.metadata?.from_form || inferredEntry) as UnifiedContentPayload['entry']

  return {
    entry: entry === 'new-picada' || entry === 'incognito' || entry === 'media' || entry === 'review' ? entry : 'review',
    user: {
      id: userId,
      username,
    },
    place: {
      name: input.place_name || null,
      address: String(input.metadata?.place_address || '') || null,
      id: String(input.metadata?.place_id || '') || null,
    },
    media: {
      url: input.photo_url || null,
      kind: input.photo_url ? 'photo' : null,
    },
    review: {
      comment: input.review_text || null,
      rating: Number(input.rating || 0) || null,
      isIncognito: Boolean(input.metadata?.is_incognito),
      markAsPicada: Boolean(input.metadata?.mark_as_picada),
    },
    taxonomy: {
      category,
      tags: tags.map(String),
      moods: moods.map(String),
    },
    meta: {
      schema_version: 'v1',
      proxied_from_menu_items: true,
      ...input.metadata,
    },
  }
}

