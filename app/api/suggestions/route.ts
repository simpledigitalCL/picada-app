import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { LOCAL_KIND_DEFAULT_FOOD_SUGGESTIONS, LOCAL_KIND_OPTIONS } from '@/lib/tags/venue-classification'
import { storedTagForFoodPick } from '@/lib/tags/food-content'
import { slugSegment } from '@/lib/tags/slug'

/** Mínimo de usuarios distintos contribuyentes para considerar estadística "lista" para UX */
const SMART_MIN_UNIQUE_USERS = 3

function getGlobalDefaults(sourceTag: string, relationType: string): string[] {
  if (relationType !== 'local_to_food') return []
  if (!sourceTag.startsWith('local_')) return []
  const sourceSlug = sourceTag.slice('local_'.length)
  const localLabel = LOCAL_KIND_OPTIONS.find(x => slugSegment(x) === sourceSlug)
  if (!localLabel) return []
  const defaults = LOCAL_KIND_DEFAULT_FOOD_SUGGESTIONS[localLabel] || []
  return defaults.map(label => storedTagForFoodPick('tipo_plato', label)).filter(Boolean)
}

/** Prioridad: 1) verified + score, 2) pending + score, 3) defaults al final */
function buildTieredSuggestionList(opts: {
  statsRows: Array<{
    target_tag: string
    co_occurrence_count: number
    unique_users_count: number
  }>
  statusBySlug: Map<string, 'verified' | 'pending'>
  defaults: string[]
  limit: number
}): { suggestions: string[]; used_smart: boolean } {
  const { statsRows, statusBySlug, defaults, limit } = opts

  const qualifying = statsRows
    .filter(r => Number(r.unique_users_count || 0) >= SMART_MIN_UNIQUE_USERS)
    .sort((a, b) => Number(b.co_occurrence_count || 0) - Number(a.co_occurrence_count || 0))

  if (qualifying.length === 0) {
    return { suggestions: defaults.slice(0, limit), used_smart: false }
  }

  const tier1: string[] = []
  const tier2: string[] = []
  const seen = new Set<string>()

  for (const row of qualifying) {
    const slug = String(row.target_tag || '').trim().toLowerCase()
    if (!slug || seen.has(slug)) continue
    const st = statusBySlug.get(slug) ?? 'pending'
    if (st === 'verified') {
      tier1.push(slug)
      seen.add(slug)
    }
  }
  for (const row of qualifying) {
    const slug = String(row.target_tag || '').trim().toLowerCase()
    if (!slug || seen.has(slug)) continue
    const st = statusBySlug.get(slug) ?? 'pending'
    if (st !== 'verified') {
      tier2.push(slug)
      seen.add(slug)
    }
  }

  const smartOrdered = [...tier1, ...tier2]
  const out: string[] = []
  for (const s of smartOrdered) {
    if (out.length >= limit) break
    if (!out.includes(s)) out.push(s)
  }
  for (const d of defaults) {
    if (out.length >= limit) break
    if (!out.includes(d)) out.push(d)
  }
  return { suggestions: out.slice(0, limit), used_smart: true }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sourceTag = String(searchParams.get('source') || '').trim().toLowerCase()
  const relationType = String(searchParams.get('type') || '').trim().toLowerCase()
  const limit = Math.max(1, Math.min(24, Number(searchParams.get('limit') || 12)))

  if (!sourceTag || !relationType) {
    return NextResponse.json({ ok: false, error: 'missing_source_or_type' }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'missing_server_client' }, { status: 500 })

  const globalDefaults = getGlobalDefaults(sourceTag, relationType)

  const { data: statRowsRaw, error: statErr } = await supabase
    .from('tag_relations_stats')
    .select('target_tag, co_occurrence_count, unique_users_count')
    .eq('source_tag', sourceTag)
    .eq('relation_type', relationType)

  if (statErr) {
    return NextResponse.json({ ok: false, error: statErr.message }, { status: 500 })
  }

  const statRows =
    statRowsRaw
      ?.map(r => ({
        target_tag: String((r as { target_tag?: string }).target_tag || '').trim().toLowerCase(),
        co_occurrence_count: Number((r as { co_occurrence_count?: number }).co_occurrence_count ?? 0),
        unique_users_count: Number((r as { unique_users_count?: number }).unique_users_count ?? 0),
      }))
      .filter(r => r.target_tag) ?? []

  const targets = statRows.map(r => r.target_tag)
  let statusBySlug = new Map<string, 'verified' | 'pending'>()

  if (targets.length > 0) {
    const { data: catRows } = await supabase.from('tag_catalog').select('slug, status').in('slug', targets)
    statusBySlug = new Map(
      (catRows || []).map(row => {
        const r = row as { slug?: string; status?: string }
        const slug = String(r.slug || '').toLowerCase()
        const st = r.status === 'verified' ? 'verified' : 'pending'
        return [slug, st] as const
      }),
    )
  }

  const { suggestions, used_smart } = buildTieredSuggestionList({
    statsRows: statRows,
    statusBySlug,
    defaults: globalDefaults,
    limit,
  })

  return NextResponse.json({
    ok: true,
    source: sourceTag,
    relation_type: relationType,
    suggestions,
    min_unique_users: SMART_MIN_UNIQUE_USERS,
    used_smart,
    smart_pool_size: statRows.filter(r => r.unique_users_count >= SMART_MIN_UNIQUE_USERS).length,
  })
}
