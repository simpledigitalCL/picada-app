import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnifiedContentPayload } from '@/lib/content-model'
import { computeContentValue, validateContentPayload } from '@/lib/content-pipeline'
import { buildMergedPlaceClassification } from '@/lib/merge-automated-place-tags'
import type { PlaceTaggingMeta } from '@/lib/place-tagging-types'
import { ingestTagRelationStats } from '@/lib/server/tag-relations'
import { sanitizeUserText } from '@/lib/sanitize'

function normalizeUuid(input?: string | null): string | null {
  const value = String(input || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function normalizeCategory(input?: string | null): 'review' | 'photo' | 'video' | 'incognito' | 'tip' {
  const value = (input || '').toLowerCase()
  if (value === 'video') return 'video'
  if (value === 'photo' || value === 'media') return 'photo'
  if (value === 'incognito') return 'incognito'
  if (value === 'tip') return 'tip'
  return 'review'
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs.map(x => String(x || '').trim().toLowerCase()).filter(Boolean))]
}

function bumpTagSignals(
  prev: Record<string, { upvotes: number; downvotes: number; last_feedback_at: string }> | undefined,
  tags: string[],
  deltaUp: number,
) {
  const out: Record<string, { upvotes: number; downvotes: number; last_feedback_at: string }> = { ...(prev || {}) }
  const now = new Date().toISOString()
  for (const slugRaw of tags) {
    const slug = String(slugRaw || '').trim().toLowerCase()
    if (!slug) continue
    const cur = out[slug] || { upvotes: 0, downvotes: 0, last_feedback_at: now }
    out[slug] = {
      upvotes: cur.upvotes + deltaUp,
      downvotes: cur.downvotes,
      last_feedback_at: now,
    }
  }
  return out
}

function extractReviews(raw: Record<string, unknown> | undefined | null): string[] | undefined {
  const s = raw?.review_snippets
  if (!Array.isArray(s)) return undefined
  return s.filter((x): x is string => typeof x === 'string')
}

function extractGoogleTypes(raw: Record<string, unknown> | undefined | null): string[] | undefined {
  const g = raw?.google_types
  if (Array.isArray(g)) return g.map(String)
  const base = raw?.base as { types?: string[] } | undefined
  return Array.isArray(base?.types) ? base.types.map(String) : undefined
}

function extractEditorial(raw: Record<string, unknown> | undefined | null): string | null {
  const sn = raw?.editorial_snippet
  if (typeof sn === 'string') return sn
  const ov = raw?.editorial_summary as { overview?: string } | undefined
  return ov?.overview ?? null
}

async function updatePlaceClassificationFromCommunityTags(
  supabase: SupabaseClient,
  input: { placeId?: string | null; placeName?: string | null; tags: string[] },
) {
  const tags = uniq(input.tags || [])
  if (!tags.length) return

  const byExternalId = String(input.placeId || '').replace(/^ext-/, '').trim()
  const byName = String(input.placeName || '').trim()
  const rows: Array<{
    id: string
    name: string | null
    address: string | null
    tagging_meta: unknown
    source_types: unknown
    raw_payload: unknown
  }> = []

  if (byExternalId) {
    const { data } = await supabase
      .from('places')
      .select('id, name, address, tagging_meta, source_types, raw_payload')
      .eq('external_id', byExternalId)
      .limit(3)
    for (const row of data || []) rows.push(row as typeof rows[number])
  }

  if (rows.length === 0 && byName) {
    const { data } = await supabase
      .from('places')
      .select('id, name, address, tagging_meta, source_types, raw_payload')
      .ilike('name', byName)
      .limit(3)
    for (const row of data || []) rows.push(row as typeof rows[number])
  }

  const dedup = new Map<string, typeof rows[number]>()
  for (const r of rows) dedup.set(r.id, r)

  for (const row of dedup.values()) {
    try {
      const metaPrev =
        row.tagging_meta && typeof row.tagging_meta === 'object'
          ? (row.tagging_meta as PlaceTaggingMeta)
          : ({ seed_version: 1 } as PlaceTaggingMeta)

      const comm = metaPrev.community || { manual_slugs: [], confirmed_automated: [], rejected_automated: [] }
      const manual = uniq([...(comm.manual_slugs || []), ...tags])
      const confirmed = uniq(comm.confirmed_automated || [])
      const rejected = uniq(comm.rejected_automated || []).filter(s => !tags.includes(s))
      const signals = bumpTagSignals(comm.tag_signals, tags, 0.35)

      const rp = row.raw_payload && typeof row.raw_payload === 'object' ? (row.raw_payload as Record<string, unknown>) : {}
      const rebuilt = buildMergedPlaceClassification({
        existingTaggingMeta: {
          ...metaPrev,
          community: {
            manual_slugs: manual,
            confirmed_automated: confirmed,
            rejected_automated: rejected,
            tag_signals: signals,
          },
        },
        existingSourceTypes: row.source_types,
        name: String(row.name || ''),
        address: String(row.address || ''),
        reviewsText: extractReviews(rp),
        googleTypes: extractGoogleTypes(rp),
        editorialSummary: extractEditorial(rp),
      })

      await supabase
        .from('places')
        .update({
          tagging_meta: rebuilt.tagging_meta as unknown as Record<string, unknown>,
          nutrition_categories: rebuilt.nutrition_categories,
          restrictions_supported: rebuilt.restrictions_supported,
          cuisines: rebuilt.cuisines,
          experiences: rebuilt.experiences,
          source_types: rebuilt.source_types,
        })
        .eq('id', row.id)
    } catch {
      // non-critical
    }
  }
}

