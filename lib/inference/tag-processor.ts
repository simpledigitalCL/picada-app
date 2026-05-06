import { getSupabaseServerClient } from '@/lib/supabase-server'
import { coerceFormTagSlug } from '@/lib/tags/slug'
import { PLACE_AUTOMATED_SEED_VERSION, type PlaceTaggingMeta } from '@/lib/tags/types'
import { repairMissingGeoInPlaces } from '@/lib/utils/geo-repair'

type InferenceAuditItem = {
  slug: string
  source: 'inference'
  confidence: number
  matched_terms: string[]
  created_at: string
}

type SemanticRule = {
  tag: string
  keywords: string[]
}

type PlaceLikeRow = {
  id: string
  address?: string | null
  name?: string | null
  city?: string | null
  commune?: string | null
  raw_payload?: unknown
  editorial_summary?: unknown
  reviews?: unknown
  tagging_meta?: unknown
  source_types?: unknown
}

const DEFAULT_CONFIDENCE = 0.5

/**
 * Diccionario semántico "palabra clave -> tag taxonomía".
 * Mantener slugs canónicos por prefijo: ambience_, attr_, local_, food_, service_.
 */
export const SEMANTIC_DICTIONARY: SemanticRule[] = [
  { tag: 'ambience_tranquilo', keywords: ['tranquilo', 'silencio', 'leer', 'calmado', 'relajado'] },
  { tag: 'ambience_romantico', keywords: ['romantico', 'romántico', 'velas', 'pareja', 'cita'] },
  { tag: 'ambience_ruidoso', keywords: ['ruido', 'ruidoso', 'musica fuerte', 'música fuerte', 'caos'] },
  { tag: 'attr_vegano', keywords: ['vegano', 'vegan', 'plant based', 'legumbres'] },
  { tag: 'attr_barato', keywords: ['barato', 'precio bajo', 'economico', 'económico'] },
  { tag: 'attr_enchufes', keywords: ['enchufes', 'laptop', 'trabajar', 'cowork'] },
  { tag: 'attr_wifi', keywords: ['wifi', 'wi-fi', 'internet'] },
  { tag: 'local_cafe_cafeteria', keywords: ['cafeteria', 'cafetería', 'cafe', 'café frío', 'cold brew'] },
  { tag: 'service_pet_friendly', keywords: ['pet friendly', 'mascotas', 'perros'] },
]

