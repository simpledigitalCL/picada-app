import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Singleton: una sola instancia por proceso de browser.
// Llamar createClient() en cada render creaba múltiples GoTrueClient
// lo que generaba warnings y comportamiento indefinido en auth.
let _client: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (_client) return _client
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  _client = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return _client
}
