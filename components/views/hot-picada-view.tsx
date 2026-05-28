'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Flame, Share2, RefreshCw, Trophy, Medal, Crown, BookmarkPlus, MapPin, Plus, Star, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { type Restaurant } from '@/lib/places/restaurants'
import { loadPreferences } from '@/lib/feed/personalization'
import { getDiscoverGeoQueryExtra } from '@/lib/location/discover-geo'
import { resolveDiscoverLocation, subscribeToLocationChanges } from '@/lib/location/core'
import { placeTextMatchesLocation } from '@/lib/location/query-match'
import { getUserInteraction, subscribeToSocialChanges } from '@/lib/social/interactions'
import { useAppStore } from '@/lib/stores/app-store'
import { sharePicada } from '@/lib/social/share'
import { LocationAutocomplete } from '@/components/search/location-autocomplete'
import type { UserPicada } from '@/app/api/user-picadas/route'
import { triggerSuccessTone, triggerTapHaptic } from '@/lib/utils/device-feedback'
import {
  rankExplorePlacesByQuery,
  suggestExploreCompletions,
} from '@/lib/feed/text-search'
import { useUserAffinity } from '@/lib/hooks/useUserAffinity'

type Props = {
  locationQuery: string
  onSelect: (r: Restaurant) => void
  onLocationChange: (label: string) => void
  onNewPicada?: () => void
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
  openNow?: boolean | null
  photoUrl?: string | null
  reviewsText?: string[]
  picadaRating?: number | null
  picadaReviews?: number
  mapsUrl: string
  phone?: string | null
  website?: string | null
  coverageSparse?: boolean
  inferredTags?: string[]
  automatedSeedTags?: Array<{ slug: string; confidence_score: number; is_automated?: boolean }>
}

type RemotePicadaRank = {
  picada_id: string
  community_votes: number
  visits_count: number
  reviews_count: number
  ranking_score: number
  place_name?: string
  place_address?: string
  maps_url?: string
  quality_score?: number
  engagement_score?: number
  recency_boost?: number
  final_score?: number
  trend_label?: 'trending' | 'rising' | 'top_week'
}

type IntentDef = {
  id: string
  label: string
  query: string
  tags: string[]
  badge: string
  placeholder: string
}

const INTENTS: IntentDef[] = [
  { id: 'almuerzo_rapido', label: 'Almuerzo rápido', query: 'almuerzo rapido', tags: ['local_comida_rapida', 'food_picada_tipica_cl'], badge: 'Ideal almuerzo rápido', placeholder: 'Busca un almuerzo rápido cerca...' },
  { id: 'liviano', label: 'Liviano', query: 'liviano saludable', tags: ['attr_vegano', 'food_restrictions_vegano', 'food_nutrition_keto'], badge: 'Ideal liviano', placeholder: 'Busca tu próximo bowl saludable...' },
  { id: 'cafe_trabajo', label: 'Café/Trabajo', query: 'cafe trabajar wifi', tags: ['local_cafe_cafeteria', 'attr_wifi', 'attr_enchufes'], badge: 'Ideal para trabajar', placeholder: 'Busca café con wifi y enchufes...' },
  { id: 'rico_barato', label: 'Rico/Barato', query: 'rico barato', tags: ['attr_barato', 'food_picada_tipica_cl'], badge: 'Ideal rico y barato', placeholder: 'Busca opciones ricas y baratas...' },
  { id: 'cita', label: 'Cita', query: 'cita romantico', tags: ['ambience_romantico', 'ambience_terraza'], badge: 'Ideal para citas', placeholder: 'Busca un lugar especial para una cita...' },
  { id: 'antojos', label: 'Antojos', query: 'antojo hamburguesa sushi', tags: ['food_tipo_plato_sushi_sashimi', 'food_picada_tipica_cl'], badge: 'Ideal para antojos', placeholder: '¿Qué se te antoja hoy?' },
  { id: 'mejor_hoy', label: 'Lo mejor hoy', query: 'mejor hoy abierto', tags: ['service_excelente_atencion', 'ambience_tranquilo'], badge: 'Top del día', placeholder: 'Descubre lo mejor de hoy...' },
]

function AnimatedSearchInput({
  value,
  onChange,
  className,
  samples,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
  samples?: string[]
}) {
  const [placeholder, setPlaceholder] = useState('')
  useEffect(() => {
    const pool = (samples && samples.length > 0) ? samples : [
      'Completo XL abierto ahora',
      'Picada con terraza',
      'Comida peruana familiar',
      'Hamburguesa barata y rica',
    ]
    let sampleIdx = 0
    let charIdx = 0
    let deleting = false
    let timer: number | null = null
    const tick = () => {
      const current = pool[sampleIdx] || ''
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
          sampleIdx = (sampleIdx + 1) % pool.length
        }
      }
      timer = window.setTimeout(tick, deleting ? 45 : 70)
    }
    tick()
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [samples])

  return (
    <Input
      placeholder={placeholder ? `Ej: ${placeholder}` : 'Buscar por local o tags'}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    />
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
      <div className="h-44 bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    </div>
  )
}

