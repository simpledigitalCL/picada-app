import { enrichPlaceText } from '@/lib/places/enrichment'
import { inferAutomatedSeedTags } from '@/lib/places/auto-tagging'
import type { AutomatedTagSeed, PlaceTaggingMeta } from '@/lib/tags/types'
import { PLACE_AUTOMATED_SEED_VERSION } from '@/lib/tags/types'

export function stripBotSourceTypeLines(sourceTypes: unknown): string[] {
  const list = Array.isArray(sourceTypes) ? (sourceTypes as string[]) : []
  return list.filter(
    line =>
      typeof line === 'string' &&
      !line.startsWith('automated:v1:') &&
      !line.startsWith('inferred:'),
  )
}

export function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

export function facetsFromCanonicalSlugs(slugs: string[]) {
  const nutrition = new Set<string>()
  const cuisines = new Set<string>()
  const restrictions = new Set<string>()
  const experiences = new Set<string>()

  for (let s of slugs) {
    s = String(s || '').toLowerCase()
    if (s.includes('vegan')) nutrition.add('vegano')
    if (s.includes('_gluten') || s.includes('sin_gluten')) {
      nutrition.add('sin_gluten')
      restrictions.add('sin_gluten')
    }
    if (s.includes('lactosa')) {
      nutrition.add('sin_lactosa')
      restrictions.add('sin_lactosa')
    }
    if (s.includes('keto')) nutrition.add('keto')
    if (s.includes('sushi') || s.includes('_sushi'))
      cuisines.add('japonesa')
    if (s.includes('tipo_plato_pizza')) cuisines.add('italiana')
    if (s.includes('cuisine_mexicana')) cuisines.add('mexicana')
    if (s.includes('picada_tipica')) cuisines.add('chilena')
    if (s.includes('cafe')) nutrition.add('cafe')
    if (s.includes('_rapida') || s.includes('_parrilla')) {
      cuisines.add('chilena')
    }
    if (s.includes('ambience_romantic') || s.includes('ambience_romantico')) experiences.add('romantico')
    if (s.includes('ambience_chill')) experiences.add('chill')
    if (s.includes('ambience_familiar')) experiences.add('familiar')
    if (s.includes('ambience_dimly_lit') || s.includes('dimly')) experiences.add('dimly_lit')
    if (s.includes('ambience_ruidoso') || s.includes('ruidoso')) experiences.add('ruidoso')
    if (s.includes('service_excelente_atencion')) experiences.add('servicio_destacado')
    if (s.includes('service_piscina') || s.includes('piscina')) experiences.add('piscina')
    if (s.includes('service_pet_friendly') || s.includes('pet_friendly') || s.includes('mascotas'))
      experiences.add('pet_friendly')
    if (s.includes('service_estacionamiento') || s.includes('estacionamiento') || s.includes('parking'))
      experiences.add('estacionamiento')
  }

  return { nutrition_categories: [...nutrition], cuisines: [...cuisines], restrictions_supported: [...restrictions], experiences: [...experiences] }
}

function parseCommunityMeta(meta: PlaceTaggingMeta | undefined | null): NonNullable<PlaceTaggingMeta['community']> {
  const base = meta?.community
  const signalsRaw = (base?.tag_signals && typeof base.tag_signals === 'object') ? base.tag_signals : {}
  const tag_signals: Record<string, { upvotes: number; downvotes: number; last_feedback_at: string }> = {}
  for (const [rawSlug, rawSignal] of Object.entries(signalsRaw || {})) {
    const slug = String(rawSlug || '').trim().toLowerCase()
    if (!slug) continue
    const sig = rawSignal as { upvotes?: unknown; downvotes?: unknown; last_feedback_at?: unknown }
    const up = Math.max(0, Number(sig?.upvotes || 0))
    const down = Math.max(0, Number(sig?.downvotes || 0))
    const last = String(sig?.last_feedback_at || '').trim() || new Date().toISOString()
    tag_signals[slug] = { upvotes: up, downvotes: down, last_feedback_at: last }
  }
  return {
    manual_slugs: uniq((base?.manual_slugs || []).map(s => String(s).trim().toLowerCase()).filter(Boolean)),
    confirmed_automated: uniq((base?.confirmed_automated || []).map(String).map(s => s.toLowerCase())),
    rejected_automated: uniq((base?.rejected_automated || []).map(String).map(s => s.toLowerCase())),
    tag_signals,
  }
}

