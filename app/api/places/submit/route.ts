import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { sanitizeUserText } from '@/lib/utils/sanitize'

type SubmitPlaceBody = {
  name: string
  category: string
  lat: number
  lng: number
  address: string
  commune?: string
  city?: string
  region?: string
  phone?: string
  instagram?: string
  gallery?: string[]
  tags?: string[]
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`places:submit:${ip}`, 10, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const body = (await req.json().catch(() => null)) as SubmitPlaceBody | null
  if (!body || !body.name?.trim() || !body.category || body.lat == null || body.lng == null) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const name      = sanitizeUserText(body.name.trim()).slice(0, 120)
  const address   = sanitizeUserText((body.address || '').trim()).slice(0, 300)
  const commune   = sanitizeUserText((body.commune || '').trim()).slice(0, 100) || null
  const city      = sanitizeUserText((body.city || '').trim()).slice(0, 100) || null
  const region    = sanitizeUserText((body.region || '').trim()).slice(0, 100) || null
  const phone     = sanitizeUserText((body.phone || '').trim()).slice(0, 30) || null
  const instagram = sanitizeUserText((body.instagram || '').trim()).slice(0, 60) || null
  const gallery   = Array.isArray(body.gallery) ? body.gallery.filter(u => typeof u === 'string').slice(0, 10) : []
  const tags      = Array.isArray(body.tags) ? body.tags.slice(0, 20) : []

  const externalId = `user-${authUser.id}-${Date.now()}`

  const { data, error } = await supabase
    .from('places')
    .insert({
      provider:     'user_submission',
      external_id:  externalId,
      name,
      address,
      commune,
      city,
      region,
      lat:          body.lat,
      lng:          body.lng,
      category:     body.category,
      phone,
      website:      instagram ? `https://instagram.com/${instagram.replace(/^@/, '')}` : null,
      gallery,
      status:       'pending',
      submitted_by: authUser.id,
      raw_payload:  { instagram, tags, submitted_at: new Date().toISOString() },
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, value: { place_id: data.id } }, { status: 201 })
}
