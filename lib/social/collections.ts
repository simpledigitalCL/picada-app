'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase'

export const COLLECTIONS_KEY = 'picada.collections.v1'
const VISITED_KEY = 'picada.visited.places.v1'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  sortOrder?: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_COLLECTIONS: UserCollection[] = [
  { id: 'default-want', name: 'Quiero ir',    emoji: '📍', color: 'bg-sky-100',   isDefault: true, places: [], isPublic: true,  createdAt: new Date().toISOString(), sortOrder: 0 },
  { id: 'default-went', name: 'Ya fui',        emoji: '✅', color: 'bg-green-100', isDefault: true, places: [], isPublic: true,  createdAt: new Date().toISOString(), sortOrder: 1 },
  { id: 'default-favs', name: 'Mis favoritos', emoji: '❤️', color: 'bg-rose-100',  isDefault: true, places: [], isPublic: true,  createdAt: new Date().toISOString(), sortOrder: 2 },
]

// ─── Internal utils ───────────────────────────────────────────────────────────

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function emit(action: 'add' | 'remove' | 'create' | 'update' | 'delete', collectionId: string, placeId?: string) {
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

// ─── localStorage ─────────────────────────────────────────────────────────────

export function loadCollections(): UserCollection[] {
  if (typeof window === 'undefined') return DEFAULT_COLLECTIONS
  try {
    const raw = window.localStorage.getItem(COLLECTIONS_KEY)
    const parsed = raw ? JSON.parse(raw) as UserCollection[] : []
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(DEFAULT_COLLECTIONS))
      return DEFAULT_COLLECTIONS
    }
    // Merge: garantiza que los defaults siempre existan, preservando sus lugares.
    // Busca por id primero (pre-sync) y luego por nombre+isDefault (post-sync con UUID de Supabase).
    const merged = DEFAULT_COLLECTIONS.map(def => {
      const found = parsed.find(c => c.id === def.id || (c.isDefault && c.name === def.name))
      return found ? { ...def, ...found, isDefault: true } : def
    })
    // Agrega solo colecciones no-default que no fueron ya mergeadas
    for (const col of parsed) {
      if (!col.isDefault && !merged.find(c => c.id === col.id)) merged.push(col)
    }
    return merged.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
  } catch { return DEFAULT_COLLECTIONS }
}

export function saveCollections(cols: UserCollection[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols))
}

// ─── Supabase helpers (privados) ──────────────────────────────────────────────

type RemotePlace = Record<string, string | null>
type RemoteCol   = {
  id: string
  name: string
  emoji: string
  color: string
  is_default: boolean
  is_public: boolean
  sort_order: number
  created_at: string
  collection_places?: RemotePlace[]
}

function remoteToLocal(cols: RemoteCol[]): UserCollection[] {
  return cols
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => ({
      id:        c.id,
      name:      c.name,
      emoji:     c.emoji,
      color:     c.color,
      isDefault: c.is_default,
      isPublic:  c.is_public,
      createdAt: c.created_at,
      sortOrder: c.sort_order,
      places: (c.collection_places ?? []).map(p => ({
        placeId:      (p.place_id ?? p.external_place_id) as string,
        placeName:    p.place_name as string,
        placeAddress: p.place_address ?? '',
        placePhoto:   p.place_photo ?? undefined,
        savedAt:      p.saved_at as string,
        note:         p.note ?? undefined,
      })),
    }))
}

async function fetchRemoteCols(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  userId: string,
): Promise<RemoteCol[]> {
  const { data } = await supabase
    .from('user_collections')
    .select('*, collection_places(*)')
    .eq('user_id', userId)
    .order('sort_order')
  return (data ?? []) as RemoteCol[]
}