function supportWithDecay(signal?: { upvotes: number; downvotes: number; last_feedback_at: string }): number {
  if (!signal) return 0
  const ageMs = Math.max(0, Date.now() - new Date(signal.last_feedback_at).getTime())
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const decay = Math.exp(-ageDays / 45) // ~45d half-life suave
  return (signal.upvotes - signal.downvotes) * decay
}

export function buildMergedPlaceClassification(args: {
  existingTaggingMeta?: PlaceTaggingMeta | null
  existingSourceTypes?: unknown
  name: string
  address: string
  reviewsText?: string[]
  googleTypes?: string[]
  editorialSummary?: string | null
}) {
  const comm = parseCommunityMeta(args.existingTaggingMeta ?? null)
  const rejected = new Set(comm.rejected_automated)
  const confirmed = new Set(comm.confirmed_automated)

  const corpus = `${args.name}\n${args.address}\n${(args.reviewsText || []).join('\n')}`
  const enrichment = enrichPlaceText(corpus)

  const inferred = inferAutomatedSeedTags({
    name: args.name,
    google_types: args.googleTypes,
    editorial_summary: args.editorialSummary,
    reviews: args.reviewsText,
  }).filter(s => !rejected.has(s.slug.toLowerCase()))

  const seeded: AutomatedTagSeed[] = inferred.map(s => ({
    ...s,
    confidence_score:
      confirmed.has(s.slug.toLowerCase()) ? Math.min(0.99, s.confidence_score + 0.1) : s.confidence_score,
  }))

  const seenSeed = new Set(seeded.map(s => s.slug.toLowerCase()))
  for (const raw of comm.manual_slugs) {
    const m = raw.toLowerCase()
    if (seenSeed.has(m)) continue
    const score = supportWithDecay(comm.tag_signals?.[m])
    const hasStrongCommunityEvidence = score >= 1
    const wasExplicitlyConfirmed = confirmed.has(m)
    if (!hasStrongCommunityEvidence && !wasExplicitlyConfirmed) continue
    const confidence = wasExplicitlyConfirmed
      ? Math.min(0.86, Math.max(0.62, 0.72 + score * 0.06))
      : Math.min(0.78, Math.max(0.52, 0.56 + score * 0.08))
    seeded.push({
      slug: raw,
      confidence_score: confidence,
      is_automated: false,
      provenance: 'name_types',
    })
    seenSeed.add(m)
  }

  const facets = facetsFromCanonicalSlugs(seeded.map(s => s.slug))

  const tagging_meta: PlaceTaggingMeta = {
    seed_version: PLACE_AUTOMATED_SEED_VERSION,
    automated_seed: {
      generated_at: new Date().toISOString(),
      weights_applied: { name_types_editorial: 3, reviews: 1 },
      tags: seeded,
    },
    community: comm,
  }

  const prevPreserved = stripBotSourceTypeLines(args.existingSourceTypes).filter(line => !line.startsWith('manual:user:'))
  const autoLines = seeded
    .filter(s => s.is_automated)
    .map(seed => `automated:v1:${seed.slug}:${Math.round(seed.confidence_score * 100)}`)
  const manualLines = seeded
    .filter(s => !s.is_automated)
    .map(seed => `manual:user:${seed.slug}:${Math.round(seed.confidence_score * 100)}`)

  return {
    tagging_meta,
    nutrition_categories: uniq([...enrichment.nutrition_categories, ...facets.nutrition_categories]),
    restrictions_supported: uniq([...enrichment.restrictions_supported, ...facets.restrictions_supported]),
    cuisines: uniq([...enrichment.cuisines, ...facets.cuisines]),
    experiences: uniq(facets.experiences),
    source_types: uniq([...prevPreserved, ...autoLines, ...manualLines]),
  }
}
