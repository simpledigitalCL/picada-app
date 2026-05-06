import { getSupabaseServerClient } from '@/lib/supabase-server'

export type AuthUser = {
  id: string
  email?: string | null
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}

export async function requireAuthenticatedUser(req: Request): Promise<AuthUser | null> {
  const token = getBearerToken(req)
  if (!token) return null
  const supabase = getSupabaseServerClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.id) return null
  return { id: data.user.id, email: data.user.email }
}
