import { NextResponse } from 'next/server'
import { consumeRateLimit, getClientIp } from '@/lib/server/rate-limit'

const SUPABASE_HOST = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')

// Acepta cualquier URL de Supabase Storage (public o signed)
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      // mismo host del proyecto Supabase
      (SUPABASE_HOST && parsed.host === SUPABASE_HOST && parsed.pathname.startsWith('/storage/v1/')) ||
      // signed URLs de Supabase CDN
      parsed.host.endsWith('.supabase.co') && parsed.pathname.startsWith('/storage/v1/')
    )
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  const ip = getClientIp(req)
  const rl = consumeRateLimit(`media-proxy:${ip}`, 180, 60_000)
  if (!rl.ok) return new NextResponse('rate_limited', { status: 429 })

  const url = new URL(req.url)
  const mediaUrl = decodeURIComponent(url.searchParams.get('url') || '')

  if (!mediaUrl || !isAllowedUrl(mediaUrl)) {
    return new NextResponse('forbidden', { status: 403 })
  }

  // Forward Range header only if present (Firefox sends it for video seeking)
  const upstreamHeaders: HeadersInit = {}
  const rangeHeader = req.headers.get('range')
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader

  let upstream: Response
  try {
    upstream = await fetch(mediaUrl, { headers: upstreamHeaders })
  } catch {
    return new NextResponse('upstream_error', { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse('upstream_error', { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') || 'video/mp4'
  const resHeaders = new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
  })

  const contentLength = upstream.headers.get('content-length')
  const contentRange = upstream.headers.get('content-range')
  if (contentLength) resHeaders.set('Content-Length', contentLength)
  if (contentRange) resHeaders.set('Content-Range', contentRange)

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  })
}

// Handle preflight for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  })
}
