import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { placeTextMatchesLocation } from '@/lib/location/query-match'
import { proxifyPhotoUrl } from '@/lib/utils/photo-url'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function stripExtPrefix(id: string): string {
  return id.replace(/^ext-/, '')
}

type PicadaRankRow = {
  picada_id: string
  community_votes: number
  visits_count: number
  reviews_count: number
  ranking_score: number
  place_name?: string
  place_address?: string
  photo_url?: string | null
  maps_url?: string
  quality_score?: number
  engagement_score?: number
  recency_boost?: number
  final_score?: number
  trend_label?: 'trending' | 'rising' | 'top_week'
  confidence_score?: number
  debug?: {
    final_score: number
    components: {
      quality_score: number
      engagement_score: number
      recency_boost: number
    }
    normalized: {
      quality: number
      engagement: number
      recency: number
    }
    weights_applied: {
      quality: number
      engagement: number
      recency: number
    }
    trend_label: 'trending' | 'rising' | 'top_week'
    reasoning: string
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get('limit') || '100')))
  const location = (url.searchParams.get('location') || '').trim()
  const debugRequested = url.searchParams.get('debug') === '1'
  const internalHeader = req.headers.get('x-internal-role') === 'internal'
  const allowDebug = debugRequested && (process.env.NODE_ENV !== 'production' || internalHeader)

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: true, items: [] as PicadaRankRow[] })
  }

  const { data, error } = await supabase
    .from('picada_event_ranking')
    .select('picada_id,community_votes,visits_count,reviews_count,ranking_score')
    .order('ranking_score', { ascending: false })
    .limit(Math.max(limit * 2, 200))

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // ── Resolución canónica contra `places` ────────────────────────────────────
  // Cada fila de `picada_event_ranking` viene identificada por whatever id se
  // emitió en los domain_events (UUID interno, external_id de Google, o un id
  // con prefijo `ext-…`). Sin resolver, el mismo lugar aparece varias veces en
  // el ranking (cada id acumula su propio score) y los clientes no pueden
  // deduplicar contra los items de discover (que vienen indexados por
  // external_id). Resolvemos todo a la entidad canónica en `places` para:
  //   1. agregar votos/visitas/reseñas del mismo place bajo una sola entrada,
  //   2. devolver el external_id canónico como `picada_id` (matchea discover),
  //   3. exponer la foto desde `gallery[0]` para podios y tarjetas.
  const rawRows = (data || []) as PicadaRankRow[]
  const rawIds = Array.from(new Set(rawRows.map(r => r.picada_id).filter(Boolean)))
  const uuidCandidates = rawIds.filter(id => UUID_RE.test(id))
  const externalCandidates = Array.from(
    new Set(rawIds.map(stripExtPrefix).filter(id => id && !UUID_RE.test(id))),
  )

  type PlaceRow = {
    id: string
    external_id: string | null
    name: string | null
    address: string | null
    maps_url: string | null
    gallery: unknown
  }

  const placeRows: PlaceRow[] = []
  if (uuidCandidates.length > 0) {
    const { data: byId } = await supabase
      .from('places')
      .select('id,external_id,name,address,maps_url,gallery')
      .in('id', uuidCandidates)
    if (byId) placeRows.push(...(byId as PlaceRow[]))
  }
  if (externalCandidates.length > 0) {
    const { data: byExt } = await supabase
      .from('places')
      .select('id,external_id,name,address,maps_url,gallery')
      .in('external_id', externalCandidates)
    if (byExt) placeRows.push(...(byExt as PlaceRow[]))
  }

  const placeByUuid = new Map<string, PlaceRow>()
  const placeByExternal = new Map<string, PlaceRow>()
  for (const row of placeRows) {
    placeByUuid.set(row.id, row)
    if (row.external_id) placeByExternal.set(row.external_id, row)
  }

  function firstGalleryUrl(gallery: unknown): string | null {
    if (!Array.isArray(gallery) || gallery.length === 0) return null
    const first = gallery[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && typeof (first as { url?: string }).url === 'string') {
      return (first as { url: string }).url
    }
    return null
  }

  function resolveCanonical(rawId: string): {
    canonicalId: string
    placeRow: PlaceRow | null
  } {
    const stripped = stripExtPrefix(rawId)
    if (UUID_RE.test(rawId)) {
      const row = placeByUuid.get(rawId) || null
      return { canonicalId: row?.external_id || rawId, placeRow: row }
    }
    const row = placeByExternal.get(stripped) || null
    return { canonicalId: row?.external_id || stripped, placeRow: row }
  }

  // Enriquecimiento opcional con metadata desde últimos eventos.
  const { data: eventRows } = await supabase
    .from('domain_events')
    .select('payload,event_at')
    .in('event_type', ['CONTENT_CREATED', 'USER_VOTED', 'USER_VISITED', 'USER_SAVED', 'USER_REVIEWED'])
    .order('event_at', { ascending: false })
    .limit(Math.max(800, limit * 12))

  const metaById: Record<string, { place_name?: string; place_address?: string; maps_url?: string; created_at?: string }> = {}
  const qualityById: Record<string, number[]> = {}
  const engagementById: Record<string, number> = {}

  const now = Date.now()

  for (const row of eventRows || []) {
    const payload = (row.payload || {}) as Record<string, unknown>
    const rawId = String(payload.picadaId || payload.placeId || '').trim()
    if (!rawId) continue
    // Normalizamos al mismo id canónico que usamos para `rawRows` para que
    // quality/engagement/meta queden agregados bajo la entidad única.
    const id = resolveCanonical(rawId).canonicalId

    if (!metaById[id]) {
      metaById[id] = {
        place_name: String(payload.placeName || '').trim() || undefined,
        place_address: String(payload.placeAddress || '').trim() || undefined,
        maps_url: String(payload.mapsUrl || '').trim() || undefined,
        created_at: row.event_at,
      }
    }

    const quality = Number(payload.quality_score || 0)
    if (quality > 0) {
      const list = qualityById[id] || []
      list.push(Math.max(0, Math.min(100, quality)))
      qualityById[id] = list
    }

    let eng = 0
    if (payload.voted === true) eng += 1
    if (payload.saved === true) eng += 3
    if (payload.placeId || payload.placeName) eng += 2
    if (payload.entryType) eng += 5
    engagementById[id] = (engagementById[id] || 0) + eng
  }

  // Agregamos filas de `picada_event_ranking` que mapean al mismo place
  // canónico — sumando contadores y quedándonos con el mejor ranking_score.
  type AggregatedRow = PicadaRankRow & { placeRow: PlaceRow | null }
  const aggregated = new Map<string, AggregatedRow>()
  for (const row of rawRows) {
    const { canonicalId, placeRow } = resolveCanonical(row.picada_id)
    const prev = aggregated.get(canonicalId)
    if (prev) {
      prev.community_votes = (prev.community_votes || 0) + (row.community_votes || 0)
      prev.visits_count = (prev.visits_count || 0) + (row.visits_count || 0)
      prev.reviews_count = (prev.reviews_count || 0) + (row.reviews_count || 0)
      prev.ranking_score = Math.max(prev.ranking_score || 0, row.ranking_score || 0)
    } else {
      aggregated.set(canonicalId, {
        ...row,
        picada_id: canonicalId,
        placeRow,
      })
    }
  }

  const scored = Array.from(aggregated.values()).map(row => {
    const meta = metaById[row.picada_id] || {}
    const place = row.placeRow
    const qualityList = qualityById[row.picada_id] || []
    const qualityScore = qualityList.length > 0
      ? qualityList.reduce((acc, n) => acc + n, 0) / qualityList.length
      : Math.min(100, ((row.reviews_count || 0) * 2) + ((row.community_votes || 0) * 3))

    const rawEngagement = (engagementById[row.picada_id] || 0) + (row.community_votes || 0) + ((row.visits_count || 0) * 2)
    const engagementBase = Math.min(100, Math.log10(rawEngagement + 1) * 40)
    const engagementScore = rawEngagement < 5 ? engagementBase * 0.75 : engagementBase

    const createdAt = meta.created_at ? new Date(meta.created_at).getTime() : now - (1000 * 60 * 60 * 24 * 30)
    const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60))
    const recencyBoost = ageHours <= 24 ? 18 : ageHours <= (24 * 7) ? 9 : 0

    const finalScore = (qualityScore * 0.6) + (engagementScore * 0.3) + (recencyBoost * 0.1)
    const confidenceScore = Math.min(100, Math.round((Math.min(1, (qualityList.length / 4)) * 60) + (Math.min(1, (rawEngagement / 20)) * 40)))
    const trendLabel: 'trending' | 'rising' | 'top_week' =
      recencyBoost >= 9 && engagementScore >= 18 ? 'rising' : 'trending'
    const reasoning =
      qualityScore >= 70 && engagementScore < 25
        ? 'alto quality_score, bajo engagement'
        : recencyBoost >= 9 && engagementScore >= 20
          ? 'contenido reciente con crecimiento rápido'
          : engagementScore >= 35 && qualityScore < 60
            ? 'alto engagement pero calidad media'
            : 'balance entre calidad, engagement y recencia'

    return {
      picada_id: row.picada_id,
      community_votes: row.community_votes,
      visits_count: row.visits_count,
      reviews_count: row.reviews_count,
      ranking_score: row.ranking_score,
      place_name: place?.name || meta.place_name,
      place_address: place?.address || meta.place_address,
      maps_url: place?.maps_url || meta.maps_url,
      photo_url: (() => {
        const first = firstGalleryUrl(place?.gallery)
        return first ? proxifyPhotoUrl(first) : null
      })(),
      quality_score: Number(qualityScore.toFixed(2)),
      engagement_score: Number(engagementScore.toFixed(2)),
      recency_boost: Number(recencyBoost.toFixed(2)),
      final_score: Number(finalScore.toFixed(2)),
      confidence_score: confidenceScore,
      trend_label: trendLabel,
      ...(allowDebug
        ? {
            debug: {
              final_score: Number(finalScore.toFixed(2)),
              components: {
                quality_score: Number(qualityScore.toFixed(2)),
                engagement_score: Number(engagementScore.toFixed(2)),
                recency_boost: Number(recencyBoost.toFixed(2)),
              },
              normalized: {
                quality: Number(Math.min(1, qualityScore / 100).toFixed(4)),
                engagement: Number(Math.min(1, engagementScore / 100).toFixed(4)),
                recency: Number(Math.min(1, recencyBoost / 18).toFixed(4)),
              },
              weights_applied: {
                quality: 0.6,
                engagement: 0.3,
                recency: 0.1,
              },
              trend_label: trendLabel,
              reasoning,
            },
          }
        : {}),
    }
  })

  const filtered = location
    ? scored.filter(item =>
        placeTextMatchesLocation(item.place_name, item.place_address, location),
      )
    : scored

  const items = filtered
    .sort((a, b) => (b.final_score || 0) - (a.final_score || 0))
    .slice(0, limit)
    .map((item, idx) => ({
      ...item,
      trend_label: idx === 0 ? 'top_week' : (item.trend_label || 'trending'),
      ...(allowDebug && item.debug
        ? {
            debug: {
              ...item.debug,
              trend_label: idx === 0 ? 'top_week' : item.debug.trend_label,
            },
          }
        : {}),
    }))

  return NextResponse.json({ ok: true, items }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}

