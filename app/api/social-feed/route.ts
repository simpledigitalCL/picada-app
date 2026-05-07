import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { placeTextMatchesLocation } from '@/lib/location/query-match'

export type SocialPost = {
  id: string
  user_id: string
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
  like_count: number
}

export async function GET(req: Request) {
  const supabase = getSupabaseServerClient()
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') || '30'), 150)
  const offset = Number(url.searchParams.get('offset') || '0')
  const entry = url.searchParams.get('entry') || ''
  const location = url.searchParams.get('location') || ''
  const placeFilter = (url.searchParams.get('place') || '').trim()
  const userIdFilter = (url.searchParams.get('user_id') || '').trim()

  if (!supabase) return NextResponse.json({ posts: [] })

  const fetchCap = Math.min(placeFilter || location ? 180 : offset + limit + 40, 200)

  let query = supabase
    .from('posts')
    .select('id, user_id, place_name, content, rating, type, mood_tags, is_incognito, nutrition_data, created_at')
    .eq('is_incognito', false)
    .order('created_at', { ascending: false })
    .range(0, fetchCap - 1)

  if (entry === 'new-picada') {
    query = query.contains('nutrition_data', { entryType: 'new-picada' } as never)
  }

  if (userIdFilter) {
    query = query.eq('user_id', userIdFilter)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ posts: [] })

  const postIds = (data || []).map(r => r.id).filter(Boolean)

  // Batch-fetch usernames and like counts in parallel
  const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
  const [profilesRes, likesRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select('id, username').in('id', userIds)
      : Promise.resolve({ data: [] }),
    postIds.length > 0
      ? supabase.from('post_likes').select('post_id').in('post_id', postIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileByUserId = new Map<string, string>()
  for (const p of (profilesRes.data || []) as Array<{ id: string; username: string }>) {
    if (p.username) profileByUserId.set(p.id, p.username)
  }

  const likeCountByPost = new Map<string, number>()
  for (const row of (likesRes.data || []) as Array<{ post_id: string }>) {
    likeCountByPost.set(row.post_id, (likeCountByPost.get(row.post_id) || 0) + 1)
  }

  const posts: SocialPost[] = (data || []).map(row => {
    const nd = (row.nutrition_data || {}) as Record<string, unknown>
    const payload = (nd.original_payload || {}) as Record<string, unknown>
    const user = (payload.user || {}) as Record<string, string>
    const media = (payload.media || {}) as Record<string, string | null>
    const entryType = String(nd.entryType || (payload.entry) || '')

    // Prioridad: perfil actual > payload guardado > fallback generado
    const username =
      profileByUserId.get(row.user_id) ||
      String(user.username || '').trim() ||
      `foodie_${String(row.id).slice(0, 4)}`

    let mediaUrl: string | null = null
    const rawUrl = String(media.url || '')
    if (rawUrl && !rawUrl.startsWith('data:')) mediaUrl = rawUrl

    return {
      id: row.id,
      user_id: row.user_id,
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
      like_count: likeCountByPost.get(row.id) || 0,
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
