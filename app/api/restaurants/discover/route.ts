import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { hydrateAutomatedSeedTagsFromPlacesDb, mergeInferredTagsForDiscover } from '@/lib/tags/discover-item'
import { buildMergedPlaceClassification } from '@/lib/tags/merge-automated'
import type { PlaceTaggingMeta } from '@/lib/tags/types'
import { getServerGoogleMapsApiKey } from '@/lib/server/env'
import { getSupabaseServerClient } from '@/lib/supabase-server'

type GooglePlace = {
  place_id: string
  name: string
  formatted_address: string
  geometry?: { location?: { lat: number; lng: number } }
  rating?: number
  user_ratings_total?: number
  price_level?: number
  types?: string[]
  photos?: { photo_reference: string }[]
}

type GoogleTextSearchResponse = {
  results?: GooglePlace[]
  next_page_token?: string
  status?: string
  error_message?: string
}

type OsmGeocode = {
  lat: string
  lon: string
}

type NominatimPlace = {
  place_id?: number
  display_name?: string
  lat?: string
  lon?: string
  name?: string
  type?: string
  class?: string
}

const DAILY_GLOBAL_NEW_LIMIT = 30
const DAILY_PER_LOCATION_NEW_LIMIT = 10
const DAILY_GLOBAL_DETAILS_LIMIT = 24
const DAILY_PER_LOCATION_DETAILS_LIMIT = 8
const GOOGLE_TEXTSEARCH_PAGE_SIZE_HINT = 20
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14d inventory
const LOCATION_DAILY_CACHE_TTL_MS = 1000 * 60 * 60 * 26 // one-day snapshot + buffer
const DETAILS_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24 * 14 // validar detalles max cada 14d

type OverpassElement = {
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}

type DiscoverItem = {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  rating: number
  reviews: number
  priceLevel: number | null
  mapsUrl: string
  provider: 'google_places' | 'openstreetmap'
  phone?: string | null
  website?: string | null
  whatsapp?: string | null
  instagram?: string | null
  email?: string | null
  openNow?: boolean | null
  photoUrl?: string | null
  reviewsText?: string[]
  picadaRating?: number | null
  picadaReviews?: number
  inferredTags?: string[]
  matchScore?: number
  matchReason?: string
  hasOffer?: boolean
  offerLabel?: string | null
  gallery?: string[]
  raw?: Record<string, unknown>
  detailsCheckedAt?: string | null
  /** Sin foto y/o sin texto de reseñas en datos mostrables (Google/OSM) */
  coverageSparse?: boolean
  /** Clasificación inicial automática (comunidad puede refinar después) */
  automatedSeedTags?: Array<{ slug: string; confidence_score: number; is_automated?: boolean }>
}

function finalizeDiscoverItems(items: DiscoverItem[]): DiscoverItem[] {
  return items.map(item => {
    const hasPhoto = Boolean((item.photoUrl || '').trim())
    const rawSnippets = (item.reviewsText || []).filter(t => String(t || '').trim().length > 0)
    const hasSnippet = rawSnippets.length > 0
    const googleReviewCount = Number(item.reviews || 0)
    const reviewsText =
      hasSnippet || googleReviewCount <= 0
        ? rawSnippets
        : [`Tiene ${googleReviewCount} reseñas en Google Maps`]
    const coverageSparse =
      item.provider === 'google_places'
        ? !hasPhoto || !hasSnippet || googleReviewCount < 1
        : !hasPhoto
    return { ...item, reviewsText, coverageSparse }
  })
}

function shouldRefreshDetails(item: DiscoverItem): boolean {
  const fromTop = item.detailsCheckedAt
  const fromRaw = typeof item.raw?.details_checked_at === 'string' ? String(item.raw?.details_checked_at) : ''
  const iso = (fromTop || fromRaw || '').trim()
  if (!iso) return true
  const checkedAt = new Date(iso).getTime()
  if (!Number.isFinite(checkedAt)) return true
  return Date.now() - checkedAt >= DETAILS_REFRESH_INTERVAL_MS
}

