import { NextResponse } from 'next/server'

export type AutocompleteKind = 'all' | 'region' | 'city' | 'commune'

type NominatimRow = {
  place_id?: number
  osm_type?: string
  osm_id?: number
  type?: string
  class?: string
  display_name: string
  name?: string
  lat: string
  lon: string
  addresstype?: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    region?: string
    country?: string
  }
}

type Item = {
  id: string
  label: string
  value: string
  lat: number
  lng: number
  kind: 'region' | 'city' | 'commune' | 'other'
  suggestedRadiusKm: number
  commune?: string
  region?: string
}

const KIND_LABEL: Record<Item['kind'], string> = {
  region: 'Región',
  city: 'Ciudad',
  commune: 'Comuna',
  other: 'Lugar',
}

function classify(row: NominatimRow): { kind: Item['kind']; suggestedRadiusKm: number } {
  const t = (row.type || '').toLowerCase()
  const c = (row.class || '').toLowerCase()
  const at = (row.addresstype || '').toLowerCase()
  const a = row.address || {}

  if (at === 'state' || at === 'region' || t === 'state' || (c === 'boundary' && t === 'administrative' && !a.city && !a.town)) {
    return { kind: 'region', suggestedRadiusKm: 200 }
  }
  if (at === 'city' || at === 'town' || t === 'city' || t === 'town') {
    return { kind: 'city', suggestedRadiusKm: 120 }
  }
  if (
    ['municipality', 'suburb', 'village', 'neighbourhood', 'quarter', 'hamlet', 'locality'].includes(at) ||
    ['village', 'town', 'suburb', 'neighbourhood', 'hamlet', 'locality'].includes(t)
  ) {
    return { kind: 'commune', suggestedRadiusKm: 60 }
  }
  if (a.state || a.region) {
    if (!a.city && !a.town && !a.village && !a.municipality) {
      return { kind: 'region', suggestedRadiusKm: 200 }
    }
  }
  return { kind: 'other', suggestedRadiusKm: 90 }
}

function rowToParts(row: NominatimRow) {
  const a = row.address || {}
  const primary =
    row.name ||
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.county ||
    row.display_name.split(',')[0]?.trim() ||
    'Ubicación'
  const commune = a.city || a.town || a.village || a.municipality || a.county || ''
  const region = a.state || a.region || ''
  const country = a.country || ''
  return { primary, commune, region, country }
}

function buildLabel(row: NominatimRow, kind: Item['kind']): string {
  const { primary, commune, region, country } = rowToParts(row)
  const badge = KIND_LABEL[kind]
  const tail = [region, country].filter(Boolean).join(', ')
  if (kind === 'region' && region) {
    return `${primary} (${badge}) · ${country || 'Chile'}`
  }
  if (commune && region && commune !== primary) {
    return `${primary} (${badge}) · ${commune} · ${region}${country ? `, ${country}` : ''}`
  }
  if (region || country) {
    return `${primary} (${badge}) · ${[region, country].filter(Boolean).join(', ')}`
  }
  return `${primary} (${badge})`
}

function rowId(row: NominatimRow, idx: number): string {
  if (row.osm_type && row.osm_id != null) return `${row.osm_type}:${row.osm_id}`
  if (row.place_id != null) return `pid:${row.place_id}`
  return `f:${row.lat},${row.lon}:${idx}`
}

function nominatimFeatureType(kind: AutocompleteKind): string | null {
  if (kind === 'region') return 'state'
  if (kind === 'city') return 'city'
  if (kind === 'commune') return 'settlement'
  return null
}

function buildSearchQuery(q: string, kind: AutocompleteKind): string {
  const base = q.trim()
  if (!base) return base
  if (kind === 'region') return `${base}, Chile`
  if (kind === 'city') return `${base}, Chile`
  if (kind === 'commune') return `${base}, comuna, Chile`
  return `${base}, Chile`
}

function filterByKind(rows: NominatimRow[], kind: AutocompleteKind): NominatimRow[] {
  if (kind === 'all') return rows
  return rows.filter((row) => {
    const { kind: k } = classify(row)
    if (kind === 'region') return k === 'region'
    if (kind === 'city') return k === 'city' || k === 'other'
    if (kind === 'commune') return k === 'commune' || k === 'city' || k === 'other'
    return true
  })
}