async function dbUpsertPlace(userId: string, colId: string, place: CollectionPlace): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return

  let internalPlaceId: string | null = null
  if (isUuid(place.placeId)) {
    internalPlaceId = place.placeId
  } else {
    // Intenta resolver el Google Place ID a un UUID interno
    const { data: found } = await supabase
      .from('places')
      .select('id')
      .eq('external_id', place.placeId)
      .maybeSingle()
    internalPlaceId = found?.id ?? null
  }

  const row: Record<string, unknown> = {
    collection_id: colId,
    user_id:       userId,
    place_name:    place.placeName,
    place_address: place.placeAddress,
    place_photo:   place.placePhoto ?? null,
    note:          place.note ?? null,
    saved_at:      place.savedAt,
  }
  if (internalPlaceId) {
    row.place_id = internalPlaceId
  } else {
    row.external_place_id = place.placeId
  }

  // PostgREST no soporta ON CONFLICT en índices únicos parciales.
  // Hacemos upsert manual: buscar fila existente por place_id o external_place_id.
  const baseQ = supabase
    .from('collection_places')
    .select('id, place_id')
    .eq('collection_id', colId)
    .eq('user_id', userId)

  let existing: { id: string; place_id: string | null } | null = null
  let selErr: { message: string } | null = null

  if (internalPlaceId) {
    const r1 = await baseQ.eq('place_id', internalPlaceId).maybeSingle()
    selErr = r1.error
    existing = r1.data
    // Fallback: el registro fue guardado antes de que el lugar existiera en places
    if (!existing && !selErr && !isUuid(place.placeId)) {
      const r2 = await supabase
        .from('collection_places')
        .select('id, place_id')
        .eq('collection_id', colId)
        .eq('user_id', userId)
        .eq('external_place_id', place.placeId)
        .maybeSingle()
      selErr = r2.error
      existing = r2.data
    }
  } else {
    const r = await baseQ.eq('external_place_id', place.placeId).maybeSingle()
    selErr = r.error
    existing = r.data
  }

  if (selErr) {
    console.warn('[collections] dbUpsertPlace select error:', selErr.message, { colId, placeId: place.placeId })
    return
  }

  if (existing) {
    const patch: Record<string, unknown> = {
      place_name:    row.place_name,
      place_address: row.place_address,
      place_photo:   row.place_photo,
      note:          row.note,
    }
    // Si resolvimos el UUID interno y el registro no lo tenía, actualizarlo
    if (internalPlaceId && !existing.place_id) {
      patch.place_id          = internalPlaceId
      patch.external_place_id = null
    }
    const { error: updErr } = await supabase
      .from('collection_places')
      .update(patch)
      .eq('id', existing.id)
    if (updErr) console.warn('[collections] dbUpsertPlace update error:', updErr.message, { id: existing.id })
    else console.log('[collections] dbUpsertPlace updated', existing.id)
  } else {
    const { error: insErr } = await supabase.from('collection_places').insert(row)
    if (insErr) console.warn('[collections] dbUpsertPlace insert error:', insErr.message, { colId, placeId: place.placeId })
    else console.log('[collections] dbUpsertPlace inserted', place.placeId, '→ col', colId)
  }
}

async function dbRemovePlace(userId: string, colId: string, placeId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return
  const q = supabase.from('collection_places').delete().eq('collection_id', colId).eq('user_id', userId)
  const { error } = await (isUuid(placeId) ? q.eq('place_id', placeId) : q.eq('external_place_id', placeId))
  if (error) console.warn('[collections] dbRemovePlace error:', error.message, { colId, placeId })
  else console.log('[collections] dbRemovePlace ok', placeId, '← col', colId)
}

// ─── CRUD público ─────────────────────────────────────────────────────────────

/** Agrega un lugar a una colección (local-first + sync Supabase en background) */
export function addToCollection(colId: string, place: Omit<CollectionPlace, 'savedAt'> & { savedAt?: string }): void {
  const savedAt = place.savedAt ?? new Date().toISOString()
  const full: CollectionPlace = { ...place, savedAt }

  const cols = loadCollections()
  const next = cols.map(c => {
    if (c.id !== colId) return c
    if (c.places.some(p => p.placeId === place.placeId)) return c
    if (c.id === 'default-went') syncVisited(full)
    return { ...c, places: [full, ...c.places] }
  })
  saveCollections(next)
  emit('add', colId, place.placeId)

  if (isUuid(colId)) {
    getAuthUserId().then(userId => { if (userId) void dbUpsertPlace(userId, colId, full) })
  }
}

/** Elimina un lugar de una colección */
export function removeFromCollection(colId: string, placeId: string): void {
  const cols = loadCollections()
  const next = cols.map(c =>
    c.id === colId ? { ...c, places: c.places.filter(p => p.placeId !== placeId) } : c
  )
  saveCollections(next)
  emit('remove', colId, placeId)

  if (isUuid(colId)) {
    getAuthUserId().then(userId => { if (userId) void dbRemovePlace(userId, colId, placeId) })
  }
}