// ─── My Picadas section ───────────────────────────────────────────────────────

type LocalSocialPost = {
  id: string
  type: 'photo' | 'review'
  text: string
  place?: string
  imageDataUrl?: string
  rating?: number
  createdAt: string
  isPicada?: boolean
}

function MyPicadasSection({ onNewPicada }: { onNewPicada?: () => void }) {
  const [myPicadas, setMyPicadas] = useState<LocalSocialPost[]>([])
  const [remotePicadas, setRemotePicadas] = useState<UserPicada[]>([])

  useEffect(() => {
    // Load locally-saved picadas
    try {
      const raw = window.localStorage.getItem('picada.profile.social.v1')
      const data = raw ? JSON.parse(raw) as { socialPosts?: LocalSocialPost[] } : {}
      const posts = data.socialPosts || []
      const picadaPosts = posts.filter(p => p.place && (p.text?.toLowerCase().includes('picada') || p.isPicada))
      setMyPicadas(picadaPosts)
    } catch { /* ignore */ }

    // Load from API
    const userId = window.localStorage.getItem('picada.user.id.v1') || ''
    if (userId) {
      fetch(`/api/user-picadas?user_id=${encodeURIComponent(userId)}&limit=20`)
        .then(r => r.ok ? r.json() : { picadas: [] })
        .then((d: { picadas: UserPicada[] }) => setRemotePicadas(d.picadas || []))
        .catch(() => null)
    }

    const onPublished = (e: Event) => {
      const post = (e as CustomEvent<LocalSocialPost>).detail
      if (post.place) setMyPicadas(prev => [post, ...prev])
    }
    window.addEventListener('picada:review-published', onPublished)
    return () => window.removeEventListener('picada:review-published', onPublished)
  }, [])

  const allMine = [
    ...myPicadas.map(p => ({ id: p.id, name: p.place || '', text: p.text, rating: p.rating, photo: p.imageDataUrl, createdAt: p.createdAt, source: 'local' as const })),
    ...remotePicadas.filter(r => !myPicadas.find(l => l.place === r.place_name)).map(r => ({ id: r.id, name: r.place_name, text: r.comment || '', rating: r.rating, photo: r.photo_url, createdAt: r.created_at, source: 'remote' as const })),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="size-4 text-orange-500" />
          <h2 className="font-bold text-sm">Mis picadas</h2>
          {allMine.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">{allMine.length}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs rounded-full border-orange-300 text-orange-700 hover:bg-orange-50 self-start sm:self-auto"
          onClick={onNewPicada}
        >
          <Plus className="size-3.5 mr-1" /> Nueva picada
        </Button>
      </div>

      {allMine.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-4 text-center space-y-2">
          <p className="text-2xl">🔍</p>
          <p className="text-xs font-medium text-orange-700">Aún no has enviado picadas</p>
          <p className="text-[11px] text-muted-foreground">Usa el botón "Nueva picada" para añadir un local que conoces y ganará visibilidad en el ranking comunitario.</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-orange-300 text-orange-600 hover:bg-orange-100"
            onClick={onNewPicada}
          >
            <Plus className="size-3.5 mr-1" /> Agregar mi primera picada
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {allMine.slice(0, 5).map(p => (
            <Card key={p.id} className="overflow-hidden p-0 gap-0">
              <CardContent className="py-2.5 px-3 flex items-center gap-3">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt={p.name} className="size-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="size-12 rounded-lg bg-orange-100 flex items-center justify-center text-xl shrink-0">🍽️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  {p.text && <p className="text-xs text-muted-foreground truncate">{p.text}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.rating ? (
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`size-3 ${n <= p.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </span>
                    {p.source === 'remote' && (
                      <Badge variant="secondary" className="text-[9px] px-1 h-3.5">Sincronizado</Badge>
                    )}
                  </div>
                </div>
                <Badge className="bg-orange-500 text-white text-[10px] shrink-0">Picada</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function placeTagSlugs(place: ExternalPlace): string[] {
  const out = new Set<string>()
  for (const s of place.automatedSeedTags || []) out.add(String(s.slug || '').toLowerCase().trim())
  for (const t of place.inferredTags || []) out.add(String(t || '').toLowerCase().trim())
  return [...out].filter(Boolean)
}

function cleanAddress(address: string): string {
  return address
    .replace(/,?\s*\d{7}/g, '')                                  // código postal chileno
    .replace(/Región Metropolitana de Santiago/g, 'RM')
    .replace(/Provincia de Santiago,?\s*/g, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/,\s*$/, '')
    .trim()
}

function intentMatchTag(place: ExternalPlace, intent: IntentDef | null): string | null {
  if (!intent) return null
  const tags = placeTagSlugs(place)
  for (const rule of intent.tags) {
    const r = rule.toLowerCase()
    if (tags.some(t => t === r || t.includes(r) || r.includes(t))) return rule
  }
  return null
}

export function HotPicadaView({ locationQuery, onSelect, onLocationChange, onNewPicada, active = true }: Props) {
  const [items, setItems] = useState<ExternalPlace[]>([])
  const [source, setSource] = useState('')
  const [discoverNotice, setDiscoverNotice] = useState('')
  const [remoteRankById, setRemoteRankById] = useState<Record<string, RemotePicadaRank>>({})
  const [loading, setLoading] = useState(false)
  const [votePulseById, setVotePulseById] = useState<Record<string, number>>({})
  const [discoverNonce, setDiscoverNonce] = useState(0)
  const [movementById, setMovementById] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<'ranking' | 'mis-picadas'>('ranking')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIntentId, setActiveIntentId] = useState<string>('')
  const interactions = useAppStore(s => s.interactions)
  const votePicadaAction = useAppStore(s => s.votePicada)
  const toggleVisitLaterAction = useAppStore(s => s.toggleVisitLater)
  const { weights: affinityWeights, topTags, trackTags } = useUserAffinity()
  const applyQuery = (next: string) => {
    setQuery(next)
    setDebouncedQuery(next)
  }
  useEffect(() => {
    const sync = () => setDiscoverNonce(n => n + 1)
    const unSubLoc = subscribeToLocationChanges(sync)
    const unSubSocial = subscribeToSocialChanges(sync)
    return () => {
      unSubLoc()
      unSubSocial()
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 180)
    return () => window.clearTimeout(t)
  }, [query])

  const fetchTrending = async (loc: string) => {
    const normalizedLoc =
      (loc || '').trim().length >= 2 ? (loc || '').trim() : resolveDiscoverLocation('').trim()
    const prefs = loadPreferences()
    const extra = getDiscoverGeoQueryExtra(normalizedLoc)
    setLoading(true)
    const discover = async (l: string) => {
      const r = await fetch(`/api/restaurants/discover?location=${encodeURIComponent(l)}&restrictions=${encodeURIComponent(prefs.restrictions.join(','))}${extra}`)
      return (r.ok ? r.json() : { items: [] }) as Promise<{ items?: ExternalPlace[]; source?: string; diagnostics?: { notice?: string } }>
    }
    try {
      let data = await discover(normalizedLoc)
      if ((data.items?.length ?? 0) === 0 && normalizedLoc.includes(',')) {
        const short = normalizedLoc.split(',')[0]?.trim()
        if (short && short.length >= 2) {
          const retry = await discover(short)
          data = { ...retry, source: retry.source || data.source }
        }
      }
      setItems(data.items || [])
      setSource(data.source || '')
      setDiscoverNotice(data.diagnostics?.notice || '')
    } catch {
      // Mantener últimos resultados evita "pantallazos vacíos" por fallos transitorios.
      setSource(prev => prev || 'cache local')
    } finally {
      setLoading(false)
    }
  }

  const fetchRemoteRanking = async () => {
    try {
      const locationParam = encodeURIComponent(locationQuery || '')
      const r = await fetch(`/api/picada-ranking?limit=200&location=${locationParam}`)
      if (!r.ok) throw new Error('ranking_fetch_failed')
      const data = (await r.json()) as { items?: RemotePicadaRank[] }
      const byId: Record<string, RemotePicadaRank> = {}
      for (const item of data.items || []) {
        if (!item?.picada_id) continue
        byId[item.picada_id] = item
      }
      setRemoteRankById(byId)
    } catch {
      setRemoteRankById({})
    }
  }

  useEffect(() => {
    if (!active) return
    const target = resolveDiscoverLocation(locationQuery)
    fetchTrending(target)
    fetchRemoteRanking()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, locationQuery, discoverNonce])

  const top = useMemo(() => {
    const byId = new Map(items.map(item => [item.id, item]))
    const remoteOnly: ExternalPlace[] = Object.values(remoteRankById)
      .filter(remote => !byId.has(remote.picada_id))
      .filter(remote =>
        placeTextMatchesLocation(remote.place_name, remote.place_address, locationQuery),
      )
      .map(remote => ({
        id: remote.picada_id,
        name: remote.place_name || `Picada ${remote.picada_id.slice(0, 8)}`,
        address: remote.place_address || 'Dirección por confirmar',
        rating: 0,
        reviews: remote.reviews_count || 0,
        openNow: true,
        picadaReviews: remote.community_votes || 0,
        mapsUrl: remote.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(remote.place_name || remote.picada_id)}`,
      }))

    return [...items, ...remoteOnly]
      .sort((a, b) => {
        const localVotesA = interactions[a.id]?.picadaVotesCount || 0
        const localVotesB = interactions[b.id]?.picadaVotesCount || 0
        const remoteA = remoteRankById[a.id]
        const remoteB = remoteRankById[b.id]
        const votesA = (remoteA?.community_votes || 0) + localVotesA
        const votesB = (remoteB?.community_votes || 0) + localVotesB
        const qualityA = (a.picadaRating || a.rating || 0) * 30 + Math.log10((a.reviews || 0) + 1) * 40
        const qualityB = (b.picadaRating || b.rating || 0) * 30 + Math.log10((b.reviews || 0) + 1) * 40
        const socialA = ((a.picadaReviews || 0) + votesA) * 8 + (a.openNow ? 8 : 0)
        const socialB = ((b.picadaReviews || 0) + votesB) * 8 + (b.openNow ? 8 : 0)
        const remoteAWeight = (remoteA?.ranking_score || 0) * 0.35
        const remoteBWeight = (remoteB?.ranking_score || 0) * 0.35
        const scoreA = qualityA + socialA + remoteAWeight
        const scoreB = qualityB + socialB + remoteBWeight
        if (scoreB !== scoreA) return scoreB - scoreA
        // Desempate estable: mejor rating y luego más reseñas.
        if ((b.picadaRating || b.rating || 0) !== (a.picadaRating || a.rating || 0)) {
          return (b.picadaRating || b.rating || 0) - (a.picadaRating || a.rating || 0)
        }
        return (b.reviews || 0) - (a.reviews || 0)
      })
      .slice(0, 200)
  }, [items, discoverNonce, interactions, remoteRankById, locationQuery])

  useEffect(() => {
    if (top.length === 0 || typeof window === 'undefined') return
    const key = 'picada.ranking.snapshot.v1'
    const prev = window.localStorage.getItem(key)
    const prevMap = prev ? JSON.parse(prev) as Record<string, number> : {}
    const nextMap: Record<string, number> = {}
    const movement: Record<string, number> = {}
    top.forEach((item, idx) => {
      const pos = idx + 1
      nextMap[item.id] = pos
      const oldPos = prevMap[item.id]
      if (typeof oldPos === 'number' && oldPos !== pos) {
        movement[item.id] = oldPos - pos
      }
    })
    setMovementById(movement)
    window.localStorage.setItem(key, JSON.stringify(nextMap))
  }, [top])

  const filteredTop = useMemo(
    () => (debouncedQuery.trim() ? rankExplorePlacesByQuery(top, debouncedQuery) : top),
    [top, debouncedQuery],
  )
  const activeIntent = useMemo(
    () => INTENTS.find(x => x.id === activeIntentId) || null,
    [activeIntentId],
  )
  const orderedIntents = useMemo(() => {
    return [...INTENTS].sort((a, b) => {
      const sa = a.tags.reduce((acc, t) => acc + Number(affinityWeights[t] || 0), 0)
      const sb = b.tags.reduce((acc, t) => acc + Number(affinityWeights[t] || 0), 0)
      if (sb !== sa) return sb - sa
      return INTENTS.findIndex(x => x.id === a.id) - INTENTS.findIndex(x => x.id === b.id)
    })
  }, [affinityWeights])
  const intentPrioritizedTop = useMemo(() => {
    if (!activeIntent) return filteredTop
    return [...filteredTop].sort((a, b) => {
      const ma = intentMatchTag(a, activeIntent) ? 1 : 0
      const mb = intentMatchTag(b, activeIntent) ? 1 : 0
      if (mb !== ma) return mb - ma
      return 0
    })
  }, [filteredTop, activeIntent])
  const queryCompletions = useMemo(
    () => suggestExploreCompletions(top, debouncedQuery, 6),
    [top, debouncedQuery],
  )
  const filteredTop1 = intentPrioritizedTop[0]
  const filteredPodium = intentPrioritizedTop.slice(0, 3)
  const smartPlaceholderSamples = useMemo(() => {
    if (topTags.some(t => t.includes('vegano') || t.includes('keto'))) {
      return ['Busca tu próximo bowl saludable...', 'Opciones fit para hoy', 'Ensaladas y platos livianos']
    }
    if (topTags.some(t => t.includes('cafe') || t.includes('wifi') || t.includes('enchufes'))) {
      return ['Café con wifi y enchufes...', 'Tu próxima cafetería para trabajar', 'Cold brew y laptop friendly']
    }
    if (topTags.some(t => t.includes('romantico') || t.includes('terraza'))) {
      return ['Tu próximo lugar para una cita...', 'Ambiente romántico con terraza', 'Noche especial cerca de ti']
    }
    if (activeIntent?.placeholder) return [activeIntent.placeholder]
    return ['Completo XL abierto ahora', 'Picada con terraza', 'Comida peruana familiar', 'Hamburguesa barata y rica']
  }, [topTags, activeIntent])

  const displaySource = useMemo(() => {
    if (!source) return ''
    const hasRemote = Object.keys(remoteRankById).length > 0
    return hasRemote ? `${source} + ranking Supabase` : source
  }, [remoteRankById, source])
  const maxCommunityVotes = useMemo(
    () => Math.max(1, ...intentPrioritizedTop.map(p => (p.picadaReviews || 0) + (interactions[p.id]?.picadaVotesCount || 0))),
    [intentPrioritizedTop, interactions],
  )

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="px-4 pt-5 pb-24 space-y-4 max-w-md mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Image src="/picada-logo.png" alt="Picada" width={122} height={36} className="h-8 w-auto rounded-sm bg-white p-1" />
            </h1>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              Ranking comunitario · Top 200 para entrar <span className="text-orange-400 font-semibold">v4</span>
            </p>
            {loading ? <p className="text-[11px] text-orange-600 mt-1">Cargando locales y señales...</p> : null}
            {!loading && discoverNotice ? <p className="text-[11px] text-amber-700 mt-1">{discoverNotice}</p> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Refrescar trending"
              onClick={() => {
                const loc = resolveDiscoverLocation(locationQuery)
                fetchTrending(loc)
                fetchRemoteRanking()
              }}
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <LocationAutocomplete value={locationQuery} onChange={onLocationChange} />
        <div className="w-full overflow-hidden">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {orderedIntents.map(intent => (
            <Button
              key={intent.id}
              type="button"
              size="sm"
              variant={activeIntentId === intent.id ? 'default' : 'outline'}
              className="h-7 px-2.5 text-[10px] rounded-full shrink-0"
              onClick={() => {
                setActiveIntentId(intent.id)
                applyQuery(intent.label)
              }}
            >
              {intent.label}
            </Button>
          ))}
          </div>
        </div>
        <div className="space-y-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <AnimatedSearchInput value={query} onChange={setQuery} className="pl-9" samples={smartPlaceholderSamples} />
          </div>
          {queryCompletions.length > 0 && debouncedQuery.trim().length >= 2 ? (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              <p className="text-[10px] text-muted-foreground shrink-0 pt-1">Sugeridos:</p>
              {queryCompletions.map(tok => (
                <Badge
                  key={`picada-rel-${tok}`}
                  variant="secondary"
                  className="cursor-pointer shrink-0 text-[10px]"
                  onClick={() => applyQuery(tok)}
                >
                  {tok}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {/* Tabs: Ranking vs Mis Picadas */}
        <div className="flex rounded-xl border overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveTab('ranking')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'ranking'
                ? 'bg-orange-500 text-white'
                : 'bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <Flame className="size-3.5 shrink-0" /> Ranking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mis-picadas')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'mis-picadas'
                ? 'bg-orange-500 text-white'
                : 'bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <MapPin className="size-3.5 shrink-0" /> Mis picadas
          </button>
        </div>

        {/* Mis Picadas tab */}
        {activeTab === 'mis-picadas' && (
          <MyPicadasSection onNewPicada={onNewPicada} />
        )}

        {/* Ranking tab */}
        {activeTab === 'ranking' && (
        <>

        {/* ── La Picada del Momento (#1 hero) ── */}
        {filteredTop1 ? (
          <motion.button
            type="button"
            className="w-full rounded-2xl overflow-hidden text-left shadow-lg active:scale-[0.98] transition-transform"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              trackTags(placeTagSlugs(filteredTop1))
              onSelect({
                id: `ext-${filteredTop1.id}`, name: filteredTop1.name, category: 'picada',
                description: filteredTop1.reviewsText?.[0] || filteredTop1.address || 'Top 1 comunidad',
                address: filteredTop1.address || '', comuna: locationQuery || 'Zona',
                lat: filteredTop1.lat || -33.45, lng: filteredTop1.lng || -70.66,
                rating: filteredTop1.picadaRating || filteredTop1.rating || 0, reviewCount: filteredTop1.reviews || 0,
                distance: 'cerca', priceRange: 2, tags: ['Top 1 Comunidad'],
                imageUrl: filteredTop1.photoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                starPlate: { name: 'Destacado del local', kcal: 0, protein: 0, carbs: 0, fat: 0 },
                openNow: filteredTop1.openNow ?? true, mapsUrl: filteredTop1.mapsUrl,
                phone: filteredTop1.phone || undefined, website: filteredTop1.website || undefined,
                reviewsText: filteredTop1.reviewsText || [],
                gallery: filteredTop1.photoUrl ? [filteredTop1.photoUrl] : [],
                coverageSparse: Boolean(filteredTop1.coverageSparse),
              })
            }}
          >
            {/* Header strip */}
            <div className="bg-gradient-to-r from-orange-600 via-red-500 to-orange-500 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.span
                  className="text-base leading-none"
                  animate={{ scale: [1, 1.35, 1], rotate: [-5, 5, -5] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden
                >
                  🔥
                </motion.span>
                <div>
                  <p className="text-white font-black text-[11px] uppercase tracking-widest leading-none">La Picada del Momento</p>
                  <p className="text-orange-100/80 text-[9px] font-medium mt-0.5">Elegida por la comunidad</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-green-300 animate-pulse" aria-hidden />
                <span className="text-white text-[10px] font-bold">#1</span>
              </div>
            </div>

            {/* Photo */}
            <div className="relative h-52 w-full bg-muted">
              {filteredTop1.photoUrl
                ? <Image src={filteredTop1.photoUrl} alt={filteredTop1.name} fill className="object-cover" />
                : <div className="flex items-center justify-center h-full text-6xl bg-gradient-to-br from-orange-100 to-amber-50">🍽️</div>}

              {/* Gradient overlay bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Bottom info */}
              <div className="absolute bottom-0 inset-x-0 px-4 pb-4">
                <div className="flex items-end justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-2xl leading-tight truncate drop-shadow-md">{filteredTop1.name}</p>
                    <p className="text-white/65 text-xs truncate mt-0.5">{cleanAddress(filteredTop1.address)}</p>
                  </div>
                  {filteredTop1.rating > 0 && (
                    <div className="shrink-0 bg-black/50 backdrop-blur-sm rounded-xl px-2.5 py-1 text-center">
                      <p className="text-yellow-300 font-black text-base leading-none">
                        {(filteredTop1.picadaRating || filteredTop1.rating).toFixed(1)}
                      </p>
                      <p className="text-yellow-300/80 text-[9px]">★ rating</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {((filteredTop1.picadaReviews || 0) > 0 || (filteredTop1.reviews || 0) > 0) && (
                    <span className="text-white/70 text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
                      {(filteredTop1.picadaReviews || 0) > 0
                        ? `${filteredTop1.picadaReviews} votos comunidad`
                        : `${filteredTop1.reviews} reseñas`}
                    </span>
                  )}
                  {filteredTop1.openNow != null && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${filteredTop1.openNow ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                      {filteredTop1.openNow ? 'Abierto' : 'Cerrado'}
                    </span>
                  )}
                  <span className="text-white/50 text-[10px] ml-auto">Toca para ver →</span>
                </div>
              </div>
            </div>
          </motion.button>
        ) : null}

        {/* ── Podio #2 y #3 ── */}
        {filteredPodium.length > 1 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">También en el podio</p>
            <div className="grid grid-cols-2 gap-2">
              {filteredPodium.slice(1, 3).map((p, i) => {
                const podiumStyle = [
                  { border: 'border-slate-300', bg: 'bg-gradient-to-b from-slate-50 to-gray-50 dark:from-slate-800/40 dark:to-slate-900/20', icon: '🥈', label: '#2', badge: 'bg-slate-600 text-white' },
                  { border: 'border-amber-400',  bg: 'bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-950/10', icon: '🥉', label: '#3', badge: 'bg-amber-600 text-white' },
                ][i]
                if (!podiumStyle) return null
                return (
                  <button
                    type="button"
                    key={`podium-${p.id}`}
                    className={`rounded-2xl border ${podiumStyle.border} ${podiumStyle.bg} overflow-hidden text-left active:scale-95 transition-transform shadow-sm`}
                    onClick={() => {
                      trackTags(placeTagSlugs(p))
                      onSelect({
                        id: `ext-${p.id}`, name: p.name, category: 'picada',
                        description: p.reviewsText?.[0] || p.address || 'Top comunidad',
                        address: p.address || '', comuna: locationQuery || 'Zona',
                        lat: p.lat || -33.45, lng: p.lng || -70.66,
                        rating: p.picadaRating || p.rating || 0, reviewCount: p.reviews || 0,
                        distance: 'cerca', priceRange: 2, tags: ['Top Comunidad'],
                        imageUrl: p.photoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                        starPlate: { name: 'Destacado del local', kcal: 0, protein: 0, carbs: 0, fat: 0 },
                        openNow: p.openNow ?? true, mapsUrl: p.mapsUrl,
                        phone: p.phone || undefined, website: p.website || undefined,
                        reviewsText: p.reviewsText || [],
                        gallery: p.photoUrl ? [p.photoUrl] : [],
                        coverageSparse: Boolean(p.coverageSparse),
                      })
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full bg-muted" style={{ aspectRatio: '4/3' }}>
                      {p.photoUrl
                        ? <Image src={p.photoUrl} alt={p.name} fill className="object-cover" />
                        : <div className="flex items-center justify-center h-full text-3xl">🍽️</div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <span className={`absolute top-2 left-2 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${podiumStyle.badge}`}>
                        {podiumStyle.label}
                      </span>
                      <span className="absolute top-2 right-2 text-lg leading-none">{podiumStyle.icon}</span>
                      {(p.picadaRating || p.rating || 0) > 0 && (
                        <span className="absolute bottom-2 right-2 text-[9px] font-bold text-yellow-300">★ {(p.picadaRating || p.rating || 0).toFixed(1)}</span>
                      )}
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-bold truncate leading-tight">{p.name}</p>
                      {p.address && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{cleanAddress(p.address)}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* Skeletons */}
        {loading && items.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && intentPrioritizedTop.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="text-5xl">🔥</span>
            <div>
              <p className="font-bold text-base">Aún no hay tendencias aquí</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sé el primero en reseñar locales de{' '}
                <span className="font-medium">{locationQuery || 'tu zona'}</span> y aparecerás en trending.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">+100 XP por crear una nueva picada</Badge>
          </div>
        )}

        {/* Cards */}
        {intentPrioritizedTop.map((p, idx) => {
          const matchedIntentTag = intentMatchTag(p, activeIntent)
          const mapsHref = p.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`
          const interaction = interactions[p.id] || getUserInteraction(p.id, p.name)
          const voteCount = interaction?.picadaVotesCount || 0
          const hasVoted = interaction?.votedPicada || false
          const saved = interaction?.savedForLater || false
          const totalCommunity = (p.picadaReviews || 0) + voteCount
          const others = Math.max(0, totalCommunity - (hasVoted ? 1 : 0))
          const heatPct = Math.round((totalCommunity / maxCommunityVotes) * 100)
          const movement = movementById[p.id] || 0
          const urgencyCopy =
            movement > 0 ? 'Subiendo rápido 🔥'
              : movement < 0 ? 'Perdiendo fuerza'
                : idx > 15 ? 'Nueva en ranking'
                  : 'Manteniendo impulso'
          const topStyle =
            idx === 0 ? 'border-yellow-400 scale-[1.03]'
              : idx === 1 ? 'border-slate-400'
                : idx === 2 ? 'border-amber-600'
                  : ''
          return (
            <Card
              key={p.id}
              className={`overflow-hidden cursor-pointer group transition-all p-0 gap-0 ${topStyle}`}
              onClick={() => {
                trackTags(placeTagSlugs(p))
                const pseudo: Restaurant = {
                  id: `ext-${p.id}`,
                  name: p.name,
                  category: 'picada',
                  description: p.reviewsText?.[0] || p.address || 'Tendencia gastronómica',
                  address: p.address || '',
                  comuna: locationQuery || 'Zona',
                  lat: p.lat || -33.45,
                  lng: p.lng || -70.66,
                  rating: p.picadaRating || p.rating || 0,
                  reviewCount: p.picadaReviews || p.reviews || 0,
                  distance: 'cerca',
                  priceRange: 2,
                  tags: ['Tendencia'],
                  imageUrl: p.photoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                  starPlate: { name: 'Destacado del local', kcal: 0, protein: 0, carbs: 0, fat: 0 },
                  openNow: p.openNow ?? true,
                  mapsUrl: p.mapsUrl,
                  phone: p.phone || undefined,
                  website: p.website || undefined,
                  reviewsText: p.reviewsText || [],
                  gallery: p.photoUrl ? [p.photoUrl] : [],
                  coverageSparse: Boolean(p.coverageSparse),
                }
                onSelect(pseudo)
              }}
            >
              <div className="relative h-44 w-full bg-muted overflow-hidden">
                {p.photoUrl
                  ? <Image src={p.photoUrl} alt={p.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  : <div className="flex items-center justify-center h-full text-4xl">🍽️</div>}

                <div className="absolute top-2 left-2 right-10 flex flex-wrap gap-1.5">
                  <Badge className="bg-black/70 text-white border-0 text-xs">
                    #{idx + 1} ranking
                  </Badge>
                  {idx === 0 ? <Badge className="bg-yellow-500 text-black border-0">👑 #1 Picada</Badge> : null}
                  {idx === 1 ? <Badge className="bg-slate-500 text-white border-0">🥈 #2</Badge> : null}
                  {idx === 2 ? <Badge className="bg-amber-700 text-white border-0">🥉 #3</Badge> : null}
                  {p.openNow != null && (
                    <Badge className={`text-xs border-0 ${p.openNow ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                      {p.openNow ? 'Abierto' : 'Cerrado'}
                    </Badge>
                  )}
                </div>

                {/* Share button */}
                <button
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  aria-label={`Compartir ${p.name}`}
                  onClick={e => {
                    e.stopPropagation()
                    sharePicada({ picadaId: p.id, name: p.name, address: p.address, imageUrl: mapsHref, votes: totalCommunity }).catch(() => null)
                  }}
                >
                  <Share2 className="size-3.5 text-foreground" />
                </button>
              </div>

              <CardContent className="py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-semibold truncate">{p.name}</p>
                  <Badge variant="secondary" aria-label={`Rating ${(p.picadaRating || p.rating || 0).toFixed(1)}`}>
                    {(p.picadaRating || p.rating || 0).toFixed(1)} ★
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold text-orange-700">{urgencyCopy}</p>
                  {movement > 0 ? <span className="text-[10px] text-green-600 font-bold">↑ +{movement}</span> : null}
                  {movement < 0 ? <span className="text-[10px] text-red-600 font-bold">↓ {movement}</span> : null}
                </div>
                {activeIntent && matchedIntentTag ? (
                  <Badge variant="outline" className="text-[10px] w-fit border-orange-300 text-orange-700">
                    {activeIntent.badge}
                  </Badge>
                ) : null}
                {remoteRankById[p.id]?.trend_label ? (
                  <p className="text-[10px] font-semibold text-orange-700">
                    {remoteRankById[p.id]?.trend_label === 'top_week'
                      ? '🏆 Top de la semana'
                      : remoteRankById[p.id]?.trend_label === 'rising'
                        ? '⬆ Subiendo'
                        : '🔥 Trending'}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground line-clamp-1">{cleanAddress(p.address)}</p>
                {p.reviewsText?.[0] && (
                  <p className="text-xs text-muted-foreground line-clamp-2 italic">"{p.reviewsText[0]}"</p>
                )}
                <div className="space-y-2">
                  <p className="text-[11px] text-orange-600 font-semibold">
                    {totalCommunity > 0
                      ? (hasVoted
                        ? `Tú y ${others} usuarios más lo han votado como picada`
                        : `🔥 ${totalCommunity} usuarios lo votaron como picada`)
                      : `${p.reviews || 0} reseñas externas`}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className={`relative text-[10px] px-2.5 py-1.5 rounded-full border transition-all w-full ${
                        hasVoted
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-500 shadow-[0_0_16px_rgba(249,115,22,.45)]'
                          : 'text-orange-700 border-orange-300 bg-orange-100/40 opacity-70 hover:opacity-100'
                      }`}
                      aria-label={`${hasVoted ? 'Quitar voto de' : 'Votar como picada en'} ${p.name}`}
                      onClick={async e => {
                        e.stopPropagation()
                        setVotePulseById(prev => ({ ...prev, [p.id]: Date.now() }))
                        triggerTapHaptic(20)
                        triggerSuccessTone()
                        await votePicadaAction(p.id, p.name, { placeAddress: p.address, mapsUrl: mapsHref })
                      }}
                    >
                      <AnimatePresence>
                        {votePulseById[p.id] ? (
                          <motion.span
                            key={votePulseById[p.id]}
                            initial={{ opacity: 0, y: 6, scale: 0.85 }}
                            animate={{ opacity: 1, y: -16, scale: 1.05 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute -top-4 right-0 text-[10px] font-bold text-orange-500 pointer-events-none"
                          >
                            {hasVoted ? '-1' : '+1'} 🔥
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                      {hasVoted ? 'Quitar voto' : 'Votar como picada'}
                    </motion.button>
                    <button
                      className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-colors inline-flex items-center justify-center gap-1 w-full ${
                        saved
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'border-sky-300 text-sky-700 hover:bg-sky-50'
                      }`}
                      onClick={e => {
                        e.stopPropagation()
                        toggleVisitLaterAction(p.id, p.name)
                      }}
                    >
                      <BookmarkPlus className="size-3.5 shrink-0" />
                      {saved ? 'Guardado' : 'Visitar más tarde'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${heatPct < 35 ? 'bg-slate-400' : heatPct < 70 ? 'bg-orange-500' : 'bg-red-500'}`}
                        style={{ width: `${heatPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {displaySource && (
          <p className="text-[10px] text-muted-foreground text-center">Fuente: {displaySource}</p>
        )}
        </>
        )} {/* end ranking tab */}
      </div>
    </div>
  )
}
