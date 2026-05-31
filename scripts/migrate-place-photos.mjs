/**
 * Migra fotos de places desde URLs proxy/Google → Supabase Storage.
 *
 * Uso:
 *   node --env-file=.env scripts/migrate-place-photos.mjs [external_id|place_id]
 *
 * Sin argumento procesa todos los places con fotos en proxy/Google.
 * Con argumento procesa solo ese place (útil para probar).
 *
 * Ejemplos:
 *   node --env-file=.env scripts/migrate-place-photos.mjs ChIJI-eh6SPXYpYRzpzNBnwESiE
 *   node --env-file=.env scripts/migrate-place-photos.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY
const BUCKET = 'place-photos'
const BATCH_SIZE = 3
const DELAY_BETWEEN_BATCHES_MS = 800

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!GOOGLE_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function extractRef(url) {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('/') ? `http://localhost${url}` : url)
    return u.searchParams.get('ref') || u.searchParams.get('photo_reference') || null
  } catch {
    return null
  }
}

function needsMigration(url) {
  return url.startsWith('/api/photos') || url.includes('maps.googleapis.com')
}

async function downloadPhoto(ref, maxwidth = 900) {
  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(ref)}&key=${encodeURIComponent(GOOGLE_KEY)}`
  const res = await fetch(googleUrl, { redirect: 'follow', signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = await res.arrayBuffer()
  return { buffer, contentType }
}

async function uploadToStorage(externalId, index, buffer, contentType) {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const safePath = externalId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const path = `${safePath}/${index}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(buffer), { contentType, upsert: true })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function migratePlace(place) {
  const urls = Array.isArray(place.gallery) ? place.gallery : []
  const newGallery = []
  let saved = 0

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]

    if (!needsMigration(url)) {
      newGallery.push(url)
      continue
    }

    const ref = extractRef(url)
    if (!ref) {
      console.log(`    [${i}] sin photo_reference — se omite`)
      newGallery.push(url)
      continue
    }

    try {
      const { buffer, contentType } = await downloadPhoto(ref)
      const storageUrl = await uploadToStorage(place.external_id, i, buffer, contentType)
      newGallery.push(storageUrl)
      saved++
      console.log(`    [${i}] ✓ ${storageUrl}`)
    } catch (err) {
      console.log(`    [${i}] ✗ ${err.message} — se mantiene proxy`)
      newGallery.push(url)
    }
  }

  if (saved > 0) {
    const { error } = await supabase
      .from('places')
      .update({ gallery: newGallery, updated_at: new Date().toISOString() })
      .eq('id', place.id)
    if (error) throw new Error(error.message)
  }

  return saved
}

async function main() {
  const target = process.argv[2]

  let query = supabase
    .from('places')
    .select('id, external_id, name, gallery')
    .not('gallery', 'is', null)

  if (target) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
    if (uuidPattern.test(target)) {
      query = query.eq('id', target)
    } else {
      query = query.eq('external_id', target)
    }
  }

  const { data: all, error } = await query
  if (error) { console.error(error.message); process.exit(1) }

  const places = (all || []).filter(p =>
    p.gallery?.some(u => needsMigration(u))
  )

  if (places.length === 0) {
    console.log('No hay places con fotos para migrar.')
    return
  }

  console.log(`Migrando ${places.length} place(s)...\n`)

  let totalSaved = 0
  let totalFailed = 0

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const batch = places.slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map(async (place, bi) => {
      const num = i + bi + 1
      console.log(`[${num}/${places.length}] ${place.name} (${place.external_id})`)
      try {
        const saved = await migratePlace(place)
        totalSaved += saved
        if (saved === 0) console.log(`    sin cambios`)
      } catch (err) {
        console.log(`    ERROR: ${err.message}`)
        totalFailed++
      }
    }))

    if (i + BATCH_SIZE < places.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS))
    }
  }

  console.log(`\nResultado: ${totalSaved} fotos subidas, ${totalFailed} places con error`)
}

main().catch(err => { console.error(err); process.exit(1) })
