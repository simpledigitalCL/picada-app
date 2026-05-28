/** Convierte una URL directa de Google Maps Photo API al proxy interno.
 *  Necesario para URLs ya guardadas en la BD antes de este cambio.
 */
export function proxifyPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/api/photos')) return url
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'maps.googleapis.com' && parsed.pathname.includes('/place/photo')) {
      const ref = parsed.searchParams.get('photo_reference')
      if (ref) return `/api/photos?ref=${encodeURIComponent(ref)}&w=900`
    }
  } catch {
    // no es una URL válida, devolver como está
  }
  return url
}
