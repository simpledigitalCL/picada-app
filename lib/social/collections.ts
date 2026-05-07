'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase'

export const COLLECTIONS_KEY = 'picada.collections.v1'
const VISITED_KEY = 'picada.visited.places.v1'

export type CollectionPlace = {
  placeId: string
  placeName: string
  placeAddress: string
  placePhoto?: string
  savedAt: string
  note?: string
}

export type UserCollection = {
  id: string
  name: string
  emoji: string
  color: string
  isDefault: boolean
  places: CollectionPlace[]
  isPublic: boolean
  createdAt: string
}

const DEFAULT_COLLECTIONS: UserCollection[] = [
  { id: 'default-want', name: 'Quiero ir',     emoji: '📍', color: 'bg-sky-100',  isDefault: true, places: [], isPublic: true, createdAt: new Date().toISOString() },
  { id: 'default-went', name: 'Ya fui',         emoji: '✅', color: 'bg-green-100', isDefault: true, places: [], isPublic: true, createdAt: new Date().toISOString() },
  { id: 'default-favs', name: 'Mis favoritos',  emoji: '❤️', color: 'bg-rose-100',  isDefault: true, places: [], isPublic: true, createdAt: new Date().toISOString() },
]

// ─── utils ───────────────────────────────────────────────────────────────────

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function emit(action: 'add' | 'remove' | 'create' | 'update', collectionId: string, placeId?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('picada:collection-updated', { detail: { action, collectionId, placeId } }))
}

function syncVisited(place: CollectionPlace) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(VISITED_KEY)
    const visited = raw ? JSON.parse(raw) as Array<{ id: string; name: string; address: string; visitedAt: string }> : []
    if (!visited.find(v => v.id === place.placeId)) {
      visited.unshift({ id: place.placeId, name: place.placeName, address: place.placeAddress, visitedAt: new Date().toISOString() })
      window.localStorage.setItem(VISITED_KEY, JSON.stringify(visited.slice(0, 80)))
    }
    window.dispatchEvent(new CustomEvent('picada:place-visited', {
      detail: { placeId: place.placeId, placeName: place.placeName, placeAddress: place.placeAddress },
    }))
  } catch { /* noop */ }
}

async function getAuthUserId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// ─── localStorage (cache local + fallback anónimo) ───────────────────────────

export function loadCollections(): UserCollection[] {
  if (typeof window === 'undefined') return DEFAULT_COLLECTIONS
  try {
    const raw = window.localStorage.getItem(COLLECTIONS_KEY)
    const parsed = raw ? JSON.parse(raw) as UserCollection[] : []
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(DEFAULT_COLLECTIONS))
      return DEFAULT_COLLECTIONS
    }
    const merged = [...DEFAULT_COLLECTIONS]
    for (const incoming of parsed) {
      const idx = merged.findIndex(c => c.id === incoming.id)
      if (idx >= 0) merged[idx] = { ...merged[idx], ...incoming, isDefault: merged[idx].isDefault }
      else merged.push(incoming)
    }
    return merged
  } catch { return DEFAULT_COLLECTIONS }
}

export function saveCollections(cols: UserCollection[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols))
}

// ─── Supabase sync (fire-and-forget) ─────────────────────────────────────────

async function dbUpsertPlace(userId: string, colId: string, place: CollectionPlace) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return
  const row: Record<string, unknown> = {
    collection_id: colId,
    user_id:       userId,
    place_name:    place.placeName,
    place_address: place.placeAddress,
    place_photo:   place.placePhoto ?? null,
    note:          place.note ?? null,
    saved_at:      place.savedAt,
  }
  if (isUuid(place.placeId)) row.place_id = place.placeId
  else row.external_place_id = place.placeId

  await supabase.from('collection_places').upsert(row, {
    onConflict: isUuid(place.placeId) ? 'collection_id,place_id' : 'collection_id,external_place_id',
  })
}

async function dbRemovePlace(userId: string, colId: string, placeId: string) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return
  const q = supabase.from('collection_places').delete().eq('collection_id', colId).eq('user_id', userId)
  if (isUuid(placeId)) await q.eq('place_id', placeId)
  else await q.eq('external_place_id', placeId)
}

// ─── API pública (síncrona + persiste en Supabase en background) ──────────────

export function addToCollection(colId: string, place: Omit<CollectionPlace, 'savedAt'> & { savedAt?: string }): void {
  const savedAt = place.savedAt ?? new Date().toISOString()
  const full: CollectionPlace = { ...place, savedAt }

  // 1. Actualiza localStorage inmediatamente
  const cols = loadCollections()
  const next = cols.map(c => {
    if (c.id !== colId) return c
    if (c.places.some(p => p.placeId === place.placeId)) return c
    if (c.id === 'default-went') syncVisited(full)
    return { ...c, places: [full, ...c.places] }
  })
  saveCollections(next)
  emit('add', colId, place.placeId)

  // 2. Persiste en Supabase si hay sesión
  getAuthUserId().then(userId => { if (userId) dbUpsertPlace(userId, colId, full) })
}

