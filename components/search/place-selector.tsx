'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type PlaceSuggestion = {
  id: string
  name: string
  address: string
  rating: number
  photoUrl?: string | null
  /** Lugar con poca cobertura en Google → ×2 XP al aportar */
  coverageSparse?: boolean
  /** Slug del tipo de local (local_bar, local_cafe_cafeteria, …) para sugerencias de tags */
  localSlug?: string | null
  /** Categoría legible del local (bar, cafe, restaurant, etc). */
  category?: string | null
  /** Tipo de negocio normalizado para payload/telemetría */
  businessType?: string | null
}

/** Mapea la categoría que devuelve /api/restaurants/discover al slug local_* */
function derivedLocalSlugFromCategory(category?: string | null, cuisines?: string[]): string | null {
  const parts = [category || '', ...(cuisines || [])].map(s => s.toLowerCase()).join(' ')
  if (!parts.trim()) return null
  if (/cafe|cafeteria|coffee|café|espresso/.test(parts)) return 'local_cafe_cafeteria'
  if (/\bbar\b|pub|cantina/.test(parts)) return 'local_bar'
  if (/pizza|pizzer/.test(parts)) return 'local_pizzeria'
  if (/fast.?food|burger|comida.?rapida|comida_rapida/.test(parts)) return 'local_comida_rapida'
  if (/mariscos|seafood|marisquer|ceviche|cevicher/.test(parts)) return 'local_marisqueria'
  if (/peruana|peruvian/.test(parts)) return 'local_comida_peruana_cevicheria'
  if (/asado|parrilla|barbecue|bbq|grill/.test(parts)) return 'local_parrilla_asados'
  if (/asian|asiatica|chino|japones|ramen|sushi|wok/.test(parts)) return 'local_comida_asiatica'
  if (/mexican|mexicana|taco|tacos/.test(parts)) return 'local_mexicana_tacos'
  if (/pasteler|brunch|bakery|patisserie/.test(parts)) return 'local_pasteleria_brunch'
  if (/sandwich|sanguch/.test(parts)) return 'local_sangucheria'
  if (/buffet|corrido/.test(parts)) return 'local_buffet_servicio_corrido'
  if (/food.?truck|carrito/.test(parts)) return 'local_food_truck_carrito'
  return null
}

type Props = {
  locationQuery: string
  value: string
  onValueChange: (v: string) => void
  selectedPlace: PlaceSuggestion | null
  onSelectPlace: (p: PlaceSuggestion | null) => void
}

export function PlaceSelector({
  locationQuery,
  value,
  onValueChange,
  selectedPlace,
  onSelectPlace,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [searchOutside, setSearchOutside] = useState(false)
  const [items, setItems] = useState<PlaceSuggestion[]>([])

  useEffect(() => {
    const q = value.trim().toLowerCase()
    if (q.length < 2) {
      setItems([])
      return
    }
    const t = window.setTimeout(async () => {
      setLoading(true)
      try {
        const location = searchOutside ? 'Chile' : locationQuery
        const res = await fetch(`/api/restaurants/discover?location=${encodeURIComponent(location)}`)
        const data = (await res.json()) as {
          items?: Array<{
            id: string
            name: string
            address: string
            rating: number
            photoUrl?: string | null
            coverageSparse?: boolean
            category?: string | null
            cuisines?: string[]
          }>
        }
        const next = (data.items || [])
          .filter(p => `${p.name} ${p.address}`.toLowerCase().includes(q))
          .slice(0, 8)
          .map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
            rating: p.rating,
            photoUrl: p.photoUrl || null,
            coverageSparse: Boolean(p.coverageSparse),
            localSlug: derivedLocalSlugFromCategory(p.category, p.cuisines),
          }))
        setItems(next)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => window.clearTimeout(t)
  }, [value, locationQuery, searchOutside])

  return (
    <div className="space-y-1.5">
      <Input
        value={value}
        onChange={e => {
          onValueChange(e.target.value)
          onSelectPlace(null)
        }}
        placeholder="Busca el local..."
        className="rounded-xl text-sm h-11"
      />
      {loading ? <p className="text-[11px] text-muted-foreground">Buscando locales...</p> : null}
      {!loading && items.length > 0 ? (
        <div className="rounded-xl border overflow-hidden">
          {items.map(s => (
            <button
              key={`${s.id}-${s.name}`}
              type="button"
              className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-accent transition-colors"
              onClick={() => {
                onValueChange(s.name)
                onSelectPlace(s)
                setItems([])
              }}
            >
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.address}</p>
            </button>
          ))}
        </div>
      ) : null}
      {!loading && items.length === 0 && value.trim().length >= 2 ? (
        <div className="rounded-xl border border-dashed p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            No encontramos locales con ese nombre en {searchOutside ? 'búsqueda ampliada' : locationQuery}.
          </p>
          {!searchOutside ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setSearchOutside(true)}
            >
              Buscar fuera de mi localidad
            </Button>
          ) : null}
        </div>
      ) : null}
      {selectedPlace ? (
        <div className="rounded-xl border p-2.5 flex gap-2.5 items-center">
          {selectedPlace.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedPlace.photoUrl} alt={selectedPlace.name} className="w-14 h-14 rounded-lg object-cover bg-muted" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-muted" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{selectedPlace.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{selectedPlace.address}</p>
            <p className="text-[11px] text-amber-600">Rating {selectedPlace.rating?.toFixed(1) || 'N/A'} ★</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

