import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { placeTextMatchesLocation } from '@/lib/location/query-match'

export type SocialPost = {
  id: string
  username: string
  place_name: string | null
  content: string | null
  rating: number | null
  type: 'review' | 'photo' | 'video' | 'incognito' | 'tip'
  mood_tags: string[]
  media_url: string | null
  created_at: string
  quality_score?: number
  tags?: string[]
  entry_type?: string
}

export async function GET(req: Request) {
  const supabase = getSupabaseServerClient()
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') || '30'), 150)
  const offset = Number(url.searchParams.get('offset') || '0')
  const entry = url.searchParams.get('entry') || ''
  const location = url.searchParams.get('location') || ''
  const placeFilter = (url.searchParams.get('place') || '').trim()

  if (!supabase) return NextResponse.json({ posts: [] })

  const fetchCap = Math.min(placeFilter || location ? 180 : offset + limit + 40, 200)

  let query = supabase
    .from('posts')
    .select('id, place_name, content, rating, type, mood_tags, is_incognito, nutrition_data, created_at')
    .eq('is_incognito', false)
    .order('created_at', { ascending: false })
    .range(0, fetchCap - 1)

  if (entry === 'new-picada') {
    query = query.contains('nutrition_data', { entryType: 'new-picada' } as never)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ posts: [] })

  const posts: SocialPost[] = (data || []).map(row => {
    const nd = (row.nutrition_data || {}) as Record<string, unknown>
    const payload = (nd.original_payload || {}) as Record<string, unknown>
    const user = (payload.user || {}) as Record<string, string>
    const media = (payload.media || {}) as Record<string, string | null>
    const entryType = String(nd.entryType || (payload.entry) || '')

    const username =
      String(user.username || '').trim() || `foodie_${String(row.id).slice(0, 4)}`

    let mediaUrl: string | null = null
    const rawUrl = String(media.url || '')
    if (rawUrl && !rawUrl.startsWith('data:')) mediaUrl = rawUrl

    return {
      id: row.id,
      username,
      place_name: row.place_name || null,
      content: row.content || null,
      rating: row.rating || null,
      type: row.type,
      mood_tags: Array.isArray(row.mood_tags) ? row.mood_tags : [],
      media_url: mediaUrl,
      created_at: row.created_at,
      quality_score: Number(nd.quality_score || 0),
      tags: Array.isArray(nd.normalized_tags) ? (nd.normalized_tags as string[]) : [],
      entry_type: entryType,
    }
  }).filter(Boolean) as SocialPost[]

  let out = posts

  if (location) {
    const tok = location.toLowerCase().split(',')[0]?.trim() || ''
    if (tok.length >= 2) {
      out = out.filter(p => (p.place_name || '').toLowerCase().includes(tok))
    }
  }

  if (placeFilter) {
    out = out.filter(p => placeTextMatchesLocation(p.place_name || '', '', placeFilter))
  }

  const sliced = out.slice(offset, offset + limit)

  return NextResponse.json({ posts: sliced })
}