export function removeFromCollection(colId: string, placeId: string): void {
  // 1. Actualiza localStorage
  saveCollections(loadCollections().map(c => c.id === colId ? { ...c, places: c.places.filter(p => p.placeId !== placeId) } : c))
  emit('remove', colId, placeId)

  // 2. Persiste en Supabase
  getAuthUserId().then(userId => { if (userId) dbRemovePlace(userId, colId, placeId) })
}

export function createCollection(name: string, emoji: string, color = 'bg-orange-100'): UserCollection {
  const supabase = getSupabaseBrowserClient()

  // Crea en localStorage con ID temporal
  const created: UserCollection = {
    id: crypto.randomUUID(), name: name.trim(), emoji: emoji || '📍', color,
    isDefault: false, places: [], isPublic: false, createdAt: new Date().toISOString(),
  }
  saveCollections([...loadCollections(), created])
  emit('create', created.id)

  // Persiste en Supabase (el ID remoto puede diferir, pero para el MVP está bien)
  if (supabase) {
    getAuthUserId().then(userId => {
      if (!userId) return
      supabase.from('user_collections').insert({
        id:         created.id,
        user_id:    userId,
        name:       created.name,
        emoji:      created.emoji,
        color:      created.color,
        is_default: false,
        is_public:  false,
      })
    })
  }

  return created
}

export function updatePlaceNote(placeId: string, note: string): void {
  const cols = loadCollections()
  let changed = false
  const next = cols.map(c => ({
    ...c,
    places: c.places.map(p => { if (p.placeId !== placeId) return p; changed = true; return { ...p, note } }),
  }))
  if (!changed) return
  saveCollections(next)
  emit('update', 'note', placeId)

  // Persiste en Supabase
  getAuthUserId().then(async userId => {
    const supabase = getSupabaseBrowserClient()
    if (!userId || !supabase) return
    const q = supabase.from('collection_places').update({ note }).eq('user_id', userId)
    if (isUuid(placeId)) await q.eq('place_id', placeId)
    else await q.eq('external_place_id', placeId)
  })
}

export function toggleCollectionVisibility(collectionId: string): void {
  const cols = loadCollections()
  const next = cols.map(c => c.id === collectionId ? { ...c, isPublic: !c.isPublic } : c)
  saveCollections(next)
  emit('update', collectionId)

  // Persiste en Supabase
  getAuthUserId().then(async userId => {
    const supabase = getSupabaseBrowserClient()
    if (!userId || !supabase) return
    const col = next.find(c => c.id === collectionId)
    if (col) await supabase.from('user_collections').update({ is_public: col.isPublic }).eq('id', collectionId).eq('user_id', userId)
  })
}

export function isPlaceSaved(placeId: string): string[] {
  return loadCollections().filter(c => c.places.some(p => p.placeId === placeId)).map(c => c.id)
}

export function getCollectionForPlace(placeId: string): UserCollection | null {
  return loadCollections().find(c => c.places.some(p => p.placeId === placeId)) ?? null
}

// ─── Sincronización desde Supabase → localStorage (llamar al hacer login) ────

export async function syncCollectionsFromSupabase(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const userId = await getAuthUserId()
  if (!supabase || !userId) return

  const { data: cols } = await supabase
    .from('user_collections')
    .select('*, collection_places(*)')
    .eq('user_id', userId)
    .order('sort_order')

  if (!cols || cols.length === 0) {
    // Primera vez: subir colecciones locales a Supabase
    const local = loadCollections()
    for (const col of local) {
      await supabase.from('user_collections').upsert({
        id: col.id, user_id: userId, name: col.name, emoji: col.emoji,
        color: col.color, is_default: col.isDefault, is_public: col.isPublic,
      }, { onConflict: 'id' })
      for (const place of col.places) {
        await dbUpsertPlace(userId, col.id, place)
      }
    }
    return
  }

  // Sobreescribe localStorage con los datos de Supabase
  const synced: UserCollection[] = cols.map(c => ({
    id:        c.id,
    name:      c.name,
    emoji:     c.emoji,
    color:     c.color,
    isDefault: c.is_default,
    isPublic:  c.is_public,
    createdAt: c.created_at,
    places:    (c.collection_places ?? []).map((p: Record<string, string>) => ({
      placeId:      p.place_id ?? p.external_place_id,
      placeName:    p.place_name,
      placeAddress: p.place_address ?? '',
      placePhoto:   p.place_photo ?? undefined,
      savedAt:      p.saved_at,
      note:         p.note ?? undefined,
    })),
  }))

  saveCollections(synced)
  emit('update', 'sync')
}
