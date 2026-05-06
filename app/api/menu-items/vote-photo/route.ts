import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })
  const body = (await req.json()) as {
    menu_item_id?: string
    vote_type?: 'useful' | 'esthetic'
  }
  const menuItemId = (body.menu_item_id || '').trim()
  const voteType = body.vote_type === 'esthetic' ? 'esthetic' : 'useful'
  if (!menuItemId) return NextResponse.json({ ok: false, error: 'menu_item_id requerido' }, { status: 400 })

  const { data: row } = await supabase
    .from('menu_items')
    .select('photo_votes, upvotes_count')
    .eq('id', menuItemId)
    .maybeSingle()

  const photoVotes = (row?.photo_votes && typeof row.photo_votes === 'object')
    ? row.photo_votes as Record<string, number>
    : {}
  const nextVotes = {
    ...photoVotes,
    [voteType]: Number(photoVotes[voteType] || 0) + 1,
  }
  const nextUpvotes = Number(row?.upvotes_count || 0) + 1
  await supabase
    .from('menu_items')
    .update({
      photo_votes: nextVotes,
      upvotes_count: nextUpvotes,
      impact_score: nextUpvotes + (Number(nextVotes.useful || 0) * 0.5),
    })
    .eq('id', menuItemId)

  return NextResponse.json({ ok: true, upvotes_count: nextUpvotes, photo_votes: nextVotes })
}

