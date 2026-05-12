import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'

// GET /api/achievements — all achievement progress for the authenticated user
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`achievements-get:${ip}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: true, achievements: [] })

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_achievements')
    .select('challenge_id, count, discovery_shown, reward_shown, unlocked_at, is_featured')
    .eq('user_id', authUser.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, achievements: data ?? [] })
}

type ProgressBody = {
  challengeId?: unknown
  count?: unknown
  discoveryShown?: unknown
  rewardShown?: unknown
  unlockedAt?: unknown
}

// POST /api/achievements — upsert progress for a single challenge (never touches is_featured)
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`achievements-post:${ip}`, 120, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: true, persisted: false })

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as ProgressBody

  const challengeId = String(body.challengeId ?? '').trim()
  if (!challengeId) {
    return NextResponse.json({ ok: false, error: 'missing challengeId' }, { status: 400 })
  }

  const count = Math.max(0, Number(body.count ?? 0))
  const discoveryShown = body.discoveryShown === true
  const rewardShown = body.rewardShown === true
  const unlockedAt = typeof body.unlockedAt === 'string' && body.unlockedAt ? body.unlockedAt : null

  // Upsert progress; use a manual update to preserve is_featured on conflict
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('id, is_featured')
    .eq('user_id', authUser.id)
    .eq('challenge_id', challengeId)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existing) {
    await supabase
      .from('user_achievements')
      .update({ count, discovery_shown: discoveryShown, reward_shown: rewardShown, unlocked_at: unlockedAt, updated_at: now })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('user_achievements')
      .insert({ user_id: authUser.id, challenge_id: challengeId, count, discovery_shown: discoveryShown, reward_shown: rewardShown, unlocked_at: unlockedAt, is_featured: false, updated_at: now })
  }

  return NextResponse.json({ ok: true, persisted: true })
}
