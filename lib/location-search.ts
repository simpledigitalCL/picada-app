/** Parámetros compartidos por el buscador de ubicación (barra, sheet y modal avanzado). */

/** Radio por defecto alrededor del punto (km). Unificado con discover-geo y modal. */
export const DEFAULT_SEARCH_RADIUS_KM = 50

export const DEFAULT_LOCATION_PLACEHOLDER = 'Buscar zona o lugar (Chile)'

export function buildAutocompleteUrl(q: string): string {
  const params = new URLSearchParams()
  params.set('q', q.trim())
  return `/api/locations/autocomplete?${params.toString()}`
}

/** Zoom Leaflet acorde al radio de búsqueda (km). */
export function zoomForSearchRadiusKm(radiusKm: number): number {
  if (radiusKm >= 160) return 8
  if (radiusKm >= 90) return 9
  if (radiusKm >= 45) return 10
  if (radiusKm >= 20) return 11
  return 12
}
