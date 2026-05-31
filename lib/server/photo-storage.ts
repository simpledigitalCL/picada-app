import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getServerGoogleMapsApiKey } from '@/lib/server/env'

export const PLACE_PHOTOS_BUCKET = 'place-photos'

export function extractPhotoRefFromUrl(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('/') ? `http://localhost${url}` : url)
    const ref = u.searchParams.get('ref') || u.searchParams.get('photo_reference')
    return ref || null
  } catch {
    return null
  }
}

export function needsMigration(url: string): boolean {
  if (!url) return false
  return url.startsWith('/api/photos') || url.includes('maps.googleapis.com')
}

export async function downloadGooglePhoto(
  photoRef: string,
  maxwidth = 900,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  let key: string
  try {
    key = getServerGoogleMapsApiKey()
  } catch {
    return null
  }

  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(photoRef)}&key=${encodeURIComponent(key)}`

  try {
    const res = await fetch(googleUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()
    return { buffer, contentType }
  } catch {
    return null
  }
}

export async function uploadPhotoToStorage(
  placeExternalId: string,
  index: number,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const safePath = placeExternalId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const path = `${safePath}/${index}.${ext}`

  const { error } = await supabase.storage
    .from(PLACE_PHOTOS_BUCKET)
    .upload(path, buffer, { contentType, upsert: true })

  if (error) return null

  const { data } = supabase.storage.from(PLACE_PHOTOS_BUCKET).getPublicUrl(path)
  return data?.publicUrl || null
}

/**
 * Descarga fotos de Google y las sube a Supabase Storage.
 * Actualiza places.gallery en BD con las URLs permanentes.
 * Las fotos que fallen se dejan en formato proxy como fallback.
 */
export async function persistPlacePhotos(
  placeId: string,
  placeExternalId: string,
  gallery: string[],
): Promise<{ newGallery: string[]; saved: number }> {
  const newGallery: string[] = []
  let saved = 0

  for (let i = 0; i < gallery.length; i++) {
    const url = gallery[i]

    if (!needsMigration(url)) {
      newGallery.push(url)
      continue
    }

    const ref = extractPhotoRefFromUrl(url)
    if (!ref) {
      newGallery.push(url)
      continue
    }

    const photo = await downloadGooglePhoto(ref)
    if (!photo) {
      newGallery.push(url)
      continue
    }

    const storageUrl = await uploadPhotoToStorage(placeExternalId, i, photo.buffer, photo.contentType)
    newGallery.push(storageUrl ?? url)
    if (storageUrl) saved++
  }

  if (saved > 0) {
    const supabase = getSupabaseServerClient()
    supabase
      ?.from('places')
      .update({ gallery: newGallery })
      .eq('id', placeId)
      .then(undefined, () => undefined) as Promise<unknown>
  }

  return { newGallery, saved }
}
