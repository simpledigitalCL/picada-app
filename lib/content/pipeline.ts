import type { UnifiedContentPayload } from '@/lib/content/model'
import { slugSegment } from '@/lib/tags/slug'

export type ComputedContentValue = {
  qualityScore: number
  engagementScore: number
  completeness: number
  normalizedTags: string[]
  normalizedCategory: string
}

const TAG_ALIASES: Record<string, string> = {
  'low carb': 'low_carb',
  lowcarb: 'low_carb',
  low_carb: 'low_carb',
  keto: 'keto',
  vegano: 'vegano',
  vegan: 'vegano',
  'sin gluten': 'sin_gluten',
  glutenfree: 'sin_gluten',
  'smash burger': 'smash_burger',
  smashburger: 'smash_burger',
}

export function normalizeTags(tags: string[]): string[] {
  const out = new Set<string>()
  for (const raw of tags || []) {
    const base = slugSegment(String(raw))
    if (!base) continue
    const normalized = TAG_ALIASES[base.replace(/_/g, ' ')] || TAG_ALIASES[base] || base
    out.add(normalized)
  }
  return [...out]
}

export function validateContentPayload(input: UnifiedContentPayload): { ok: true } | { ok: false; error: string } {
  const hasMedia = Boolean(input.media?.url)
  const hasComment = Boolean((input.review?.comment || '').trim())
  const hasRating = Number(input.review?.rating || 0) > 0
  // new-picada: marcar un lugar como picada es contenido suficiente por sí solo
  const isNewPicada = input.entry === 'new-picada' && Boolean((input.place?.name || '').trim())
  if (!hasMedia && !hasComment && !hasRating && !isNewPicada) {
    return { ok: false, error: 'El contenido requiere al menos media, comentario o calificación' }
  }
  return { ok: true }
}

export function computeContentValue(input: UnifiedContentPayload): ComputedContentValue {
  const normalizedTags = normalizeTags(input.taxonomy?.tags || [])
  const hasMedia = Boolean(input.media?.url)
  const hasComment = Boolean((input.review?.comment || '').trim())
  const hasRating = Number(input.review?.rating || 0) > 0
  const hasPlace = Boolean((input.place?.name || '').trim())
  const hasCategory = Boolean((input.taxonomy?.category || '').trim())
  const hasMoods = (input.taxonomy?.moods || []).length > 0

  // Base + dimensiones (centralizado y reusable)
  let qualityScore = 5
  if (hasMedia) qualityScore += 5
  if (hasComment) qualityScore += 5
  if (hasRating) qualityScore += 3
  if (hasPlace) qualityScore += 3
  if (hasCategory) qualityScore += 2
  if (hasMoods) qualityScore += 1

  // Regla tags solicitada
  qualityScore += normalizedTags.length
  if (normalizedTags.length >= 3) qualityScore += 2

  const fields = [hasMedia, hasComment, hasRating, hasPlace, hasCategory, normalizedTags.length > 0, hasMoods]
  const baseCompleteness = (fields.filter(Boolean).length / fields.length) * 100
  const commentLength = (input.review?.comment || '').trim().length
  const qualityBonus = Math.min(20, Math.max(0, (commentLength / 280) * 20))
  const shortCommentPenalty = hasComment && commentLength < 12 ? 8 : 0
  const completeness = Math.round(Math.max(0, Math.min(100, baseCompleteness + qualityBonus - shortCommentPenalty)))
  if (hasComment && commentLength < 8) qualityScore = Math.max(0, qualityScore - 2)

  return {
    qualityScore,
    engagementScore: 0,
    completeness,
    normalizedTags,
    normalizedCategory: slugSegment(input.taxonomy?.category || '') || 'experiencia',
  }
}

