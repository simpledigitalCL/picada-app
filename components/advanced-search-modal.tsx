'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, LocateFixed, MapPin } from 'lucide-react'
import { locationMatchesQuery } from '@/lib/discover-geo'
import { getCurrentLocation, getRecentSearches, setGeoFilter } from '@/lib/location'
import { buildAutocompleteUrl, DEFAULT_SEARCH_RADIUS_KM, zoomForSearchRadiusKm } from '@/lib/location-search'
type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  initialLocation: string
  onApply: (payload: { locationLabel: string; lat: number; lng: number; radiusKm: number }) => void
}

type ReverseResult = { location?: string; commune?: string; region?: string; road?: string }

type AutocompleteItem = {
  id: string
  label: string
  value: string
  lat: number
  lng: number
  kind: 'region' | 'city' | 'commune' | 'other'
  suggestedRadiusKm: number
  commune?: string
  region?: string
}

const VOYAGER_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

export function AdvancedSearchModal({ open, onOpenChange, initialLocation, onApply }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<{ L: typeof import('leaflet'); map: import('leaflet').Map } | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)
  const circleRef = useRef<import('leaflet').Circle | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const latRef = useRef(-33.447)
  const lngRef = useRef(-70.673)
  const radiusRef = useRef(DEFAULT_SEARCH_RADIUS_KM)

  const [radiusKm, setRadiusKm] = useState(DEFAULT_SEARCH_RADIUS_KM)
  const [lat, setLat] = useState(-34.17)
  const [lng, setLng] = useState(-70.74)
  const [query, setQuery] = useState(initialLocation)
  const [items, setItems] = useState<AutocompleteItem[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  latRef.current = lat
  lngRef.current = lng
  radiusRef.current = radiusKm

  useEffect(() => {
    if (!open) return
    setItems([])
    setRecentSearches(getRecentSearches())
    const passed = initialLocation.trim()
    const { mode, geo, label } = getCurrentLocation()
    if (passed.length >= 2) {
      setQuery(passed)
    } else {
      const saved = (window.localStorage.getItem('picada.location.v1') || label).trim()
      setQuery(mode === 'auto' ? label : saved || label)
    }
    if (geo?.lat != null && geo?.lng != null) {
      const useSavedCoords = passed.length < 2 || locationMatchesQuery(geo.label, passed)
      if (useSavedCoords) {
        setLat(geo.lat)
        setLng(geo.lng)
        if (geo.radiusKm != null && geo.radiusKm >= 1) {
          setRadiusKm(Math.min(200, Math.round(geo.radiusKm)))
        }
      }
    }
  }, [open, initialLocation])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setItems([])
      return
    }
    const t = window.setTimeout(() => {
      setLoading(true)
      fetch(buildAutocompleteUrl(q))
        .then(r => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: AutocompleteItem[] }) => setItems(d.items || []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(t)
  }, [query, open])

  useEffect(() => {
    if (!open || query.trim().length < 2 || items.length === 0) return
    const first = items[0]
    setLat(first.lat)
    setLng(first.lng)
  }, [open, query, items])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timers: number[] = []

    const tryInit = () => {
      if (cancelled || !mapRef.current || leafletRef.current) return

      void import('leaflet').then(L => {
        if (cancelled || !mapRef.current || leafletRef.current) return

        const existing = document.querySelector('link[data-picada-leaflet]')
        if (!existing) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          link.setAttribute('data-picada-leaflet', 'true')
          document.head.appendChild(link)
        }

        const el = mapRef.current
        el.innerHTML = ''

        const la = latRef.current
        const ln = lngRef.current
        const rk = radiusRef.current

        const map = L.map(el, { zoomControl: true, attributionControl: false }).setView(
          [la, ln],
          zoomForSearchRadiusKm(rk),
        )

        L.tileLayer(VOYAGER_TILES, { maxZoom: 19, subdomains: 'abcd' }).addTo(map)

        const circle = L.circle([la, ln], {
          radius: rk * 1000,
          color: '#f97316',
          fillColor: '#f97316',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '6 4',
        }).addTo(map)
        circleRef.current = circle

        const marker = L.marker([la, ln], { draggable: true }).addTo(map)
        marker.on('dragend', () => {
          const p = marker.getLatLng()
          setLat(p.lat)
          setLng(p.lng)
          circleRef.current?.setLatLng([p.lat, p.lng])
          fetch(`/api/locations/reverse?lat=${p.lat}&lng=${p.lng}`)
            .then(r => (r.ok ? r.json() : {}))
            .then((d: ReverseResult) => {
              if (d.location) setQuery(d.location)
            })
            .catch(() => {})
        })

        markerRef.current = marker
        leafletRef.current = { L, map }

        const ro = new ResizeObserver(() => {
          map.invalidateSize()
        })
        ro.observe(el)
        resizeObserverRef.current = ro

        requestAnimationFrame(() => map.invalidateSize())
        timers.push(window.setTimeout(() => map.invalidateSize(), 120))
        timers.push(window.setTimeout(() => map.invalidateSize(), 400))

        setMapReady(true)

        const la2 = latRef.current
        const ln2 = lngRef.current
        const rk2 = radiusRef.current
        if (la2 !== la || ln2 !== ln || rk2 !== rk) {
          marker.setLatLng([la2, ln2])
          circle.setLatLng([la2, ln2])
          circle.setRadius(rk2 * 1000)
          map.setView([la2, ln2], zoomForSearchRadiusKm(rk2))
        }
      })
    }

    tryInit()
    timers.push(window.setTimeout(tryInit, 50))
    timers.push(window.setTimeout(tryInit, 150))
    timers.push(window.setTimeout(tryInit, 320))

    return () => {
      cancelled = true
      timers.forEach(id => window.clearTimeout(id))
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) return
    setMapReady(false)
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    if (leafletRef.current) {
      leafletRef.current.map.remove()
      leafletRef.current = null
    }
    markerRef.current = null
    circleRef.current = null
    if (mapRef.current) mapRef.current.innerHTML = ''
  }, [open])

  useEffect(() => {
    if (!open || !mapReady || !leafletRef.current || !markerRef.current) return
    const lf = leafletRef.current
    const marker = markerRef.current
    const circle = circleRef.current
    marker.setLatLng([lat, lng])
    circle?.setLatLng([lat, lng])
    circle?.setRadius(radiusKm * 1000)
    lf.map.flyTo([lat, lng], zoomForSearchRadiusKm(radiusKm), { duration: 0.4 })
    requestAnimationFrame(() => lf.map.invalidateSize())
  }, [lat, lng, open, mapReady])

  useEffect(() => {
    if (!circleRef.current) return
    circleRef.current.setRadius(radiusKm * 1000)
    if (open && mapReady && leafletRef.current) {
      leafletRef.current.map.setZoom(zoomForSearchRadiusKm(radiusKm))
    }
  }, [radiusKm, open, mapReady])

  const applyReverseForPoint = (pLat: number, pLng: number) => {
    fetch(`/api/locations/reverse?lat=${pLat}&lng=${pLng}`)
      .then(r => (r.ok ? r.json() : {}))
      .then((d: ReverseResult) => {
        if (d.location && !query.trim()) setQuery(d.location)
      })
      .catch(() => {})
  }

  const handleGeolocate = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const nLat = pos.coords.latitude
        const nLng = pos.coords.longitude
        setLat(nLat)
        setLng(nLng)
        try {
          const r = await fetch(`/api/locations/reverse?lat=${nLat}&lng=${nLng}`)
          const d = (await r.json()) as ReverseResult
          if (d.location) setQuery(d.location)
        } catch {
          /* ignore */
        }
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
    )
  }

  const locationLine = query.trim() || `${lat.toFixed(3)}, ${lng.toFixed(3)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-2xl sm:max-w-lg">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Búsqueda de precisión</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-3">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Busca zona, ciudad o pueblo (Chile)"
                className="rounded-xl"
              />
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl shrink-0"
                onClick={handleGeolocate}
                disabled={geoLoading}
                aria-label="Usar mi geolocalización"
              >
                {geoLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LocateFixed className="size-4" />
                )}
              </Button>
            </div>

            {/* Búsquedas recientes: solo cuando el campo está vacío/corto y no hay resultados */}
            {!loading && items.length === 0 && query.trim().length < 2 && recentSearches.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-xl border bg-background shadow-sm z-10 relative">
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Búsquedas recientes
                </p>
                {recentSearches.map(search => (
                  <button
                    key={search}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border/60 last:border-0 flex items-center gap-2"
                    onClick={() => {
                      setQuery(search)
                      setRecentSearches([])
                    }}
                  >
                    <MapPin className="size-3 shrink-0 text-orange-400" />
                    <span className="truncate">{search}</span>
                  </button>
                ))}
              </div>
            )}

            {(loading || items.length > 0) && (
              <div className="max-h-36 overflow-y-auto rounded-xl border bg-background shadow-sm z-10 relative">
                {loading ? (
                  <div className="p-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Buscando...
                  </div>
                ) : (
                  items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border/60 last:border-0"
                      onClick={() => {
                        setQuery(item.value)
                        setLat(item.lat)
                        setLng(item.lng)
                        setRadiusKm(DEFAULT_SEARCH_RADIUS_KM)
                        setItems([])
                        if (!item.commune && !item.region) {
                          applyReverseForPoint(item.lat, item.lng)
                        }
                      }}
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div
              ref={mapRef}
              className="h-52 w-full rounded-2xl overflow-hidden border shadow-sm relative z-0 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:z-0"
              style={{ background: '#e8e0d8' }}
            />
            <p className="text-[10px] text-muted-foreground px-0.5">
              El círculo naranja muestra el radio de búsqueda (~{radiusKm} km desde el pin).
            </p>
          </div>

          <div className="flex items-start gap-1.5 text-xs text-muted-foreground px-0.5">
            <MapPin className="size-3 shrink-0 text-orange-500 mt-0.5" />
            <span>
              <span className="font-medium text-foreground">Buscando en:</span> {locationLine}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Radio de búsqueda</p>
              <span className="text-xs font-semibold text-orange-500">{radiusKm} km</span>
            </div>
            <input
              type="range"
              min={1}
              max={200}
              value={Math.min(200, radiusKm)}
              onChange={e => setRadiusKm(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 km</span>
              <span>Por defecto {DEFAULT_SEARCH_RADIUS_KM} km</span>
              <span>200 km</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Por defecto {DEFAULT_SEARCH_RADIUS_KM} km; mueve el deslizador para acotar o ampliar la búsqueda.
            </p>
          </div>

          <Button
            className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
            onClick={async () => {
              let label = query || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
              try {
                const r = await fetch(`/api/locations/reverse?lat=${lat}&lng=${lng}`)
                const d = (await r.json()) as ReverseResult
                if (d.location) label = d.location
              } catch {
                /* ignore */
              }
              const mode = getCurrentLocation().mode
              setGeoFilter({ lat, lng, radiusKm, label }, mode)
              onApply({ locationLabel: label, lat, lng, radiusKm })
              onOpenChange(false)
            }}
          >
            Aplicar búsqueda radial
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