/** Crea una nueva colección de usuario */
export function createCollection(
  name: string,
  emoji: string,
  color = 'bg-orange-100',
  isPublic = false,
): UserCollection {
  const cols = loadCollections()
  const sortOrder = cols.length

  const created: UserCollection = {
    id:        crypto.randomUUID(),
    name:      name.trim(),
    emoji:     emoji || '📍',
    color,
    isDefault: false,
    places:    [],
    isPublic,
    createdAt: new Date().toISOString(),
    sortOrder,
  }
  saveCollections([...cols, created])
  emit('create', created.id)

  getAuthUserId().then(async userId => {
    const supabase = getSupabaseBrowserClient()
    if (!userId || !supabase) {
      console.log('[collections] createCollection: no session, saved locally only', created.id)
      return
    }
    // Intenta insertar con el UUID local
    const { error } = await supabase.from('user_collections').insert({
      id:         created.id,
      user_id:    userId,
      name:       created.name,
      emoji:      created.emoji,
      color:      created.color,
      is_default: false,
      is_public:  created.isPublic,
      sort_order: sortOrder,
    })
    if (error) {
      console.warn('[collections] createCollection DB error:', error.message, created.id)
    } else {
      console.log('[collections] createCollection DB ok', created.id, created.name)
    }
  })

  return created
}

/** Actualiza metadatos de una colección (nombre, emoji, color, visibilidad) */
export function updateCollection(
  colId: string,
  patch: Partial<Pick<UserCollection, 'name' | 'emoji' | 'color' | 'isPublic'>>,
): void {
  const cols = loadCollections()
  const next = cols.map(c => (c.id === colId ? { ...c, ...patch } : c))
  saveCollections(next)
  emit('update', colId)

  if (isUuid(colId)) {
    getAuthUserId().then(async userId => {
      const supabase = getSupabaseBrowserClient()
      if (!userId || !supabase) return
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.name     !== undefined) dbPatch.name      = patch.name
      if (patch.emoji    !== undefined) dbPatch.emoji     = patch.emoji
      if (patch.color    !== undefined) dbPatch.color     = patch.color
      if (patch.isPublic !== undefined) dbPatch.is_public = patch.isPublic
      await supabase.from('user_collections').update(dbPatch).eq('id', colId).eq('user_id', userId)
    })
  }
}

/** Elimina una colección de usuario (las colecciones default no se pueden borrar) */
export function deleteCollection(colId: string): void {
  const cols = loadCollections()
  const target = cols.find(c => c.id === colId)
  if (!target || target.isDefault) return

  saveCollections(cols.filter(c => c.id !== colId))
  emit('delete', colId)

  if (isUuid(colId)) {
    getAuthUserId().then(async userId => {
      const supabase = getSupabaseBrowserClient()
      if (!userId || !supabase) return
      // El CASCADE en DB borra automáticamente los collection_places
      const { error } = await supabase.from('user_collections').delete().eq('id', colId).eq('user_id', userId)
      if (error) console.warn('[collections] deleteCollection DB error:', error.message, colId)
      else console.log('[collections] deleteCollection DB ok', colId)
    })
  }
}

