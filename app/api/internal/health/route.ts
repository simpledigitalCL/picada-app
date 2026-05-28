import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: 'no_supabase_client', hint: 'SUPABASE_SERVICE_ROLE_KEY missing or SUPABASE_URL wrong' })
  }
  const t0 = Date.now()
  const { data, error } = await supabase
    .from('place_discovery_cache')
    .select('location_key')
    .eq('location_key', 'daily::rancagua::2026-05-28')
    .maybeSingle()
  const qt = Date.now() - t0
  if (error) {
    return NextResponse.json({ ok: false, reason: 'query_error', code: error.code, message: error.message, qt })
  }
  return NextResponse.json({
    ok: true,
    rowFound: Boolean(data),
    qt,
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'not_set',
  })
}