/** Evita varias filas Nominatim para el mismo lugar (p. ej. 4× “Rancagua”). */
function normalizePlaceName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function dedupeItems(items: Item[]): Item[] {
  const seenName = new Set<string>()
  const out: Item[] = []
  for (const it of items) {
    const name = normalizePlaceName(it.value)
    if (name.length >= 2 && seenName.has(name)) continue
    if (name.length >= 2) seenName.add(name)
    out.push(it)
    if (out.length >= 10) break
  }
  return out
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const qRaw = (url.searchParams.get('q') || '').trim()
  if (qRaw.length < 2) return NextResponse.json({ items: [] as Item[] })

  const kindParam = (url.searchParams.get('kind') || 'all').toLowerCase()
  const kind: AutocompleteKind =
    kindParam === 'region' || kindParam === 'city' || kindParam === 'commune' ? kindParam : 'all'

  const searchQ = buildSearchQuery(qRaw, kind)

  const upstream = new URL('https://nominatim.openstreetmap.org/search')
  upstream.searchParams.set('q', searchQ)
  upstream.searchParams.set('format', 'jsonv2')
  upstream.searchParams.set('addressdetails', '1')
  upstream.searchParams.set('limit', '12')
  upstream.searchParams.set('countrycodes', 'cl')
  const ft = nominatimFeatureType(kind)
  if (ft) upstream.searchParams.set('featuretype', ft)

  const r = await fetch(upstream.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PicadaApp/1.0 (location-autocomplete; contact=picada.app)',
    },
    cache: 'no-store',
  })
  const rows = r.ok ? ((await r.json()) as NominatimRow[]) : []
  let filtered = filterByKind(rows, kind)

  let items: Item[] = filtered.map((row, idx) => {
    const { kind: k, suggestedRadiusKm } = classify(row)
    const { primary, commune, region } = rowToParts(row)
    const label = buildLabel(row, k)
    return {
      id: rowId(row, idx),
      label,
      value: primary,
      lat: Number(row.lat),
      lng: Number(row.lon),
      kind: k,
      suggestedRadiusKm,
      commune: commune || undefined,
      region: region || undefined,
    }
  })

  items = dedupeItems(items)

  if (items.length === 0) {
    const photon = new URL('https://photon.komoot.io/api/')
    photon.searchParams.set('q', qRaw)
    photon.searchParams.set('lang', 'es')
    photon.searchParams.set('limit', '12')
    photon.searchParams.set('bbox', '-76.5,-56.5,-66.0,-17.3')
    const pr = await fetch(photon.toString(), { cache: 'no-store' })
    if (pr.ok) {
      const pd = (await pr.json()) as {
        features?: Array<{
          geometry?: { coordinates?: number[] }
          properties?: Record<string, string>
        }>
      }
      const raw: Item[] = (pd.features || []).map((f, i) => {
        const p = f.properties || {}
        const osmId = p.osm_id
        const osmKey = p.osm_key
        const id =
          osmId && osmKey ? `${osmKey}:${osmId}` : `photon:${i}:${p.name || ''}`
        const city = p.city || p.name || ''
        const state = p.state || p.county || ''
        const country = p.country || ''
        const coords = f.geometry?.coordinates || [0, 0]
        const lng = Number(coords[0] || 0)
        const lat = Number(coords[1] || 0)
        const label = [city, state, country].filter(Boolean).join(' · ') || `Ubicación ${i + 1}`
        const pt = String(p.type || '').toLowerCase()
        let k: Item['kind'] = 'commune'
        if (pt === 'state') k = 'region'
        else if (pt === 'city' || pt === 'district') k = 'city'
        const radius = k === 'region' ? 200 : k === 'city' ? 120 : 60
        return {
          id,
          label: `${label} (${KIND_LABEL[k]})`,
          value: city || label,
          lat,
          lng,
          kind: k,
          suggestedRadiusKm: radius,
          commune: city || undefined,
          region: state || undefined,
        }
      })
      items = dedupeItems(raw)
    }
  }

  return NextResponse.json({ items })
}
