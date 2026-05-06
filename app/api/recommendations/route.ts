import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { requireAuthenticatedUser } from '@/lib/server/auth'

type RecommendationRow = {
  place_id: string
  name: string
  address: string | null
  city: string | null
  rating: number | null
  picada_score: number | null
  maps_url: string | null
  photo_url: string | null
  score: number | null
  reason: string | null
}

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'server_unavailable' }, { status: 500 })

  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 5), 20))
  const city = String(url.searchParams.get('city') || '').trim()

  const { data, error } = await supabase.rpc('get_personalized_recommendations', {
    p_user_id: auth.id,
    p_limit: limit,
    p_city: city || null,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: 'rpc_failed', details: error.message }, { status: 500 })
  }

  const rows = (data || []) as RecommendationRow[]
  if (rows.length > 0) return NextResponse.json({ ok: true, items: rows })

  // Fallback para usuarios nuevos/sin señal: mejores picada_score en la ciudad
  const q = supabase
    .from('places')
    .select('id,name,address,city,rating,picada_score,maps_url,gallery')
    .eq('is_active', true)
    .order('picada_score', { ascending: false })
    .order('rating', { ascending: false })
    .limit(limit)
  const fallbackQuery = city ? q.ilike('city', `%${city}%`) : q
  const { data: fallbackRows } = await fallbackQuery

  const fallbackItems = (fallbackRows || []).map((r: any) => ({
    place_id: String(r.id),
    name: String(r.name || 'Local recomendado'),
    address: (r.address as string | null) || null,
    city: (r.city as string | null) || null,
    rating: Number(r.rating || 0),
    picada_score: Number(r.picada_score || 0),
    maps_url: (r.maps_url as string | null) || null,
    photo_url: Array.isArray(r.gallery) && r.gallery.length > 0 ? String(r.gallery[0]) : null,
    score: Number(r.picada_score || 0),
    reason: 'fallback_city_top',
  }))

  return NextResponse.json({ ok: true, items: fallbackItems, fallback: true })
}

