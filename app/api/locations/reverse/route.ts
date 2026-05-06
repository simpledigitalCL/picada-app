import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  if (!lat || !lng) return NextResponse.json({ location: '' })

  const upstream = new URL('https://nominatim.openstreetmap.org/reverse')
  upstream.searchParams.set('format', 'jsonv2')
  upstream.searchParams.set('lat', lat)
  upstream.searchParams.set('lon', lng)

  const r = await fetch(upstream.toString(), {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'PicadaApp/1.0 (location-reverse)',
    },
    cache: 'no-store',
  })
  if (!r.ok) return NextResponse.json({ location: '' })
  const data = (await r.json()) as { display_name?: string; address?: Record<string, string> }
  const address = data.address || {}
  const commune = address.city || address.town || address.village || address.suburb || address.county || ''
  const region = address.state || ''
  const road = address.road || address.pedestrian || address.footway || ''
  const compact = [commune, region, address.country].filter(Boolean).join(', ')
  return NextResponse.json({
    location: compact || data.display_name || '',
    commune,
    region,
    road,
  })
}

