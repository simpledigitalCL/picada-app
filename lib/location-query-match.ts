/**
 * Cruza texto de un lugar (nombre + dirección) con la búsqueda de zona del usuario,
 * sin exigir que la dirección contenga la cadena completa ("Rancagua, O'Higgins, Chile").
 */

const STOPWORDS = new Set([
  'chile',
  'cl',
  'region',
  'región',
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'comuna',
  'ciudad',
  'provincia',
])

function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´]/g, "'")
    .trim()
}

/** Partes útiles extraídas de la etiqueta de ubicación (inicio, mapa, picada). */
export function locationSearchTokens(userLocation: string): string[] {
  const raw = userLocation.trim()
  if (!raw) return []
  const parts = raw.split(/[,·/]/g).flatMap(s => s.trim().split(/\s+/))
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const w = normalizeWord(p)
    if (w.length < 3 || STOPWORDS.has(w)) continue
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

export function placeTextMatchesLocation(
  placeName: string | undefined,
  placeAddress: string | undefined,
  userLocation: string,
): boolean {
  const q = userLocation.trim().toLowerCase()
  if (!q) return true
  const text = `${placeName || ''} ${placeAddress || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const qn = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (text.includes(qn)) return true
  const tokens = locationSearchTokens(userLocation)
  return tokens.some(t => {
    const tn = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return text.includes(tn)
  })
}
