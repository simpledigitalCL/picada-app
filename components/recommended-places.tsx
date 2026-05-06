'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Star, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import type { Restaurant } from '@/lib/restaurants'

type RecommendedItem = {
  place_id: string
  name: string
  address: string | null
  city: string | null
  rating: number | null
  picada_score: number | null
  maps_url: string | null
  photo_url: string | null
  score: number | null
  reason: string | null
}

export function RecommendedPlaces({
  locationQuery,
  onSelect,
}: {
  locationQuery: string
  onSelect: (r: Restaurant) => void
}) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RecommendedItem[]>([])
  const [token, setToken] = useState('')
  const seenImpressionsRef = useRef<Set<string>>(new Set())
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const trackedAtRef = useRef<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const supabase = getSupabaseBrowserClient()
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
      const accessToken = data.session?.access_token || ''
      setToken(accessToken)
      if (!accessToken) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
        }
        return
      }
      try {
        const r = await fetch(`/api/recommendations?limit=5&city=${encodeURIComponent(locationQuery || '')}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = (await r.json()) as { ok?: boolean; items?: RecommendedItem[] }
        if (!cancelled) setItems(json.items || [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [locationQuery])

  const hasData = useMemo(() => items.length > 0, [items])

  const sendTrack = async (placeId: string, eventType: 'view' | 'save' | 'review' = 'view') => {
    if (!token || !placeId) return
    const key = `${eventType}:${placeId}`
    const now = Date.now()
    const prevAt = Number(trackedAtRef.current[key] || 0)
    if (now - prevAt < 30_000) return
    trackedAtRef.current[key] = now
    try {
      await fetch('/api/affinity/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ placeId, eventType }),
      })
    } catch {
      /* ignore tracking errors */
    }
  }

  useEffect(() => {
    if (!token || items.length === 0) return
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const id = entry.target.getAttribute('data-place-id') || ''
          if (!id || !entry.isIntersecting || entry.intersectionRatio < 0.6) return
          if (seenImpressionsRef.current.has(id)) return
          seenImpressionsRef.current.add(id)
          void sendTrack(id, 'view')
        })
      },
      { threshold: [0.6] },
    )
    items.forEach(item => {
      const el = cardRefs.current[item.place_id]
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [items, token])

  if (loading) {
    return (
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-orange-500" />
          <h3 className="text-sm font-bold">Recomendados para ti</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-56 h-28 rounded-xl border bg-card animate-pulse shrink-0 snap-start" />
          ))}
        </div>
      </section>
    )
  }

  if (!hasData) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-4 text-orange-500" />
        <h3 className="text-sm font-bold">Recomendados para ti</h3>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory">
        {items.map(item => (
          <Card
            key={item.place_id}
            className="w-56 shrink-0 overflow-hidden cursor-pointer snap-start"
            ref={el => {
              cardRefs.current[item.place_id] = el
            }}
            data-place-id={item.place_id}
            onClick={() => {
              void sendTrack(item.place_id, 'view')
              onSelect({
                id: `ext-${item.place_id}`,
                placeExternalId: item.place_id,
                name: item.name,
                category: 'picada',
                description: 'Recomendación personalizada',
                address: item.address || '',
                comuna: item.city || locationQuery || 'Zona',
                lat: -33.45,
                lng: -70.66,
                rating: Number(item.rating || 0),
                reviewCount: 0,
                distance: 'cerca',
                priceRange: 2,
                tags: ['Sugerido para ti'],
                imageUrl: item.photo_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                starPlate: { name: 'Recomendado', kcal: 0, protein: 0, carbs: 0, fat: 0 },
                openNow: true,
                mapsUrl: item.maps_url || undefined,
              })
            }}
          >
            <div className="h-14 w-full bg-muted relative">
              {item.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-2 space-y-1">
              <p className="text-xs font-bold truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{item.address || item.city || 'Sin dirección'}</p>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">Sugerido para ti</Badge>
                <span className="text-[10px] inline-flex items-center gap-0.5">
                  <Star className="size-3 fill-yellow-400 text-yellow-400" />
                  {Number(item.rating || 0).toFixed(1)}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

