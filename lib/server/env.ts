import 'server-only'

function readRequired(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required server env: ${name}`)
  }
  return value.trim()
}

export function getServerSupabaseUrl(): string {
  const fromServer = process.env.SUPABASE_URL
  const fromPublic = process.env.NEXT_PUBLIC_SUPABASE_URL
  const value = (fromServer || fromPublic || '').trim()
  if (!value) {
    throw new Error('Missing required server env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)')
  }
  return value
}

export function getServerSupabaseServiceRoleKey(): string {
  return readRequired('SUPABASE_SERVICE_ROLE_KEY')
}

export function getServerGoogleMapsApiKey(): string {
  return readRequired('GOOGLE_MAPS_API_KEY')
}
