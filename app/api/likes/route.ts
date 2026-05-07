import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'

const XP_PER_LIKE = 5
const AFFINITY_PER_LIKE = 1

// GET /api/likes?post_ids=a,b,c  → { liked: string[] }
export async function GET(req: Request) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ liked: [] })

  const auth = await requireAuthenticatedUser(req)
  if (!auth) return NextResponse.json({ liked: [] })

  const url = new URL(req.url)
  const raw = url.searchParams.get('post_ids') || ''
  const postIds = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100)
  if (postIds.length === 0) return NextResponse.json({ liked: [] })

  const { data } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', auth.id)
    .in('post_id', postIds)

  return NextResponse.json({ liked: (data || []).map(r => r.post_id) })
}

// POST /api/likes  body: { post_id, action: 'like'|'unlike', author_id?, tags? }
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`likes:${ip}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const auth = await requireAuthenticatedUser(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    post_id?: string
    action?: string
    author_id?: string
    tags?: string[]
  }

  const postId = String(body.post_id || '').trim()
  const action = body.action === 'unlike' ? 'unlike' : 'like'
  const authorId = String(body.author_id || '').trim()
  const tags = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean).slice(0, 10) : []

  if (!postId) return NextResponse.json({ ok: false, error: 'missing_post_id' }, { status: 400 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })

  if (action === 'unlike') {
    await supabase.from('post_likes').delete().eq('user_id', auth.id).eq('post_id', postId)
    return NextResponse.json({ ok: true, action: 'unliked' })
  }

  // Insert like — unique violation (23505) means already liked, still ok
  const { error } = await supabase
    .from('post_likes')
    .insert({ user_id: auth.id, post_id: postId })

  if (error && error.code !== '23505') {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (error?.code === '23505') {
    return NextResponse.json({ ok: true, action: 'already_liked' })
  }

  // Grant +5 XP to the post author (fire-and-forget)
  if (authorId && authorId !== auth.id) {
    supabase.rpc('increment_profile_points', {
      p_user_id: authorId,
      p_delta: XP_PER_LIKE,
    }).then(undefined, () => undefined) as Promise<unknown>
  }

  // +1 tag affinity for the liker (select-then-upsert pattern)
  if (tags.length > 0) {
    const { data: existing } = await supabase
      .from('user_tag_affinity')
      .select('tag_slug, weight')
      .eq('user_id', auth.id)
      .in('tag_slug', tags)

    const current = new Map<string, number>()
    for (const row of (existing || []) as Array<{ tag_slug: string; weight: number }>) {
      current.set(String(row.tag_slug), Number(row.weight || 0))
    }

    const now = new Date().toISOString()
    const payload = tags.map(slug => ({
      user_id: auth.id,
      tag_slug: slug,
      weight: (current.get(slug) || 0) + AFFINITY_PER_LIKE,
      updated_at: now,
    }))

    supabase
      .from('user_tag_affinity')
      .upsert(payload, { onConflict: 'user_id,tag_slug' })
      .then(undefined, () => undefined) as Promise<unknown>
  }

  return NextResponse.json({ ok: true, action: 'liked' })
}
