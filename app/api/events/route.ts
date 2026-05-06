import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { logApiEvent } from '@/lib/server/observability'

type DomainEventType =
  | 'CONTENT_CREATED'
  | 'USER_VOTED'
  | 'USER_REVIEWED'
  | 'USER_SAVED'
  | 'USER_VISITED'
  | 'USER_SCANNED'

type DomainEvent = {
  type: DomainEventType
  payload?: Record<string, unknown>
  ts?: number
}

function isValidType(value: string): value is DomainEventType {
  return ['CONTENT_CREATED', 'USER_VOTED', 'USER_REVIEWED', 'USER_SAVED', 'USER_VISITED', 'USER_SCANNED'].includes(value)
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`events:${ip}`, 120, 60_000)
  if (!rl.ok) {
    logApiEvent('/api/events', 'rate_limited', { ip })
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  const body = (await req.json().catch(() => ({}))) as DomainEvent
  const type = String(body?.type || '')
  if (!isValidType(type)) {
    return NextResponse.json({ ok: false, error: 'Tipo de evento inválido' }, { status: 400 })
  }

  const payload = typeof body.payload === 'object' && body.payload ? body.payload : {}
  const payloadString = JSON.stringify(payload)
  if (payloadString.length > 20_000) {
    return NextResponse.json({ ok: false, error: 'payload_too_large' }, { status: 413 })
  }
  const ts = Number(body.ts || Date.now())
  const eventAt = Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString()

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: true, persisted: false })
  const authUser = await requireAuthenticatedUser(req)
  const payloadRecord = payload as Record<string, unknown>
  const userId = authUser?.id || String(payloadRecord.userId || '')
  const username = String(payloadRecord.username || '')

  const { error } = await supabase.from('domain_events').insert({
    event_type: type,
    payload,
    event_at: eventAt,
    user_id: userId,
    username,
  })

  if (error) {
    logApiEvent('/api/events', 'persist_warning', { ip, error: error.message, type })
    return NextResponse.json({ ok: true, persisted: false, warning: error.message })
  }
  logApiEvent('/api/events', 'ok', { ip, type, userId: userId || null })
  return NextResponse.json({ ok: true, persisted: true })
}

export async function GET(req: Request) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: true, analytics: { total: 0, byType: {} } })

  const url = new URL(req.url)
  const limit = Math.min(500, Math.max(20, Number(url.searchParams.get('limit') || '200')))
  const { data, error } = await supabase
    .from('domain_events')
    .select('event_type')
    .order('event_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const byType = (data || []).reduce<Record<string, number>>((acc, row) => {
    const key = String(row.event_type || 'UNKNOWN')
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    ok: true,
    analytics: {
      total: (data || []).length,
      byType,
    },
  })
}

