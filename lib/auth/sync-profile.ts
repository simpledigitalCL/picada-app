'use client'

import type { Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase'

function slugifyUsername(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildUsername(session: Session): string {
  const meta = (session.user.user_metadata || {}) as Record<string, unknown>
  const candidates = [
    meta.preferred_username,
    meta.user_name,
    meta.name,
    session.user.email?.split('@')[0],
    `user-${session.user.id.slice(0, 8)}`,
  ]
  for (const c of candidates) {
    const v = slugifyUsername(String(c || ''))
    if (v.length >= 3) return v.slice(0, 32)
  }
  return `user-${session.user.id.slice(0, 8)}`
}

export async function ensureProfileForSession(session: Session | null | undefined) {
  if (!session?.user?.id) return
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return

  const meta = (session.user.user_metadata || {}) as Record<string, unknown>
  const avatar = String(meta.avatar_url || meta.picture || '').trim() || null
  const usernameBase = buildUsername(session)

  const basePayload = {
    id: session.user.id,
    username: usernameBase,
    avatar_url: avatar,
    updated_at: new Date().toISOString(),
  }

  const firstTry = await supabase
    .from('profiles')
    .upsert(basePayload, { onConflict: 'id' })

  if (!firstTry.error) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('picada.user.id.v1', session.user.id)
    }
    return
  }

  const fallbackPayload = {
    ...basePayload,
    username: `${usernameBase.slice(0, 20)}-${session.user.id.slice(0, 6)}`,
  }
  await supabase.from('profiles').upsert(fallbackPayload, { onConflict: 'id' })
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('picada.user.id.v1', session.user.id)
  }
}

