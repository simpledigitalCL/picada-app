import { createClient } from '@supabase/supabase-js'
import { getServerSupabaseServiceRoleKey, getServerSupabaseUrl } from '@/lib/server/env'

export function getSupabaseServerClient() {
  try {
    const url = getServerSupabaseUrl()
    const serviceRole = getServerSupabaseServiceRoleKey()
    return createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  } catch {
    return null
  }
}

