'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Star, X, Bookmark, ExternalLink, Search, Navigation } from 'lucide-react'
import Image from 'next/image'
import { type Restaurant } from '@/lib/places/restaurants'
import {
  rankExplorePlacesByQuery,
  suggestExploreCompletions,
} from '@/lib/feed/text-search'
import { slugDisplayFromAutomatedSlug } from '@/lib/tags/display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { LocationAutocomplete } from '@/components/search/location-autocomplete'
import { cn } from '@/lib/utils'
import { loadPreferences } from '@/lib/feed/personalization'
import { computePlaceMatchScore } from '@/lib/places/match'
import { MatchScore } from '@/components/restaurant/match-score'
import { getDiscoverGeoQueryExtra } from '@/lib/location/discover-geo'
import { resolveDiscoverLocation, subscribeToLocationChanges } from '@/lib/location/core'
import { CollectionPickerSheet } from '@/components/restaurant/collection-picker-sheet'
import { isPlaceSaved } from '@/lib/social/collections'
import { openUnifiedPostForm } from '@/lib/content/post-form-draft'

function zoomToRadiusKm(zoom: number): number {
  return Math.max(1, Math.min(100, Math.round(200 / Math.pow(2, zoom - 11))))
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const dLat = (bLat - aLat) * Math.PI / 180
  const dLng = (bLng - aLng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface MapViewProps {
  onSelect: (r: Restaurant) => void
  active: boolean
  locationQuery: string
  onLocationChange: (value: string) => void
}

type ExternalPlace = {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  rating: number
  reviews: number
  priceLevel: number | null
  mapsUrl: string
  phone?: string | null
  website?: string | null
  openNow?: boolean | null
  photoUrl?: string | null
  reviewsText?: string[]
  picadaRating?: number | null
  picadaReviews?: number
  provider?: 'google_places' | 'openstreetmap'
  inferredTags?: string[]
  matchScore?: number
  matchReason?: string
  hasOffer?: boolean
  offerLabel?: string | null
  coverageSparse?: boolean
  automatedSeedTags?: Array<{ slug: string; confidence_score: number; is_automated?: boolean }>
}

export function MapView({ onSelect, active, locationQuery, onLocationChange }: MapViewProps) {
  const mapRef            = useRef<HTMLDivElement>(null)
  const leafletRef        = useRef<any>(null)
  const markersRef        = useRef<any[]>([])
  const userMarkerRef     = useRef<any>(null)
  const userPosRef        = useRef<{ lat: number; lng: number } | null>(null)
  const hasCenteredRef    = useRef(false)
  const hasPlacesRef      = useRef(false)
  const requestSeq        = useRef(0)
  const [selectedExternal, setSelectedExternal] = useState<ExternalPlace | null>(null)
  const [mapReady,  setMapReady]  = useState(false)
  const [externalPlaces, setExternalPlaces] = useState<ExternalPlace[]>([])
  const [externalSource, setExternalSource] = useState('')
  const [discoverNotice, setDiscoverNotice] = useState('')
  const [lastProximityPlace, setLastProximityPlace] = useState('')
  const [discoverNonce, setDiscoverNonce] = useState(0)
  const [reviewCounts, setReviewCounts] = useState<Record<string, { count: number; lastSeen: string }>>({})
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerBlock, setPickerBlock] = useState(false)

  useEffect(() => {
    if (pickerOpen) {
      setPickerBlock(true)
    } else {
      const t = window.setTimeout(() => setPickerBlock(false), 350)
      return () => window.clearTimeout(t)
    }
  }, [pickerOpen])
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const [query, setQuery] = useState('')
  const [searchPlaceholder, setSearchPlaceholder] = useState('')

  useEffect(() => {
    const h = () => setDiscoverNonce(n => n + 1)
    const unSub = subscribeToLocationChanges(h)
    return () => unSub()
  }, [])

  // Al cambiar la ubicación de texto, limpiar acumulado para no mezclar zonas distintas
  useEffect(() => {
    setExternalPlaces([])
    setMapCenter(null)
  }, [locationQuery])

  useEffect(() => {
    const load = () => {
      try {
        const raw = window.localStorage.getItem('picada.local.reviews.v1')
        setReviewCounts(raw ? JSON.parse(raw) as Record<string, { count: number; lastSeen: string }> : {})
      } catch {
        setReviewCounts({})
      }
      const ids = new Set<string>()
      for (const p of externalPlaces) {
        if (isPlaceSaved(p.id).length > 0) ids.add(p.id)
      }
      setSavedIds(ids)
    }
    load()
    const onUpdated = () => load()
    window.addEventListener('picada:collection-updated', onUpdated)
    return () => window.removeEventListener('picada:collection-updated', onUpdated)
  }, [externalPlaces])

  useEffect(() => {
    const setPos = (lat: number, lng: number) => {
      const p = { lat, lng }
      userPosRef.current = p
      setUserPos(p)
    }

    if (Capacitor.isNativePlatform()) {
      Geolocation.requestPermissions().then((perm) => {
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
          .then(pos => setPos(pos.coords.latitude, pos.coords.longitude))
          .catch(() => {})
      }).catch(() => {})
    } else {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => setPos(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      )
    }
  }, [])

  // Marker de posición del usuario (punto azul) + centrado inicial
  useEffect(() => {
    if (!mapReady || !userPos || !leafletRef.current) return
    const { L, map } = leafletRef.current

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userPos.lat, userPos.lng])
    } else {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:16px;height:16px;border-radius:50%;
          background:#3b82f6;border:3px solid white;
          box-shadow:0 0 0 6px rgba(59,130,246,0.25),0 2px 8px rgba(0,0,0,0.35);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon, zIndexOffset: 1000 }).addTo(map)
    }

    // Primera vez que obtenemos posición real: centrar en el usuario a zoom 15
    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true
      map.setView([userPos.lat, userPos.lng], 15, { animate: true })
    }
  }, [mapReady, userPos])

  const placesForMap = useMemo(() => {
    const base = query.trim() ? rankExplorePlacesByQuery(externalPlaces, query) : [...externalPlaces]
    return base.sort((a, b) => {
      // 1. Cercanía al usuario
      if (userPos && a.lat != null && b.lat != null && a.lng != null && b.lng != null) {
        const dA = haversineM(userPos.lat, userPos.lng, a.lat, a.lng)
        const dB = haversineM(userPos.lat, userPos.lng, b.lat, b.lng)
        if (Math.abs(dA - dB) > 300) return dA - dB
      }
      // 2. Afinidad con preferencias
      if ((b.matchScore || 0) !== (a.matchScore || 0)) return (b.matchScore || 0) - (a.matchScore || 0)
      // 3. Votos Picada
      if ((b.picadaReviews || 0) !== (a.picadaReviews || 0)) return (b.picadaReviews || 0) - (a.picadaReviews || 0)
      // 4. Reseñas Google
      return (b.reviews || 0) - (a.reviews || 0)
    })
  }, [externalPlaces, query, userPos])

  const queryCompletions = useMemo(
    () => suggestExploreCompletions(externalPlaces, query, 6),
    [externalPlaces, query],
  )

  const fallbackNameCompletions = useMemo(() => {
    const q = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
    if (q.length < 2) return [] as string[]
    const counts = new Map<string, number>()
    for (const p of externalPlaces) {
      const words = String(p.name || '')
        .split(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g)
        .map(w => w.trim())
        .filter(w => w.length >= 2)
      for (const w of words) {
        const normalized = w
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
        if (!normalized.startsWith(q)) continue
        counts.set(w, (counts.get(w) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return a[0].length - b[0].length
      })
      .slice(0, 6)
      .map(([label]) => label)
  }, [externalPlaces, query])

  const displayedCompletions = queryCompletions.length > 0 ? queryCompletions : fallbackNameCompletions

  useEffect(() => {
    const samples = [
      'Hamburguesa familiar',
      'Sushi + terraza',
      'Picada con piscina',
      'Café pet friendly',
    ]
    let idx = 0
    let char = 0
    let deleting = false
    let timer: number | null = null
    const tick = () => {
      const current = samples[idx] || ''
      if (!deleting) {
        char += 1
        setSearchPlaceholder(current.slice(0, char))
        if (char >= current.length) {
          deleting = true
          timer = window.setTimeout(tick, 900)
          return
        }
      } else {
        char -= 1
        setSearchPlaceholder(current.slice(0, Math.max(0, char)))
        if (char <= 0) {
          deleting = false
          idx = (idx + 1) % samples.length
        }
      }
      timer = window.setTimeout(tick, deleting ? 45 : 70)
    }
    tick()
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  const mapPreviewChips = useMemo(() => {
    if (!selectedExternal) return [] as string[]
    const labels: string[] = []
    const seen = new Set<string>()
    for (const s of selectedExternal.automatedSeedTags || []) {
      const l = slugDisplayFromAutomatedSlug(s.slug)
      const k = l.toLowerCase()
      if (!seen.has(k)) {
        seen.add(k)
        labels.push(l)
      }
      if (labels.length >= 6) return labels
    }
    for (const t of selectedExternal.inferredTags || []) {
      if (labels.length >= 6) break
      const k = String(t).toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      labels.push(String(t))
    }
    return labels
  }, [selectedExternal])

  // Inicializar mapa la primera vez que se monta
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(L => {
      if (leafletRef.current) return // ya inicializado

      const link = document.createElement('link')
      link.rel  = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)

      const map = L.map(mapRef.current!, {
        zoomControl: false,
        attributionControl: false,
      }).setView([-33.43, -70.62], 13)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      leafletRef.current = { L, map }
      setMapReady(true)
      map.on('click', () => setSelectedExternal(null))
      map.on('moveend', () => {
        const c = map.getCenter()
        setMapCenter({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
      })
    })

    return () => {
      leafletRef.current?.map.remove()
      leafletRef.current = null
      userMarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const location = resolveDiscoverLocation(locationQuery)
    if (location.length < 2) return
    const controller = new AbortController()
    const t = window.setTimeout(() => {
      const prefs = loadPreferences()
      // Si el mapa tiene centro propio, usarlo; si no, el geo guardado
      const geoExtra = mapCenter
        ? `&latitude=${mapCenter.lat}&longitude=${mapCenter.lng}&radius=${zoomToRadiusKm(mapCenter.zoom)}`
        : getDiscoverGeoQueryExtra(location)
      const seq = ++requestSeq.current
      const discover = async (loc: string) => {
        const r = await fetch(`/api/restaurants/discover?location=${encodeURIComponent(loc)}&restrictions=${encodeURIComponent(prefs.restrictions.join(','))}${geoExtra}`, { signal: controller.signal })
        return (r.ok ? r.json() : { items: [] }) as Promise<{ items?: ExternalPlace[]; source?: string; diagnostics?: { notice?: string } }>
      }
      discover(location)
        .then(async (data: { items?: ExternalPlace[]; source?: string }) => {
          const current = data.items || []
          if (current.length === 0 && location.includes(',')) {
            const short = location.split(',')[0]?.trim()
            if (short && short.length >= 2) {
              const retry = await discover(short)
              return { ...retry, source: retry.source || data.source }
            }
          }
          return data
        })
        .then((data: { items?: ExternalPlace[]; source?: string }) => {
          if (seq !== requestSeq.current) return
          const incoming = data.items || []
          if (incoming.length > 0) hasPlacesRef.current = true
          // Acumular: agregar lugares nuevos sin borrar los que ya se ven
          setExternalPlaces(prev => {
            const map = new Map(prev.map(p => [p.id, p]))
            for (const p of incoming) map.set(p.id, p)
            return [...map.values()]
          })
          setExternalSource(data.source || '')
          setDiscoverNotice((data as { diagnostics?: { notice?: string } }).diagnostics?.notice || '')
        })
        .catch(() => {})
    }, 400)
    return () => {
      window.clearTimeout(t)
      controller.abort()
    }
  }, [active, locationQuery, discoverNonce, mapCenter])

  useEffect(() => {
    if (!active || externalPlaces.length === 0 || typeof navigator === 'undefined') return
    const pendingRaw = window.localStorage.getItem('picada.pending.dishes.v1')
    const pending = pendingRaw ? (JSON.parse(pendingRaw) as string[]) : []
    if (pending.length === 0) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const userLat = pos.coords.latitude
      const userLng = pos.coords.longitude
      const nearby = externalPlaces.find(p => {
        if (p.lat == null || p.lng == null) return false
        const dLat = (p.lat - userLat) * 111_000
        const dLng = (p.lng - userLng) * 111_000
        const meters = Math.sqrt(dLat * dLat + dLng * dLng)
        return meters <= 900
      })
      if (!nearby) return
      if (nearby.name === lastProximityPlace) return
      setLastProximityPlace(nearby.name)
      const dish = pending[0]
      const confirmVisit = window.confirm(`Estas en ${nearby.name}. Tenias guardado "${dish}". ¿Lo vas a probar hoy?`)
      if (confirmVisit) {
        const prev = Number(window.localStorage.getItem('picada.influence.points.v1') || '0')
        window.localStorage.setItem('picada.influence.points.v1', String(prev + 20))
        window.dispatchEvent(new CustomEvent('picada:influence-updated'))
        window.alert('Modo Cazador activado: saca la foto del plato para ganar puntos x2.')
      }
    })
  }, [active, externalPlaces, lastProximityPlace])

  // Llamar invalidateSize cada vez que el tab del mapa se activa
  useEffect(() => {
    if (!active || !leafletRef.current) return
    setTimeout(() => leafletRef.current?.map.invalidateSize(), 150)
  }, [active])

  // Renderizar markers al cambiar filtro o cuando el mapa está listo
  useEffect(() => {
    if (!mapReady || !leafletRef.current) return
    const { L, map } = leafletRef.current

    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []

    // No mostrar locales de prueba: solo datos externos reales discover

    placesForMap
      .filter(p => p.lat != null && p.lng != null)
      .forEach(p => {
        const prefs = loadPreferences()
        const computed = computePlaceMatchScore({
          user: { likes: prefs.likes, restrictions: prefs.restrictions, dislikes: prefs.dislikes },
          placeName: p.name,
          placeAddress: p.address,
          placeReviewsText: p.reviewsText,
          inferredTags: p.inferredTags,
        })
        const glow = (p.matchScore || computed.score) >= 90
        const offerGlow = Boolean(p.hasOffer)
        const photo = p.photoUrl
          ? `background-image:url('${p.photoUrl.replace(/'/g, "\\'")}');background-size:cover;background-position:center;`
          : 'background:#2563eb;'
        const saved = savedIds.has(p.id)
        const reviewsCount = reviewCounts[p.name]?.count || 0
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            position:relative;
            width:44px;height:44px;border-radius:50%;
            border:3px solid ${saved ? '#f97316' : 'white'};
            box-shadow:${offerGlow
              ? '0 0 0 9px rgba(230,126,34,.28),0 6px 18px rgba(0,0,0,.45)'
              : glow
                ? '0 0 0 8px rgba(46,204,113,.22),0 6px 18px rgba(0,0,0,.45)'
                : '0 4px 14px rgba(0,0,0,.35)'};
            overflow:hidden;
            ${photo}
          ">
            <div style="
              position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);
              background:#111827;color:#fff;border-radius:999px;
              padding:1px 6px;font-size:10px;font-weight:700;border:1px solid rgba(255,255,255,.35);
            ">${p.rating ? p.rating.toFixed(1) : 'N/A'}★</div>
            ${reviewsCount > 0 ? `<div style="position:absolute;top:-3px;right:-3px;width:16px;height:16px;border-radius:999px;background:#f97316;color:white;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;">${reviewsCount}</div>` : ''}
            ${p.picadaReviews && p.picadaReviews >= 5 ? `<div style="position:absolute;top:-1px;left:-2px;font-size:10px;">🔥</div>` : ''}
          </div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })
        const marker = L.marker([p.lat as number, p.lng as number], { icon }).addTo(map)
        marker.on('click', (e: any) => {
          e.originalEvent?.stopPropagation()
          setSelectedExternal(p)
        })
        markersRef.current.push(marker)
      })

    // Si ya tenemos GPS del usuario, no hacer fitBounds (el usuario está centrado a zoom 15).
    // Si no hay GPS, hacer fitBounds sobre los locales como fallback.
    if (!userPosRef.current) {
      const points: Array<[number, number]> = placesForMap
        .filter(p => p.lat != null && p.lng != null)
        .map(p => [p.lat as number, p.lng as number] as [number, number])
      if (points.length === 0) return
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
    }
  }, [mapReady, locationQuery, placesForMap, reviewCounts, savedIds])

  return (
    <div className={cn("flex flex-col h-full relative overflow-hidden", pickerBlock && "pointer-events-none")}>
      {/* Chips flotantes sobre el mapa */}
      <div className="absolute top-3 left-0 right-0 z-30 px-3 space-y-2 pointer-events-none">
        <LocationAutocomplete
          value={locationQuery}
          onChange={onLocationChange}
          inputClassName="bg-background/95 backdrop-blur-sm shadow-sm pointer-events-auto"
        />
        <div className="rounded-xl border border-orange-200/70 bg-background/95 backdrop-blur-sm shadow-sm p-2.5 space-y-2 pointer-events-auto">
          <div className="relative">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder || 'Busca por tags, platos o local'}
              className="h-8 pl-7 text-xs"
            />
          </div>
          {displayedCompletions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {displayedCompletions.map(s => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] rounded-md"
                  onClick={() => setQuery(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
        </div>
        {placesForMap.length > 0 && (
          <div className="text-[10px] text-muted-foreground bg-background/90 backdrop-blur-sm rounded px-2 py-1 pointer-events-none w-fit">
            Mostrando {placesForMap.length}
            {externalPlaces.length !== placesForMap.length ? ` / ${externalPlaces.length}` : ''} · {externalSource || 'externa'}
            {discoverNotice ? ` · ${discoverNotice}` : ''}
          </div>
        )}
      </div>

      {/* Contenedor del mapa — llena todo el espacio */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Card flotante del local seleccionado */}
      {selectedExternal && (
        <div className="absolute bottom-4 left-3 right-3 z-30">
          <Card
            className="shadow-2xl py-0 gap-0 cursor-pointer"
            onClick={() => {
              const prevClicks = Number(window.localStorage.getItem('picada.creator.clicks.v1') || '0')
              window.localStorage.setItem('picada.creator.clicks.v1', String(prevClicks + 1))
              window.dispatchEvent(new CustomEvent('picada:influence-updated'))
              if (!selectedExternal) return
              const pseudo: Restaurant = {
                id: `ext-${selectedExternal.id}`,
                placeExternalId: selectedExternal.id,
                name: selectedExternal.name,
                category: 'picada',
                description: selectedExternal.reviewsText?.[0] || selectedExternal.address || 'Restaurante descubierto desde mapa',
                address: selectedExternal.address || '',
                comuna: locationQuery || 'Zona',
                lat: selectedExternal.lat || -33.45,
                lng: selectedExternal.lng || -70.66,
                rating: selectedExternal.rating || 4.2,
                reviewCount: selectedExternal.reviews || 0,
                distance: 'cerca',
                priceRange: 2,
                tags:
                  (selectedExternal.automatedSeedTags && selectedExternal.automatedSeedTags.length > 0
                    ? selectedExternal.automatedSeedTags.map(x => slugDisplayFromAutomatedSlug(x.slug)).slice(0, 12)
                    : ['Google/OSM']),
                automatedSeedTags: selectedExternal.automatedSeedTags,
                imageUrl: selectedExternal.photoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                starPlate: { name: 'Especialidad de la casa', kcal: 450, protein: 24, carbs: 40, fat: 18 },
                openNow: selectedExternal.openNow ?? true,
                mapsUrl: selectedExternal.mapsUrl,
                phone: selectedExternal.phone || undefined,
                website: selectedExternal.website || undefined,
                reviewsText: selectedExternal.reviewsText || [],
                gallery: selectedExternal.photoUrl ? [selectedExternal.photoUrl] : [],
                coverageSparse: Boolean(selectedExternal.coverageSparse),
              }
              onSelect(pseudo)
              setSelectedExternal(null)
            }}
          >
            <CardContent className="flex gap-3 items-center p-3">
              {selectedExternal ? (
                <>
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted">
                    {selectedExternal.photoUrl ? (
                      <Image src={selectedExternal.photoUrl} alt={selectedExternal.name} fill className="object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{selectedExternal.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedExternal.address}</p>
                    {mapPreviewChips.length > 0 ? (
                      <div className="flex flex-wrap gap-0.5 mt-1" aria-hidden>
                        {mapPreviewChips.map(l => (
                          <Badge key={l} variant="outline" className="text-[9px] font-normal px-1 py-0 h-5 border-violet-200/90 bg-violet-500/[0.08] shrink-0 max-w-[8rem] truncate">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-muted-foreground mt-0.5">Sin etiquetas aún</p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="size-3 fill-yellow-500 stroke-none" />
                      <span className="text-xs font-bold">{selectedExternal.rating?.toFixed(1) || 'N/A'}</span>
                      <span className="text-xs text-muted-foreground">· {selectedExternal.reviews || 0} reseñas</span>
                    </div>
                    <p className={`text-[10px] mt-0.5 font-medium ${selectedExternal.openNow ? 'text-green-600' : 'text-amber-600'}`}>
                      {selectedExternal.openNow ? 'Abierto ahora' : 'Cierra pronto'}
                    </p>
                    {(selectedExternal.picadaReviews || 0) > 0 && (
                      <p className="text-[10px] text-amber-600 mt-0.5">
                        Picada ★ {selectedExternal.picadaRating?.toFixed(1) || 'N/A'} ({selectedExternal.picadaReviews})
                      </p>
                    )}
                    <MatchScore
                      score={selectedExternal.matchScore || computePlaceMatchScore({
                        user: (() => {
                          const prefs = loadPreferences()
                          return { likes: prefs.likes, restrictions: prefs.restrictions, dislikes: prefs.dislikes }
                        })(),
                        placeName: selectedExternal.name,
                        placeAddress: selectedExternal.address,
                        placeReviewsText: selectedExternal.reviewsText,
                        inferredTags: selectedExternal.inferredTags,
                      }).score}
                      reason={selectedExternal.matchReason || 'Apto por reseñas y etiquetas inferidas'}
                    />
                    {selectedExternal.phone && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Fono: {selectedExternal.phone}</p>
                    )}
                    {selectedExternal.hasOffer ? (
                      <p className="text-[10px] text-orange-500 font-semibold mt-0.5">
                        Oferta activa: {selectedExternal.offerLabel || 'Disponible ahora'}
                      </p>
                    ) : null}
                    {selectedExternal.website && (
                      <a href={selectedExternal.website} target="_blank" rel="noreferrer" className="text-[10px] underline text-muted-foreground mt-0.5 inline-block">
                        Sitio web
                      </a>
                    )}
                    {userPos && selectedExternal.lat != null && selectedExternal.lng != null ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        A {Math.max(1, Math.round((Math.sqrt(((selectedExternal.lat - userPos.lat) * 111) ** 2 + ((selectedExternal.lng - userPos.lng) * 111) ** 2) / 5) * 60))} min caminando
                      </p>
                    ) : null}
                    {!savedIds.has(selectedExternal.id) ? (
                      <p className="text-[10px] text-orange-600 font-medium mt-1">Guárdalo para visitarlo luego</p>
                    ) : null}
                  </div>
                </>
              ) : null}
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPickerOpen(true)
                  }}
                >
                  <Bookmark className="size-3.5 mr-1" /> Guardar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!selectedExternal) return
                    openUnifiedPostForm({
                      type: 'review',
                      mode: 'rating_quick',
                      place: {
                        id: selectedExternal.id,
                        name: selectedExternal.name,
                        address: selectedExternal.address,
                        rating: selectedExternal.rating,
                        photoUrl: selectedExternal.photoUrl || undefined,
                      },
                    })
                  }}
                >
                  Reseñar ⭐
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!selectedExternal?.mapsUrl) return
                    window.open(selectedExternal.mapsUrl, '_blank')
                  }}
                >
                  <ExternalLink className="size-3.5 mr-1" /> Ir
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); setSelectedExternal(null) }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Botón flotante: centrar en mi posición */}
      {userPos && (
        <button
          className="absolute bottom-28 right-3 z-30 w-10 h-10 rounded-full bg-background shadow-lg border border-border flex items-center justify-center active:scale-95 transition-transform"
          onClick={() => {
            if (!userPos || !leafletRef.current) return
            leafletRef.current.map.setView([userPos.lat, userPos.lng], 15, { animate: true })
          }}
        >
          <Navigation className="size-4 text-blue-500" />
        </button>
      )}

      {selectedExternal ? (
        <CollectionPickerSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          place={{ placeId: selectedExternal.id, placeName: selectedExternal.name, placeAddress: selectedExternal.address, placePhoto: selectedExternal.photoUrl || undefined }}
        />
      ) : null}
    </div>
  )
}
