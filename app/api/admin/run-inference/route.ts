import { NextResponse } from 'next/server'
import { runCityInferenceBatch } from '@/lib/inference/tag-processor'
import { requireAuthenticatedUser } from '@/lib/server/auth'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`run-inference:${ip}`, 3, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const auth = await requireAuthenticatedUser(req)
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized', message: 'Sesión requerida' },
      { status: 401 },
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'server_misconfigured', message: 'Supabase server client no disponible' },
      { status: 500 },
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json(
      { ok: false, error: 'profile_lookup_failed', message: profileError.message },
      { status: 500 },
    )
  }

  if (profile?.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'forbidden', message: 'Solo admins pueden ejecutar inferencia' },
      { status: 403 },
    )
  }

  const url = new URL(req.url)
  const city = String(url.searchParams.get('city') || '').trim()
  const batchSize = Number(url.searchParams.get('batchSize') || 200)
  const dryRun = String(url.searchParams.get('dryRun') || '').toLowerCase() === 'true'

  if (!city) {
    return NextResponse.json(
      { ok: false, error: 'city_required', message: 'Debes enviar ?city=NombreCiudad' },
      { status: 400 },
    )
  }

  try {
    const result = await runCityInferenceBatch({ city, batchSize, dryRun })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'inference_failed', details: error instanceof Error ? error.message : 'unknown_error' },
      { status: 500 },
    )
  }
}

