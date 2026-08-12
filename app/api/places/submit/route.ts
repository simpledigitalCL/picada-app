import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { sanitizeUserText } from '@/lib/utils/sanitize'

type SubmitPlaceBody = {
  name: string
  category: string
  lat: number
  lng: number
  address: string
  commune?: string
  city?: string
  region?: string
  phone?: string
  instagram?: string
  gallery?: string[]
  tags?: string[]
  review_rating?: number
  review_comment?: string
  review_moods?: string[]
  review_media_url?: string
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`places:submit:${ip}`, 10, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const body = (await req.json().catch(() => null)) as SubmitPlaceBody | null
  if (!body || !body.name?.trim() || !body.category || body.lat == null || body.lng == null) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const name      = sanitizeUserText(body.name.trim()).slice(0, 120)
  const address   = sanitizeUserText((body.address || '').trim()).slice(0, 300)
  const commune   = sanitizeUserText((body.commune || '').trim()).slice(0, 100) || null
  const city      = sanitizeUserText((body.city || '').trim()).slice(0, 100) || null
  const region    = sanitizeUserText((body.region || '').trim()).slice(0, 100) || null
  const phone     = sanitizeUserText((body.phone || '').trim()).slice(0, 30) || null
  const instagram = sanitizeUserText((body.instagram || '').trim()).slice(0, 60) || null
  const gallery   = Array.isArray(body.gallery) ? body.gallery.filter(u => typeof u === 'string').slice(0, 10) : []
  const tags      = Array.isArray(body.tags) ? body.tags.slice(0, 20) : []

  const reviewRating  = typeof body.review_rating === 'number' && body.review_rating > 0
    ? Math.min(5, Math.max(0.5, body.review_rating))
    : null
  const reviewComment = body.review_comment ? sanitizeUserText(body.review_comment).slice(0, 1000) : null
  const reviewMoods   = Array.isArray(body.review_moods) ? body.review_moods.slice(0, 10) : []
  const reviewMedia   = typeof body.review_media_url === 'string' && /^https?:\/\//i.test(body.review_media_url)
    ? body.review_media_url
    : null

  const hasReview = reviewRating !== null || Boolean(reviewComment)

  const externalId = `user-${authUser.id}-${Date.now()}`

  const { data, error } = await supabase
    .from('places')
    .insert({
      provider:     'user_submission',
      external_id:  externalId,
      name,
      address,
      commune,
      city,
      region,
      lat:          body.lat,
      lng:          body.lng,
      category:     body.category,
      phone,
      website:      instagram ? `https://instagram.com/${instagram.replace(/^@/, '')}` : null,
      gallery,
      status:       hasReview ? 'active' : 'pending',
      submitted_by: authUser.id,
      raw_payload:  { instagram, tags, submitted_at: new Date().toISOString() },
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const placeId = data.id
  let postId: string | null = null

  if (hasReview) {
    const mediaPayload = reviewMedia
      ? { url: reviewMedia, kind: 'photo', original_payload: { media: { url: reviewMedia } } }
      : null

    const { data: postData } = await supabase
      .from('posts')
      .insert({
        user_id:    authUser.id,
        place_id:   placeId,
        type:       'review',
        content:    reviewComment || '',
        rating:     reviewRating,
        mood_tags:  reviewMoods,
        nutrition_data: {
          review: {
            comment: reviewComment,
            rating:  reviewRating,
          },
          taxonomy: { moods: reviewMoods },
          ...(mediaPayload ? { original_payload: mediaPayload.original_payload } : {}),
        },
      })
      .select('id')
      .single()

    if (postData?.id) {
      postId = postData.id

      if (reviewMedia && postData.id) {
        supabase
          .from('post_media')
          .insert({ post_id: postData.id, url: reviewMedia, kind: 'photo', position: 0 })
          .then(undefined, () => undefined) as Promise<unknown>
      }
    }
  }

  // Invalidar cache de discovery para que el lugar aparezca
  const locationKey = (commune || city || '').toLowerCase().trim()
  if (locationKey) {
    supabase
      .from('place_discovery_cache')
      .delete()
      .ilike('location_key', `%${locationKey}%`)
      .then(undefined, () => undefined) as Promise<unknown>
  }

  return NextResponse.json({ ok: true, value: { place_id: placeId, post_id: postId } }, { status: 201 })
}