function extractInstagramFromWebsite(website: string | null): string | null {
  if (!website) return null
  const match = website.match(/instagram\.com\/([^/?#\s]+)/)
  return match ? `https://instagram.com/${match[1]}` : null
}

function generateWhatsAppLink(phone: string | null): string | null {
  if (!phone) return null
  const raw = phone.replace(/\D/g, '')
  if (!raw) return null
  // Normalización preferente Chile:
  // +56 9XXXXXXXX -> 569XXXXXXXX
  // 9XXXXXXXX     -> 569XXXXXXXX
  const noLeadingZero = raw.replace(/^0+/, '')
  let normalized = noLeadingZero
  if (!normalized.startsWith('56') && normalized.length === 9 && normalized.startsWith('9')) {
    normalized = `56${normalized}`
  }
  if (normalized.length >= 10) return `https://wa.me/${normalized}`
  return null
}

function extractReviewsFromRaw(raw: Record<string, unknown>): string[] {
  const snippets = raw.review_snippets
  if (!Array.isArray(snippets)) return []
  return snippets.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
}

function buildGooglePhotoUrl(photoReference: string, key: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=900&photo_reference=${encodeURIComponent(photoReference)}&key=${encodeURIComponent(key)}`
}

function extractContactFromRaw(raw: Record<string, unknown>): {
  phone: string | null
  website: string | null
  whatsapp: string | null
  instagram: string | null
  email: string | null
} {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const base = (raw.base && typeof raw.base === 'object') ? (raw.base as Record<string, unknown>) : null
  const phone = str(
    raw.phone ||
    raw.formatted_phone_number ||
    raw.international_phone_number ||
    base?.international_phone_number ||
    base?.formatted_phone_number,
  ) || null
  const website = str(raw.website || raw.web || raw.url || base?.website) || null
  const rawWhatsapp = str(raw.whatsapp || raw.whatsapp_number || raw.whatsapp_phone) || null
  const whatsapp = rawWhatsapp || generateWhatsAppLink(phone)
  const instagram = str(raw.instagram) || extractInstagramFromWebsite(website)
  const email = str(raw.email || raw.contact_email) || null
  return { phone, website, whatsapp, instagram, email }
}

function cleanCommune(raw: string | null | undefined): string | null {
  const value = String(raw || '')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return value || null
}

function googleAddressComponents(raw: Record<string, unknown> | undefined | null) {
  const base = (raw?.base && typeof raw.base === 'object') ? (raw.base as Record<string, unknown>) : {}
  return Array.isArray(base.address_components)
    ? base.address_components as Array<{ long_name?: string; short_name?: string; types?: string[] }>
    : []
}

function extractGoogleComponent(
  raw: Record<string, unknown> | undefined | null,
  preferredTypes: string[],
): string | null {
  const components = googleAddressComponents(raw)
  for (const type of preferredTypes) {
    const value = components.find(c => Array.isArray(c.types) && c.types.includes(type))?.long_name
    if (typeof value === 'string' && value.trim()) return cleanCommune(value)
  }
  return null
}

function extractRegion(raw: Record<string, unknown> | undefined | null, provider: 'google_places' | 'openstreetmap', address: string): string | null {
  if (provider === 'google_places') {
    return extractGoogleComponent(raw, ['administrative_area_level_1'])
  }
  const parts = String(address || '').split(',').map(p => p.trim())
  const token = parts.find(p => /regi[oó]n/i.test(p))
  return cleanCommune(token || null)
}

function extractCity(raw: Record<string, unknown> | undefined | null, provider: 'google_places' | 'openstreetmap', address: string): string | null {
  if (provider === 'google_places') {
    return extractGoogleComponent(raw, ['locality', 'administrative_area_level_2'])
  }
  const parts = String(address || '').split(',').map(p => p.trim()).filter(Boolean)
  const candidate = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  return cleanCommune(candidate || null)
}

function extractCommune(raw: Record<string, unknown> | undefined | null, provider: 'google_places' | 'openstreetmap', address: string): string | null {
  if (provider === 'google_places') {
    return extractGoogleComponent(raw, ['sublocality_level_1', 'administrative_area_level_3'])
  }
  const parts = String(address || '').split(',').map(p => p.trim()).filter(Boolean)
  const candidate = parts.length >= 3 ? parts[parts.length - 3] : parts[0]
  return cleanCommune(candidate || null)
}

function extractCategoryFromRaw(raw: Record<string, unknown> | undefined | null, provider: 'google_places' | 'openstreetmap'): string | null {
  if (!raw) return null
  if (provider === 'google_places') {
    const base = (raw.base && typeof raw.base === 'object') ? (raw.base as Record<string, unknown>) : {}
    const types = Array.isArray(base.types) ? base.types.map(String).filter(Boolean) : []
    return types[0] || null
  }
  const t = raw.type
  return typeof t === 'string' && t.trim() ? t.trim() : null
}

function parseRestrictions(raw: string): string[] {
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

/** Si no hay lat/lng no podemos medir distancia: conservamos el ítem (búsqueda ya fue por zona). */
function withinSearchRadius(item: DiscoverItem, latQ: number, lngQ: number, radiusKmQ: number): boolean {
  if (item.lat == null || item.lng == null) return true
  if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return true
  return haversineKm(latQ, lngQ, item.lat, item.lng) <= radiusKmQ
}

function filterByRadial(
  items: DiscoverItem[],
  hasGeo: boolean,
  latQ: number,
  lngQ: number,
  radiusKmQ: number,
): DiscoverItem[] {
  if (!hasGeo) return items
  const strict = items.filter(i => withinSearchRadius(i, latQ, lngQ, radiusKmQ))
  if (strict.length > 0) return strict
  // Centro del pin vs centro de resultados (Google/OSM) puede desalinear > radio: ampliar antes de vaciar.
  if (items.length === 0) return items
  const cap = Math.min(200, Math.max(radiusKmQ * 4, radiusKmQ + 40))
  const relaxed = items.filter(i => {
    if (i.lat == null || i.lng == null) return true
    if (!Number.isFinite(i.lat) || !Number.isFinite(i.lng)) return true
    return haversineKm(latQ, lngQ, i.lat, i.lng) <= cap
  })
  return relaxed.length > 0 ? relaxed : items
}

function scoreByRestrictions(item: DiscoverItem, restrictions: string[]) {
  if (restrictions.length === 0) return { score: 70, reason: 'Match por ubicación' }
  const text = [
    item.name,
    item.address,
    ...(item.reviewsText || []),
    ...(item.inferredTags || []),
  ].join(' ').toLowerCase()
  let score = 58
  const hits: string[] = []
  for (const r of restrictions) {
    if (text.includes(r)) {
      score += 16
      hits.push(r)
    } else if (r.includes('lactosa') && /sin lactosa|lactose free/.test(text)) {
      score += 18
      hits.push('sin lactosa')
    } else if (r.includes('veg') && /vegano|vegan|plant/.test(text)) {
      score += 16
      hits.push('vegano')
    } else if (r.includes('gluten') && /sin gluten|gluten free|sin tacc/.test(text)) {
      score += 16
      hits.push('sin gluten')
    }
  }
  return {
    score: Math.max(5, Math.min(99, score)),
    reason: hits.length > 0 ? `Apto por ${hits.slice(0, 2).join(', ')}` : 'Apto por reseñas y contexto',
  }
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit = {}, timeoutMs = 10000): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function canUseGoogleForLocation(location: string): boolean {
  // Permitir Google en cualquier ubicación textual válida.
  // La protección de consumo la hace el budget diario (global + por ubicación).
  return location.trim().length >= 2
}

async function discoverFromPreloadedPlaces(location: string, key?: string, providerOnly?: string): Promise<DiscoverItem[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase || !location.trim()) return []

  // Usar solo la parte principal para evitar "contaminación" por tokens regionales
  // (ej: "Región Metropolitana") que devuelven locales de otras comunas/ciudades.
  const primary = extractPrimaryLocation(location).toLowerCase()

  const conditions: string[] = []
  // Match estricto por localidad principal.
  if (primary) {
    conditions.push(
      `city.ilike.%${primary}%`,
      `commune.ilike.%${primary}%`,
      `address.ilike.%${primary}%`,
    )
  }
  if (conditions.length === 0) return []

  let dbQuery = supabase
    .from('places')
    .select('id, provider, external_id, name, address, commune, city, region, maps_url, lat, lng, rating, internal_rating, internal_rating_count, reviews_count, price_level, gallery, raw_payload, tagging_meta')
    .or(conditions.join(','))
    .order('reviews_count', { ascending: false })
    .limit(200)
  if (providerOnly) dbQuery = dbQuery.eq('provider', providerOnly)
  const { data } = await dbQuery

  return (data || []).map((p: any) => {
    const taggingMeta = (p.tagging_meta && typeof p.tagging_meta === 'object') ? p.tagging_meta as PlaceTaggingMeta : undefined
    const rawPayload = (p.raw_payload && typeof p.raw_payload === 'object') ? p.raw_payload : {}
    const contact = extractContactFromRaw(rawPayload)
    const galleryFromDb = Array.isArray(p.gallery) ? p.gallery.slice(0, 3).map((g: unknown) => String(g)) : []
    const rawBase = (rawPayload.base && typeof rawPayload.base === 'object') ? (rawPayload.base as Record<string, unknown>) : null
    const rawBasePhotos = rawBase && Array.isArray(rawBase.photos) ? rawBase.photos : []
    const firstRawRef =
      rawBasePhotos.length > 0 &&
      rawBasePhotos[0] &&
      typeof (rawBasePhotos[0] as Record<string, unknown>).photo_reference === 'string'
        ? String((rawBasePhotos[0] as Record<string, unknown>).photo_reference)
        : null
    const fallbackPhoto = firstRawRef && key ? buildGooglePhotoUrl(firstRawRef, key) : null
    const photoUrl = galleryFromDb[0] || fallbackPhoto || null
    const gallery = photoUrl
      ? [photoUrl, ...galleryFromDb.filter((g: string) => g !== photoUrl)].slice(0, 3)
      : galleryFromDb
    const automatedSeedTags = (taggingMeta?.automated_seed?.tags || []).map(
      (t: { slug: string; confidence_score?: number; is_automated?: boolean }) => ({
        slug: t.slug,
        confidence_score: Number(t.confidence_score ?? 0),
        is_automated: t.is_automated !== false,
      }),
    )
    return {
      id: p.external_id || p.id,
      name: p.name || 'Local',
      address: p.address || primary,
      lat: Number.isFinite(Number(p.lat)) ? Number(p.lat) : null,
      lng: Number.isFinite(Number(p.lng)) ? Number(p.lng) : null,
      rating: Number(p.rating || 0),
      reviews: Number(p.reviews_count || 0),
      picadaRating: p.internal_rating_count >= 1 ? Number(p.internal_rating) : null,
      picadaReviews: Number(p.internal_rating_count || 0),
      priceLevel: p.price_level ?? null,
      mapsUrl: p.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name || ''} ${p.address || ''}`.trim())}`,
      provider: (p.provider === 'openstreetmap' || p.provider === 'osm' ? 'openstreetmap' : 'google_places') as 'google_places' | 'openstreetmap',
      phone: contact.phone,
      website: contact.website,
      whatsapp: contact.whatsapp,
      instagram: contact.instagram,
      email: contact.email,
      openNow: null,
      photoUrl,
      reviewsText: extractReviewsFromRaw(rawPayload),
      gallery,
      raw: rawPayload,
      detailsCheckedAt: typeof rawPayload.details_checked_at === 'string' ? String(rawPayload.details_checked_at) : null,
      automatedSeedTags: automatedSeedTags.length > 0 ? automatedSeedTags : undefined,
    } satisfies DiscoverItem
  })
}

async function fetchGoogleTextSearchPage(
  key: string,
  query: string,
  pageToken?: string,
): Promise<GoogleTextSearchResponse | null> {
  const endpoint = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  endpoint.searchParams.set('language', 'es')
  endpoint.searchParams.set('key', key)
  if (pageToken) {
    endpoint.searchParams.set('pagetoken', pageToken)
  } else {
    endpoint.searchParams.set('query', query)
  }
  return await fetchJsonWithTimeout<GoogleTextSearchResponse>(
    endpoint.toString(),
    { cache: 'no-store' },
    4000,
  )
}

async function discoverFromGoogle(location: string, key: string): Promise<DiscoverItem[]> {
  // Usar solo el nombre principal (ej. "Rancagua" no el string completo de geocoding)
  const primaryLocation = extractPrimaryLocation(location) || location
  const query = `restaurantes ${primaryLocation}`
  const first = await fetchGoogleTextSearchPage(key, query)
  const all: GooglePlace[] = [...(first?.results || [])]
  if ((first?.next_page_token || '').trim()) {
    // Google requiere una pausa antes de usar next_page_token.
    await new Promise(r => setTimeout(r, 600))
    const second = await fetchGoogleTextSearchPage(key, query, first?.next_page_token)
    all.push(...(second?.results || []))
  }
  const base = all.slice(0, GOOGLE_TEXTSEARCH_PAGE_SIZE_HINT * 2)
  const mapped = base
    .filter(p => Boolean(p.place_id) && Boolean(p.name))
    .map((p) => {
      const photoRef = p.photos?.[0]?.photo_reference
      const photoUrl = photoRef ? buildGooglePhotoUrl(photoRef, key) : null
      return {
        id: p.place_id,
        name: p.name,
        address: p.formatted_address,
        lat: p.geometry?.location?.lat ?? null,
        lng: p.geometry?.location?.lng ?? null,
        rating: p.rating || 0,
        reviews: p.user_ratings_total || 0,
        priceLevel: p.price_level ?? null,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.formatted_address}`)}&query_place_id=${p.place_id}`,
        phone: null,
        website: null,
        openNow: null,
        photoUrl,
        reviewsText: [],
        provider: 'google_places' as const,
        raw: { base: p } as unknown as Record<string, unknown>,
        detailsCheckedAt: null,
      }
    })
  const strict = mapped.filter(item => itemMatchesLocation(item, location))
  // Si el filtro textual deja 0 (caso frecuente con direcciones abreviadas),
  // devolvemos el set base para no bloquear resultados válidos de Google.
  return strict.length > 0 ? strict : mapped
}

type GoogleLiteDetails = {
  formatted_phone_number?: string
  international_phone_number?: string
  website?: string
  opening_hours?: { open_now?: boolean }
  reviews?: Array<{ text?: string }>
  photos?: { photo_reference: string }[]
  types?: string[]
  address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>
  editorial_summary?: { overview?: string; language?: string }
}

function needsGoogleDetails(item: DiscoverItem): boolean {
  const missingPhone = !item.phone
  const missingWeb = !item.website
  const missingPhoto = !item.photoUrl
  const missingReviews = (item.reviewsText || []).length === 0
  const stale = shouldRefreshDetails(item)
  // Si faltan datos críticos, permitir reintento aunque no esté "stale" todavía.
  // El presupuesto diario ya evita sobreconsumo.
  const incomplete = missingPhone || missingWeb || missingPhoto || missingReviews
  return item.provider === 'google_places' && (incomplete || stale)
}

async function getKnownPlaceIds(externalIds: string[]): Promise<Set<string>> {
  const supabase = getSupabaseServerClient()
  if (!supabase || externalIds.length === 0) return new Set()
  const { data } = await supabase
    .from('places')
    .select('external_id')
    .in('external_id', externalIds)
    .in('provider', ['google_places', 'google'])
  return new Set((data || []).map((p: any) => String(p.external_id)))
}

async function enrichGoogleWithLiteDetails(
  items: DiscoverItem[],
  key: string,
  max = 8,
): Promise<{ items: DiscoverItem[]; consumed: number }> {
  if (!key || items.length === 0 || max <= 0) return { items, consumed: 0 }

  const toEnrichIndices: number[] = []
  for (let i = 0; i < items.length && toEnrichIndices.length < max; i++) {
    if (needsGoogleDetails(items[i]!)) toEnrichIndices.push(i)
  }
  if (toEnrichIndices.length === 0) return { items, consumed: 0 }

  let consumed = 0
  const enrichedByIndex = new Map<number, DiscoverItem>()

  await Promise.all(toEnrichIndices.map(async (i) => {
    const item = items[i]!
    try {
      const endpoint = new URL('https://maps.googleapis.com/maps/api/place/details/json')
      endpoint.searchParams.set('place_id', item.id)
      endpoint.searchParams.set('language', 'es')
      endpoint.searchParams.set(
        'fields',
        'formatted_phone_number,international_phone_number,website,opening_hours,reviews,photos,types,address_components,editorial_summary',
      )
      endpoint.searchParams.set('key', key)
      const json = await fetchJsonWithTimeout<{ result?: GoogleLiteDetails }>(
        endpoint.toString(),
        { cache: 'no-store' },
        2000,
      )
      if (!json) return
      const d = json.result || {}
      const photoRef = d.photos?.[0]?.photo_reference
      const photoUrl = photoRef ? buildGooglePhotoUrl(photoRef, key) : item.photoUrl || null
      const rawPhone = d.formatted_phone_number || d.international_phone_number || item.phone || null
      const rawWebsite = d.website || item.website || null
      const whatsapp = item.whatsapp || generateWhatsAppLink(rawPhone)
      const instagram = item.instagram || extractInstagramFromWebsite(rawWebsite)
      const reviewsText = (d.reviews || []).map(x => x.text || '').filter(Boolean).slice(0, 3)
      const googleTypesList = Array.isArray(d.types) ? d.types.map(String) : []
      const editorialSummary = (d.editorial_summary?.overview || '').trim() || null
      const now = new Date().toISOString()
      // Actualizar gallery con la foto encontrada para persistirla en BD
      const existingGallery = item.gallery || []
      const newGallery = photoUrl && !existingGallery.includes(photoUrl)
        ? [photoUrl, ...existingGallery].slice(0, 3)
        : existingGallery
      const hasMeaningfulDetails =
        Boolean(rawPhone) ||
        Boolean(rawWebsite) ||
        Boolean(photoUrl) ||
        reviewsText.length > 0 ||
        typeof d.opening_hours?.open_now === 'boolean'
      enrichedByIndex.set(i, {
        ...item,
        phone: rawPhone,
        website: rawWebsite,
        whatsapp,
        instagram,
        openNow: d.opening_hours?.open_now ?? item.openNow ?? null,
        reviewsText,
        photoUrl,
        gallery: newGallery,
        detailsCheckedAt: hasMeaningfulDetails ? now : (item.detailsCheckedAt || null),
        raw: {
          ...(item.raw || {}),
          details_checked_at: hasMeaningfulDetails ? now : (item.raw?.details_checked_at || null),
          formatted_phone_number: rawPhone,
          website: rawWebsite,
          whatsapp,
          instagram,
          // Persistir reseñas en raw_payload para no necesitar re-fetchear
          review_snippets: reviewsText,
          google_types: googleTypesList,
          base: {
            ...(item.raw?.base && typeof item.raw.base === 'object' ? item.raw.base as Record<string, unknown> : {}),
            international_phone_number: d.international_phone_number || null,
            website: d.website || null,
            types: googleTypesList,
            address_components: d.address_components || [],
          },
          editorial_snippet: editorialSummary,
          editorial_summary: editorialSummary ? { overview: editorialSummary } : undefined,
        },
      })
      consumed++
    } catch {
      // keep original
    }
  }))

  const out = items.map((item, i) => enrichedByIndex.get(i) ?? item)
  return { items: out, consumed }
}

async function discoverFromOsm(location: string) {
  const geocode = new URL('https://nominatim.openstreetmap.org/search')
  const q = /chile/i.test(location) ? location : `${location}, Chile`
  geocode.searchParams.set('q', q)
  geocode.searchParams.set('format', 'jsonv2')
  geocode.searchParams.set('limit', '1')
  const g = await fetchJsonWithTimeout<OsmGeocode[]>(
    geocode.toString(),
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PicadaApp/1.0 (restaurants-discover)',
      },
      cache: 'no-store',
    },
    6000,
  )
  if (!g) return []
  const first = g[0]
  if (!first) return []

  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []

  const radiusM = 7000
  const overpassQuery = `