export async function persistUnifiedContent(supabase: SupabaseClient, body: UnifiedContentPayload) {
  const validation = validateContentPayload(body)
  if (!validation.ok) {
    return { ok: false as const, status: 400, error: validation.error }
  }

  const computed = computeContentValue(body)
  const userId = normalizeUuid(body.user?.id)
  if (!userId) {
    return { ok: false as const, status: 400, error: 'invalid_user_id' }
  }
  const username = String(body.user?.username || '').trim() || 'foodie'
  const placeName = sanitizeUserText(body.place?.name || '').trim()
  const comment = sanitizeUserText(body.review?.comment || '').trim()
  const placeAddressSanitized = sanitizeUserText(body.place?.address || '').trim()
  const rating = Number(body.review?.rating || 0) || null
  const mediaUrl = body.media?.url || null
  const mediaKind = body.media?.kind || null
  const isIncognito = Boolean(body.review?.isIncognito)
  const contentType = normalizeCategory(
    mediaKind === 'video' ? 'video' : mediaUrl ? 'photo' : isIncognito ? 'incognito' : 'review',
  )
  const entryType = body.entry
  const normalizedCategory = computed.normalizedCategory
  const normalizedTags = computed.normalizedTags
  const moods = body.taxonomy?.moods || []
  const placeId = normalizeUuid(body.place?.id) || null
  const placeAddress = placeAddressSanitized || null
  const backgroundTasks: Promise<unknown>[] = []

  const { data: insertedPost, error: postsError } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      type: contentType,
      content: comment || null,
      rating,
      mood_tags: body.taxonomy?.moods || [],
      place_name: placeName || null,
      is_incognito: isIncognito,
      nutrition_data: {
        schema_version: String(body.meta?.schema_version || 'v1'),
        quality_score: computed.qualityScore,
        engagement_score: computed.engagementScore,
        completeness: computed.completeness,
        normalized_tags: computed.normalizedTags,
        normalized_category: computed.normalizedCategory,
        original_payload: body,
      },
    })
    .select('id')
    .single()
  if (postsError) {
    return { ok: false as const, status: 500, error: postsError.message || 'posts_insert_failed' }
  }

  // Secundario no bloqueante.
  if (placeName && (comment || mediaUrl || rating)) {
    backgroundTasks.push(
      supabase.from('menu_items').insert({
        place_name: placeName.trim(),
        item_name: body.entry === 'new-picada' ? 'Nueva picada' : 'Aporte comunidad',
        rating,
        review_text: comment,
        photo_url: mediaUrl,
        show_nutrition: false,
        source: 'community',
        is_official: false,
        metadata: {
          from_unified_form: true,
          schema_version: String(body.meta?.schema_version || 'v1'),
          entry: body.entry,
          category: computed.normalizedCategory,
          tags: computed.normalizedTags,
          quality_score: computed.qualityScore,
          engagement_score: computed.engagementScore,
          completeness: computed.completeness,
          mark_as_picada: Boolean(body.review?.markAsPicada),
          ...(body.meta || {}),
        },
      }).catch(() => undefined),
    )
  }

  // Registro analítico centralizado no bloqueante.
  backgroundTasks.push(
    supabase.from('content_submissions').insert({
      user_id: userId || null,
      username: username || null,
      entry_type: entryType,
      content_type: contentType,
      is_incognito: isIncognito,
      has_media: Boolean(mediaUrl),
      media_kind: mediaKind || null,
      has_comment: Boolean(comment),
      comment_length: comment.length,
      rating,
      place_id: placeId,
      place_name: placeName || null,
      place_address: placeAddress,
      category: normalizedCategory,
      tags: normalizedTags,
      moods,
      quality_score: computed.qualityScore,
      engagement_score: computed.engagementScore,
      completeness: computed.completeness,
      payload: body,
      computed: {
        normalized_tags: normalizedTags,
        normalized_category: normalizedCategory,
      },
    }).catch(() => undefined),
  )

  backgroundTasks.push(
    supabase.from('domain_events').insert({
      event_type: 'CONTENT_CREATED',
      user_id: userId,
      username,
      event_at: new Date().toISOString(),
      payload: {
        userId,
        username,
        placeId,
        placeName: placeName || null,
        placeAddress,
        entryType,
        hasMedia: Boolean(mediaUrl),
        hasRating: Boolean(rating),
        hasTags: normalizedTags.length > 0,
        quality_score: computed.qualityScore,
        engagement_score: computed.engagementScore,
        completeness: computed.completeness,
        tags: normalizedTags,
      },
    }).catch(() => undefined),
  )

  backgroundTasks.push(ingestTagRelationStats(supabase, normalizedTags, userId).catch(() => undefined))

  backgroundTasks.push(
    updatePlaceClassificationFromCommunityTags(supabase, {
      placeId: placeId ? String(placeId) : null,
      placeName,
      tags: normalizedTags,
    }).catch(() => undefined),
  )

  return {
    ok: true as const,
    value: {
      post_id: String((insertedPost as { id?: string } | null)?.id || ''),
      quality_score: computed.qualityScore,
      engagement_score: computed.engagementScore,
      completeness: computed.completeness,
      tags: computed.normalizedTags,
    },
    backgroundTasks,
  }
}

