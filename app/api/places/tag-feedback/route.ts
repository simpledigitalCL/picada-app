import { NextResponse } from 'next/server'
import { buildMergedPlaceClassification } from '@/lib/merge-automated-place-tags'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import type { PlaceTaggingMeta } from '@/lib/place-tagging-types'

type Body = {
  externalId?: string
  slug?: string
  action?: 'confirm' | 'reject' | 'add_manual'
}

export async function POST(req: Request) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'supabase_missing' }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as Body
  const externalId = String(body.externalId || '').trim()
  const slugRaw = String(body.slug || '').trim().toLowerCase()
  const action = body.action

  if ((!externalId && !slugRaw) || !action || !externalId) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const { data: placeRows } = await supabase
    .from('places')
    .select('id, provider, external_id, name, address, tagging_meta, source_types, raw_payload')
    .eq('external_id', externalId)
    .order('updated_at', { ascending: false })
    .limit(3)

  const place = (placeRows || [])[0]
  if (!place) return NextResponse.json({ ok: false, error: 'place_not_found' }, { status: 404 })

  const metaPrev = (place.tagging_meta && typeof place.tagging_meta === 'object')
    ? place.tagging_meta as PlaceTaggingMeta
    : { seed_version: 1 }

  const rp = place.raw_payload && typeof place.raw_payload === 'object' ? place.raw_payload as Record<string, unknown> : {}

  const comm = metaPrev.community || { manual_slugs: [], confirmed_automated: [], rejected_automated: [] }
  const signals = (comm.tag_signals && typeof comm.tag_signals === 'object')
    ? { ...comm.tag_signals as Record<string, { upvotes: number; downvotes: number; last_feedback_at: string }> }
    : {}

  let nextManual = [...(comm.manual_slugs || []).map(String).map(s => s.toLowerCase())]
  let confirmed = [...(comm.confirmed_automated || []).map(String).map(s => s.toLowerCase())]
  let rejected = [...(comm.rejected_automated || []).map(String).map(s => s.toLowerCase())]

  const bumpSignal = (slug: string, kind: 'up' | 'down', delta = 1) => {
    const prev = signals[slug] || { upvotes: 0, downvotes: 0, last_feedback_at: new Date().toISOString() }
    signals[slug] = {
      upvotes: prev.upvotes + (kind === 'up' ? delta : 0),
      downvotes: prev.downvotes + (kind === 'down' ? delta : 0),
      last_feedback_at: new Date().toISOString(),
    }
  }

  if (action === 'confirm' && slugRaw) {
    if (!confirmed.includes(slugRaw)) confirmed.push(slugRaw)
    rejected = rejected.filter(s => s !== slugRaw)
    bumpSignal(slugRaw, 'up', 1)
  } else if (action === 'reject' && slugRaw) {
    if (!rejected.includes(slugRaw)) rejected.push(slugRaw)
    confirmed = confirmed.filter(s => s !== slugRaw)
    bumpSignal(slugRaw, 'down', 1)
  } else if (action === 'add_manual' && slugRaw) {
    if (!nextManual.includes(slugRaw)) nextManual.push(slugRaw)
    bumpSignal(slugRaw, 'up', 1)
  }

  const reviewsText = extractReviews(rp)

  /** Reclasifica sólo lado servidor — respeta rejects/manual vía merge */
  const rebuilt = buildMergedPlaceClassification({
    existingTaggingMeta: {
      ...metaPrev,
      community: {
        manual_slugs: nextManual,
        confirmed_automated: confirmed,
        rejected_automated: rejected,
        tag_signals: signals,
      },
    },
    existingSourceTypes: place.source_types,
    name: String(place.name || ''),
    address: String(place.address || ''),
    reviewsText,
    googleTypes: extractGoogleTypes(rp),
    editorialSummary: extractEditorial(rp),
  })

  await supabase
    .from('places')
    .update({
      tagging_meta: rebuilt.tagging_meta as unknown as Record<string, unknown>,
      nutrition_categories: rebuilt.nutrition_categories,
      restrictions_supported: rebuilt.restrictions_supported,
      cuisines: rebuilt.cuisines,
      experiences: rebuilt.experiences,
      source_types: rebuilt.source_types,
      raw_payload: { ...rp, place_tag_feedback_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', place.id)

  return NextResponse.json({ ok: true, tagging_meta: rebuilt.tagging_meta })
}

function extractGoogleTypes(raw: Record<string, unknown>): string[] | undefined {
  const g = raw.google_types
  if (Array.isArray(g)) return g.map(String)
  const base = raw.base as { types?: string[] } | undefined
  if (Array.isArray(base?.types)) return base!.types!.map(String)
  return undefined
}

function extractEditorial(raw: Record<string, unknown>): string | null {
  const s = raw.editorial_snippet
  if (typeof s === 'string') return s
  const es = raw.editorial_summary as { overview?: string } | undefined
  return es?.overview ?? null
}

function extractReviews(raw: Record<string, unknown>): string[] | undefined {
  const s = raw.review_snippets
  if (!Array.isArray(s)) return undefined
  return s.filter((x): x is string => typeof x === 'string')
}
