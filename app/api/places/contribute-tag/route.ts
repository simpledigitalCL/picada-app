import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase no configurado' }, { status: 500 })

  const body = (await req.json()) as { provider?: string; externalId?: string; tag?: string }
  const provider = (body.provider || '').trim()
  const externalId = (body.externalId || '').trim()
  const tag = (body.tag || '').trim().toLowerCase()

  if (!provider || !externalId || !tag) {
    return NextResponse.json({ ok: false, error: 'Parámetros incompletos' }, { status: 400 })
  }

  const { data: place } = await supabase
    .from('places')
    .select('id, source_types, raw_payload')
    .eq('provider', provider)
    .eq('external_id', externalId)
    .maybeSingle()

  if (!place) return NextResponse.json({ ok: false, error: 'Lugar no encontrado' }, { status: 404 })

  const sourceTypes = Array.isArray(place.source_types) ? place.source_types as string[] : []
  const rawPayload = (place.raw_payload && typeof place.raw_payload === 'object') ? place.raw_payload as Record<string, unknown> : {}
  const votes = (rawPayload.community_votes && typeof rawPayload.community_votes === 'object')
    ? rawPayload.community_votes as Record<string, number>
    : {}
  const currentVotes = Number(votes[tag] || 0)
  const nextVotes = currentVotes + 1
  const nextVotesMap = { ...votes, [tag]: nextVotes }
  const communityTag = `community:${tag}`
  const inferredHit = sourceTypes.some(s => s === `inferred:${tag}` || s.includes(tag))
  const verified = inferredHit || nextVotes >= 3
  const verifiedTag = `community_verified:${tag}`
  const next = [...new Set([...sourceTypes, communityTag, ...(verified ? [verifiedTag] : [])])]

  await supabase
    .from('places')
    .update({
      source_types: next,
      raw_payload: { ...rawPayload, community_votes: nextVotesMap },
      updated_at: new Date().toISOString(),
    })
    .eq('id', place.id)

  return NextResponse.json({ ok: true, tag: communityTag, votes: nextVotes, verified })
}

