'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, Loader2, LocateFixed } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Input } from '@/components/ui/input'

export type PlaceGeo = {
  commune: string | null
  city:    string | null
  region:  string | null
}

type Props = {
  lat: number | null
  lng: number | null
  address: string | null
  onLocationSet: (lat: number, lng: number, address: string, geo: PlaceGeo) => void
}

type NominatimAddress = {
  road?: string
  suburb?: string
  municipality?: string
  town?: string
  city?: string
  state?: string
  country?: string
  country_code?: string
}

type NominatimSearchResult = {
  lat: string
  lon: string
  display_name: string
  address?: NominatimAddress
}

type NominatimReverseResult = {
  display_name?: string
  address?: NominatimAddress
}

function parseGeo(addr: NominatimAddress | undefined): PlaceGeo {
  return {
    commune: addr?.municipality || addr?.suburb || addr?.town || null,
    city:    addr?.city || addr?.town || addr?.municipality || null,
    region:  addr?.state || null,
  }
}

export function NewPicadaMapStep({ lat, lng, address, onLocationSet }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const pinRef     = useRef<any>(null)
  // Keep latest callback in ref so map click handler always uses current version
  const onLocationSetRef = useRef(onLocationSet)
  useEffect(() => { onLocationSetRef.current = onLocationSet })

  const [query, setQuery]             = useState('')
  const [searching, setSearching]     = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating]       = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const autoLocatedRef                = useRef(false)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const placePinAt = async (L: any, map: any, makePinIcon: () => any, pLat: number, pLng: number) => {
    if (pinRef.current) {
      pinRef.current.setLatLng([pLat, pLng])
    } else {
      pinRef.current = L.marker([pLat, pLng], { icon: makePinIcon() }).addTo(map)
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${pLat}&lon=${pLng}&format=json`,
        { headers: { 'Accept-Language': 'es', 'User-Agent': 'PicadaApp/1.0' } },
      )
      const data = await res.json() as NominatimReverseResult
      onLocationSetRef.current(
        pLat, pLng,
        data.display_name || `${pLat.toFixed(5)}, ${pLng.toFixed(5)}`,
        parseGeo(data.address),
      )
    } catch {
      onLocationSetRef.current(pLat, pLng, `${pLat.toFixed(5)}, ${pLng.toFixed(5)}`, { commune: null, city: null, region: null })
    }
  }

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(L => {
      if (leafletRef.current) return

      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link')
        link.rel  = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const initLat = lat ?? -33.45
      const initLng = lng ?? -70.66

      const map = L.map(mapRef.current!, {
        zoomControl: false,
        attributionControl: false,
      }).setView([initLat, initLng], 15)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

      const makePinIcon = () => L.divIcon({
        className: '',
        html: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="
            width:28px;height:28px;border-radius:50% 50% 50% 0;
            background:#f97316;border:3px solid white;
            transform:rotate(-45deg);
            box-shadow:0 4px 14px rgba(0,0,0,0.35);
          "></div>
        </div>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      })

      if (lat != null && lng != null) {
        pinRef.current = L.marker([lat, lng], { icon: makePinIcon() }).addTo(map)
      }

      map.on('click', (e: any) => {
        const { lat: pLat, lng: pLng } = e.latlng
        placePinAt(L, map, makePinIcon, pLat, pLng)
      })

      leafletRef.current = { L, map, makePinIcon }

      if (lat == null && !autoLocatedRef.current) {
        autoLocatedRef.current = true
        void useDeviceLocation()
      }
    })

    return () => {
      leafletRef.current?.map.remove()
      leafletRef.current = null
      pinRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Device location ───────────────────────────────────────────────────────
  const useDeviceLocation = async () => {
    if (!leafletRef.current) return
    setLocating(true)
    setLocateError(null)
    try {
      let pLat: number
      let pLng: number
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.requestPermissions()
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          setLocateError('Permiso de ubicación denegado.')
          return
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
        pLat = pos.coords.latitude
        pLng = pos.coords.longitude
      } else {
        if (!navigator.geolocation) {
          setLocateError('Geolocalización no disponible en este navegador.')
          return
        }
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 10000, maximumAge: 30000,
          }),
        )
        pLat = pos.coords.latitude
        pLng = pos.coords.longitude
      }
      const { L, map, makePinIcon } = leafletRef.current
      map.setView([pLat, pLng], 17)
      await placePinAt(L, map, makePinIcon, pLat, pLng)
    } catch (err: any) {
      setLocateError(err?.message ? `No se pudo obtener tu ubicación: ${err.message}` : 'No se pudo obtener tu ubicación.')
    } finally {
      setLocating(false)
    }
  }

  // ── Address search ────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const q = query.trim()
    if (!q || !leafletRef.current) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=cl&addressdetails=1`,
        { headers: { 'Accept-Language': 'es', 'User-Agent': 'PicadaApp/1.0' } },
      )
      const results = await res.json() as NominatimSearchResult[]
      if (!results.length) {
        setSearchError('No se encontró esa dirección. Intentá con más detalle o tocá el mapa.')
        return
      }
      const { lat: rLat, lon: rLon, display_name, address: addr } = results[0]
      const pLat = parseFloat(rLat)
      const pLng = parseFloat(rLon)
      const { L, map, makePinIcon } = leafletRef.current
      map.setView([pLat, pLng], 17)
      if (pinRef.current) {
        pinRef.current.setLatLng([pLat, pLng])
      } else {
        pinRef.current = L.marker([pLat, pLng], { icon: makePinIcon() }).addTo(map)
      }
      onLocationSetRef.current(pLat, pLng, display_name, parseGeo(addr))
    } catch {
      setSearchError('Error al buscar. Verificá tu conexión.')
    } finally {
      setSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch() }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-base font-semibold">¿Dónde queda la picada?</h3>
        <p className="text-xs text-muted-foreground">Escribí la dirección o tocá el mapa para marcar</p>
      </div>

      {/* Buscador de dirección */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchError(null) }}
            onKeyDown={handleKeyDown}
            placeholder="Ej: Av. Providencia 1234, Santiago"
            className="pl-9 pr-3"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="shrink-0 h-10 px-4 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
        </button>
      </div>

      {searchError && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{searchError}</p>
      )}

      <button
        type="button"
        onClick={useDeviceLocation}
        disabled={locating}
        className="w-full h-10 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 text-orange-700 dark:text-orange-200 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
        {locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
      </button>

      {locateError && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{locateError}</p>
      )}

      <div ref={mapRef} className="w-full rounded-2xl overflow-hidden border border-border" style={{ height: 240 }} />

      {address ? (
        <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-3 py-2.5">
          <MapPin className="size-4 text-orange-500 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-800 dark:text-orange-200 leading-snug">{address}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 px-3 py-2.5">
          <MapPin className="size-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">Ninguna ubicación seleccionada aún</p>
        </div>
      )}
    </div>
  )
}