[out:json][timeout:25];
(
  node["amenity"~"restaurant|fast_food|cafe"](around:${radiusM},${lat},${lon});
  way["amenity"~"restaurant|fast_food|cafe"](around:${radiusM},${lat},${lon});
  relation["amenity"~"restaurant|fast_food|cafe"](around:${radiusM},${lat},${lon});
);
out center 80;
`
  const overpassEndpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
  ]

  let od: { elements?: OverpassElement[] } | null = null
  for (const endpoint of overpassEndpoints) {
    const parsed = await fetchJsonWithTimeout<{ elements?: OverpassElement[] }>(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        cache: 'no-store',
      },
      7000,
    )
    if (!parsed) continue
    if ((parsed.elements || []).length > 0) {
      od = parsed
      break
    }
    if (!od) od = parsed
  }
  if (!od) {
    // Fallback adicional: búsqueda directa en Nominatim por "restaurant in <location>"
    const fallback = new URL('https://nominatim.openstreetmap.org/search')
    fallback.searchParams.set('q', `restaurant in ${extractPrimaryLocation(location)}, Chile`)
    fallback.searchParams.set('format', 'jsonv2')
    fallback.searchParams.set('limit', '20')
    const places = await fetchJsonWithTimeout<NominatimPlace[]>(
      fallback.toString(),
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PicadaApp/1.0 (restaurants-discover)',
        },
        cache: 'no-store',
      },
      7000,
    )
    if (!places || places.length === 0) return []
    const fallbackItems = places
      .map((p, idx) => {
        const lat = Number(p.lat)
        const lng = Number(p.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        const nameGuess = (p.name || p.display_name || '').split(',')[0]?.trim()
        if (!nameGuess) return null
        return {
          id: `osm-nominatim-${p.place_id || idx}`,
          name: nameGuess,
          address: p.display_name || location,
          lat,
          lng,
          rating: 0,
          reviews: 0,
          priceLevel: null,
          mapsUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`,
          phone: null,
          website: null,
          openNow: null,
          photoUrl: null,
          reviewsText: [],
          provider: 'openstreetmap' as const,
          raw: p as unknown as Record<string, unknown>,
        } satisfies DiscoverItem
      })
      .filter(Boolean) as DiscoverItem[]
    return fallbackItems.slice(0, 12)
  }
  const items = (od.elements || [])
    .map((el) => {
      const name = el.tags?.name || el.tags?.brand || null
      if (!name) return null
      const eLat = (el as any).lat ?? (el as any).center?.lat
      const eLng = (el as any).lon ?? (el as any).center?.lon
      if (!Number.isFinite(eLat) || !Number.isFinite(eLng)) return null
      const addr = [
        el.tags?.['addr:street'],
        el.tags?.['addr:housenumber'],
        el.tags?.['addr:city'] || el.tags?.['addr:suburb'],
      ].filter(Boolean).join(' ')
      return {
        id: `osm-${el.id}`,
        name,
        address: addr || location,
        lat: Number(eLat),
        lng: Number(eLng),
        rating: 0,
        reviews: 0,
        priceLevel: null,
        mapsUrl: `https://www.openstreetmap.org/?mlat=${eLat}&mlon=${eLng}#map=18/${eLat}/${eLng}`,
        phone: null,
        website: el.tags?.website || null,
        openNow: null,
        photoUrl: null,
        reviewsText: [],
        provider: 'openstreetmap' as const,
        raw: el as unknown as Record<string, unknown>,
      }
    })
    .filter(Boolean) as Array<{
      id: string
      name: string
      address: string
      lat: number | null
      lng: number | null
      rating: number
      reviews: number
      priceLevel: number | null
      mapsUrl: string
    }>

  const unique = new Map<string, (typeof items)[number]>()
  for (const it of items) {
    const key = `${it.name.toLowerCase()}-${Math.round((it.lat || 0) * 1000)}-${Math.round((it.lng || 0) * 1000)}`
    if (!unique.has(key)) unique.set(key, it)
  }
  return [...unique.values()].slice(0, 12)
}

