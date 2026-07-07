import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { logApiEvent } from '@/lib/server/observability'
import { sanitizeUserText } from '@/lib/utils/sanitize'
import { normalizeUuid } from '@/lib/server/content-persistence'
import { postEditSchema } from '@/lib/validation/post-edit-schema'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Carga el post y valida propiedad. Las rutas usan service-role (bypass RLS),
 * así que la propiedad se valida SIEMPRE en código.
 * Devuelve la fila, o una respuesta de error lista para retornar.
 */
async function loadOwnedPost(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  postId: string,
  authUserId: string,
): Promise<
  | { ok: true; post: { id: string; user_id: string; is_incognito: boolean } }
  | { ok: false; response: NextResponse }
> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, is_incognito')
    .eq('id', postId)
    .single()

  if (error || !data) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 }) }
  }
  const post = data as { id: string; user_id: string; is_incognito: boolean }
  if (post.user_id !== authUserId) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }) }
  }
  return { ok: true, post }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`posts-edit:${ip}`, 30, 60_000)
  if (!rl.ok) {
    logApiEvent('/api/posts/[id]', 'rate_limited', { ip })
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) {
    logApiEvent('/api/posts/[id]', 'unauthorized', { ip })
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const { id } = await params
  const postId = normalizeUuid(id)
  if (!postId) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })

  const rawBody = await req.json().catch(() => null)
  const parsed = postEditSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_payload', details: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }
  const body = parsed.data

  const owned = await loadOwnedPost(supabase, postId, authUser.id)
  if (!owned.ok) return owned.response

  // ── Actualizar columnas del post ────────────────────────────────────────────
  const update: Record<string, unknown> = {}
  if (body.content !== undefined) {
    const clean = body.content == null ? null : sanitizeUserText(body.content).trim()
    update.content = clean || null
  }
  if (body.rating !== undefined) update.rating = body.rating ?? null
  if (body.moods !== undefined) update.mood_tags = body.moods

  // Media (reemplazo total). Filtra data: y respeta hasta 3 fotos o 1 video.
  const mediaList =
    body.mediaList !== undefined
      ? body.mediaList
          .filter(m => m.url && !m.url.startsWith('data:'))
          .slice(0, 3)
          .map((m, i) => ({ post_id: postId, url: m.url.trim(), media_type: m.kind, sort_order: i }))
      : null

  // Si cambió la media, recomputamos `type` como en la creación.
  if (mediaList !== null) {
    const hasVideo = mediaList.some(m => m.media_type === 'video')
    const hasPhoto = mediaList.some(m => m.media_type === 'photo')
    update.type = hasVideo ? 'video' : hasPhoto ? 'photo' : owned.post.is_incognito ? 'incognito' : 'review'
  }

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await supabase
      .from('posts')
      .update(update)
      .eq('id', postId)
      .eq('user_id', authUser.id)
    if (updateError) {
      logApiEvent('/api/posts/[id]', 'update_error', { ip, userId: authUser.id, error: updateError.message })
      return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
    }
  }

  // ── Reconciliar post_media (fuente autoritativa) ─────────────────────────────
  if (mediaList !== null) {
    const { error: delError } = await supabase.from('post_media').delete().eq('post_id', postId)
    if (delError) {
      logApiEvent('/api/posts/[id]', 'media_delete_error', { ip, userId: authUser.id, error: delError.message })
      return NextResponse.json({ ok: false, error: 'media_update_failed' }, { status: 500 })
    }
    if (mediaList.length > 0) {
      const { error: insError } = await supabase.from('post_media').insert(mediaList)
      if (insError) {
        logApiEvent('/api/posts/[id]', 'media_insert_error', { ip, userId: authUser.id, error: insError.message })
        return NextResponse.json({ ok: false, error: 'media_update_failed' }, { status: 500 })
      }
    }
  }

  logApiEvent('/api/posts/[id]', 'updated', { ip, userId: authUser.id, postId })
  return NextResponse.json({
    ok: true,
    value: {
      id: postId,
      ...(body.content !== undefined ? { content: update.content } : {}),
      ...(body.rating !== undefined ? { rating: update.rating } : {}),
      ...(body.moods !== undefined ? { moods: body.moods } : {}),
      ...(mediaList !== null
        ? { media: mediaList.map(m => ({ url: m.url, kind: m.media_type })), type: update.type }
        : {}),
    },
  })
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`posts-delete:${ip}`, 30, 60_000)
  if (!rl.ok) {
    logApiEvent('/api/posts/[id]', 'rate_limited', { ip })
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) {
    logApiEvent('/api/posts/[id]', 'unauthorized', { ip })
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const { id } = await params
  const postId = normalizeUuid(id)
  if (!postId) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })

  const owned = await loadOwnedPost(supabase, postId, authUser.id)
  if (!owned.ok) return owned.response

  // Borrado explícito de media (por si el FK no tiene ON DELETE CASCADE).
  await supabase.from('post_media').delete().eq('post_id', postId)

  const { error: delError } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', authUser.id)
  if (delError) {
    logApiEvent('/api/posts/[id]', 'delete_error', { ip, userId: authUser.id, error: delError.message })
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 })
  }

  // El trigger trg_refresh_place_rating recalcula internal_rating al borrar.
  logApiEvent('/api/posts/[id]', 'deleted', { ip, userId: authUser.id, postId })
  return NextResponse.json({ ok: true, value: { id: postId } })
}
