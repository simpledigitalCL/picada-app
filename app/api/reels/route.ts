import { NextResponse } from 'next/server'
import type { ReelItem } from '@/lib/feed/types'

const RECIPE_BLOCKLIST = [
  'receta',
  'cómo hacer',
  'como hacer',
  'cómo preparar',
  'como preparar',
  'ingredientes',
  'tutorial',
  'paso a paso',
  'how to make',
  'cooking tutorial',
  'en la cocina con',
  'batiendo',
  'horne',
]

const CL_BOOST = /chile|santiago|🇨🇱|santiagu|stgo|porta?ñ|gastronom|picada|restaurante|comida|food tour|barrio|local|chileno|chilena/i

function isRecipeContent(text: string): boolean {
  const t = text.toLowerCase()
  return RECIPE_BLOCKLIST.some(p => t.includes(p))
}

function isReelItemGastronomic(item: { title: string; description: string }): boolean {
  if (isRecipeContent(item.title) || isRecipeContent(item.description)) return false
  return true
}

function normalizeTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[,\s/]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 2)
}

function matchesLocation(text: string, location: string): boolean {
  const tokens = normalizeTokens(location)
  if (tokens.length === 0) return true
  const t = text.toLowerCase()
  return tokens.some(token => t.includes(token))
}

function locationScore(text: string, location: string): number {
  const tokens = normalizeTokens(location)
  if (tokens.length === 0) return 0
  const t = text.toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (t.includes(token)) score += 1
  }
  return score
}