/** Reordena las colecciones según la lista de IDs provista */
export function reorderCollections(orderedIds: string[]): void {
  const cols = loadCollections()
  const byId = new Map(cols.map(c => [c.id, c]))
  const reordered: UserCollection[] = []
  orderedIds.forEach((id, i) => {
    const col = byId.get(id)
    if (col) reordered.push({ ...col, sortOrder: i })
  })
  // Agrega colecciones no incluidas en orderedIds al final
  cols.forEach(c => { if (!orderedIds.includes(c.id)) reordered.push(c) })
  saveCollections(reordered)
  emit('update', 'reorder')

  getAuthUserId().then(async userId => {
    const supabase = getSupabaseBrowserClient()
    if (!userId || !supabase) return
    await Promise.all(
      orderedIds
        .filter(isUuid)
        .map((id, i) =>
          supabase
            .from('user_collections')
            .update({ sort_order: i, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)
        )
    )
  })
}

/** Actualiza la nota de un lugar en todas las colecciones donde esté guardado */
export function updatePlaceNote(placeId: string, note: string): void {
  const cols = loadCollections()
  let changed = false
  const next = cols.map(c => ({
    ...c,
    places: c.places.map(p => {
      if (p.placeId !== placeId) return p
      changed = true
      return { ...p, note }
    }),
  }))
  if (!changed) return
  saveCollections(next)
  emit('update', 'note', placeId)

  getAuthUserId().then(async userId => {
    const supabase = getSupabaseBrowserClient()
    if (!userId || !supabase) return
    const q = supabase.from('collection_places').update({ note }).eq('user_id', userId)
    if (isUuid(placeId)) await q.eq('place_id', placeId)
    else await q.eq('external_place_id', placeId)
  })
}

/** Cambia visibilidad pública de una colección */
export function toggleCollectionVisibility(collectionId: string): void {
  const cols = loadCollections()
  const next = cols.map(c => (c.id === collectionId ? { ...c, isPublic: !c.isPublic } : c))
  saveCollections(next)
  emit('update', collectionId)

  if (isUuid(collectionId)) {
    getAuthUserId().then(async userId => {
      const supabase = getSupabaseBrowserClient()
      if (!userId || !supabase) return
      const col = next.find(c => c.id === collectionId)
      if (col) {
        await supabase
          .from('user_collections')
          .update({ is_public: col.isPublic, updated_at: new Date().toISOString() })
          .eq('id', collectionId)
          .eq('user_id', userId)
      }
    })
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Devuelve los IDs de colecciones donde está guardado el lugar */
export function isPlaceSaved(placeId: string): string[] {
  return loadCollections().filter(c => c.places.some(p => p.placeId === placeId)).map(c => c.id)
}

/** Primera colección que contiene el lugar */
export function getCollectionForPlace(placeId: string): UserCollection | null {
  return loadCollections().find(c => c.places.some(p => p.placeId === placeId)) ?? null
}

// ─── Sincronización Supabase → localStorage (llamar al hacer login) ───────────

let syncInProgress = false

export async function syncCollectionsFromSupabase(): Promise<void> {
  if (syncInProgress) return
  syncInProgress = true
  try {
    await _doSync()
  } finally {
    syncInProgress = false
  }
}

async function _doSync(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const userId = await getAuthUserId()
  if (!supabase || !userId) return

  const remote = await fetchRemoteCols(supabase, userId)
  const local  = loadCollections()

  const remoteByName = new Map(remote.map(c => [c.name, c]))
  const remoteById   = new Map(remote.map(c => [c.id,   c]))

  for (let i = 0; i < local.length; i++) {
    const col = local[i]
    // Busca equivalente remoto: primero por ID (si es UUID), luego por nombre
    let remoteCol = (isUuid(col.id) ? remoteById.get(col.id) : undefined) ?? remoteByName.get(col.name)

    if (!remoteCol) {
      // No existe en Supabase → upsert con onConflict para evitar duplicados por race condition
      const { data: inserted, error: insColErr } = await supabase
        .from('user_collections')
        .upsert({
          user_id:    userId,
          name:       col.name,
          emoji:      col.emoji,
          color:      col.color,
          is_default: col.isDefault,
          is_public:  col.isPublic,
          sort_order: i,
        }, { onConflict: 'user_id,name' })
        .select('id')
        .single()

      if (insColErr) { console.warn('[collections] sync: upsert col error:', insColErr.message, col.name); continue }
      if (!inserted) { console.warn('[collections] sync: no upserted data for col', col.name); continue }

      // Refetch para obtener la fila completa (con collection_places vacío)
      const { data: fetched } = await supabase
        .from('user_collections')
        .select('*, collection_places(*)')
        .eq('id', inserted.id)
        .single()

      if (!fetched) { console.warn('[collections] sync: could not refetch col', inserted.id); continue }
      remoteCol = fetched as RemoteCol
      remoteByName.set(col.name, remoteCol)
      remoteById.set(remoteCol.id, remoteCol)
    }

    // Sube lugares locales que no están en el remoto
    const remotePlaceIds = new Set(
      (remoteCol.collection_places ?? []).map(p => p.place_id ?? p.external_place_id)
    )
    console.log('[collections] sync: col', remoteCol.name, '— local places:', col.places.length, '| remote places:', remotePlaceIds.size)
    for (const place of col.places) {
      if (!remotePlaceIds.has(place.placeId)) {
        console.log('[collections] sync: uploading place', place.placeId, place.placeName, '→ col', remoteCol.id)
        await dbUpsertPlace(userId, remoteCol.id, place)
      }
    }
  }

  // Descarga estado final y actualiza localStorage con UUIDs reales
  const final = await fetchRemoteCols(supabase, userId)
  console.log('[collections] sync: final remote cols:', final.length)
  if (final.length > 0) {
    saveCollections(remoteToLocal(final))
    emit('update', 'sync')
  }
}
