import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

type LeaderboardRow = {
  user_id: string
  username: string
  quality_score: number
  engagement_score: number
  consistency_score: number
  recency_score: number
  final_score: number
  debug?: {
    final_score: number
    quality_contribution: number
    engagement_contribution: number
    consistency_contribution: number
    recency_contribution: number
    diminishing_returns_applied: boolean
    confidence_score: number
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit') || '20')))
  const debugRequested = url.searchParams.get('debug') === '1'
  const internalHeader = req.headers.get('x-internal-role') === 'internal'
  const allowDebug = debugRequested && (process.env.NODE_ENV !== 'production' || internalHeader)

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: true, items: [] as LeaderboardRow[] })
  }

  const { data, error } = await supabase
    .from('domain_events')
    .select('user_id,username,event_type,payload,event_at')
    .order('event_at', { ascending: false })
    .limit(3000)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const grouped: Record<string, {
    username: string
    qualitySum: number
    engagement: number
    createdByDay: Record<string, number>
    mostRecentAt: number
    diminishingApplied: boolean
  }> = {}

  for (const row of data || []) {
    const userId = String(row.user_id || '').trim()
    if (!userId) continue
    if (!grouped[userId]) {
      grouped[userId] = { username: String(row.username || 'foodie'), qualitySum: 0, engagement: 0, createdByDay: {}, mostRecentAt: 0, diminishingApplied: false }
    }
    const target = grouped[userId]
    const payload = (row.payload || {}) as Record<string, unknown>
    const day = String(row.event_at || '').slice(0, 10)
    const at = row.event_at ? new Date(row.event_at).getTime() : 0
    target.mostRecentAt = Math.max(target.mostRecentAt, at)

    if (row.event_type === 'CONTENT_CREATED') {
      const q = Number(payload.quality_score || payload.xp || 0)
      const countInDay = (target.createdByDay[day] || 0) + 1
      target.createdByDay[day] = countInDay
      const multiplier = countInDay <= 3 ? 1 : countInDay <= 8 ? 0.5 : 0.2
      if (multiplier < 1) target.diminishingApplied = true
      target.qualitySum += q * multiplier
      continue
    }
    if (row.event_type === 'USER_VOTED' && payload.voted !== false) target.engagement += 1
    if (row.event_type === 'USER_SAVED' && payload.saved !== false) target.engagement += 3
    if (row.event_type === 'USER_VISITED') target.engagement += 2
    if (row.event_type === 'USER_REVIEWED') target.engagement += 5
  }

  const items = Object.entries(grouped)
    .map(([user_id, value]) => {
      const activeDays = Object.keys(value.createdByDay).length
      const consistency = Math.min(100, activeDays * 8)
      const qualityScore = Math.min(100, value.qualitySum / 3)
      const engagementScore = Math.min(100, Math.log10(value.engagement + 1) * 35)
      const ageHours = value.mostRecentAt > 0 ? Math.max(0, (Date.now() - value.mostRecentAt) / (1000 * 60 * 60)) : 9999
      const recencyScore = ageHours <= 24 ? 100 : ageHours <= (24 * 7) ? 55 : 0
      const qualityContribution = qualityScore * 0.6
      const engagementContribution = engagementScore * 0.25
      const consistencyContribution = consistency * 0.1
      const recencyContribution = recencyScore * 0.05
      const final = qualityContribution + engagementContribution + consistencyContribution + recencyContribution
      const confidenceScore = Math.min(100, Math.round((Math.min(1, activeDays / 7) * 50) + (Math.min(1, value.engagement / 30) * 50)))
      return {
        user_id,
        username: value.username,
        quality_score: Number(qualityScore.toFixed(2)),
        engagement_score: Number(engagementScore.toFixed(2)),
        consistency_score: Number(consistency.toFixed(2)),
        recency_score: Number(recencyScore.toFixed(2)),
        final_score: Number(final.toFixed(2)),
        ...(allowDebug
          ? {
              debug: {
                final_score: Number(final.toFixed(2)),
                quality_contribution: Number(qualityContribution.toFixed(2)),
                engagement_contribution: Number(engagementContribution.toFixed(2)),
                consistency_contribution: Number(consistencyContribution.toFixed(2)),
                recency_contribution: Number(recencyContribution.toFixed(2)),
                diminishing_returns_applied: value.diminishingApplied,
                confidence_score: confidenceScore,
              },
            }
          : {}),
      }
    })
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, limit)

  return NextResponse.json({ ok: true, items })
}

