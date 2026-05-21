import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'

// GET /api/badges — all unlocked badges for the authenticated user
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`badges-get:${ip}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: true, badges: [] })

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_badges')
    .select('badge_id, unlocked_at')
    .eq('user_id', authUser.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, badges: data ?? [] })
}

type UnlockBody = { badgeId?: unknown; unlockedAt?: unknown }

// POST /api/badges — unlock a badge for the authenticated user (idempotent)
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`badges-post:${ip}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: true, persisted: false })

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as UnlockBody
  const badgeId = String(body.badgeId ?? '').trim()
  if (!badgeId) return NextResponse.json({ ok: false, error: 'missing badgeId' }, { status: 400 })

  const unlockedAt =
    typeof body.unlockedAt === 'string' && body.unlockedAt
      ? body.unlockedAt
      : new Date().toISOString()

  const { error } = await supabase
    .from('user_badges')
    .upsert({ user_id: authUser.id, badge_id: badgeId, unlocked_at: unlockedAt }, { onConflict: 'user_id,badge_id' })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, persisted: true })
}
