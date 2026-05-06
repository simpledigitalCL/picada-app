'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PartyPopper, Sparkles, Utensils } from 'lucide-react'
import { ReelVideoCard } from '@/components/feed/reel-video-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LocationAutocomplete } from '@/components/search/location-autocomplete'
import { cn } from '@/lib/utils'
import type { ReelItem, ReelsApiResponse } from '@/lib/feed/types'
import {
  loadPreferences,
  loadReelInteractions,
  rankReels,
  saveReelInteractions,
  type ReelInteraction,
} from '@/lib/feed/personalization'

function ReelsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">
      <Utensils className="size-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}

interface ReelsViewProps {
  locationQuery: string
  onLocationChange: (value: string) => void
}

export function ReelsView({ locationQuery, onLocationChange }: ReelsViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<ReelItem[] | null>(null)
  const [source, setSource] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [interactions, setInteractions] = useState<ReelInteraction>({
    likedById: [],
    favoriteById: [],
    likedAuthors: [],
    likedPlatforms: [],
    favoriteItems: [],
  })

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const prefs = loadPreferences()
    const restrictions = encodeURIComponent(prefs.restrictions.join(','))
    fetch(`/api/reels?location=${encodeURIComponent(locationQuery)}&restrictions=${restrictions}&_=${Date.now()}`)
      .then(async r => {
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || `HTTP ${r.status}`)
        }
        return r.json() as Promise<ReelsApiResponse>
      })
      .then(data => {
        const prefs = loadPreferences()
        const inter = loadReelInteractions()
        setInteractions(inter)
        setItems(rankReels(data.items, prefs, inter))
        setSource(data.source)
      })
      .catch((e: Error) => {
        setError(e.message || 'No se pudo cargar el feed')
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [locationQuery])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const rerank = () => {
      const prefs = loadPreferences()
      const inter = loadReelInteractions()
      setInteractions(inter)
      setItems(current => rankReels(current || [], prefs, inter))
    }
    window.addEventListener('picada:prefs-updated', rerank)
    window.addEventListener('picada:reels-interactions-updated', rerank)
    return () => {
      window.removeEventListener('picada:prefs-updated', rerank)
      window.removeEventListener('picada:reels-interactions-updated', rerank)
    }
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Cargando reels…
      </div>
    )
  }

  if (error) {
    return <ReelsError message={error} onRetry={load} />
  }

  const list = items ?? []
  if (list.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">
        <PartyPopper className="size-10 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No hay videos disponibles. Revisa <code className="text-xs bg-muted px-1 rounded">YOUTUBE_API_KEY</code> o ajusta la ubicación.
        </p>
        <Button variant="outline" className="mt-4" onClick={load}>
          Actualizar
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 relative bg-black">
      <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
        {source && (
          <Badge variant="outline" className="text-[0.6rem] font-semibold text-white border-white/30 bg-black/40 backdrop-blur-md">
            {source === 'rapidapi+youtube+curated'
              ? 'RapidAPI + YouTube'
              : source === 'youtube+curated'
                ? 'YouTube + curado'
                : 'Curado'}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[0.6rem] font-semibold gap-1 bg-black/50 text-white border-0">
          <Sparkles className="size-3" />
          Personalizado
        </Badge>
        <div className="flex items-center gap-0.5 text-white/80 max-[300px]:hidden" aria-hidden>
          <Utensils className="size-3.5" />
          <span className="text-[0.6rem] font-medium pl-0.5">YouTube</span>
        </div>
      </div>
      <div className="absolute top-2 right-2 z-30 w-[52%] max-w-[240px]">
        <LocationAutocomplete
          value={locationQuery}
          onChange={onLocationChange}
          dark
          inputClassName="h-8 text-xs bg-black/45 border-white/20 text-white placeholder:text-white/60"
        />
      </div>

      <div
        ref={scrollRef}
        className={cn(
          'flex-1 min-h-0 max-w-md mx-auto w-full overflow-y-auto',
          'snap-y snap-mandatory scroll-smooth',
          'overscroll-y-contain touch-pan-y',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        <div className="flex flex-col gap-0">
          {list.map(reel => (
            <ReelVideoCard
              key={reel.id}
              item={reel}
              scrollRoot={scrollRef}
              liked={interactions.likedById.includes(reel.id)}
              favorite={interactions.favoriteById.includes(reel.id)}
              onToggleLike={item => {
                const prev = interactions
                const liked = prev.likedById.includes(item.id)
                const next: ReelInteraction = {
                  likedById: liked
                    ? prev.likedById.filter(id => id !== item.id)
                    : [...prev.likedById, item.id],
                  favoriteById: prev.favoriteById,
                  likedAuthors: liked
                    ? prev.likedAuthors.filter(a => a !== item.author.toLowerCase())
                    : [...prev.likedAuthors, item.author.toLowerCase()],
                  likedPlatforms: liked
                    ? prev.likedPlatforms.filter(p => p !== item.platform)
                    : [...prev.likedPlatforms, item.platform],
                  favoriteItems: prev.favoriteItems,
                }
                const saved = saveReelInteractions(next)
                setInteractions(saved)
                const prefs = loadPreferences()
                setItems(current => rankReels(current || [], prefs, saved))
              }}
              onToggleFavorite={item => {
                const prev = interactions
                const favorite = prev.favoriteById.includes(item.id)
                const next: ReelInteraction = {
                  ...prev,
                  favoriteById: favorite
                    ? prev.favoriteById.filter(id => id !== item.id)
                    : [...prev.favoriteById, item.id],
                  favoriteItems: favorite
                    ? prev.favoriteItems.filter(f => f.id !== item.id)
                    : [
                        ...prev.favoriteItems,
                        {
                          id: item.id,
                          title: item.title,
                          author: item.author,
                          sourceUrl: item.sourceUrl,
                        },
                      ],
                }
                const saved = saveReelInteractions(next)
                setInteractions(saved)
                const prefs = loadPreferences()
                setItems(current => rankReels(current || [], prefs, saved))
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
