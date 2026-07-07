import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { interactionsBatchSchema } from '@/lib/validation/interactions-schema'

const MAX_CONTEXT_BYTES = 2000

function normalizeUuid(input?: string | null): string | null {
  const value = String(input || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

// POST /api/interactions/batch
// body: { anonId?, items: [{ type, placeRef?, context? }] }
// Log append-only de interacciones usuario↔lugar (incluye impresiones).
// Acepta usuarios anónimos (anonId de localStorage) para stitching posterior
// vía identity_links.
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`interactions:${ip}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const json = await req.json().catch(() => null)
  const parsed = interactionsBatchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const auth = await requireAuthenticatedUser(req)
  const { anonId, items } = parsed.data
  if (!auth && !anonId) {
    return NextResponse.json({ ok: false, error: 'missing_identity' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: true, inserted: 0, persisted: false })

  // Resolver placeRef: UUID directo, o external_id (Google/OSM) → UUID interno.
  const refs = items.map(item => String(item.placeRef || '').replace(/^ext-/, ''))
  const externalIds = [...new Set(refs.filter(ref => ref && !normalizeUuid(ref)))]
  const externalToUuid = new Map<string, string>()
  if (externalIds.length > 0) {
    const { data } = await supabase
      .from('places')
      .select('id, external_id')
      .in('external_id', externalIds)
    for (const row of (data || []) as Array<{ id: string; external_id: string }>) {
      externalToUuid.set(String(row.external_id), String(row.id))
    }
  }

  const rows = items.map((item, idx) => {
    const ref = refs[idx]
    const uuid = normalizeUuid(ref)
    let context = item.context || {}
    if (JSON.stringify(context).length > MAX_CONTEXT_BYTES) context = {}
    return {
      user_id: auth?.id || null,
      anon_id: anonId || null,
      place_id: uuid || (ref ? externalToUuid.get(ref) || null : null),
      place_external_id: !uuid && ref ? ref : null,
      interaction_type: item.type,
      context,
    }
  })

  const { error } = await supabase.from('user_interactions').insert(rows)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, inserted: rows.length })
}
