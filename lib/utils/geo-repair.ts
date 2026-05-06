import { getSupabaseServerClient } from '@/lib/supabase-server'

type GeoRepairRow = {
  id: string
  address?: string | null
  city?: string | null
  commune?: string | null
}

const KNOWN_CITY_HINTS = [
  'santiago',
  'rancagua',
  'valparaiso',
  'vina del mar',
  'concepcion',
  'temuco',
  'antofagasta',
  'iquique',
]

function normalizeToken(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function toTitleCase(raw: string): string {
  return raw
    .split(/\s+/g)
    .filter(Boolean)
    .map(word => word[0] ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : word)
    .join(' ')
}

function extractCityFromAddress(address: string): string | null {
  const normalized = normalizeToken(address)
  if (!normalized) return null

  for (const city of KNOWN_CITY_HINTS) {
    if (normalized.includes(city)) return toTitleCase(city)
  }

  const parts = address
    .split(',')
    .map(p => normalizeToken(p))
    .filter(Boolean)
  if (parts.length === 0) return null

  const noCountry = parts.filter(p => p !== 'chile')
  const candidate = noCountry[noCountry.length - 1] || noCountry[noCountry.length - 2]
  if (!candidate) return null
  if (candidate.length < 3) return null
  if (/\d/.test(candidate)) return null
  return toTitleCase(candidate)
}

/**
 * Limpia geografía en `places`: completa city/commune cuando están vacíos usando `address`.
 */
export async function repairMissingGeoInPlaces(options?: {
  batchSize?: number
  cityHint?: string
  dryRun?: boolean
}) {
  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('supabase_not_configured')
  const batchSize = Math.max(1, Math.min(1000, Number(options?.batchSize || 400)))
  const cityHint = normalizeToken(options?.cityHint || '')
  const dryRun = Boolean(options?.dryRun)

  const query = supabase
    .from('places')
    .select('id, address, city, commune')
    .or('city.is.null,commune.is.null')
    .limit(batchSize)

  const { data, error } = await query
  if (error) throw error

  const rows = (data || []) as GeoRepairRow[]
  let scanned = 0
  let updated = 0
  const updatedIds: string[] = []

  for (const row of rows) {
    scanned += 1
    const currentCity = String(row.city || '').trim()
    const currentCommune = String(row.commune || '').trim()
    const parsed = extractCityFromAddress(String(row.address || ''))
    if (!parsed) continue
    if (cityHint && normalizeToken(parsed) !== cityHint && !normalizeToken(String(row.address || '')).includes(cityHint)) {
      continue
    }

    const nextCity = currentCity || parsed
    const nextCommune = currentCommune || parsed

    if (!nextCity && !nextCommune) continue
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('places')
        .update({
          city: nextCity ? toTitleCase(nextCity) : null,
          commune: nextCommune ? toTitleCase(nextCommune) : null,
        })
        .eq('id', row.id)
      if (updateError) throw updateError
    }
    updated += 1
    updatedIds.push(row.id)
  }

  return { ok: true, dryRun, scanned, updated, updatedIds }
}

