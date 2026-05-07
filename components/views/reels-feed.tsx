'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Search, RefreshCw, Share2, Bookmark, Flame, Menu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LocationAutocomplete } from '@/components/search/location-autocomplete'
import { type Restaurant } from '@/lib/places/restaurants'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { MatchScore } from '@/components/restaurant/match-score'
import { hasSeenPicadaTooltip, loadPreferences, markPicadaTooltipSeen } from '@/lib/feed/personalization'
import { computePlaceMatchScore } from '@/lib/places/match'
import { getDiscoverGeoQueryExtra } from '@/lib/location/discover-geo'
import {
  placeClassificationCorpus,
  placeDiscoverSearchHaystack,
} from '@/lib/places/category-filter'
import {
  rankExplorePlacesByQuery,
} from '@/lib/feed/text-search'
import { slugDisplayFromAutomatedSlug } from '@/lib/tags/display'
import { resolveDiscoverLocation, subscribeToLocationChanges } from '@/lib/location/core'
import { subscribeToSocialChanges } from '@/lib/social/interactions'
import { useAppStore } from '@/lib/stores/app-store'
import { sharePicada } from '@/lib/social/share'
import { CollectionPickerSheet } from '@/components/restaurant/collection-picker-sheet'
import { isPlaceSaved, loadCollections } from '@/lib/social/collections'
import { openUnifiedPostForm } from '@/lib/content/post-form-draft'
import { triggerSuccessTone, triggerTapHaptic } from '@/lib/utils/device-feedback'
import { RecommendedPlaces } from '@/components/restaurant/recommended-places'

interface ReelsFeedProps {
  onSelect: (r: Restaurant) => void
  locationQuery: string
  onLocationChange: (value: string) => void
  active?: boolean
}

type ExternalPlace = {
  id: string
  name: string
  address: string
  lat?: number | null
  lng?: number | null
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
  coverageSparse?: boolean
  automatedSeedTags?: Array<{ slug: string; confidence_score: number; is_automated?: boolean }>
}

const CATEGORY_RE: Record<string, RegExp> = {
  picada: /picada|chilena|fuente de soda|sangucheria|sanguchería|completo|lomito|chorrillana|food_picada|local_fuente|local_sangucheria|local_comida_rapida|food_sandwich|food_completo|food_lomito/,
  parrilla: /parrilla|asado|churrasco|vacuno|chorizo|local_parrilla|food_parrilla|food_asado|parrillada/,
  vegano: /vegano|vegana|vegan|plant.based|vegetariano|vegetariana|sin carne|restrictions_vegano|restrictions_vegetariano|food_vegano/,
  fitness: /fitness|protein|proteina|saludable|healthy|bowl|ensalada|light|nutrition_fit|food_saludable/,
  keto: /keto|low carb|sin azucar|sin gluten|nutrition_keto|food_keto|restrictions_keto/,
  premium: /premium|gourmet|chef|cocina de autor|alta cocina|degustacion|maridaje|local_alto|food_gourmet/,
  cafe: /cafe|café|cafeteria|cafetería|coffee|brunch|pasteleria|pastelería|tostadas|cold brew|local_cafe|local_cafeteria|local_pasteleria|food_cafe/,
  japones: /japon|japones|japonés|sushi|ramen|izakaya|wok|gyoza|local_japones|food_sushi|food_ramen|tipo_plato_sushi/,
  pizza: /pizza|pizzeria|pizzería|local_pizzeria|food_pizza|napolitana/,
  peruano: /peruano|peruana|ceviche|cevicheria|cevichería|causa|aji de gallina|lomo saltado|local_cevicheria|food_ceviche|food_peruano/,
  mexicano: /mexican|taco|tacos|quesadilla|nachos|burrito|local_mexicana|food_tacos/,
  bar: /\bbar\b|cocktail|coctel|cóctel|cerveza artesanal|picoteo|local_bar|food_cocktail/,
  mariscos: /marisco|marisqueria|marisquería|reineta|ostiones|paila marina|seafood|local_marisqueria|food_marisco/,
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
      <div className="h-48 bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  query,
  category,
  locationQuery,
  onClearFilters,
}: {
  query: string
  category: string
  locationQuery: string
  onClearFilters: () => void
}) {
  const hasFilters = !!query || !!category
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
      <span className="text-5xl">{hasFilters ? '🔍' : '📍'}</span>
      <div>
        <p className="font-bold text-base">
          {hasFilters
            ? 'Sin resultados con ese filtro'
            : `No encontramos locales en "${locationQuery}"`}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {hasFilters
            ? 'Prueba quitando algún filtro o cambia el mood.'
            : 'Intenta con otra ubicación o amplía el radio de búsqueda.'}
        </p>
      </div>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Quitar filtros
        </Button>
      )}
    </div>
  )
}

