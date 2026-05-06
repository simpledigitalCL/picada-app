import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { sanitizeUserText } from '@/lib/utils/sanitize'

export async function POST(req: Request) {
  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'supabase_missing' }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as {
    place_id?: string
    rating?: number
    content?: string
    comment?: string
    description?: string
  }

  const placeId = String(body.place_id || '').trim()
  const rating = Number(body.rating || 0)
  const content = sanitizeUserText(body.content || body.comment || body.description || '')
  if (!placeId) return NextResponse.json({ ok: false, error: 'place_id_required' }, { status: 400 })

  const { error } = await supabase.from('reviews').insert({
    user_id: authUser.id,
    place_id: placeId,
    rating: Number.isFinite(rating) ? rating : null,
    content,
  })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
