'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, MapPin, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import type { PlaceSuggestion } from '@/components/search/place-selector'

type DiscoverItem = {
  id: string
  name: string
  address: string
  rating: number
  photoUrl?: string | null
  coverageSparse?: boolean
  category?: string | null
  businessType?: string | null
  cuisines?: string[]
}

function normalizeBusinessType(category?: string | null): string | null {
  const value = String(category || '').trim().toLowerCase()
  if (!value) return null
  if (value.includes('cafe')) return 'cafe'
  if (value.includes('bar') || value.includes('pub') || value.includes('cantina')) return 'bar'
  if (value.includes('restaurant') || value.includes('restaurante')) return 'restaurant'
  if (value.includes('bakery') || value.includes('pasteler')) return 'bakery'
  return value
}

type Props = {
  locationQuery: string
  restaurantQuery: string
  selectedPlace: PlaceSuggestion | null
  placeStepError: boolean
  onRestaurantQueryChange: (value: string) => void
  onSelectPlace: (place: PlaceSuggestion) => void
}

export function LocationSelector({
  locationQuery,
  restaurantQuery,
  selectedPlace,
  placeStepError,
  onRestaurantQueryChange,
  onSelectPlace,
}: Props) {
  const [items, setItems] = useState<PlaceSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [fallbackMode, setFallbackMode] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const q = restaurantQuery.trim()
    if (q.length < 2) {
      setItems([])
      return
    }

    const timer = window.setTimeout(async () => {
      // Cancelar petición anterior
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setLoading(true)
      try {
        // 1) Cache/DB local primero — evita cuota de Google
        const localRes = await fetch(
          `/api/restaurants/discover?location=${encodeURIComponent(locationQuery)}`,
          { cache: 'no-store', signal: ctrl.signal },
        )
        const localJson = (await localRes.json().catch(() => ({}))) as { items?: DiscoverItem[] }
        const localMatches: PlaceSuggestion[] = (localJson.items || [])
          .filter(p => `${p.name} ${p.address}`.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 8)
          .map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
            rating: Number(p.rating || 0),
            photoUrl: p.photoUrl || null,
            coverageSparse: Boolean(p.coverageSparse),
            localSlug: null,
            category: p.category || null,
            businessType: normalizeBusinessType(p.businessType || p.category),
          }))

        if (localMatches.length > 0) {
          setFallbackMode(false)
          setItems(localMatches)
          return
        }

        // 2) Fallback OSM cuando discover no resuelve
        const osmRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(`${q}, ${locationQuery || 'Chile'}`)}`,
          { cache: 'no-store', signal: ctrl.signal },
        )
        const osmJson = (await osmRes.json().catch(() => [])) as Array<{
          place_id?: string | number
          name?: string
          display_name?: string
          type?: string
          category?: string
        }>
        const osmMatches: PlaceSuggestion[] = osmJson.map((row, idx) => ({
          id: `osm-${row.place_id || idx}`,
          name: (row.name || row.display_name || q).split(',')[0]?.trim() || q,
          address: row.display_name || `${q}, ${locationQuery || 'Chile'}`,
          rating: 0,
          photoUrl: null,
          coverageSparse: true,
          localSlug: null,
          category: row.type || row.category || null,
          businessType: normalizeBusinessType(row.type || row.category),
        }))
        setFallbackMode(true)
        setItems(osmMatches)
      } catch (err) {
        // AbortError es esperado al cancelar — no tratar como error de UX
        if ((err as { name?: string })?.name !== 'AbortError') {
          setFallbackMode(true)
          setItems([])
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 240)

    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [restaurantQuery, locationQuery])

  const handleSelect = async (s: PlaceSuggestion) => {
    onRestaurantQueryChange(s.name)
    let next = s
    const supabase = getSupabaseBrowserClient()
    if (supabase) {
      if (!s.category) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.id)
        const placeQuery = supabase.from('places').select('category, business_type')
        const { data } = await (isUuid ? placeQuery.eq('id', s.id) : placeQuery.eq('external_id', s.id))
          .maybeSingle()
        if (data) {
          next = {
            ...s,
            category: String((data as { category?: string | null }).category || '').trim() || null,
            businessType:
              String((data as { business_type?: string | null }).business_type || '').trim() ||
              normalizeBusinessType((data as { category?: string | null }).category || null),
          }
        }
      }
      const canonicalType = String(next.businessType || next.category || '').trim()
      if (canonicalType) {
        const { data: localTag } = await supabase
          .from('tag_catalog')
          .select('slug')
          .eq('category', 'local')
          .eq('status', 'verified')
          .ilike('display_name', `%${canonicalType}%`)
          .limit(1)
          .maybeSingle()
        next = {
          ...next,
          localSlug: String((localTag as { slug?: string } | null)?.slug || '').trim() || null,
        }
      }
    }
    onSelectPlace(next)
    setItems([])
  }

  const handleManual = () => {
    onSelectPlace({
      id: `manual-${Date.now()}`,
      name: restaurantQuery.trim(),
      address: locationQuery || 'Chile',
      rating: 0,
      coverageSparse: true,
      localSlug: null,
      category: 'manual',
      businessType: 'manual',
    })
    setItems([])
  }

  return (
    <div className={cn('space-y-2', placeStepError && 'rounded-xl ring-2 ring-destructive/40 p-2')}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={restaurantQuery}
          onChange={e => onRestaurantQueryChange(e.target.value)}
          placeholder="Restaurante, café, picada..."
          className="pl-9 rounded-xl text-sm h-11"
        />
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-[11px] text-muted-foreground px-1 animate-pulse">Buscando lugares…</p>
      )}

      {/* Resultados */}
      {!loading && items.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          {items.map(s => (
            <button
              key={`${s.id}-${s.name}`}
              type="button"
              className="w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-accent transition-colors flex items-start gap-2.5"
              onClick={() => handleSelect(s)}
            >
              <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{s.name}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.address}</p>
                {s.rating > 0 && (
                  <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-0.5">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    {s.rating.toFixed(1)}
                    {s.coverageSparse && (
                      <span className="ml-1 text-orange-600 font-bold">· ×2 XP</span>
                    )}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No resultados — opción manual */}
      {!loading && restaurantQuery.trim().length >= 2 && items.length === 0 && !selectedPlace && (
        <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            No encontramos "{restaurantQuery.trim()}" cerca de {locationQuery || 'tu zona'}.
          </p>
          <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={handleManual}>
            Agregar "{restaurantQuery.trim()}" manualmente
          </Button>
        </div>
      )}

      {/* Fallback indicator */}
      {fallbackMode && items.length > 0 && (
        <p className="text-[10px] text-amber-700 px-1 flex items-center gap-1">
          <Zap className="size-3" />
          Resultados vía OpenStreetMap — cobertura puede variar.
        </p>
      )}

      {/* Error de validación */}
      {placeStepError && (
        <p className="text-xs text-destructive font-medium px-1">
          Debes seleccionar un local para continuar.
        </p>
      )}

      {/* Confirmación de selección */}
      {selectedPlace && (
        <div className="rounded-xl border border-border bg-accent/40 px-3 py-2 flex items-center gap-2">
          <MapPin className="size-4 text-orange-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{selectedPlace.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{selectedPlace.address}</p>
          </div>
        </div>
      )}
    </div>
  )
}
