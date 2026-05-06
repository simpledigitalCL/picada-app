'use client'

export type LocationMode = 'manual' | 'auto'
export type GeoState = { lat?: number; lng?: number; radiusKm?: number; label?: string } | null

const LOCATION_KEY = 'picada.location.v1'
const LOCATION_MODE_KEY = 'picada.location.mode.v1'
const GEO_KEY = 'picada.geo.v1'
const GEO_SESSION_KEY = 'picada.geo.session.v1'
const LOCATION_CHANGED_EVENT = 'picada:location-changed'
const RECENT_SEARCHES_KEY = 'picada.recent.searches.v1'
const MAX_RECENT_SEARCHES = 5

function readJson<T>(key: string, source: Storage, fallback: T): T {
  try {
    const raw = source.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function getCurrentLocation(): { label: string; mode: LocationMode; geo: GeoState } {
  if (typeof window === 'undefined') return { label: '', mode: 'manual', geo: null }
  const label = (window.localStorage.getItem(LOCATION_KEY) || '').trim()
  const modeRaw = window.localStorage.getItem(LOCATION_MODE_KEY)
  const mode: LocationMode = modeRaw === 'auto' ? 'auto' : 'manual'
  const geoSession = readJson<GeoState>(GEO_SESSION_KEY, window.sessionStorage, null)
  const geoLocal = readJson<GeoState>(GEO_KEY, window.localStorage, null)
  return { label, mode, geo: geoSession || geoLocal }
}

export function resolveDiscoverLocation(locationQuery?: string): string {
  const current = getCurrentLocation().label
  const candidate = (locationQuery || '').trim() || current
  return candidate.length >= 2 ? candidate : ''
}

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveToRecentSearches(label: string) {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentSearches().filter(s => s.toLowerCase() !== label.toLowerCase())
    const updated = [label, ...existing].slice(0, MAX_RECENT_SEARCHES)
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // ignore
  }
}

export function setCurrentLocation(label: string) {
  if (typeof window === 'undefined') return
  const normalized = label.trim()
  if (!normalized) {
    window.localStorage.removeItem(LOCATION_KEY)
    document.cookie = 'picada_location=; path=/; max-age=0; samesite=lax'
    notifyLocationChanged()
    return
  }
  window.localStorage.setItem(LOCATION_KEY, normalized)
  document.cookie = `picada_location=${encodeURIComponent(normalized)}; path=/; max-age=31536000; samesite=lax`
  saveToRecentSearches(normalized)
  notifyLocationChanged()
}

export function setLocationMode(mode: LocationMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCATION_MODE_KEY, mode)
  notifyLocationChanged()
}

export function setGeoFilter(geo: { lat: number; lng: number; radiusKm: number; label: string }, mode: LocationMode) {
  if (typeof window === 'undefined') return
  const payload = JSON.stringify(geo)
  if (mode === 'auto') {
    window.localStorage.setItem(GEO_KEY, payload)
    window.sessionStorage.removeItem(GEO_SESSION_KEY)
  } else {
    window.sessionStorage.setItem(GEO_SESSION_KEY, payload)
  }
  notifyLocationChanged()
}

export function clearGeoFilter() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(GEO_KEY)
  window.sessionStorage.removeItem(GEO_SESSION_KEY)
  notifyLocationChanged()
}

export function subscribeToLocationChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback()
  window.addEventListener(LOCATION_CHANGED_EVENT, handler)
  window.addEventListener('picada:geo-updated', handler) // backward compatibility
  return () => {
    window.removeEventListener(LOCATION_CHANGED_EVENT, handler)
    window.removeEventListener('picada:geo-updated', handler)
  }
}

export function notifyLocationChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(LOCATION_CHANGED_EVENT))
  window.dispatchEvent(new Event('picada:geo-updated')) // backward compatibility
}

