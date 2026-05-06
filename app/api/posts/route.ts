import { after, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import type { UnifiedContentPayload } from '@/lib/content/model'
import { persistUnifiedContent } from '@/lib/server/content-persistence'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { logApiEvent } from '@/lib/server/observability'
import { sanitizeUserText } from '@/lib/utils/sanitize'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`posts:${ip}`, 30, 60_000)
  if (!rl.ok) {
    logApiEvent('/api/posts', 'rate_limited', { ip })
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) {
    logApiEvent('/api/posts', 'unauthorized', { ip })
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const body = (await req.json().catch(() => null)) as UnifiedContentPayload | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }
  if (body.review?.comment != null) body.review.comment = sanitizeUserText(body.review.comment)
  if ((body as { content?: unknown }).content != null) (body as { content?: string }).content = sanitizeUserText((body as { content?: unknown }).content)
  if ((body as { description?: unknown }).description != null) (body as { description?: string }).description = sanitizeUserText((body as { description?: unknown }).description)
  const reviewText = String(body.review?.comment || '')
  if (reviewText.length > 4000) {
    return NextResponse.json({ ok: false, error: 'text_too_long' }, { status: 400 })
  }
  body.user = { ...(body.user || {}), id: authUser.id, username: body.user?.username || authUser.email || 'foodie' }
  console.error('PAYLOAD_RECIBIDO:', body)
  let result: Awaited<ReturnType<typeof persistUnifiedContent>>
  try {
    result = await persistUnifiedContent(supabase, body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'persist_exception'
    logApiEvent('/api/posts', 'persist_exception', { ip, userId: authUser.id, error: message })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
  if (!result.ok) {
    logApiEvent('/api/posts', 'persist_error', { ip, userId: authUser.id, status: result.status, error: result.error })
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
  }
  after(async () => {
    const tasks = (result as { backgroundTasks?: Promise<unknown>[] }).backgroundTasks || []
    if (tasks.length === 0) return
    const settled = await Promise.allSettled(tasks)
    const hasFailures = settled.some(s => s.status === 'rejected')
    const postId = (result as { value?: { post_id?: string } }).value?.post_id || null
    logApiEvent('/api/posts', 'secondary_tasks_audit', {
      postId,
      secondaryTasksCount: tasks.length,
      status: hasFailures ? 'failed' : 'success',
    })
  })
  logApiEvent('/api/posts', 'ok', { ip, userId: authUser.id })
  return NextResponse.json({ ok: true, value: result.value }, { status: 201 })
}

