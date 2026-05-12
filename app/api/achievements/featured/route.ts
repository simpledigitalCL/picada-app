import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'

type FeaturedBody = {
  challengeId?: unknown
}

// POST /api/achievements/featured — equip a challenge as the user's featured achievement.
// Unfeatures any previously featured achievement atomically.
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`achievements-featured:${ip}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: true, persisted: false })

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as FeaturedBody
  const challengeId = String(body.challengeId ?? '').trim()
  if (!challengeId) {
    return NextResponse.json({ ok: false, error: 'missing challengeId' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Unfeature all existing
  void (supabase
    .from('user_achievements')
    .update({ is_featured: false, updated_at: now })
    .eq('user_id', authUser.id)
    .eq('is_featured', true)
    .then(undefined, () => undefined))

  // Upsert the newly featured row (mark as featured, preserve progress if row exists)
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('user_id', authUser.id)
    .eq('challenge_id', challengeId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('user_achievements')
      .update({ is_featured: true, updated_at: now })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('user_achievements')
      .insert({ user_id: authUser.id, challenge_id: challengeId, is_featured: true, updated_at: now })
  }

  return NextResponse.json({ ok: true, persisted: true })
}
