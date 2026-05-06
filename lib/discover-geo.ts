/**
 * Geo extra params for /api/restaurants/discover so radio búsqueda y texto
 * de ubicación no se desincronicen (el label de reverse geocode rara vez es idéntico al input).
 */

import { DEFAULT_SEARCH_RADIUS_KM } from '@/lib/location-search'

export function locationMatchesQuery(geoLabel: string | undefined, locationQuery: string): boolean {
  if (!locationQuery?.trim()) return true
  if (!geoLabel?.trim()) return true
  const norm = (s: string) =>
    s.toLowerCase().replace(/\s+/g, ' ').replace(/[''`´]/g, "'").trim()
  const a = norm(geoLabel)
  const b = norm(locationQuery)
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  const partsA = a.split(/[,·]/).map(s => s.trim()).filter(s => s.length > 1)
  const partsB = b.split(/[,·]/).map(s => s.trim()).filter(s => s.length > 1)
  for (const x of partsA) {
    for (const y of partsB) {
      if (x.includes(y) || y.includes(x)) return true
    }
  }
  return false
}

type GeoV1 = { lat?: number; lng?: number; radiusKm?: number; label?: string }

function readGeoWithPriority(): GeoV1 | null {
  if (typeof window === 'undefined') return null
  for (const key of ['picada.geo.session.v1', 'picada.geo.v1'] as const) {
    const raw = key === 'picada.geo.session.v1'
      ? window.sessionStorage.getItem(key)
      : window.localStorage.getItem(key)
    if (!raw) continue
    try {
      const g = JSON.parse(raw) as GeoV1
      if (Number.isFinite(g.lat) && Number.isFinite(g.lng)) return g
    } catch {
      // ignore
    }
  }
  return null
}

/** Query string para discover (incl. &latitude=… si hay geo alineada al texto de ubicación). */
export function getDiscoverGeoQueryExtra(locationQuery: string): string {
  const g = readGeoWithPriority()
  if (!g) return ''
  if (!locationMatchesQuery(g.label, locationQuery)) return ''
  const r = g.radiusKm != null && g.radiusKm >= 1 ? g.radiusKm : DEFAULT_SEARCH_RADIUS_KM
  return `&latitude=${encodeURIComponent(String(g.lat))}&longitude=${encodeURIComponent(String(g.lng))}&radius=${encodeURIComponent(String(r))}`
}
