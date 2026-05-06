'use client'

import { useEffect, useMemo, useState } from 'react'
import { FolderHeart, MoreHorizontal, Plus, Share2, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  addToCollection,
  createCollection,
  loadCollections,
  removeFromCollection,
  saveCollections,
  toggleCollectionVisibility,
  type UserCollection,
} from '@/lib/collections'

// Public API for adding a place to a collection from outside this component
export function addPlaceToCollection(collectionId: string, place: { id: string; name: string; address: string; addedAt?: string }) {
  addToCollection(collectionId, {
    placeId: place.id,
    placeName: place.name,
    placeAddress: place.address,
    savedAt: place.addedAt,
  })
}

interface Props {
  compact?: boolean
}

export function RestaurantCollections({ compact = false }: Props) {
  const { toast } = useToast()
  const [collections, setCollections] = useState<UserCollection[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📍')
  const [newColor, setNewColor] = useState('bg-orange-100')

  const EMOJI_OPTIONS = ['🍕', '🍣', '🍺', '☕', '🌮', '🥗', '🍜', '🌹', '💼', '🎉', '🔥', '📍']
  const COLORS = ['bg-orange-100', 'bg-rose-100', 'bg-green-100', 'bg-sky-100', 'bg-violet-100']

  useEffect(() => {
    setCollections(loadCollections())
    const handler = () => setCollections(loadCollections())
    window.addEventListener('picada:collection-updated', handler)
    return () => window.removeEventListener('picada:collection-updated', handler)
  }, [])

  const stats = useMemo(() => {
    const want = collections.find(c => c.id === 'default-want')?.places || []
    const went = collections.find(c => c.id === 'default-went')?.places || []
    const wentIds = new Set(went.map(p => p.placeId))
    const covered = want.filter(p => wentIds.has(p.placeId)).length
    return { covered, total: want.length }
  }, [collections])

  const handleCreate = () => {
    if (!newName.trim()) return
    createCollection(newName.trim(), newEmoji, newColor)
    setCollections(loadCollections())
    setNewName('')
    setNewEmoji('📍')
    setCreating(false)
  }

  const handleRemovePlace = (collectionId: string, placeId: string) => {
    removeFromCollection(collectionId, placeId)
    setCollections(loadCollections())
  }

  const handleDeleteCollection = (id: string) => {
    const target = collections.find(c => c.id === id)
    if (!target || target.isDefault) return
    const updated = collections.filter(c => c.id !== id)
    saveCollections(updated)
    window.dispatchEvent(new CustomEvent('picada:collection-updated', { detail: { action: 'remove', collectionId: id } }))
    setCollections(updated)
  }

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {collections.map(c => (
          <button
            key={c.id}
            className="shrink-0 flex flex-col items-center gap-1 rounded-xl border bg-card px-3 py-2 hover:bg-accent transition-colors"
            aria-label={`Colección ${c.name}`}
          >
            <span className="text-xl">{c.emoji}</span>
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{c.name}</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1">{c.places.length}</Badge>
          </button>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderHeart className="size-4 text-orange-500" aria-hidden />
            Mis colecciones
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => setCreating(v => !v)}
            aria-label="Crear colección"
          >
            <Plus className="size-3.5" aria-hidden />
            Nueva
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {/* New collection form */}
        <AnimatePresence>
        {creating ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="rounded-xl border p-3 space-y-2 bg-muted/30 overflow-hidden"
          >
            <p className="text-xs font-semibold">Nueva colección</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => setNewEmoji(e)}
                  className={`text-lg rounded-lg p-1 transition-colors ${newEmoji === e ? 'bg-orange-100 dark:bg-orange-900/30 ring-2 ring-orange-400' : 'hover:bg-muted'}`}
                  aria-label={`Emoji ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nombre de la colección"
              className="h-9 text-sm border-orange-300 focus-visible:ring-orange-200"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              aria-label="Nombre de la colección"
            />
            <div className="flex gap-2">
              {COLORS.map(color => (
                <button key={color} className={`size-5 rounded-full border ${color} ${newColor === color ? 'ring-2 ring-orange-400' : ''}`} onClick={() => setNewColor(color)} />
              ))}
            </div>
            <div className={`rounded-lg p-2 ${newColor}`}>
              <p className="text-sm font-semibold">{newEmoji} {newName || 'Mi nueva lista'}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleCreate} disabled={!newName.trim()}>
                Crear
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        ) : null}
        </AnimatePresence>

        {stats.total > 0 ? (
          <div className="rounded-xl border p-2.5 bg-muted/20 text-xs">
            {stats.covered > 0
              ? `Has visitado ${stats.covered}/${stats.total} lugares de "Quiero ir" 🎉`
              : `Aún no has ido a ${stats.total} de estos lugares. ¡Explóralos!`}
          </div>
        ) : null}

        {/* Collection list */}
        {collections.map(c => (
          <div key={c.id} className="rounded-xl border overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
              onClick={() => setExpanded(prev => prev === c.id ? null : c.id)}
              aria-expanded={expanded === c.id}
              aria-label={`${c.name}, ${c.places.length} lugares`}
            >
              <span className="text-3xl">{c.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{c.name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{c.places.length}</Badge>
                  {c.isPublic ? <Badge className="text-[10px] bg-green-100 text-green-700">🌐 Pública</Badge> : null}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === c.id ? null : c.id) }} className="p-1">
                <MoreHorizontal className="size-4" />
              </button>
            </button>
            {activeMenu === c.id ? (
              <div className="border-t px-3 py-2 flex flex-wrap gap-1.5 text-xs">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { toggleCollectionVisibility(c.id); setCollections(loadCollections()) }}>
                  {c.isPublic ? 'Hacer privada' : 'Hacer pública'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={async () => {
                    const text = `📋 Mi lista '${c.name}' en Picada.App:\n${c.places.map(p => `• ${p.placeName}`).join('\n')}\n\nDescúbrela en Picada.App 🗺️`
                    try {
                      if (navigator.share) await navigator.share({ title: c.name, text })
                      else await navigator.clipboard.writeText(text)
                      toast({ title: 'Colección lista para compartir' })
                    } catch {
                      // noop
                    }
                  }}
                >
                  <Share2 className="size-3.5 mr-1" /> Compartir
                </Button>
                {!c.isDefault ? (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => {
                      const nextName = window.prompt('Nuevo nombre', c.name)
                      if (!nextName?.trim()) return
                      const next = loadCollections().map(col => col.id === c.id ? { ...col, name: nextName.trim() } : col)
                      saveCollections(next)
                      window.dispatchEvent(new CustomEvent('picada:collection-updated', { detail: { action: 'update', collectionId: c.id } }))
                      setCollections(next)
                    }}>
                      Renombrar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] text-red-600" onClick={() => handleDeleteCollection(c.id)}>
                      <Trash2 className="size-3.5 mr-1" /> Eliminar
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}

            {expanded === c.id && (
              <div className="border-t bg-muted/20 px-3 py-2 space-y-1.5">
                {c.places.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    Aún no tienes lugares en esta colección.
                    <br />Agrégalos desde el detalle de cada restaurant.
                  </p>
                ) : (
                  c.places.map(p => (
                    <div key={p.placeId} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.placeName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.placeAddress}</p>
                        {p.note ? <p className="text-[10px] text-muted-foreground italic truncate">{p.note}</p> : null}
                        <p className="text-[10px] text-muted-foreground">Guardado {new Date(p.savedAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => handleRemovePlace(c.id, p.placeId)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        aria-label={`Quitar ${p.placeName} de ${c.name}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