function parseRestrictions(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

function restrictionScore(text: string, restrictions: string[]): number {
  const t = text.toLowerCase()
  let score = 0
  for (const r of restrictions) {
    if (t.includes(r)) score += 2.8
    if (r.includes('lactosa') && /sin lactosa|lactose free|leche vegetal/.test(t)) score += 3.5
    if (r.includes('veg') && /vegano|vegan|plant based/.test(t)) score += 3.2
    if (r.includes('gluten') && /sin gluten|gluten free|sin tacc/.test(t)) score += 3.2
    if (r.includes('keto') && /keto|low carb/.test(t)) score += 3.2
  }
  return score
}

function extractYoutubeIdFromUrlOrId(s: string): string | null {
  const t = s.trim()
  if (/^[\w-]{11}$/.test(t)) return t
  const m = t.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function youtubeIdFromSource(source: string): string | null {
  return extractYoutubeIdFromUrlOrId(source)
}

function youtubeEmbedWithAutoplayLoop(videoId: string): string {
  const u = new URL(`https://www.youtube.com/embed/${videoId}`)
  u.searchParams.set('rel', '0')
  u.searchParams.set('modestbranding', '1')
  u.searchParams.set('playsinline', '1')
  u.searchParams.set('autoplay', '1')
  u.searchParams.set('mute', '1')
  u.searchParams.set('controls', '1')
  u.searchParams.set('loop', '1')
  u.searchParams.set('playlist', videoId)
  u.searchParams.set('enablejsapi', '1')
  u.searchParams.set('start', '0')
  return u.toString()
}

/** Fallback curado: cortos y videos gastronómicos sobre Chile (sin API) */
const CURATED: Omit<ReelItem, 'id'>[] = [
  {
    platform: 'youtube',
    title: 'Peruanos probando comida chilena en Santiago',
    description: 'Street food y locales en la capital',
    author: 'YouTube',
    thumbnailUrl: 'https://i.ytimg.com/vi/N4PQPvi5HNQ/sddefault.jpg',
    embedUrl: youtubeEmbedWithAutoplayLoop('N4PQPvi5HNQ'),
    sourceUrl: 'https://www.youtube.com/shorts/N4PQPvi5HNQ',
    tags: ['santiago', 'comida chilena', 'callejera'],
  },
  {
    platform: 'youtube',
    title: 'Comidas y dónde probarlas en Chile',
    description: 'Gastronomía y recorridos',
    author: 'YouTube',
    thumbnailUrl: 'https://i.ytimg.com/vi/FDZ61Mx-QqI/sddefault.jpg',
    embedUrl: youtubeEmbedWithAutoplayLoop('FDZ61Mx-QqI'),
    sourceUrl: 'https://www.youtube.com/shorts/FDZ61Mx-QqI',
    tags: ['chile', 'gastronomía'],
  },
  {
    platform: 'youtube',
    title: 'Street food y locales imperdibles en Santiago',
    description: 'Descubriendo puestos y comida callejera',
    author: 'YouTube',
    thumbnailUrl: 'https://i.ytimg.com/vi/eigdtxBakJ8/sddefault.jpg',
    embedUrl: youtubeEmbedWithAutoplayLoop('eigdtxBakJ8'),
    sourceUrl: 'https://www.youtube.com/watch?v=eigdtxBakJ8',
    tags: ['santiago', 'street food'],
  },
  {
    platform: 'youtube',
    title: 'Comida típica en Santiago',
    description: 'Primeras impresiones de la gastronomía chilena',
    author: 'YouTube',
    thumbnailUrl: 'https://i.ytimg.com/vi/jGiOQE-ryYk/sddefault.jpg',
    embedUrl: youtubeEmbedWithAutoplayLoop('jGiOQE-ryYk'),
    sourceUrl: 'https://www.youtube.com/watch?v=jGiOQE-ryYk',
    tags: ['santiago', 'típico chileno'],
  },
]

function stableId(p: ReelItem['platform'], key: string) {
  return `${p}-${key}`.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)
}

function toReel(p: (typeof CURATED)[0], i: number): ReelItem {
  const id = stableId(
    p.platform,
    p.sourceUrl + String(i),
  )
  return { ...p, id }
}

async function fetchYoutubeSearch(
  key: string,
  query: string,
  max: number,
  location: string,
  publishedAfter?: string,
): Promise<ReelItem[]> {
  const u = new URL('https://www.googleapis.com/youtube/v3/search')
  u.searchParams.set('part', 'snippet')
  u.searchParams.set('type', 'video')
  u.searchParams.set('maxResults', String(max))
  u.searchParams.set('q', `${query} ${location}`.trim())
  u.searchParams.set('relevanceLanguage', 'es')
  u.searchParams.set('regionCode', 'CL')
  u.searchParams.set('videoDuration', 'short')
  u.searchParams.set('order', 'date')
  if (publishedAfter) u.searchParams.set('publishedAfter', publishedAfter)
  u.searchParams.set('key', key)

  const r = await fetch(u.toString(), { cache: 'no-store' })
  if (!r.ok) return []
  const data = (await r.json()) as {
    items?: { id: { videoId: string }; snippet: { title: string; description: string; channelTitle: string; thumbnails: { high?: { url: string } } } }[]
  }
  const out: Array<ReelItem & { _locScore?: number }> = []
  for (const it of data.items || []) {
    const vid = it.id?.videoId
    if (!vid) continue
    const sn = it.snippet
    const title = sn.title
    const description = sn.description || ''
    if (!isReelItemGastronomic({ title, description })) continue
    if (!CL_BOOST.test(title + ' ' + description)) {
      if (!/restaur|comida|food|eat|gastro|picad|lomito|empan|asado|sushi|café|bar|chef/i.test(title + description)) continue
    }
    const thumb = sn.thumbnails?.high?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`
    const loc = locationScore(`${title} ${description} ${sn.channelTitle}`, location)
    out.push({
      id: stableId('youtube', vid),
      platform: 'youtube',
      title,
      description: description.slice(0, 220),
      author: sn.channelTitle,
      thumbnailUrl: thumb,
      embedUrl: youtubeEmbedWithAutoplayLoop(vid),
      sourceUrl: `https://www.youtube.com/watch?v=${vid}`,
      tags: ['youtube', 'búsqueda'],
      _locScore: loc,
    })
  }
  out.sort((a, b) => (b._locScore || 0) - (a._locScore || 0))
  return out
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url)
  const cookieLocation = req.headers.get('cookie')?.match(/(?:^|;\s*)picada_location=([^;]+)/)?.[1]
  const location = (reqUrl.searchParams.get('location') || (cookieLocation ? decodeURIComponent(cookieLocation) : '')).trim()
  const restrictions = parseRestrictions(reqUrl.searchParams.get('restrictions') || '')
  const key = process.env.YOUTUBE_API_KEY
  const merged: ReelItem[] = []

  if (key) {
    const queries = shuffled([
      'picadas santiago chile comida',
      'restaurantes santiago 2024',
      'comida chilena restaurante',
      'food vlog restaurantes',
      'street food latinoamerica',
      'top restaurantes comida local',
      'comida callejera',
      'mejores restaurantes',
      'food shorts',
      'restaurant review',
    ])
    const recent = new Date(Date.now() - 1000 * 60 * 60 * 24 * 540).toISOString()
    for (const q of queries.slice(0, 8)) {
      const batch = await fetchYoutubeSearch(key, q, 25, location, recent)
      merged.push(...batch)
    }
  }

  for (const [i, c] of CURATED.entries()) {
    if (c.platform === 'youtube') {
      const vid = extractYoutubeIdFromUrlOrId(c.sourceUrl) || extractYoutubeIdFromUrlOrId(c.embedUrl)
      if (vid) {
        if (merged.some(m => m.platform === 'youtube' && m.embedUrl.includes(vid))) continue
      }
    }
    merged.push(toReel(c, i))
  }

  const seen = new Set<string>()
  const dedup: ReelItem[] = []
  for (const item of merged) {
    if (isRecipeContent(item.title) || isRecipeContent(item.description)) continue
    const k = item.embedUrl
    if (seen.has(k)) continue
    seen.add(k)
    dedup.push(item)
  }

  const ranked = shuffled(dedup).sort((a, b) => {
    const aText = `${a.title} ${a.description} ${a.author} ${a.tags.join(' ')}`
    const bText = `${b.title} ${b.description} ${b.author} ${b.tags.join(' ')}`
    const aLoc = locationScore(aText, location)
    const bLoc = locationScore(bText, location)
    const aRestr = restrictionScore(aText, restrictions)
    const bRestr = restrictionScore(bText, restrictions)
    return (bLoc * 2 + bRestr) - (aLoc * 2 + aRestr)
  })

  return NextResponse.json({
    items: ranked.slice(0, 40),
    source: key ? 'youtube+curated' : 'curated',
    at: new Date().toISOString(),
  })
}