function normalizeText(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function asMeta(value: unknown): PlaceTaggingMeta {
  if (!value || typeof value !== 'object') {
    return { seed_version: PLACE_AUTOMATED_SEED_VERSION }
  }
  const base = value as PlaceTaggingMeta
  return {
    seed_version: Number(base.seed_version || PLACE_AUTOMATED_SEED_VERSION),
    automated_seed: base.automated_seed,
    community: base.community,
  }
}

function extractEditorialSummary(row: PlaceLikeRow): string {
  const direct = row.editorial_summary
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const raw = (row.raw_payload && typeof row.raw_payload === 'object') ? (row.raw_payload as Record<string, unknown>) : {}
  const fromObj = raw.editorial_summary
  if (typeof fromObj === 'string' && fromObj.trim()) return fromObj.trim()
  if (fromObj && typeof fromObj === 'object') {
    const overview = (fromObj as { overview?: unknown }).overview
    if (typeof overview === 'string' && overview.trim()) return overview.trim()
  }
  return ''
}

function extractReviews(row: PlaceLikeRow): string[] {
  const direct = Array.isArray(row.reviews) ? row.reviews : []
  const raw = (row.raw_payload && typeof row.raw_payload === 'object') ? (row.raw_payload as Record<string, unknown>) : {}
  const fromRaw = Array.isArray(raw.reviews) ? raw.reviews : []
  const snippets = Array.isArray(raw.review_snippets) ? raw.review_snippets : []
  const all = [...direct, ...fromRaw, ...snippets]
  const out: string[] = []
  for (const item of all) {
    if (typeof item === 'string' && item.trim()) out.push(item.trim())
    else if (item && typeof item === 'object') {
      const txt = (item as { text?: unknown }).text
      if (typeof txt === 'string' && txt.trim()) out.push(txt.trim())
    }
    if (out.length >= 8) break
  }
  return out
}

export function inferTagsFromSemanticSignals(input: {
  editorial_summary?: string
  reviews?: string[]
  dictionary?: SemanticRule[]
}) {
  const dict = input.dictionary || SEMANTIC_DICTIONARY
  const corpus = normalizeText([input.editorial_summary || '', ...(input.reviews || [])].join('\n'))
  const found = new Map<string, Set<string>>()

  for (const rule of dict) {
    const canonical = coerceFormTagSlug(rule.tag)
    if (!canonical) continue
    for (const kw of rule.keywords) {
      const term = normalizeText(kw)
      if (!term) continue
      if (corpus.includes(term)) {
        if (!found.has(canonical)) found.set(canonical, new Set())
        found.get(canonical)!.add(term)
      }
    }
  }

  return [...found.entries()].map(([slug, terms]) => ({
    slug,
    matched_terms: [...terms],
    confidence: DEFAULT_CONFIDENCE,
  }))
}

async function resolveTargetTable() {
  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('supabase_not_configured')
  return { supabase, table: 'places' as const }
}

/**
 * Batch por ciudad para locales que hoy no tienen tags automáticos.
 * Ejecuta update de `tagging_meta` + `source_types` con fuente inference.
 */
export async function runCityInferenceBatch(options: {
  city: string
  batchSize?: number
  dryRun?: boolean
}) {
  const city = String(options?.city || '').trim()
  if (!city) throw new Error('city_required')
  const batchSize = Math.max(1, Math.min(500, Number(options?.batchSize || 200)))
  const dryRun = Boolean(options?.dryRun)
  console.info(`Procesando ${city}...`)

  // Limpieza geográfica previa para maximizar cobertura por ciudad/comuna.
  await repairMissingGeoInPlaces({ batchSize: 1000, cityHint: city, dryRun })

  const { supabase, table } = await resolveTargetTable()
  const { data, error } = await supabase
    .from(table)
    .select('id, name, address, city, commune, raw_payload, tagging_meta, source_types')
    .or(`city.ilike.%${city}%,commune.ilike.%${city}%,address.ilike.%${city}%`)
    .limit(batchSize)

  if (error) throw error
  const rows = (data || []) as PlaceLikeRow[]

  let scanned = 0
  let updated = 0
  const updatedIds: string[] = []

  for (const row of rows) {
    scanned += 1
    const meta = asMeta(row.tagging_meta)
    const prevTags = meta.automated_seed?.tags || []
    if (prevTags.length > 0) continue

    const inferred = inferTagsFromSemanticSignals({
      editorial_summary: extractEditorialSummary(row),
      reviews: extractReviews(row),
    })
    if (inferred.length === 0) continue

    const now = new Date().toISOString()
    const newSeedTags = inferred.map(i => ({
      slug: i.slug,
      confidence_score: i.confidence,
      is_automated: true,
      provenance: 'reviews' as const,
      metadata: { source: 'inference', confidence: i.confidence, matched_terms: i.matched_terms },
    }))

    const tagging_meta = {
      ...meta,
      seed_version: PLACE_AUTOMATED_SEED_VERSION,
      automated_seed: {
        generated_at: now,
        weights_applied: { name_types_editorial: 1, reviews: 1 },
        tags: newSeedTags,
      },
      inference_audit: newSeedTags.map((t): InferenceAuditItem => ({
        slug: t.slug,
        source: 'inference',
        confidence: t.confidence_score,
        matched_terms: (t.metadata?.matched_terms || []) as string[],
        created_at: now,
      })),
    }

    const sourceTypes = Array.isArray(row.source_types) ? row.source_types.filter(x => typeof x === 'string') as string[] : []
    const inferredSourceTypes = newSeedTags.map(t => `inferred:inference:${t.slug}:50`)
    const mergedSourceTypes = [...new Set([...sourceTypes, ...inferredSourceTypes])]

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from(table)
        .update({
          tagging_meta: tagging_meta as unknown as Record<string, unknown>,
          source_types: mergedSourceTypes,
        })
        .eq('id', row.id)
      if (updateError) throw updateError
    }

    updated += 1
    updatedIds.push(row.id)
  }

  return { ok: true, table, city, dryRun, scanned, updated, updatedIds }
}