/** "Rancagua, Región del Libertador..." → "Rancagua" (primera parte antes de la coma).
 *  Para coordenadas numéricas devuelve el string completo sin modificar. */
function extractPrimaryLocation(location: string): string {
  const str = location.trim()
  // Si parece coordenadas (solo dígitos, coma, punto, guión) → no cortar
  if (/^[-\d.,\s]+$/.test(str)) return str
  return (str.split(',')[0] ?? str).trim()
}

function normalizeLocationKey(location: string): string {
  // La clave de caché usa solo la parte principal para que "rancagua" y
  // "Rancagua, Región del Libertador..." compartan el mismo caché.
  return extractPrimaryLocation(location).toLowerCase().replace(/\s+/g, ' ')
}

function tokenizeLocation(location: string): string[] {
  const stop = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'y', 'en', 'region', 'región', 'chile', 'comuna', 'ciudad'])
  return normalizeLocationKey(location)
    .split(/[\s,./()-]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 3 && !stop.has(s))
}

function itemMatchesLocation(item: Pick<DiscoverItem, 'name' | 'address'>, location: string): boolean {
  const tokens = tokenizeLocation(location)
  if (tokens.length === 0) return true
  const text = `${item.name} ${item.address}`.toLowerCase()
  const strong = tokens.filter(t => t.length >= 5)
  if (strong.length > 0) return strong.some(t => text.includes(t))
  return tokens.some(t => text.includes(t))
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function locationDailyKey(location: string): string {
  return `daily::${normalizeLocationKey(location)}::${todayKey()}`
}

function globalDailyBudgetKey(): string {
  return `gmaps_budget_global::${todayKey()}`
}

function locationDailyBudgetKey(location: string): string {
  return `gmaps_budget_location::${normalizeLocationKey(location)}::${todayKey()}`
}

function globalDailyDetailsBudgetKey(): string {
  return `gmaps_details_global::${todayKey()}`
}

function locationDailyDetailsBudgetKey(location: string): string {
  return `gmaps_details_location::${normalizeLocationKey(location)}::${todayKey()}`
}

function hashPlace(item: DiscoverItem) {
  const payload = JSON.stringify({
    name: item.name,
    address: item.address,
    rating: item.rating,
    reviews: item.reviews,
    priceLevel: item.priceLevel,
    lat: item.lat,
    lng: item.lng,
  })
  return createHash('sha256').update(payload).digest('hex')
}

async function readDiscoveryCache(location: string) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null
  const key = normalizeLocationKey(location)
  const { data } = await supabase
    .from('place_discovery_cache')
    .select('payload, source, expires_at')
    .eq('location_key', key)
    .maybeSingle()
  if (!data) return null
  const expiresAt = new Date(data.expires_at)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) return null
  return data
}

