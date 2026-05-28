import { NextResponse } from 'next/server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'
import { getServerGoogleMapsApiKey } from '@/lib/server/env'

export async function GET(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`photos:${ip}`, 120, 60_000)
  if (!rl.ok) return new NextResponse('rate_limited', { status: 429 })

  const url = new URL(req.url)
  const ref = url.searchParams.get('ref') || ''
  const maxwidth = url.searchParams.get('w') || '900'

  if (!ref || ref.length < 10) return new NextResponse('bad_request', { status: 400 })

  let key: string
  try {
    key = getServerGoogleMapsApiKey()
  } catch {
    return new NextResponse('not_configured', { status: 503 })
  }

  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(ref)}&key=${encodeURIComponent(key)}`

  try {
    const upstream = await fetch(photoUrl, { redirect: 'follow' })
    if (!upstream.ok) return new NextResponse('upstream_error', { status: upstream.status })

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new NextResponse('upstream_error', { status: 502 })
  }
}
