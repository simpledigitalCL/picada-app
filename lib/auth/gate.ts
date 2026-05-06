'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase'

export async function isAuthenticatedClient(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session?.user)
}

export async function requireAuthOrPrompt(): Promise<boolean> {
  const ok = await isAuthenticatedClient()
  if (!ok && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('picada:require-auth'))
  }
  return ok
}