async function readDiscoveryCacheByKey(cacheKey: string) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('place_discovery_cache')
    .select('payload, source, expires_at')
    .eq('location_key', cacheKey)
    .maybeSingle()
  if (!data) return null
  const expiresAt = new Date(data.expires_at)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) return null
  return data
}

function extractGoogleTypesFromRaw(raw: Record<string, unknown> | undefined | null): string[] {
  if (!raw) return []
  const g = raw.google_types
  if (Array.isArray(g)) return g.map(String)
  const base = raw.base as { types?: string[] } | undefined
  if (Array.isArray(base?.types)) return base!.types!.map(String)
  return []
}

function extractEditorialFromRaw(raw: Record<string, unknown> | undefined | null): string | null {
  if (!raw) return null
  const s = raw.editorial_snippet
  if (typeof s === 'string' && s.trim()) return s.trim()
  const es = raw.editorial_summary as { overview?: string } | undefined
  if (es?.overview && typeof es.overview === 'string') return es.overview.trim()
  return null
}

async function writeDiscoveryCache(
  locationOrKey: string,
  source: string,
  items: DiscoverItem[],
  ttlMs = 1000 * 60 * 60 * 6,
  options?: { persistPlaces?: boolean },
) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return

  const key = locationOrKey
  const expires = new Date(Date.now() + ttlMs).toISOString()
  const persistPlaces = options?.persistPlaces ?? true

  const placeIds = persistPlaces
    ? (
        await Promise.all(
          items.map(async item => {
            // Never re-index user submissions as Google/OSM places
            if (item.id.startsWith('user-')) return null

            const rp = item.raw ? (item.raw as Record<string, unknown>) : null
            const googleTypes = extractGoogleTypesFromRaw(rp)
            const editorial = extractEditorialFromRaw(rp)
            const contentHash = hashPlace(item)

            const { data: existing } = await supabase
              .from('places')
              .select('id, content_hash, raw_payload, tagging_meta, source_types, city, commune, region, phone, website, category')
              .in('provider', item.provider === 'google_places' ? ['google_places', 'google'] : ['openstreetmap', 'osm'])
              .eq('external_id', item.id)
              .maybeSingle()

            const classified = buildMergedPlaceClassification({
              existingTaggingMeta: (existing?.tagging_meta as PlaceTaggingMeta | null) ?? null,
              existingSourceTypes: existing?.source_types,
              name: item.name,
              address: item.address,
              reviewsText: item.reviewsText,
              googleTypes,
              editorialSummary: editorial,
            })

            const seeds = classified.tagging_meta.automated_seed?.tags || []
            item.automatedSeedTags = seeds.map(t => ({
              slug: t.slug,
              confidence_score: t.confidence_score,
              is_automated: t.is_automated !== false,
            }))

            const rawRecord = item.raw || {}
            const inferredRegion = extractRegion(rawRecord, item.provider, item.address)
            const inferredCategory = extractCategoryFromRaw(rawRecord, item.provider)
            const contactFromRaw = extractContactFromRaw(rawRecord)
            const safeCity = extractCity(rawRecord, item.provider, item.address)
            const safeCommune = extractCommune(rawRecord, item.provider, item.address)

            const upsertPayload = {
              provider: item.provider === 'google_places' ? 'google' : 'osm',
              external_id: item.id,
              name: item.name,
              address: item.address,
              city: cleanCommune(safeCity) || cleanCommune(existing?.city) || null,
              commune: safeCommune || cleanCommune(existing?.commune) || null,
              region: cleanCommune(inferredRegion) || cleanCommune(existing?.region) || null,
              maps_url: item.mapsUrl,
              lat: item.lat,
              lng: item.lng,
              rating: item.rating,
              reviews_count: item.reviews,
              price_level: item.priceLevel,
              phone: item.provider === 'google_places'
                ? (contactFromRaw.phone || existing?.phone || null)
                : (existing?.phone || contactFromRaw.phone || null),
              website: item.provider === 'google_places'
                ? (contactFromRaw.website || existing?.website || null)
                : (existing?.website || contactFromRaw.website || null),
              category: inferredCategory || existing?.category || null,
              nutrition_categories: classified.nutrition_categories,
              restrictions_supported: classified.restrictions_supported,
              cuisines: classified.cuisines,
              experiences: classified.experiences,
              source_types: classified.source_types,
              tagging_meta: classified.tagging_meta,
              gallery: item.gallery || [],
              raw_payload: item.raw || {},
              content_hash: contentHash,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

            const { data: upserted } = await supabase
              .from('places')
              .upsert(upsertPayload, { onConflict: 'provider,external_id' })
              .select('id')
              .single()

            if (existing && existing.content_hash && existing.content_hash !== contentHash && upserted?.id) {
              await supabase.from('place_change_log').insert({
                place_id: upserted.id,
                previous_payload: existing.raw_payload || {},
                current_payload: item.raw || {},
                changed_fields: ['content_hash_changed'],
              })
            }

            return upserted?.id as string | undefined
          }),
        )
      ).filter((id): id is string => Boolean(id))
    : []

  await supabase.from('place_discovery_cache').upsert({
    location_key: key,
    source,
    place_ids: placeIds,
    payload: items,
    fetched_at: new Date().toISOString(),
    expires_at: expires,
  }, { onConflict: 'location_key' })
}