// ─── Share helper ─────────────────────────────────────────────────────────────

function sharePlace(place: ExternalPlace) {
  sharePicada({
    picadaId: place.id,
    name: place.name,
    address: place.address,
    imageUrl: place.mapsUrl || window.location.href,
    votes: place.picadaReviews || 0,
  }).catch(() => null)
}

function PicadaTooltip({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(t)
  }, [onClose])
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="absolute -top-12 left-0 z-20 bg-orange-500 text-white text-[10px] rounded-xl px-2.5 py-1.5 shadow"
        onClick={onClose}
      >
        🔥 ¿Es buena picada? ¡Vótala! Ayudas a la comunidad y ganas XP
        <span className="absolute -bottom-1 left-4 w-2 h-2 bg-orange-500 rotate-45" />
      </motion.div>
    </AnimatePresence>
  )
}

function AnimatedSearchInput({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const [placeholder, setPlaceholder] = useState('')
  useEffect(() => {
    const samples = [
      'Hamburguesa familiar',
      'Sushi con terraza',
      'Picada con piscina',
      'Cafetería pet friendly',
      'Ambiente chill vegano',
      'Parrilla para niños',
    ]
    let sampleIdx = 0
    let charIdx = 0
    let deleting = false
    let timer: number | null = null
    const tick = () => {
      const current = samples[sampleIdx] || ''
      if (!deleting) {
        charIdx += 1
        setPlaceholder(current.slice(0, charIdx))
        if (charIdx >= current.length) {
          deleting = true
          timer = window.setTimeout(tick, 950)
          return
        }
      } else {
        charIdx -= 1
        setPlaceholder(current.slice(0, Math.max(0, charIdx)))
        if (charIdx <= 0) {
          deleting = false
          sampleIdx = (sampleIdx + 1) % samples.length
        }
      }
      timer = window.setTimeout(tick, deleting ? 40 : 70)
    }
    tick()
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  return (
    <Input
      placeholder={placeholder ? `Ej: ${placeholder}` : 'Buscar por local o tags'}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    />
  )
}

function shallowEqualTagIndex(a: Record<string, string[]>, b: Record<string, string[]>) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    const av = a[k] || []
    const bv = b[k] || []
    if (av.length !== bv.length) return false
    for (let i = 0; i < av.length; i++) {
      if (av[i] !== bv[i]) return false
    }
  }
  return true
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReelsFeed({ onSelect, locationQuery, onLocationChange, active = true }: ReelsFeedProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState('')
  const [externalPlaces, setExternalPlaces] = useState<ExternalPlace[]>([])
  const [externalSource, setExternalSource] = useState('')
  const [discoverNotice, setDiscoverNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewCols, setViewCols] = useState(1)
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('mobile')
  const [visibleCount, setVisibleCount] = useState(12)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const requestSeq = useRef(0)
  const touchStartY = useRef(0)
  const scrollRafRef = useRef<number | null>(null)
  const [pullDelta, setPullDelta] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [discoverNonce, setDiscoverNonce] = useState(0)
  const [isHeaderCompact, setIsHeaderCompact] = useState(false)
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false)
  const [communityTagIndex, setCommunityTagIndex] = useState<Record<string, string[]>>({})
  const [communityReviewsIndex, setCommunityReviewsIndex] = useState<Record<string, { count: number }>>({})
  /** Fotos comunitarias por nombre de local (clave lowercased) para mini carrusel en tarjetas */
  const [placePhotoCarousel, setPlacePhotoCarousel] = useState<Record<string, string[]>>({})
  const applyQuery = (next: string) => {
    setQuery(next)
    setDebouncedQuery(next)
  }

  useEffect(() => {
    const h = () => setDiscoverNonce(n => n + 1)
    const unSubLoc = subscribeToLocationChanges(h)
    const unSubSocial = subscribeToSocialChanges(h)
    return () => {
      unSubLoc()
      unSubSocial()
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 180)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    const loadTagIndex = () => {
      if (typeof window === 'undefined') return
      try {
        const raw = window.localStorage.getItem('picada.profile.social.v1')
        const parsed = raw ? JSON.parse(raw) : {}
        const posts = Array.isArray(parsed?.socialPosts) ? parsed.socialPosts as Array<{ place?: string; tags?: string[]; moods?: string[] }> : []
        const byPlace: Record<string, string[]> = {}
        for (const p of posts) {
          const place = String(p.place || '').trim().toLowerCase()
          if (!place) continue
          const tags = [...(p.tags || []), ...(p.moods || [])]
            .map(t => slugDisplayFromAutomatedSlug(String(t || '')).toLowerCase().trim())
            .filter(Boolean)
          if (!byPlace[place]) byPlace[place] = []
          byPlace[place] = [...new Set([...byPlace[place], ...tags])]
        }
        setCommunityTagIndex(prev => (shallowEqualTagIndex(prev, byPlace) ? prev : byPlace))
      } catch {
        setCommunityTagIndex(prev => (Object.keys(prev).length === 0 ? prev : {}))
      }
    }
    loadTagIndex()
    const onPub = () => loadTagIndex()
    window.addEventListener('picada:review-published', onPub)
    return () => window.removeEventListener('picada:review-published', onPub)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadCarouselPhotos = async () => {
      try {
        const res = await fetch('/api/social-feed?limit=80')
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          posts: Array<{ place_name: string | null; media_url: string | null; type: string }>
        }
        const map: Record<string, string[]> = {}
        for (const post of data.posts || []) {
          if (post.type === 'video') continue
          const url = post.media_url
          if (!url || url.startsWith('data:video')) continue
          const key = (post.place_name || '').trim().toLowerCase()
          if (!key) continue
          if (!map[key]) map[key] = []
          if (map[key].length < 8 && !map[key].includes(url)) map[key].push(url)
        }
        if (!cancelled) setPlacePhotoCarousel(map)
      } catch {
        /* ignore */
      }
    }
    void loadCarouselPhotos()
    window.addEventListener('picada:review-published', loadCarouselPhotos)
    return () => {
      cancelled = true
      window.removeEventListener('picada:review-published', loadCarouselPhotos)
    }
  }, [discoverNonce])

  useEffect(() => {
    const loadReviewIndex = () => {
      try {
        const raw = window.localStorage.getItem('picada.local.reviews.v1')
        setCommunityReviewsIndex(raw ? JSON.parse(raw) as Record<string, { count: number }> : {})
      } catch {
        setCommunityReviewsIndex({})
      }
    }
    loadReviewIndex()
    window.addEventListener('picada:review-published', loadReviewIndex)
    return () => window.removeEventListener('picada:review-published', loadReviewIndex)
  }, [])

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      const mode = w < 768 ? 'mobile' : w < 1200 ? 'tablet' : 'desktop'
      setViewport(mode)
      const def = mode === 'mobile' ? 1 : mode === 'tablet' ? 2 : 4
      setViewCols(def)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current != null) {
        window.cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [])

  const mergedPlaces = useMemo(
    () =>
      externalPlaces.map(p => ({
        ...p,
        inferredTags: [...(p.inferredTags || []), ...(communityTagIndex[p.name.trim().toLowerCase()] || [])],
      })),
    [externalPlaces, communityTagIndex],
  )

  const placeCorpusById = useMemo(() => {
    const byId: Record<string, string> = {}
    for (const p of mergedPlaces) {
      byId[p.id] = placeClassificationCorpus({
        name: p.name,
        address: p.address,
        inferredTags: p.inferredTags,
        automatedSeedTags: p.automatedSeedTags,
      })
    }
    return byId
  }, [mergedPlaces])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of mergedPlaces) {
      for (const s of p.automatedSeedTags || []) {
        const label = slugDisplayFromAutomatedSlug(s.slug).toLowerCase().trim()
        if (!label) continue
        counts.set(label, (counts.get(label) || 0) + 2)
      }
      for (const t of p.inferredTags || []) {
        const label = slugDisplayFromAutomatedSlug(String(t || '')).toLowerCase().trim()
        if (!label) continue
        counts.set(label, (counts.get(label) || 0) + 1)
      }
    }
    return counts
  }, [mergedPlaces])

  const filteredExternal = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim()
    const categoryFiltered = mergedPlaces.filter(p => {
      if (!category) return true
      const re = CATEGORY_RE[category]
      if (!re) return true
      return re.test(placeCorpusById[p.id] || '')
    })
    if (!q) return categoryFiltered
    const ranked = rankExplorePlacesByQuery(
      categoryFiltered,
      q,
    )
    if (ranked.length > 0) return ranked
    const fallback = Object.entries(communityReviewsIndex)
      .filter(([name]) => placeDiscoverSearchHaystack({
        name,
        address: 'Lugar aportado por la comunidad',
      }).includes(q))
      .slice(0, 5)
      .map(([name, data], idx) => ({
        id: `local-${name.toLowerCase().replace(/\s+/g, '-')}-${idx}`,
        name,
        address: 'Lugar aportado por la comunidad',
        rating: 0,
        reviews: Number(data?.count || 0),
        priceLevel: null,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
        provider: 'openstreetmap' as const,
      }))
    return fallback
  }, [mergedPlaces, category, debouncedQuery, placeCorpusById, communityReviewsIndex])

  const listForDisplay = filteredExternal

  const trendChips = useMemo(
    () =>
      [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label]) => label),
    [tagCounts],
  )

  const queryCompletions = useMemo(
    () => {
      const q = debouncedQuery.toLowerCase().trim()
      if (q.length < 2) return []
      return [...tagCounts.entries()]
        .filter(([label]) => label.startsWith(q))
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1]
          return a[0].length - b[0].length
        })
        .slice(0, 6)
        .map(([label]) => label)
    },
    [tagCounts, debouncedQuery],
  )

  const fetchPlaces = async (loc: string, signal?: AbortSignal) => {
    const prefs = loadPreferences()
    const extra = getDiscoverGeoQueryExtra(loc)
    const seq = ++requestSeq.current
    setLoading(true)
    try {
      const res = await fetch(
        `/api/restaurants/discover?location=${encodeURIComponent(loc)}&restrictions=${encodeURIComponent(prefs.restrictions.join(','))}${extra}`,
        { signal },
      )
      let data: { items?: ExternalPlace[]; source?: string; diagnostics?: { notice?: string } } = res.ok ? await res.json() : { items: [] }
      if ((data.items?.length ?? 0) === 0 && loc.includes(',')) {
        const short = loc.split(',')[0]?.trim()
        if (short && short.length >= 2) {
          const r2 = await fetch(
            `/api/restaurants/discover?location=${encodeURIComponent(short)}&restrictions=${encodeURIComponent(prefs.restrictions.join(','))}${extra}`,
            { signal },
          )
          if (r2.ok) data = await r2.json()
        }
      }
      if (seq !== requestSeq.current) return
      setExternalPlaces(data.items || [])
      setExternalSource(data.source || '')
      setDiscoverNotice(data.diagnostics?.notice || '')
    } catch {
      // mantener resultados previos si falla
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!active) return
    const location = resolveDiscoverLocation(locationQuery)
    if (location.length < 2) return
    const controller = new AbortController()
    const t = window.setTimeout(() => fetchPlaces(location, controller.signal), 80)
    return () => { window.clearTimeout(t); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, locationQuery, discoverNonce])

  useEffect(() => {
    setVisibleCount(12)
  }, [category, debouncedQuery, discoverNonce])

  useEffect(() => {
    const root = scrollRef.current
    const el = sentinelRef.current
    if (!root || !el) return
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 12, listForDisplay.length))
        }
      },
      { root, threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [listForDisplay.length])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPlaces(resolveDiscoverLocation(locationQuery))
    setRefreshing(false)
  }

  const isPulling = pullDelta > 60

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              Picada<span className="text-muted-foreground font-normal">.App</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Descubre locales en {locationQuery || 'tu ubicación'}
            </p>
            {loading ? (
              <p className="text-[11px] text-orange-600">Cargando locales...</p>
            ) : discoverNotice ? (
              <p className="text-[11px] text-amber-700">{discoverNotice}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn('shrink-0', refreshing && 'animate-spin')}
            onClick={handleRefresh}
            aria-label="Refrescar"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>

        {/* Expanded header — collapses on scroll */}
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] ease-in-out',
            isHeaderCompact
              ? 'grid-rows-[0fr] opacity-0 duration-200'
              : 'grid-rows-[1fr] opacity-100 duration-300',
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="space-y-3 pt-0.5">
              <LocationAutocomplete value={locationQuery} onChange={onLocationChange} />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <AnimatedSearchInput value={query} onChange={setQuery} className="pl-9" />
              </div>
              {(queryCompletions.length > 0 || trendChips.length > 0) && (
                <div className="space-y-1 -mx-4 px-4">
                  {queryCompletions.length > 0 && debouncedQuery.trim().length >= 2 && (
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                      <p className="text-[10px] text-muted-foreground shrink-0 pt-1">Sugeridos:</p>
                      {queryCompletions.map(tok => (
                        <Badge
                          key={`rel-${tok}`}
                          variant="secondary"
                          className="cursor-pointer shrink-0 text-[10px]"
                          onClick={() => applyQuery(tok)}
                        >
                          {tok}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {trendChips.length > 0 && (
                    <div className="rounded-md overflow-hidden border border-orange-300/60 shadow-sm">
                      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white flex items-center gap-1.5 tracking-wide">
                          <Flame className="size-3.5" />
                          Tendencias del momento
                        </span>
                        <span className="text-[9px] text-orange-100 font-medium uppercase tracking-wider">en tu zona</span>
                      </div>
                      <div className="bg-white px-3 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {trendChips.slice(0, 6).map((tok) => (
                            <button
                              key={`trend-${tok}`}
                              type="button"
                              onClick={() => applyQuery(tok)}
                              className={cn(
                                'h-7 px-2.5 text-[11px] font-medium rounded border whitespace-nowrap transition-colors',
                                query === tok
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-orange-50 text-orange-900 border-orange-200 hover:border-orange-400 hover:bg-orange-100',
                              )}
                              title={tok}
                            >
                              {tok}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compact bar — appears on scroll */}
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] ease-in-out',
            isHeaderCompact
              ? 'grid-rows-[1fr] opacity-100 duration-300'
              : 'grid-rows-[0fr] opacity-0 duration-200',
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="flex items-center gap-2 pt-0.5">
              <Button variant="outline" size="sm" className="h-8" onClick={() => setFiltersMenuOpen(true)}>
                <Menu className="size-4 mr-1.5" />
                Filtros
              </Button>
              <p className="text-[11px] text-muted-foreground truncate">
                {locationQuery || 'Sin ubicación'} · {listForDisplay.length} locales
              </p>
            </div>
          </div>
        </div>
      </div>

        <RecommendedPlaces
          locationQuery={locationQuery}
          onSelect={onSelect}
        />

      {/* Pull-to-refresh indicator */}
      {isPulling && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-orange-500 font-medium">
          <RefreshCw className="size-3.5 animate-spin" />
          Suelta para refrescar
        </div>
      )}
      {pullDelta > 10 && pullDelta <= 60 && (
        <div className="flex justify-center py-1">
          <div
            className="size-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin"
            style={{ opacity: pullDelta / 60 }}
          />
        </div>
      )}

      {/* Lista scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={e => {
          const top = (e.currentTarget as HTMLDivElement).scrollTop
          if (scrollRafRef.current != null) return
          scrollRafRef.current = window.requestAnimationFrame(() => {
            setIsHeaderCompact(prev => (prev ? top > 40 : top > 90))
            scrollRafRef.current = null
          })
        }}
        onTouchStart={e => {
          if ((e.currentTarget as HTMLDivElement).scrollTop <= 0) {
            touchStartY.current = e.touches[0]!.clientY
          }
        }}
        onTouchMove={e => {
          if ((e.currentTarget as HTMLDivElement).scrollTop > 0) return
          const delta = e.touches[0]!.clientY - touchStartY.current
          if (delta > 0) setPullDelta(delta)
        }}
        onTouchEnd={() => {
          if (isPulling) handleRefresh()
          setPullDelta(0)
        }}
      >
        <div className="px-4 py-4 space-y-4 pb-24 min-h-full">
          {loading && externalPlaces.length === 0 ? (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${viewCols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : listForDisplay.length === 0 ? (
            <EmptyState
              query={query}
              category={category}
              locationQuery={locationQuery}
              onClearFilters={() => { applyQuery(''); setCategory('') }}
            />
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${viewCols}, minmax(0, 1fr))` }}
            >
              {listForDisplay.slice(0, visibleCount).map(p => (
                <PlaceCard
                  key={p.id}
                  place={p}
                  locationQuery={locationQuery}
                  onSelect={onSelect}
                  extraPhotos={placePhotoCarousel[p.name.trim().toLowerCase()] || []}
                />
              ))}
            </div>
          )}
          <div ref={sentinelRef} className="h-10" />
          {externalSource ? (
            <p className="text-[10px] text-muted-foreground text-center">
              Fuente: {externalSource}
            </p>
          ) : null}
        </div>
      </div>
      <Sheet open={filtersMenuOpen} onOpenChange={setFiltersMenuOpen}>
        <SheetContent side="bottom" className="h-[80dvh] rounded-t-3xl p-4 overflow-y-auto">
          <SheetTitle className="text-sm">Filtros y búsqueda</SheetTitle>
          <div className="space-y-3 mt-2">
            <LocationAutocomplete value={locationQuery} onChange={onLocationChange} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <AnimatedSearchInput value={query} onChange={setQuery} className="pl-9" />
            </div>
            {(queryCompletions.length > 0 || trendChips.length > 0) && (
              <div className="space-y-1">
                {queryCompletions.length > 0 && debouncedQuery.trim().length >= 2 ? (
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                    {queryCompletions.map(tok => (
                      <Badge
                        key={`menu-rel-${tok}`}
                        variant="secondary"
                        className="cursor-pointer shrink-0 text-[10px]"
                        onClick={() => applyQuery(tok)}
                      >
                        {tok}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {trendChips.length > 0 ? (
                  <div className="rounded-md overflow-hidden border border-orange-300/60 shadow-sm">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1.5 tracking-wide">
                        <Flame className="size-3.5" />
                        Tendencias del momento
                      </span>
                      <span className="text-[9px] text-orange-100 font-medium uppercase tracking-wider">en tu zona</span>
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {trendChips.slice(0, 6).map((tok) => (
                          <button
                            key={`menu-trend-${tok}`}
                            type="button"
                            onClick={() => applyQuery(tok)}
                            className={cn(
                              'h-7 px-2.5 text-[11px] font-medium rounded border whitespace-nowrap transition-colors',
                              query === tok
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-orange-50 text-orange-900 border-orange-200 hover:border-orange-400 hover:bg-orange-100',
                            )}
                            title={tok}
                          >
                            {tok}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Place card ───────────────────────────────────────────────────────────────

const PlaceCard = memo(function PlaceCard({
  place: p,
  locationQuery,
  onSelect,
  extraPhotos = [],
}: {
  place: ExternalPlace
  locationQuery: string
  onSelect: (r: Restaurant) => void
  /** Fotos de la comunidad del mismo local (URLs); carrusel junto a la foto principal */
  extraPhotos?: string[]
}) {
  const interaction = useAppStore(s => s.interactions[p.id])
  const refreshInteraction = useAppStore(s => s.refreshInteraction)
  const votePicadaAction = useAppStore(s => s.votePicada)
  const prefs = useMemo(() => loadPreferences(), [])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerBlock, setPickerBlock] = useState(false)
  const [reviewCounts, setReviewCounts] = useState<Record<string, { count: number; lastSeen: string }>>({})
  const [collectionsCount, setCollectionsCount] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  const [xpFloat, setXpFloat] = useState<number | null>(null)
  const [picadaPulseKey, setPicadaPulseKey] = useState(0)
  const computed = useMemo(
    () =>
      computePlaceMatchScore({
        user: { likes: prefs.likes, restrictions: prefs.restrictions, dislikes: prefs.dislikes },
        placeName: p.name,
        placeAddress: p.address,
        placeReviewsText: p.reviewsText,
        inferredTags: p.inferredTags,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.id],
  )

  const score = p.matchScore ?? computed.score
  const reason = p.matchReason ?? computed.reasons[0]

  useEffect(() => {
    refreshInteraction(p.id, p.name)
  }, [p.id, p.name, refreshInteraction])

  useEffect(() => {
    if (pickerOpen) {
      setPickerBlock(true)
    } else {
      const t = window.setTimeout(() => setPickerBlock(false), 350)
      return () => window.clearTimeout(t)
    }
  }, [pickerOpen])

  const handleClick = () => {
    if (pickerBlock) return
    const prevClicks = Number(window.localStorage.getItem('picada.creator.clicks.v1') || '0')
    window.localStorage.setItem('picada.creator.clicks.v1', String(prevClicks + 1))
    window.dispatchEvent(new CustomEvent('picada:influence-updated'))
    const pseudo: Restaurant = {
      id: `ext-${p.id}`,
      placeExternalId: p.id,
      name: p.name,
      category: 'picada',
      description: p.reviewsText?.[0] || p.address || 'Lugar descubierto',
      address: p.address || '',
      comuna: locationQuery || 'Zona',
      lat: p.lat || -34.17,
      lng: p.lng || -70.74,
      rating: p.rating || 4.2,
      reviewCount: p.reviews || 0,
      distance: 'cerca',
      priceRange: 2,
      tags:
        (p.automatedSeedTags && p.automatedSeedTags.length > 0
          ? p.automatedSeedTags
              .slice()
              .sort((a, b) => Number(b.confidence_score || 0) - Number(a.confidence_score || 0))
              .map(x => slugDisplayFromAutomatedSlug(x.slug))
              .slice(0, 3)
          : ['Real']),
      automatedSeedTags: p.automatedSeedTags,
      imageUrl: p.photoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
      starPlate: { name: 'Catálogo del local', kcal: 0, protein: 0, carbs: 0, fat: 0 },
      openNow: p.openNow ?? true,
      mapsUrl: p.mapsUrl,
      phone: p.phone || undefined,
      website: p.website || undefined,
      reviewsText: p.reviewsText || [],
      gallery: p.photoUrl ? [p.photoUrl] : [],
      coverageSparse: Boolean(p.coverageSparse),
    }
    onSelect(pseudo)
  }

  const votedPicada = interaction?.votedPicada || false
  const picadaVotesCount = interaction?.picadaVotesCount || 0

  useEffect(() => {
    const load = () => {
      try {
        const raw = window.localStorage.getItem('picada.local.reviews.v1')
        setReviewCounts(raw ? JSON.parse(raw) as Record<string, { count: number; lastSeen: string }> : {})
      } catch {
        setReviewCounts({})
      }
      setCollectionsCount(isPlaceSaved(p.id).length)
    }
    load()
    const onUpdated = () => load()
    window.addEventListener('picada:collection-updated', onUpdated)
    return () => window.removeEventListener('picada:collection-updated', onUpdated)
  }, [p.id])

  useEffect(() => {
    if (hasSeenPicadaTooltip()) return
    setShowTooltip(true)
  }, [])

  const carouselSlides = useMemo(() => {
    const urls: string[] = []
    const add = (u?: string | null) => {
      if (!u || urls.includes(u)) return
      urls.push(u)
    }
    add(p.photoUrl)
    extraPhotos.forEach(add)
    return urls
  }, [p.photoUrl, extraPhotos])

  const [carouselIdx, setCarouselIdx] = useState(0)

  useEffect(() => {
    setCarouselIdx(0)
  }, [carouselSlides.join('|')])

  useEffect(() => {
    if (carouselSlides.length <= 1 || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => {
      setCarouselIdx(i => (i + 1) % carouselSlides.length)
    }, 3500)
    return () => clearInterval(t)
  }, [carouselSlides])

  const classificationChips = useMemo(() => {
    const byLabel = new Map<string, { label: string; score: number }>()
    const push = (rawLabel: string, score: number) => {
      const label = slugDisplayFromAutomatedSlug(String(rawLabel || '')).trim()
      if (!label) return
      const key = label.toLowerCase()
      const prev = byLabel.get(key)
      if (!prev || score > prev.score) byLabel.set(key, { label, score })
    }
    for (const s of p.automatedSeedTags || []) {
      const conf = Number(s.confidence_score || 0)
      push(s.slug, 100 + conf * 100)
    }
    for (const t of p.inferredTags || []) {
      push(String(t), 20)
    }
    return [...byLabel.values()]
      .sort((a, b) => b.score - a.score)
      .map(x => x.label)
      .slice(0, 3)
  }, [p.id, p.automatedSeedTags, p.inferredTags])

  return (
    <Card
      className="cursor-pointer overflow-hidden rounded-xl border p-0 gap-0 py-0 shadow-sm group hover:shadow-md transition-shadow"
      onClick={handleClick}
    >
      {carouselSlides.length > 0 ? (
        <div className="relative aspect-[5/3] w-full shrink-0 overflow-hidden bg-muted">
          <AnimatePresence mode="wait">
            <motion.div
              key={carouselSlides[carouselIdx]}
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.9 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={carouselSlides[carouselIdx]}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </motion.div>
          </AnimatePresence>
            {collectionsCount > 0 ? (
              <div className="absolute top-2 left-2 bg-white/80 backdrop-blur rounded-full p-1">
                <Bookmark className="size-3 text-orange-500 fill-orange-500" />
              </div>
            ) : null}
            {reviewCounts[p.name]?.count > 0 ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                🔥 {reviewCounts[p.name]?.count} reseñas
              </motion.div>
            ) : p.reviews < 3 ? (
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">💬 Sé el primero</div>
            ) : null}
            {picadaVotesCount >= 20 ? (
              <div className="absolute bottom-2 right-2 text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full">TOP PICADA 🏆</div>
            ) : null}
            {/* Share button on hover */}
            <button
              className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => { e.stopPropagation(); sharePlace(p) }}
              aria-label="Compartir"
            >
              <Share2 className="size-3.5" />
            </button>
            {/* Open now indicator */}
            {p.openNow != null && (
              <div className={cn(
                'absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                p.openNow
                  ? 'bg-green-500/90 text-white'
                  : 'bg-red-500/90 text-white',
              )}>
                {p.openNow ? 'Abierto' : 'Cerrado'}
              </div>
            )}
          {carouselSlides.length > 1 ? (
            <div className="absolute bottom-2 left-1/2 z-[5] flex -translate-x-1/2 gap-1 pointer-events-auto">
              {carouselSlides.map((_, i) => (
                <button
                  key={`car-${i}`}
                  type="button"
                  aria-label={`Foto ${i + 1}`}
                  className={cn(
                    'h-1 rounded-full transition-all',
                    i === carouselIdx ? 'w-5 bg-white' : 'w-1 bg-white/50 hover:bg-white/80',
                  )}
                  onClick={e => {
                    e.stopPropagation()
                    setCarouselIdx(i)
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative aspect-[5/2] w-full shrink-0 bg-muted flex items-center justify-center">
          <span className="text-3xl">🍽️</span>
          <button
            className="absolute top-2 right-2 bg-background/80 rounded-full p-1.5"
            onClick={e => { e.stopPropagation(); sharePlace(p) }}
            aria-label="Compartir"
          >
            <Share2 className="size-3.5" />
          </button>
        </div>
      )}

      <div className="px-3 pt-2.5 pb-3 space-y-2">
        <div>
          <p className="text-sm font-bold leading-tight">{p.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.address}</p>
        </div>

        {classificationChips.length > 0 && (
          <div className="flex flex-wrap gap-1" aria-label="Clasificación del local">
            {classificationChips.slice(0, 3).map(label => (
              <Badge key={label} variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-5 border-violet-200/90 bg-violet-500/[0.07] text-foreground dark:border-violet-700/70">
                {label}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {p.rating ? `⭐ ${p.rating.toFixed(1)}` : '—'} · {p.reviews} reseñas
          </p>
          {(p.picadaReviews || 0) > 0 && (
            <span className="text-[10px] text-orange-600 font-semibold ml-auto">🔥 Comunidad</span>
          )}
        </div>

        {score > 50 && <MatchScore score={score} reason={reason} />}

        <div className="relative">
          {showTooltip ? <PicadaTooltip onClose={() => { setShowTooltip(false); markPicadaTooltipSeen() }} /> : null}
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation()
              const before = votedPicada
              await votePicadaAction(p.id, p.name, { placeAddress: p.address, mapsUrl: p.mapsUrl })
              if (!before) {
                triggerTapHaptic(20)
                triggerSuccessTone()
                if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                  confetti({ particleCount: 35, spread: 50, origin: { y: 0.8 }, colors: ['#f97316', '#ef4444', '#fbbf24', '#fb923c'] })
                }
                setPicadaPulseKey(Date.now())
                setXpFloat(3)
                window.setTimeout(() => setXpFloat(null), 1200)
              }
            }}
            className={cn(
              'h-11 px-3 rounded-xl border-2 text-sm font-bold inline-flex items-center justify-between w-full',
              votedPicada
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-500 shadow-[0_4px_20px_rgba(249,115,22,0.45)]'
                : 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border-orange-300',
            )}
          >
            <span className="inline-flex items-center gap-1.5"><Flame className="size-4" />{votedPicada ? '¡Es una Picada!' : 'Votar como Picada'}</span>
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full', votedPicada ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700')}>{picadaVotesCount} votos</span>
          </button>
          {picadaPulseKey ? (
            <motion.div
              key={picadaPulseKey}
              initial={{ scale: 0.95 }}
              animate={{ scale: [0.95, 1.08, 1] }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-0 rounded-xl border-2 border-orange-300/70"
            />
          ) : null}
          {xpFloat ? (
            <motion.div initial={{ y: 0, opacity: 1 }} animate={{ y: -40, opacity: 0 }} transition={{ duration: 1.2 }} className="absolute right-4 -top-2 text-xs text-orange-600 font-bold">
              +{xpFloat} XP
            </motion.div>
          ) : null}
        </div>
        <div className="pt-1 border-t flex items-center gap-1.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); setPickerOpen(true) }} className={cn('h-8 text-xs rounded-lg border flex-1 inline-flex items-center justify-center gap-1', collectionsCount > 0 ? 'text-green-600 border-green-400 bg-green-50' : 'text-muted-foreground border-border')}>
            <Bookmark className={cn('size-3.5', collectionsCount > 0 ? 'fill-green-600' : '')} />
            {collectionsCount > 0 ? 'Guardado ✓' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openUnifiedPostForm({
                type: 'review',
                mode: 'rating_quick',
                place: { id: p.id, name: p.name, address: p.address, rating: p.rating, photoUrl: p.photoUrl || undefined },
              })
            }}
            className={cn('h-8 text-xs rounded-lg border flex-1', (reviewCounts[p.name]?.count || 0) > 0 ? 'text-green-600 border-green-400 bg-green-50' : 'text-muted-foreground border-border')}
          >
            {(reviewCounts[p.name]?.count || 0) > 0 ? 'Reseñado ✓' : '⭐ Reseñar'}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); sharePlace(p) }} className="h-8 rounded-lg border flex-1 inline-flex items-center justify-center">
            <Share2 className="size-3.5" />
          </button>
        </div>
      </div>
      <CollectionPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        place={{ placeId: p.id, placeName: p.name, placeAddress: p.address, placePhoto: p.photoUrl || undefined }}
      />
    </Card>
  )
})
PlaceCard.displayName = 'PlaceCard'
