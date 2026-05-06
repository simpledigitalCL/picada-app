import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export type UserPicada = {
  id: string
  place_name: string
  place_address: string | null
  username: string
  comment: string | null
  rating: number | null
  photo_url: string | null
  tags: string[]
  created_at: string
  category: string | null
  votes: number
}

export async function GET(req: Request) {
  const supabase = getSupabaseServerClient()
  const url = new URL(req.url)
  const userId = url.searchParams.get('user_id') || ''
  const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 200)

  if (!supabase) return NextResponse.json({ picadas: [] })

  // Get user-submitted picadas from menu_items where entry=new-picada
  let query = supabase
    .from('menu_items')
    .select('id, place_name, review_text, rating, photo_url, source, metadata, created_at')
    .eq('source', 'community')
    .order('created_at', { ascending: false })
    .limit(limit)

  // Filter by user if provided
  if (userId) {
    query = query.contains('metadata', { user_id: userId } as never)
  }

  const { data: items, error } = await query

  if (error) return NextResponse.json({ picadas: [] })

  // Also pull vote counts from domain_events
  const placeNames = (items || []).map(i => i.place_name).filter(Boolean)
  let votesByPlace: Record<string, number> = {}

  if (placeNames.length > 0) {
    const { data: events } = await supabase
      .from('domain_events')
      .select('payload')
      .eq('event_type', 'USER_VOTED')
      .in('payload->>placeName', placeNames)

    for (const ev of events || []) {
      const name = String((ev.payload as Record<string, unknown>)?.placeName || '')
      if (name) votesByPlace[name] = (votesByPlace[name] || 0) + 1
    }
  }

  const picadas: UserPicada[] = (items || [])
    .filter(item => {
      const meta = (item.metadata || {}) as Record<string, unknown>
      return meta.from_unified_form === true && (meta.entry === 'new-picada' || meta.mark_as_picada === true)
    })
    .map(item => {
      const meta = (item.metadata || {}) as Record<string, unknown>
      return {
        id: String(item.id),
        place_name: String(item.place_name || ''),
        place_address: null,
        username: String(meta.username || meta.user_id || 'foodie'),
        comment: item.review_text || null,
        rating: item.rating || null,
        photo_url: item.photo_url || null,
        tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
        created_at: String(item.created_at || ''),
        category: String(meta.category || ''),
        votes: votesByPlace[item.place_name] || 0,
      }
    })

  return NextResponse.json({ picadas })
}