async function readBudgetCount(key: string): Promise<number> {
  if (!getSupabaseServerClient()) return 0
  const row = await readDiscoveryCacheByKey(key)
  if (!row) return 0
  const n = Number((row.payload as { count?: number })?.count || 0)
  return Number.isFinite(n) ? n : 0
}

async function addBudgetCount(key: string, delta: number): Promise<void> {
  const supabase = getSupabaseServerClient()
  if (!supabase || delta <= 0) return
  const current = await readBudgetCount(key)
  await supabase.from('place_discovery_cache').upsert({
    location_key: key,
    source: 'budget_counter',
    place_ids: [],
    payload: { count: current + delta },
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + LOCATION_DAILY_CACHE_TTL_MS).toISOString(),
  }, { onConflict: 'location_key' })
}

async function enrichDiscoverTags(items: DiscoverItem[]): Promise<DiscoverItem[]> {
  const hydrated = await hydrateAutomatedSeedTagsFromPlacesDb(items)
  return mergeInferredTagsForDiscover(hydrated)
}

async function attachOffers(items: DiscoverItem[]): Promise<DiscoverItem[]> {
  return attachOffersBatch(items)
}

async function attachOffersBatch(items: DiscoverItem[]): Promise<DiscoverItem[]> {
  // Modo fast-path: desactivar lookup global de ofertas para priorizar tiempo de respuesta.
  return items
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const cookieLocation = req.headers.get('cookie')?.match(/(?:^|;\s*)picada_location=([^;]+)/)?.[1]
  const location = (url.searchParams.get('location') || (cookieLocation ? decodeURIComponent(cookieLocation) : '')).trim()
  const latQ = Number(url.searchParams.get('latitude') || '')
  const lngQ = Number(url.searchParams.get('longitude') || '')
  const radiusKmQ = Number(url.searchParams.get('radius') || '50')
  const hasGeo = Number.isFinite(latQ) && Number.isFinite(lngQ)
  const restrictions = parseRestrictions(url.searchParams.get('restrictions') || '')
  const key = (() => {
    try {
      return getServerGoogleMapsApiKey()
    } catch {
      return ''
    }
  })()
  if (!location && !hasGeo) return NextResponse.json({ items: [], source: 'disabled' })
  const normalizedLocation = normalizeLocationKey(location || `${latQ},${lngQ}`)
  const locationDailySnapshotKey = locationDailyKey(normalizedLocation)

  // Leer todos los contadores de budget en paralelo
  const [detailsGlobalUsed, detailsLocationUsed, globalUsed, locationUsed, dailySnapshot] = await Promise.all([
    readBudgetCount(globalDailyDetailsBudgetKey()),
    readBudgetCount(locationDailyDetailsBudgetKey(normalizedLocation)),
    readBudgetCount(globalDailyBudgetKey()),
    readBudgetCount(locationDailyBudgetKey(normalizedLocation)),
    readDiscoveryCacheByKey(locationDailySnapshotKey),
  ])
  let detailsRemaining = Math.max(
    0,
    Math.min(
      DAILY_GLOBAL_DETAILS_LIMIT - detailsGlobalUsed,
      DAILY_PER_LOCATION_DETAILS_LIMIT - detailsLocationUsed,
    ),
  )
  const globalRemaining = Math.max(0, DAILY_GLOBAL_NEW_LIMIT - globalUsed)
  const locationRemaining = Math.max(0, DAILY_PER_LOCATION_NEW_LIMIT - locationUsed)
  const dailyRemaining = Math.min(globalRemaining, locationRemaining)

  // Fast path: snapshot diario ya materializado — se usa siempre si existe.
  // El snapshot expira naturalmente (26h TTL). El enriquecimiento progresivo con Google
  // ocurre solo en el primer request tras la expiración, no en cada request del día.
  if (dailySnapshot && Array.isArray(dailySnapshot.payload) && dailySnapshot.payload.length > 0) {
    const base = dailySnapshot.payload as DiscoverItem[]
    const withTags = await enrichDiscoverTags(base)
    const scored = withTags.map(item => {
      const m = scoreByRestrictions(item, restrictions)
      return { ...item, matchScore: m.score, matchReason: m.reason }
    })
    return NextResponse.json({
      items: finalizeDiscoverItems(filterByRadial(scored, hasGeo, latQ, lngQ, radiusKmQ)),
      source: dailySnapshot.source,
      diagnostics: { cacheHit: true, snapshot: 'daily', fastPath: true },
    }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } })
  }

  // Deadline global de 8s para todo el path lento (cubre FASE 1 + FASE 2).
  // Garantiza que la función nunca exceda el límite de Vercel ni bloquee el browser.
  const slowPathDeadline = Date.now() + 8000

  // Cargar en paralelo: caché de inventario + locales ya guardados en BD
  const [cached, preloaded] = await Promise.all([
    readDiscoveryCache(normalizedLocation),
    discoverFromPreloadedPlaces(location, key || undefined),
  ])
  const inventoryItems = (cached?.payload as DiscoverItem[] | undefined) || []
  const inventoryIds = new Set(inventoryItems.map(i => i.id))
  const freshFromDb = preloaded.filter(p => !inventoryIds.has(p.id))
  let baseItems = [...inventoryItems, ...freshFromDb]

  const googleAllowed = canUseGoogleForLocation(location)
  let source: string = preloaded.length > 0 && inventoryItems.length === 0 ? 'preloaded_places' : (cached?.source || 'cache_inventory')

  // FASE 1 — Enriquecer locales ya en BD con Details API (foto, teléfono, reseñas).
  // Solo si aún queda tiempo en el deadline global.
  if (key && detailsRemaining > 0 && baseItems.length > 0 && Date.now() < slowPathDeadline) {
    const enrichResult = await enrichGoogleWithLiteDetails(baseItems, key, Math.min(3, detailsRemaining))
    if (enrichResult.consumed > 0) {
      baseItems = enrichResult.items
      detailsRemaining = Math.max(0, detailsRemaining - enrichResult.consumed)
      await Promise.all([
        addBudgetCount(globalDailyDetailsBudgetKey(), enrichResult.consumed),
        addBudgetCount(locationDailyDetailsBudgetKey(normalizedLocation), enrichResult.consumed),
        writeDiscoveryCache(normalizedLocation, cached?.source || 'cache_inventory', baseItems, LOCATION_CACHE_TTL_MS),
      ])
    }
  }

  // Fast return: si ya hay suficientes items, no llamar a Google TextSearch.
  // También aplica si se agotó el deadline (retornar lo que hay de Supabase).
  if (baseItems.length >= 3 || Date.now() >= slowPathDeadline) {
    const withTags = await enrichDiscoverTags(baseItems)
    const scored = withTags.map(item => {
      const m = scoreByRestrictions(item, restrictions)
      return { ...item, matchScore: m.score, matchReason: m.reason }
    })
    const withOffers = await attachOffersBatch(scored)
    const radialFiltered = filterByRadial(withOffers, hasGeo, latQ, lngQ, radiusKmQ)
    await writeDiscoveryCache(locationDailySnapshotKey, source, radialFiltered, LOCATION_DAILY_CACHE_TTL_MS, { persistPlaces: false })
    return NextResponse.json({
      items: finalizeDiscoverItems(radialFiltered),
      source,
      diagnostics: { cacheHit: true, snapshot: 'supabase_fast' },
    }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } })
  }

  // FASE 2 — Descubrir nuevos locales (solo si no hay datos en BD y queda tiempo).
  const needsGoogleDiscovery =
    key &&
    googleAllowed &&
    dailyRemaining > 0 &&
    Date.now() < slowPathDeadline
  let newPlacesCount = 0
  let googleFailure: string | null = null

  if (needsGoogleDiscovery) {
    const googleItems = await discoverFromGoogle(location, key)
    if (googleItems.length === 0) {
      googleFailure = 'Google no devolvió resultados (posible REQUEST_DENIED o cuota/restricción de API key).'
    }
    // Verificar contra la tabla places (no solo caché) para no re-consumir cuota
    const dbKnownIds = await getKnownPlaceIds(googleItems.map(i => i.id))
    const allKnownIds = new Set([...dbKnownIds, ...inventoryIds])
    const freshCandidates = googleItems.filter(i => !allKnownIds.has(i.id))

    if (freshCandidates.length > 0 || baseItems.length === 0) {
      // Nuevos locales: enriquecer con Details API
      const toEnrich = freshCandidates.length > 0
        ? freshCandidates.slice(0, dailyRemaining)
        : googleItems.slice(0, Math.min(DAILY_PER_LOCATION_NEW_LIMIT, googleItems.length))
      const enrichedNew = await enrichGoogleWithLiteDetails(toEnrich, key, Math.min(3, detailsRemaining))
      const newItems = enrichedNew.items
      newPlacesCount = newItems.length

      if (enrichedNew.consumed > 0) {
        await Promise.all([
          addBudgetCount(globalDailyDetailsBudgetKey(), enrichedNew.consumed),
          addBudgetCount(locationDailyDetailsBudgetKey(normalizedLocation), enrichedNew.consumed),
        ])
      }
      if (newItems.length > 0) {
        await Promise.all([
          addBudgetCount(globalDailyBudgetKey(), newItems.length),
          addBudgetCount(locationDailyBudgetKey(normalizedLocation), newItems.length),
        ])
        // Nuevos locales al frente, existentes detrás
        baseItems = [...newItems, ...baseItems.filter(b => !newItems.find(n => n.id === b.id))]
        await writeDiscoveryCache(normalizedLocation, 'google_places', baseItems, LOCATION_CACHE_TTL_MS)
        source = 'google_places'
      }
    }
  }

  const diagnosticsNotice =
    !key
      ? 'Google no configurado: se muestran datos cacheados/fallback.'
      : !googleAllowed
        ? 'Google restringido para esta zona; usando inventario cacheado.'
        : dailyRemaining <= 0
          ? 'Cuota diaria agotada: mostrando resultados ya almacenados.'
          : detailsRemaining <= 0
            ? 'Sin cuota de detalles hoy: fotos/reseñas se actualizan en próximo ciclo.'
            : null

  if (baseItems.length > 0) {
    const withPicada = await enrichDiscoverTags(baseItems)
    const scored = withPicada.map(item => {
      const m = scoreByRestrictions(item, restrictions)
      return { ...item, matchScore: m.score, matchReason: m.reason }
    })
    const withOffers = await attachOffersBatch(scored)
    const radialFiltered = filterByRadial(withOffers, hasGeo, latQ, lngQ, radiusKmQ)
    await writeDiscoveryCache(
      locationDailySnapshotKey,
      source,
      radialFiltered,
      LOCATION_DAILY_CACHE_TTL_MS,
      { persistPlaces: false },
    )
    return NextResponse.json({
      items: finalizeDiscoverItems(radialFiltered),
      source,
      diagnostics: {
        count: radialFiltered.length,
        dbCount: baseItems.length,
        newToday: newPlacesCount,
        detailsRemaining,
        notice: googleFailure || diagnosticsNotice,
      },
    })
  }

  // Fallback OSM: solo si BD y Google no tienen nada
  const osmItems = await discoverFromOsm(location)
  await writeDiscoveryCache(normalizedLocation, 'openstreetmap', osmItems as DiscoverItem[], LOCATION_CACHE_TTL_MS)
  const osmEnriched = await enrichDiscoverTags(osmItems as DiscoverItem[])
  const scored = osmEnriched.map(item => {
    const m = scoreByRestrictions(item, restrictions)
    return { ...item, matchScore: m.score, matchReason: m.reason }
  })
  const withOffers = await attachOffersBatch(scored)
  const radialFiltered = filterByRadial(withOffers, hasGeo, latQ, lngQ, radiusKmQ)
  await writeDiscoveryCache(
    locationDailySnapshotKey,
    'openstreetmap',
    radialFiltered,
    LOCATION_DAILY_CACHE_TTL_MS,
    { persistPlaces: false },
  )
  return NextResponse.json({
    items: finalizeDiscoverItems(radialFiltered),
    source: 'openstreetmap',
    diagnostics: {
      googleConfigured: Boolean(key),
      googleAllowed,
      usedFallback: true,
      count: osmItems.length,
      notice: googleFailure || diagnosticsNotice,
    },
  })
}

