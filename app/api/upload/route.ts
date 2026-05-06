import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { logApiEvent } from '@/lib/server/observability'

const BUCKET = 'user-media'
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`upload:${ip}`, 20, 60_000)
  if (!rl.ok) {
    logApiEvent('/api/upload', 'rate_limited', { ip })
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }
  const authUser = await requireAuthenticatedUser(req)
  if (!authUser) {
    logApiEvent('/api/upload', 'unauthorized', { ip })
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'no_supabase' }, { status: 500 })

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ ok: false, error: 'expected_multipart' }, { status: 400 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ ok: false, error: 'bad_form' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ ok: false, error: 'unsupported_file_type' }, { status: 415 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: 'file_too_large' }, { status: 413 })
  }

  const userId = String(authUser.id || '').slice(0, 40)
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(userId)) {
    return NextResponse.json({ ok: false, error: 'invalid_user_id' }, { status: 400 })
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const kind = file.type.startsWith('video/') ? 'video' : 'photo'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    logApiEvent('/api/upload', 'upload_error', { ip, userId, error: uploadError.message })
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 })
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = publicUrlData?.publicUrl || null

  logApiEvent('/api/upload', 'ok', { ip, userId, kind })
  return NextResponse.json({ ok: true, url, kind, path })
}
