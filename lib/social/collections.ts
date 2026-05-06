'use client'

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
  { id: 'default-want', name: 'Quiero ir', emoji: '📍', color: 'bg-sky-100', isDefault: true, places: [], isPublic: true, createdAt: new Date().toISOString() },
  { id: 'default-went', name: 'Ya fui', emoji: '✅', color: 'bg-green-100', isDefault: true, places: [], isPublic: true, createdAt: new Date().toISOString() },
  { id: 'default-favs', name: 'Mis favoritos', emoji: '❤️', color: 'bg-rose-100', isDefault: true, places: [], isPublic: true, createdAt: new Date().toISOString() },
]

function emitCollectionUpdated(action: 'add' | 'remove' | 'create' | 'update', collectionId: string, placeId?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('picada:collection-updated', { detail: { action, collectionId, placeId } }))
}

function syncVisitedPlace(place: CollectionPlace) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(VISITED_KEY)
    const visited = raw ? JSON.parse(raw) as Array<{ id: string; name: string; address: string; visitedAt: string }> : []
    if (!visited.find(v => v.id === place.placeId)) {
      visited.unshift({
        id: place.placeId,
        name: place.placeName,
        address: place.placeAddress,
        visitedAt: new Date().toISOString(),
      })
      window.localStorage.setItem(VISITED_KEY, JSON.stringify(visited.slice(0, 80)))
    }
    window.dispatchEvent(new CustomEvent('picada:place-visited', {
      detail: { placeId: place.placeId, placeName: place.placeName, placeAddress: place.placeAddress },
    }))
  } catch {
    // noop
  }
}

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
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...incoming, isDefault: merged[idx].isDefault }
      } else {
        merged.push(incoming)
      }
    }
    return merged
  } catch {
    return DEFAULT_COLLECTIONS
  }
}

export function saveCollections(cols: UserCollection[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols))
}

export function addToCollection(colId: string, place: Omit<CollectionPlace, 'savedAt'> & { savedAt?: string }): void {
  const cols = loadCollections()
  const next = cols.map(c => {
    if (c.id !== colId) return c
    if (c.places.some(p => p.placeId === place.placeId)) return c
    const normalized: CollectionPlace = {
      ...place,
      savedAt: place.savedAt || new Date().toISOString(),
    }
    if (c.id === 'default-went') syncVisitedPlace(normalized)
    return { ...c, places: [normalized, ...c.places] }
  })
  saveCollections(next)
  emitCollectionUpdated('add', colId, place.placeId)
}

export function removeFromCollection(colId: string, placeId: string): void {
  const cols = loadCollections()
  const next = cols.map(c => (c.id === colId ? { ...c, places: c.places.filter(p => p.placeId !== placeId) } : c))
  saveCollections(next)
  emitCollectionUpdated('remove', colId, placeId)
}

export function createCollection(name: string, emoji: string, color = 'bg-orange-100'): UserCollection {
  const created: UserCollection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    emoji: emoji || '📍',
    color,
    isDefault: false,
    places: [],
    isPublic: false,
    createdAt: new Date().toISOString(),
  }
  const next = [...loadCollections(), created]
  saveCollections(next)
  emitCollectionUpdated('create', created.id)
  return created
}

export function isPlaceSaved(placeId: string): string[] {
  return loadCollections()
    .filter(c => c.places.some(p => p.placeId === placeId))
    .map(c => c.id)
}

export function getCollectionForPlace(placeId: string): UserCollection | null {
  return loadCollections().find(c => c.places.some(p => p.placeId === placeId)) || null
}

export function updatePlaceNote(placeId: string, note: string): void {
  const cols = loadCollections()
  let changed = false
  const next = cols.map(c => {
    const places = c.places.map(p => {
      if (p.placeId !== placeId) return p
      changed = true
      return { ...p, note }
    })
    return { ...c, places }
  })
  if (!changed) return
  saveCollections(next)
  emitCollectionUpdated('update', 'note', placeId)
}

export function toggleCollectionVisibility(collectionId: string): void {
  const next = loadCollections().map(c => (c.id === collectionId ? { ...c, isPublic: !c.isPublic } : c))
  saveCollections(next)
  emitCollectionUpdated('update', collectionId)
}
