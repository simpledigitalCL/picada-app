'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Globe, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import {
  addToCollection,
  createCollection,
  isPlaceSaved,
  loadCollections,
  removeFromCollection,
  type UserCollection,
} from '@/lib/social/collections'

type PickerPlace = {
  placeId: string
  placeName: string
  placeAddress: string
  placePhoto?: string
}

const EMOJIS = ['📍', '❤️', '🌹', '🍣', '🍕', '☕', '🌮', '🔥']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  place: PickerPlace
}

export function CollectionPickerSheet({ open, onOpenChange, place }: Props) {
  const { toast } = useToast()
  const [collections, setCollections] = useState<UserCollection[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📍')
  const [flashCollectionId, setFlashCollectionId] = useState<string | null>(null)

  const refreshState = () => {
    const cols = loadCollections()
    setCollections(cols)
    setSelectedIds(isPlaceSaved(place.placeId))
  }

  const countByCollection = useMemo(() => new Map(collections.map(c => [c.id, c.places.length])), [collections])

  const toggleCollection = (collectionId: string) => {
    setSelectedIds(prev => (prev.includes(collectionId) ? prev.filter(id => id !== collectionId) : [...prev, collectionId]))
  }

  useEffect(() => {
    if (open) refreshState()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place.placeId])

  const handleDone = () => {
    const prevSelected = new Set(isPlaceSaved(place.placeId))
    const nextSelected = new Set(selectedIds)
    collections.forEach(col => {
      const was = prevSelected.has(col.id)
      const now = nextSelected.has(col.id)
      if (!was && now) {
        addToCollection(col.id, {
          placeId: place.placeId,
          placeName: place.placeName,
          placeAddress: place.placeAddress,
          placePhoto: place.placePhoto,
        })
        setFlashCollectionId(col.id)
        window.setTimeout(() => setFlashCollectionId(null), 800)
      }
      if (was && !now) removeFromCollection(col.id, place.placeId)
    })
    if (typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      confetti({ particleCount: 40, spread: 45, origin: { y: 0.85 } })
    }
    const firstCollection = collections.find(c => nextSelected.has(c.id))
    const saveCount = Number(window.localStorage.getItem('picada.collections.saved.count.v1') || '0') + 1
    window.localStorage.setItem('picada.collections.saved.count.v1', String(saveCount))
    toast({ title: firstCollection ? `+2 XP — Guardado en ${firstCollection.name}` : 'Colecciones actualizadas' })
    if (saveCount === 1) {
      toast({ title: 'Tip rápido', description: '¿Quieres agregar una nota? Hazlo desde el detalle del local.' })
    }
    if (saveCount === 2) {
      toast({ title: 'Siguiente nivel', description: '¿Crear una lista personalizada? Te ayudará a organizar mejor tus planes.' })
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => {
      if (v) refreshState()
      onOpenChange(v)
    }}>
      <SheetContent
        side="bottom"
        className="max-h-[70dvh] rounded-t-3xl px-5 pt-4 pb-8 overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <SheetTitle className="text-base font-bold">¿Dónde lo guardas?</SheetTitle>
        <AnimatePresence>
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="mt-4 space-y-3"
          >
            {collections.map(col => (
              <div
                key={col.id}
                onClick={() => toggleCollection(col.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleCollection(col.id)
                  }
                }}
                className={`h-14 w-full rounded-xl border px-3 flex items-center justify-between gap-3 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors ${flashCollectionId === col.id ? 'bg-orange-100 border-orange-300' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">{col.emoji}</span>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold truncate">{col.name}</p>
                    <p className="text-xs text-muted-foreground">{countByCollection.get(col.id) || 0} lugares</p>
                  </div>
                  {col.isPublic ? <Globe className="size-3.5 text-green-600" /> : null}
                </div>
                <motion.div animate={{ scale: selectedIds.includes(col.id) ? [0.8, 1] : 1 }} transition={{ duration: 0.15 }}>
                  <Checkbox checked={selectedIds.includes(col.id)} className={selectedIds.includes(col.id) ? 'bg-orange-500 border-orange-500' : ''} />
                </motion.div>
              </div>
            ))}

            <div className="rounded-xl border border-dashed p-3">
              <button type="button" onClick={() => setCreating(v => !v)} className="text-sm font-semibold inline-flex items-center gap-2">
                <Plus className="size-4" /> Crear nueva lista
              </button>
              {creating ? (
                <div className="mt-3 space-y-2">
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre de la lista" />
                  <div className="flex gap-1.5 flex-wrap">
                    {EMOJIS.map(e => (
                      <button key={e} type="button" className={`size-8 rounded-lg border ${newEmoji === e ? 'border-orange-500 bg-orange-50' : ''}`} onClick={() => setNewEmoji(e)}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newName.trim()}
                    onClick={() => {
                      const created = createCollection(newName, newEmoji)
                      setNewName('')
                      setCreating(false)
                      refreshState()
                      setSelectedIds(prev => [...new Set([...prev, created.id])])
                    }}
                  >
                    Crear
                  </Button>
                </div>
              ) : null}
            </div>

            <Button className="w-full h-11 rounded-xl" onClick={handleDone}>Listo</Button>
          </motion.div>
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}
