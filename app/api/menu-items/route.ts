import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { menuItemToUnifiedPayload } from '@/lib/menu-items-proxy'

export async function GET(req: Request) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ items: [] })
  const url = new URL(req.url)
  const placeName = (url.searchParams.get('place_name') || '').trim()
  if (!placeName) return NextResponse.json({ items: [] })
  const { data } = await supabase
    .from('menu_items')
    .select('*')
    .ilike('place_name', `%${placeName}%`)
    .order('created_at', { ascending: false })
    .limit(60)
  const rows = (data || []) as Array<{
    id: string
    item_name: string
    rating?: number
    review_text?: string
    photo_url?: string | null
    nutrition?: Record<string, number | string>
    source?: string
    is_official?: boolean
    upvotes_count?: number
    impact_score?: number
    photo_votes?: Record<string, number>
    metadata?: Record<string, unknown>
    created_at?: string
  }>

  const grouped = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.item_name.toLowerCase().trim()
    const current = grouped.get(key) || []
    current.push(row)
    grouped.set(key, current)
  }

  const summary = [...grouped.entries()].map(([key, items]) => {
    const official = items.filter(i => i.is_official)
    const community = items.filter(i => !i.is_official)
    const source = official.length > 0 ? official : items
    const topPhoto = [...source]
      .filter(i => i.photo_url)
      .sort((a, b) => ((b.upvotes_count || 0) + ((b.photo_votes?.useful || 0) * 2) + (b.photo_votes?.esthetic || 0)) - ((a.upvotes_count || 0) + ((a.photo_votes?.useful || 0) * 2) + (a.photo_votes?.esthetic || 0)))[0]

    const ratings = items.map(i => Number(i.rating || 0)).filter(n => Number.isFinite(n) && n > 0)
    const aiKcal = items
      .map(i => i.nutrition)
      .filter(Boolean)
      .filter(n => String((n as Record<string, unknown>).source || '') === 'AI_GENERATED')
      .map(n => Number((n as Record<string, unknown>).kcal || 0))
      .filter(v => v > 0)
    const userKcal = items
      .map(i => i.nutrition)
      .filter(Boolean)
      .filter(n => String((n as Record<string, unknown>).source || '') === 'USER_MANUAL')
      .map(n => Number((n as Record<string, unknown>).kcal || 0))
      .filter(v => v > 0)
    const avg = (arr: number[]) => arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(0)) : 0
    return {
      key,
      item_name: items[0].item_name,
      total_reviews: items.length,
      avg_rating: avg(ratings),
      avg_kcal_ai: avg(aiKcal),
      avg_kcal_user: avg(userKcal),
      top_photo_url: topPhoto?.photo_url || null,
      top_photo_item_id: topPhoto?.id || null,
      official_count: official.length,
      community_count: community.length,
      entries: items,
    }
  })

  return NextResponse.json({ items: rows, summary })
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    place_name?: string
    item_name?: string
    rating?: number
    review_text?: string
    photo_url?: string | null
    nutrition?: { kcal?: number; protein?: number; carbs?: number; fat?: number; source?: 'AI_GENERATED' | 'USER_MANUAL' }
    show_nutrition?: boolean
    is_official?: boolean
    impact_score?: number
    mood?: 'epico' | 'clean' | 'barato'
    metadata?: Record<string, unknown>
  }
  const unified = menuItemToUnifiedPayload({
    place_name: body.place_name,
    item_name: body.item_name,
    rating: body.rating,
    review_text: body.review_text,
    photo_url: body.photo_url,
    metadata: { mood: body.mood || 'epico', ...(body.metadata || {}) },
  })

  const target = new URL('/api/posts', req.url)
  const forward = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unified),
    cache: 'no-store',
  })
  const payload = await forward.json().catch(() => ({ ok: false }))
  return NextResponse.json(payload, { status: forward.status })
}

