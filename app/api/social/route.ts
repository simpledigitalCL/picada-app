import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { logApiEvent } from '@/lib/server/observability'
import { sanitizeUserText } from '@/lib/utils/sanitize'

function isSafeId(v: string, min = 3, max = 64): boolean {
  return new RegExp(`^[a-zA-Z0-9._:-]{${min},${max}}$`).test(v)
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`social:${ip}`, 60, 60_000)
  if (!rl.ok) {
    logApiEvent('/api/social', 'rate_limited', { ip })
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }
  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) {
    logApiEvent('/api/social', 'unauthorized', { ip })
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })
  const body = (await req.json()) as {
    action?: 'follow' | 'save_item'
    follower_id?: string
    following_id?: string
    user_id?: string
    menu_item_id?: string
    kind?: 'pending' | 'favorite'
    content?: string
    comment?: string
    description?: string
  }
  if (body.content != null) body.content = sanitizeUserText(body.content)
  if (body.comment != null) body.comment = sanitizeUserText(body.comment)
  if (body.description != null) body.description = sanitizeUserText(body.description)
  if (body.action === 'follow') {
    const follower = authUser.id
    const following = (body.following_id || '').trim()
    if (!follower || !following || !isSafeId(follower) || !isSafeId(following)) {
      return NextResponse.json({ ok: false, error: 'IDs inválidos' }, { status: 400 })
    }
    await supabase.from('follows').upsert({ follower_id: follower, following_id: following }, { onConflict: 'follower_id,following_id' })
    logApiEvent('/api/social', 'follow_ok', { ip, follower, following })
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'save_item') {
    const userId = authUser.id
    const menuItemId = (body.menu_item_id || '').trim()
    if (!userId || !menuItemId || !isSafeId(userId) || !isSafeId(menuItemId, 8, 64)) {
      return NextResponse.json({ ok: false, error: 'IDs inválidos' }, { status: 400 })
    }
    await supabase.from('saved_items').upsert({
      user_id: userId,
      menu_item_id: menuItemId,
      kind: body.kind || 'pending',
    }, { onConflict: 'user_id,menu_item_id' })
    logApiEvent('/api/social', 'save_item_ok', { ip, userId, menuItemId })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 })
}

export async function GET(req: Request) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ followers: 0, following: 0, pending: 0 })
  const url = new URL(req.url)
  const userId = (url.searchParams.get('user_id') || '').trim()
  const placeName = (url.searchParams.get('place_name') || '').trim()

  if (placeName) {
    const { data: items } = await supabase
      .from('menu_items')
      .select('id, review_text')
      .ilike('place_name', `%${placeName}%`)
      .limit(200)
    const ids = (items || []).map(i => i.id)
    let pendingCount = 0
    if (ids.length > 0) {
      const { count } = await supabase
        .from('saved_items')
        .select('*', { count: 'exact', head: true })
        .in('menu_item_id', ids)
        .eq('kind', 'pending')
      pendingCount = count || 0
    }
    const byExpert = new Map<string, number>()
    for (const item of items || []) {
      const tag = String(item.review_text || '').match(/@([\w-]+)/)?.[1] || 'comunidad'
      byExpert.set(tag, (byExpert.get(tag) || 0) + 1)
    }
    const expert = [...byExpert.entries()].sort((a, b) => b[1] - a[1])[0]
    return NextResponse.json({
      pending_count: pendingCount,
      top_expert: expert ? { user: expert[0], reviews: expert[1] } : null,
    })
  }

  if (!userId) return NextResponse.json({ followers: 0, following: 0, pending: 0 })
  const [{ count: followers }, { count: following }, { count: pending }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('saved_items').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'pending'),
  ])
  return NextResponse.json({
    followers: followers || 0,
    following: following || 0,
    pending: pending || 0,
  })
}

