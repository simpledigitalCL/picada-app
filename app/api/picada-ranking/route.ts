import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { placeTextMatchesLocation } from '@/lib/location/query-match'

type PicadaRankRow = {
  picada_id: string
  community_votes: number
  visits_count: number
  reviews_count: number
  ranking_score: number
  place_name?: string
  place_address?: string
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
    const id = String(payload.picadaId || payload.placeId || '').trim()
    if (!id) continue

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

  const scored = ((data || []) as PicadaRankRow[]).map(row => {
    const meta = metaById[row.picada_id] || {}
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
      ...row,
      place_name: meta.place_name,
      place_address: meta.place_address,
      maps_url: meta.maps_url,
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

  return NextResponse.json({ ok: true, items })
}

