import { NextResponse } from 'next/server'
import { buildMergedPlaceClassification } from '@/lib/merge-automated-place-tags'
import type { PlaceTaggingMeta } from '@/lib/place-tagging-types'
import { getSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Cron / job: backfill clasificación inicial y refresco diario.
 * Autorización: Authorization: Bearer <CRON_SECRET> o header x-cron-secret.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  const header = req.headers.get('x-cron-secret')
  const token =
    auth?.startsWith('Bearer ')
      ? auth.slice(7).trim()
      : (header || '').trim()
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const maxBatch = Math.min(
    Math.max(Number((body as { limit?: unknown }).limit) || 50, 1),
    160,
  )

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'supabase_missing' }, { status: 500 })

  const { data: candidates } = await supabase
    .from('places')
    .select(
      'id, provider, external_id, name, address, tagging_meta, source_types, raw_payload, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(400)

  const rows =
    candidates?.filter(p => {
      const meta =
        (p as { tagging_meta?: { automated_seed?: { generated_at?: string } } }).tagging_meta || {}
      const hasSeed = Boolean(meta.automated_seed?.generated_at)
      return !hasSeed
    }) ?? []

  const slice = rows.slice(0, maxBatch)
  let ok = 0
  let err = 0

  function extractReviews(raw: Record<string, unknown> | undefined | null): string[] | undefined {
    const s = raw?.review_snippets
    if (!Array.isArray(s)) return undefined
    return s.filter((x): x is string => typeof x === 'string')
  }

  function extractGoogle(raw: Record<string, unknown> | undefined | null): string[] | undefined {
    const g = raw?.google_types
    if (Array.isArray(g)) return g.map(String)
    const base = raw?.base as { types?: string[] } | undefined
    return Array.isArray(base?.types) ? base.types.map(String) : undefined
  }

  function editorial(raw: Record<string, unknown> | undefined | null): string | null {
    const sn = raw?.editorial_snippet
    if (typeof sn === 'string') return sn
    const ov = raw?.editorial_summary as { overview?: string } | undefined
    return ov?.overview ?? null
  }

  for (const row of slice) {
    try {
      const rp = row.raw_payload && typeof row.raw_payload === 'object' ? (row.raw_payload as Record<string, unknown>) : {}
      const merged = buildMergedPlaceClassification({
        existingTaggingMeta: (row.tagging_meta as PlaceTaggingMeta | null) ?? null,
        existingSourceTypes: row.source_types,
        name: String(row.name || ''),
        address: String(row.address || ''),
        reviewsText: extractReviews(rp),
        googleTypes: extractGoogle(rp),
        editorialSummary: editorial(rp),
      })
      await supabase
        .from('places')
        .update({
          tagging_meta: merged.tagging_meta as unknown as Record<string, unknown>,
          nutrition_categories: merged.nutrition_categories,
          restrictions_supported: merged.restrictions_supported,
          cuisines: merged.cuisines,
          experiences: merged.experiences,
          source_types: merged.source_types,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id as string)
      ok++
    } catch {
      err++
    }
  }

  return NextResponse.json({ ok: true, processed: ok, failures: err, queued: slice.length })
}
