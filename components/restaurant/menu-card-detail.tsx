'use client'

import Image from 'next/image'
import { Heart, BookmarkPlus, Sparkles, Share2, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAuthHeaders } from '@/lib/api/auth'
import { requireAuthOrPrompt } from '@/lib/auth/gate'

type Entry = {
  id: string
  review_text?: string
  rating?: number
  photo_url?: string | null
  nutrition?: Record<string, number | string>
  is_official?: boolean
}

export function MenuCardDetail({
  open,
  onOpenChange,
  itemName,
  topPhoto,
  avgRating,
  avgKcalAi,
  avgKcalUser,
  entries,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  itemName: string
  topPhoto?: string | null
  avgRating: number
  avgKcalAi: number
  avgKcalUser: number
  entries: Entry[]
}) {
  const exportWithWatermark = async () => {
    if (!topPhoto) return
    const watermarkUser =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('picada.user.id.v1') || 'foodie').slice(0, 24)
        : 'foodie'
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = topPhoto
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('No se pudo cargar imagen'))
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || 1080
    canvas.height = img.naturalHeight || 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(0,0,0,.55)'
    ctx.fillRect(canvas.width - 360, canvas.height - 80, 340, 56)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('Picada.APP', canvas.width - 346, canvas.height - 46)
    ctx.font = '18px sans-serif'
    ctx.fillText(`@${watermarkUser}`, canvas.width - 346, canvas.height - 24)
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${itemName}-picada.png`
    a.click()
  }

  const shareNative = async () => {
    const text = `Mira este plato en Picada.APP: ${itemName}`
    if (navigator.share) {
      await navigator.share({ title: itemName, text })
      return
    }
    await navigator.clipboard.writeText(text)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{itemName}</DialogTitle>
        </DialogHeader>
        {topPhoto ? (
          <div className="relative h-48 rounded-xl overflow-hidden bg-muted">
            <Image src={topPhoto} alt={itemName} fill className="object-cover" />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline"><Sparkles className="size-3 mr-1" /> {avgRating}/5 promedio</Badge>
          <Badge variant="outline">Promedio IA: {avgKcalAi || 0} kcal</Badge>
          <Badge variant="outline">Usuarios: {avgKcalUser || 0} kcal</Badge>
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {entries.slice(0, 10).map(e => (
            <div key={e.id} className="rounded-lg border p-2">
              <p className="text-xs text-muted-foreground">{e.is_official ? 'Oficial' : 'Visto por la comunidad'} · {e.rating || 0}/5</p>
              <p className="text-sm">{e.review_text || 'Sin comentario'}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            onClick={async () => {
              if (!entries[0]?.id) return
              const allowed = await requireAuthOrPrompt()
              if (!allowed) return
              const authHeaders = await getAuthHeaders()
              await fetch('/api/social', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ action: 'save_item', menu_item_id: entries[0].id, kind: 'pending' }),
              })
              if (typeof window !== 'undefined') {
                const raw = window.localStorage.getItem('picada.pending.dishes.v1')
                const current = raw ? (JSON.parse(raw) as string[]) : []
                const next = [...new Set([itemName, ...current])].slice(0, 50)
                window.localStorage.setItem('picada.pending.dishes.v1', JSON.stringify(next))
              }
            }}
          >
            <BookmarkPlus className="size-4 mr-1.5" />
            Guardar para después
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!entries[0]?.id) return
              await fetch('/api/menu-items/vote-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menu_item_id: entries[0].id, vote_type: 'esthetic' }),
              })
            }}
          >
            <Heart className="size-4 mr-1.5" />
            Me gusta
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={exportWithWatermark}>
            <Download className="size-4 mr-1.5" />
            Exportar con marca
          </Button>
          <Button variant="outline" onClick={shareNative}>
            <Share2 className="size-4 mr-1.5" />
            Compartir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

