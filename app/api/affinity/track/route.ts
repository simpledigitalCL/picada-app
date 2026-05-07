import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { trackUserPlaceAffinity, type AffinityEventType } from '@/lib/user/affinity'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`affinity:${ip}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const auth = await requireAuthenticatedUser(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { placeId?: string; eventType?: AffinityEventType } | null
  const placeId = String(body?.placeId || '').trim()
  const eventType = (body?.eventType || 'view') as AffinityEventType
  if (!placeId) return NextResponse.json({ ok: false, error: 'missing_place_id' }, { status: 400 })

  const result = await trackUserPlaceAffinity({ userId: auth.id, placeId, eventType })
  if (!result.ok) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}

