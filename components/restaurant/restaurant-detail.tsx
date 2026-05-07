'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, MapPin, Clock, X, Camera, Flame, Trophy, Plus, Share2, Phone, MessageCircle, Navigation, Instagram, Music2, Sparkles, Heart, Play, Video, Edit3, Check, ThumbsDown } from 'lucide-react'
import { type Restaurant, CATEGORY_META, priceLabel } from '@/lib/places/restaurants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, proxyVideoUrl } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { MatchScore } from '@/components/restaurant/match-score'
import { loadPreferences } from '@/lib/feed/personalization'
import { computePlaceMatchScore } from '@/lib/places/match'
import { MenuCardDetail } from '@/components/restaurant/menu-card-detail'
import { grantPoints } from '@/lib/gamification/core'
import { XP_RULES } from '@/lib/gamification/standards'
import { XpChip } from '@/components/gamification/xp-chip'
import { useAppStore } from '@/lib/stores/app-store'
import { sharePicada } from '@/lib/social/share'
import { slugDisplayFromAutomatedSlug } from '@/lib/tags/display'
import { openUnifiedPostForm } from '@/lib/content/post-form-draft'
import { isPlaceSaved, loadCollections, removeFromCollection, updatePlaceNote } from '@/lib/social/collections'
import { toggleLike, hasLiked, getLikeCount, toggleFollow, isFollowing } from '@/lib/social/likes'
import { placeTextMatchesLocation } from '@/lib/location/query-match'
import type { SocialPost } from '@/app/api/social-feed/route'
import { triggerSuccessTone, triggerTapHaptic } from '@/lib/utils/device-feedback'
import { sanitizeUserText } from '@/lib/utils/sanitize'

// ─── Community post types & card ─────────────────────────────────────────────

type CommunityPost = {
  id: string
  username: string
  content?: string | null
  rating?: number | null
  type: 'review' | 'photo' | 'video'
  mediaUrl?: string | null
  tags?: string[]
  moods?: string[]
  createdAt: string
  anonymous?: boolean
}

function displayTagLabel(raw: string): string {
  const norm = String(raw || '').trim().toLowerCase()
  if (!norm) return ''
  return slugDisplayFromAutomatedSlug(norm).replace(/\s+/g, ' ').trim()
}

function mapSocialPostToCommunity(p: SocialPost): CommunityPost {
  const entry = (p.entry_type || '').toLowerCase()
  const isVideo = p.type === 'video' || entry.includes('reel')
  return {
    id: p.id,
    username: p.username,
    content: p.content,
    rating: p.rating,
    type: isVideo ? 'video' : p.media_url ? 'photo' : 'review',
    mediaUrl: p.media_url,
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    moods: Array.isArray(p.mood_tags) ? p.mood_tags.map(String) : [],
    createdAt: p.created_at,
    anonymous: false,
  }
}

function loadLocalCommunityPosts(placeName: string, fallbackUsername: string): CommunityPost[] {
  try {
    const raw = window.localStorage.getItem('picada.profile.social.v1')
    const data = raw ? JSON.parse(raw) : {}
    const username = String(data.username || fallbackUsername || 'foodie')
    const socialPosts = (data.socialPosts || []) as Array<{
      id: string
      type: string
      text: string
      place?: string
      imageDataUrl?: string
      rating?: number
      tags?: string[]
      moods?: string[]
      createdAt: string
    }>
    return socialPosts
      .filter(sp => placeTextMatchesLocation(sp.place || '', '', placeName))
      .map(sp => ({
        id: `local-${sp.id}`,
        username,
        content: sp.text,
        rating: sp.rating ?? null,
        type: sp.imageDataUrl?.startsWith('data:video')
          ? 'video'
          : sp.type === 'photo'
            ? 'photo'
            : 'review',
        mediaUrl: sp.imageDataUrl || null,
        tags: Array.isArray(sp.tags) ? sp.tags.map(String) : [],
        moods: Array.isArray(sp.moods) ? sp.moods.map(String) : [],
        createdAt: sp.createdAt,
        anonymous: false,
      }))
  } catch {
    return []
  }
}

const REVIEW_CLAMP = 180

function ExpandableText({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > REVIEW_CLAMP
  return (
    <p className={cn('text-sm leading-relaxed', className)}>
      {isLong && !expanded ? `${text.slice(0, REVIEW_CLAMP).trimEnd()}…` : text}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="ml-1.5 text-orange-600 font-semibold text-xs hover:underline whitespace-nowrap"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </p>
  )
}

function CommunityPostCard({ post, placeName }: { post: CommunityPost; placeName: string }) {
  const [liked, setLiked] = useState(() => hasLiked(post.id))
  const [likeCount, setLikeCount] = useState(() => getLikeCount(post.id))
  const [following, setFollowing] = useState(() => isFollowing(post.username))
  const isVideo = post.type === 'video' || (post.mediaUrl?.startsWith('data:video') ?? false)
  const displayName = post.anonymous ? 'Usuario anónimo' : `@${sanitizeUserText(post.username)}`
  const safePostContent = sanitizeUserText(post.content || '')
  const safePlaceName = sanitizeUserText(placeName)
  const detailTags = useMemo(
    () =>
      [...new Set([...(post.tags || []), ...(post.moods || [])].map(t => displayTagLabel(String(t || ''))).filter(Boolean))].slice(0, 12),
    [post.tags, post.moods],
  )

  const handleLike = () => {
    const result = toggleLike(post.id, likeCount)
    setLiked(result.liked)
    setLikeCount(result.count)
  }
  const handleFollow = () => setFollowing(toggleFollow(post.username))

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Hace ${Math.max(0, mins)} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Hace ${hrs} h`
    return `Hace ${Math.floor(hrs / 24)} d`
  }

  return (
    <div className="rounded-2xl border border-orange-100/80 bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-300 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {(post.anonymous ? '?' : post.username).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate">{displayName}</p>
            <p className="text-[10px] text-orange-600 font-medium flex items-center gap-0.5">
              <MapPin className="size-2.5 shrink-0" />{safePlaceName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-[10px] text-muted-foreground">{timeAgo(post.createdAt)}</p>
          {!post.anonymous ? (
            <button
              type="button"
              onClick={handleFollow}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                following
                  ? 'bg-orange-50 border-orange-200 text-orange-700'
                  : 'bg-background border-border text-foreground hover:bg-orange-50'
              }`}
            >
              {following ? '✓ Siguiendo' : '+ Seguir'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Media */}
      {post.mediaUrl && String(post.mediaUrl).trim() ? (
        <div className="relative bg-black">
          {isVideo ? (
            <div className="relative aspect-video">
              <video
                src={proxyVideoUrl(String(post.mediaUrl).trim()) ?? String(post.mediaUrl).trim()}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>
          ) : String(post.mediaUrl).startsWith('data:') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(post.mediaUrl).trim()} alt="" className="w-full max-h-72 object-cover" />
          ) : (
            <div className="relative aspect-video">
              <Image src={String(post.mediaUrl).trim()} alt="" fill className="object-cover" sizes="100vw" />
            </div>
          )}
        </div>
      ) : null}

      {/* Actions */}
      <div className="px-3 pt-2.5 pb-1 flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.82 }}
          onClick={handleLike}
          className="flex items-center gap-1.5"
          aria-label="Me gusta"
        >
          <Heart className={`size-5 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-foreground/70'}`} />
          <span className="text-xs font-medium">{likeCount}</span>
        </motion.button>
        <button
          type="button"
          onClick={async () => {
            if (navigator.share) {
              await navigator.share({ title: `${safePlaceName} en Picada`, text: safePostContent }).catch(() => null)
            }
          }}
          className="flex items-center gap-1 text-foreground/70"
          aria-label="Compartir"
        >
          <Share2 className="size-4.5" />
        </button>
        {post.rating ? (
          <div className="ml-auto flex items-center gap-0.5">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`size-3.5 ${n <= (post.rating ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
            ))}
          </div>
        ) : null}
      </div>

      {/* Content */}
      {(safePostContent || detailTags.length > 0) ? (
        <div className="px-3 pb-3 space-y-2">
          {safePostContent ? <p className="text-sm leading-relaxed text-foreground/90">{safePostContent}</p> : null}
          {detailTags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {detailTags.map(tag => (
                <span key={tag} className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ─── Main props ───────────────────────────────────────────────────────────────

interface RestaurantDetailProps {
  restaurant: Restaurant
  onClose: () => void
  onAddReview: () => void
  onAddPhoto: () => void
  onPickerOpen?: () => void
}

export function RestaurantDetail({ restaurant: r, onClose, onAddReview, onAddPhoto, onPickerOpen }: RestaurantDetailProps) {
  const meta = CATEGORY_META[r.category] ?? CATEGORY_META.picada
  const [tab, setTab] = useState<'info' | 'catalog' | 'reviews' | 'photos'>('reviews')
  const [menuItems, setMenuItems] = useState<Array<{ id: string; item_name: string; rating?: number; review_text?: string; photo_url?: string | null; nutrition?: Record<string, number | string>; is_official?: boolean; metadata?: Record<string, unknown>; created_at?: string }>>([])
  const [menuSummary, setMenuSummary] = useState<Array<{
    item_name: string
    avg_rating: number
    avg_kcal_ai: number
    avg_kcal_user: number
    top_photo_url: string | null
    top_photo_item_id: string | null
    entries: Array<{ id: string; review_text?: string; rating?: number; photo_url?: string | null; nutrition?: Record<string, number | string>; is_official?: boolean }>
  }>>([])
  const [communityPhotos, setCommunityPhotos] = useState<string[]>([])
  const [communityReviews, setCommunityReviews] = useState<
    Array<{ text: string; rating?: number; photoUrl?: string | null; author?: string; createdAt?: string; tags?: string[] }>
  >([])
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [heroSlide, setHeroSlide] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSummary, setSelectedSummary] = useState<{
    item_name: string
    avg_rating: number
    avg_kcal_ai: number
    avg_kcal_user: number
    top_photo_url: string | null
    entries: Array<{ id: string; review_text?: string; rating?: number; photo_url?: string | null; nutrition?: Record<string, number | string>; is_official?: boolean }>
  } | null>(null)
  const [socialPulse, setSocialPulse] = useState<{ pending_count: number; top_expert: { user: string; reviews: number } | null }>({ pending_count: 0, top_expert: null })
  const [tagVotes, setTagVotes] = useState<Record<string, number>>({})
  const [addingTag, setAddingTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [tagVotedByUser, setTagVotedByUser] = useState<Record<string, boolean>>({})
  const [quickRating, setQuickRating] = useState(0)
  const [quickRated, setQuickRated] = useState(false)
  const [savedToCollection, setSavedToCollection] = useState(false)
  const [savedCollectionIds, setSavedCollectionIds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [picadaBurst, setPicadaBurst] = useState(false)
  const [automatedSeedFeedback, setAutomatedSeedFeedback] = useState<
    Record<string, 'confirmed' | 'rejected'>
  >({})
  const [seedFeedbackBusy, setSeedFeedbackBusy] = useState<string | null>(null)
  const social = useAppStore(s => s.interactions[r.id.replace(/^ext-/, '')])
  const refreshInteraction = useAppStore(s => s.refreshInteraction)
  const votePicadaAction = useAppStore(s => s.votePicada)
  const toggleVisitLaterAction = useAppStore(s => s.toggleVisitLater)
  const prefs = typeof window !== 'undefined' ? loadPreferences() : { likes: [], restrictions: [], dislikes: [] }
  const match = computePlaceMatchScore({
    user: prefs,
    placeName: r.name,
    placeAddress: `${r.address} ${r.tags.join(' ')}`,
  })

  const sendAutomatedSeedFeedback = useCallback(
    async (slug: string, action: 'confirm' | 'reject') => {
      if (!r.placeExternalId || seedFeedbackBusy) return
      setSeedFeedbackBusy(slug)
      try {
        const res = await fetch('/api/places/tag-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ externalId: r.placeExternalId, slug, action }),
        })
        if (res.ok) {
          setAutomatedSeedFeedback(prev => ({
            ...prev,
            [slug]: action === 'confirm' ? 'confirmed' : 'rejected',
          }))
          grantPoints(XP_RULES.tagVote)
        }
      } catch {
        /* ignore */
      } finally {
        setSeedFeedbackBusy(null)
      }
    },
    [r.placeExternalId, seedFeedbackBusy],
  )

  useEffect(() => {
    const loadCommunity = () => {
    fetch(`/api/menu-items?place_name=${encodeURIComponent(r.name)}`)
      .then(res => (res.ok ? res.json() : { items: [] }))
      .then((data: {
        items?: Array<{ id: string; item_name: string; rating?: number; review_text?: string; photo_url?: string | null; nutrition?: Record<string, number | string>; is_official?: boolean; metadata?: Record<string, unknown>; created_at?: string }>
        summary?: Array<{
          item_name: string
          avg_rating: number
          avg_kcal_ai: number
          avg_kcal_user: number
          top_photo_url: string | null
          top_photo_item_id: string | null
          entries: Array<{ id: string; review_text?: string; rating?: number; photo_url?: string | null; nutrition?: Record<string, number | string>; is_official?: boolean }>
        }>
      }) => {
        const items = data.items || []
        setMenuItems(items)
        setMenuSummary(data.summary || [])
        setCommunityPhotos(items.map(i => i.photo_url).filter(Boolean) as string[])
        setCommunityReviews(
          items
            .map(i => ({
              text: i.review_text || '',
              rating: i.rating,
              photoUrl: i.photo_url || null,
              author: String((i.metadata?.display_name as string) || ''),
              createdAt: i.created_at,
              tags: Array.isArray(i.metadata?.tags) ? (i.metadata?.tags as string[]).map(String) : [],
            }))
            .filter(
              i =>
                i.text.trim().length > 0 ||
                (i.rating != null && Number(i.rating) > 0) ||
                Boolean(i.photoUrl),
            ),
        )
      })
      .catch(() => {
        setMenuItems([])
        setMenuSummary([])
        setCommunityPhotos([])
        setCommunityReviews([])
      })
    }

    loadCommunity()

    fetch(`/api/social?place_name=${encodeURIComponent(r.name)}`)
      .then(res => (res.ok ? res.json() : { pending_count: 0, top_expert: null }))
      .then((data: { pending_count?: number; top_expert?: { user: string; reviews: number } | null }) => {
        setSocialPulse({ pending_count: data.pending_count || 0, top_expert: data.top_expert || null })
      })
      .catch(() => setSocialPulse({ pending_count: 0, top_expert: null }))

    const refresh = () => loadCommunity()
    window.addEventListener('picada:menu-items-updated', refresh)
    return () => window.removeEventListener('picada:menu-items-updated', refresh)
  }, [r.name])

  useEffect(() => {
    let cancelled = false
    const loadSocial = async () => {
      let remote: SocialPost[] = []
      try {
        const res = await fetch(`/api/social-feed?place=${encodeURIComponent(r.name)}&limit=90`)
        if (res.ok) {
          const data = (await res.json()) as { posts: SocialPost[] }
          remote = data.posts || []
        }
      } catch {
        /* ignore */
      }
      const mappedRemote = remote.map(mapSocialPostToCommunity)
      const mappedLocal = typeof window !== 'undefined' ? loadLocalCommunityPosts(r.name, '') : []
      const map = new Map<string, CommunityPost>()
      mappedLocal.forEach(p => map.set(p.id, p))
      mappedRemote.forEach(p => map.set(p.id, p))
      const merged = [...map.values()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      if (!cancelled) setCommunityPosts(merged)
    }
    void loadSocial()
    const onPub = () => void loadSocial()
    window.addEventListener('picada:review-published', onPub)
    return () => {
      cancelled = true
      window.removeEventListener('picada:review-published', onPub)
    }
  }, [r.name])

  const heroSlides = useMemo(() => {
    const urls: string[] = []
    const add = (u?: string | null) => {
      const s = typeof u === 'string' ? u.trim() : ''
      if (!s || urls.includes(s)) return
      if (s.startsWith('data:video')) return
      urls.push(s)
    }
    // Prioridad: comunidad > fotos de Google/cache.
    communityPosts.forEach(p => {
      if (p.type !== 'video') add(p.mediaUrl)
    })
    communityPhotos.forEach(add)
    ;(r.gallery || []).forEach(add)
    add(r.imageUrl)
    if (urls.length) return urls
    const fb = typeof r.imageUrl === 'string' ? r.imageUrl.trim() : ''
    return fb ? [fb] : []
  }, [r.gallery, r.imageUrl, communityPosts, communityPhotos])

  useEffect(() => {
    setHeroSlide(0)
  }, [heroSlides.join('|')])

  useEffect(() => {
    if (heroSlides.length <= 1 || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => {
      setHeroSlide(i => (i + 1) % heroSlides.length)
    }, 3800)
    return () => window.clearInterval(t)
  }, [heroSlides])

  const reelPosts = useMemo(() => communityPosts.filter(p => p.type === 'video'), [communityPosts])
  const photoFeedPosts = useMemo(() => communityPosts.filter(p => p.type !== 'video'), [communityPosts])
  const googleFallbackReviews = useMemo<
    Array<{ text: string; rating?: number; photoUrl?: string | null; author?: string; createdAt?: string; tags?: string[] }>
  >(
    () => (r.reviewsText || []).map(text => ({ text, rating: r.rating || undefined, author: 'Google Maps' })),
    [r.reviewsText, r.rating],
  )
  const reviewsForDisplay = communityReviews.length > 0 ? communityReviews : googleFallbackReviews

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = `picada.place.tagvotes.${r.id}`
    const votedKey = `picada.place.tagvotes.user.${r.id}`
    const base: Record<string, number> = {}
    for (const t of r.tags || []) base[t] = Math.max(base[t] || 0, 1)
    try {
      const raw = window.localStorage.getItem(key)
      const votedRaw = window.localStorage.getItem(votedKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>
        setTagVotes({ ...base, ...parsed })
      } else {
        setTagVotes(base)
      }
      setTagVotedByUser(votedRaw ? JSON.parse(votedRaw) as Record<string, boolean> : {})
    } catch {
      setTagVotes(base)
      setTagVotedByUser({})
    }
  }, [r.id, r.tags])

  useEffect(() => {
    const idKey = r.id.replace(/^ext-/, '')
    refreshInteraction(idKey, r.name)
  }, [r.id, r.name, refreshInteraction])

  const normalizeWhatsappNumber = (input?: string | null) => {
    const digits = String(input || '').replace(/\D/g, '').replace(/^0+/, '')
    if (!digits) return ''
    if (digits.startsWith('56')) return digits
    if (digits.length === 9 && digits.startsWith('9')) return `56${digits}`
    return digits
  }
  const cleanPhone = (r.phone || '').replace(/[^\d+]/g, '')
  const whatsappPhone = normalizeWhatsappNumber(r.phone)
  const waMessage = encodeURIComponent(`¡Hola! Vengo de Picada 🔥, una app gastronómica. Tengo una consulta sobre ${r.name}.`)
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${waMessage}`
    : null
  const mapsHref = r.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address}`)}`
  const tagSuggestions = [
    'Familiar', 'Chill', 'Romántico', 'Ruidoso', 'Terraza',
    'Casual', 'Formal', 'Sport-elegante',
    'Picada', 'Premium', 'Café', 'Sushi', 'Parrilla',
    'Vegano', 'Vegetariano', 'Keto', 'Sin lactosa', 'Sin gluten',
  ]
  const sectionTags = {
    ambiente: ['Familiar', 'Chill', 'Romántico', 'Ruidoso', 'Terraza'],
    dresscode: ['Casual', 'Formal', 'Sport-elegante'],
    comida: ['Picada', 'Premium', 'Café', 'Sushi', 'Parrilla', 'Vegano', 'Vegetariano', 'Keto', 'Sin lactosa', 'Sin gluten'],
  } as const

  const handleQuickRate = (stars: number) => {
    if (quickRated) return
    setQuickRating(stars)
    setQuickRated(true)
    onClose()
    openUnifiedPostForm({
      type: 'review',
      mode: 'rating_quick',
      place: {
        id: r.id,
        name: r.name,
        address: r.address,
        rating: r.rating,
        photoUrl: r.imageUrl,
        coverageSparse: r.coverageSparse,
      },
      review: { rating: stars, comment: 'calificación rápida' },
      taxonomy: { category: 'experiencia', tags: ['quick_rating'], moods: [] },
    })
  }

  useEffect(() => {
    const loadSavedState = () => {
      const idKey = r.id.replace(/^ext-/, '')
      const ids = isPlaceSaved(idKey)
      setSavedCollectionIds(ids)
      setSavedToCollection(ids.length > 0)
      const collection = loadCollections().find(c => c.places.some(p => p.placeId === idKey))
      const place = collection?.places.find(p => p.placeId === idKey)
      setNote(place?.note || '')
    }
    loadSavedState()
    const onUpdated = () => loadSavedState()
    window.addEventListener('picada:collection-updated', onUpdated)
    return () => window.removeEventListener('picada:collection-updated', onUpdated)
  }, [r.id])

  useEffect(() => {
    if (!savedToCollection) return
    const t = window.setTimeout(() => {
      const idKey = r.id.replace(/^ext-/, '')
      updatePlaceNote(idKey, note)
    }, 1000)
    return () => window.clearTimeout(t)
  }, [note, r.id, savedToCollection])

  const voteTag = (label: string) => {
    if (tagVotedByUser[label]) return
    setTagVotes(prev => {
      const next = { ...prev, [label]: (prev[label] || 0) + 1 }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`picada.place.tagvotes.${r.id}`, JSON.stringify(next))
      }
      return next
    })
    setTagVotedByUser(prev => {
      const next = { ...prev, [label]: true }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`picada.place.tagvotes.user.${r.id}`, JSON.stringify(next))
      }
      return next
    })
    grantPoints(Math.round(XP_RULES.tagVote * (r.coverageSparse ? 2 : 1)))
  }

  const handleTogglePicadaVote = async () => {
    const idKey = r.id.replace(/^ext-/, '')
    triggerTapHaptic(20)
    triggerSuccessTone()
    await votePicadaAction(idKey, r.name, { placeAddress: r.address, mapsUrl: r.mapsUrl })
  }

  const handleToggleVisitLater = () => {
    const idKey = r.id.replace(/^ext-/, '')
    toggleVisitLaterAction(idKey, r.name)
  }

  const votedPicada = social?.votedPicada || false
  const picadaVotesCount = social?.picadaVotesCount || 0
  const savedForLater = social?.savedForLater || false
  const savedCollections = useMemo(() => {
    const idKey = r.id.replace(/^ext-/, '')
    return loadCollections().filter(c => c.places.some(p => p.placeId === idKey))
  }, [savedCollectionIds, r.id])

  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className="pb-8">
        {/* Foto hero — carrusel comunitario (solo imágenes; sin vídeo para mantener el feed liviano) */}
        <div className="relative w-full h-56 bg-muted">
          <AnimatePresence mode="wait">
            <motion.div
              key={heroSlides[heroSlide] || 'hero-empty'}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.85 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              {(() => {
                const src = (heroSlides[heroSlide] || r.imageUrl || '').trim()
                if (!src) {
                  return <div className="h-full w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">Sin foto aún</div>
                }
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" />
                )
              })()}
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {heroSlides.length > 1 ? (
            <div className="absolute bottom-[5.25rem] left-1/2 z-10 flex -translate-x-1/2 gap-1.5 pointer-events-auto">
              {heroSlides.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  type="button"
                  aria-label={`Ver foto ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === heroSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/75',
                  )}
                  onClick={() => setHeroSlide(i)}
                />
              ))}
            </div>
          ) : null}

          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute top-4 right-4 rounded-full bg-white/90 hover:bg-white size-8"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn('border-0 text-xs', meta.color)}>
                {meta.emoji} {meta.label}
              </Badge>
              <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
                {priceLabel(r.priceRange)}
              </Badge>
            </div>
            <h2 className="text-2xl font-extrabold leading-tight">{r.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-white/80 text-sm">
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-yellow-400 stroke-none" />
                <span className="font-bold text-white">{r.rating}</span>
                <span>({r.reviewCount} reseñas)</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-none">
              <Button size="sm" variant="secondary" className="bg-black/55 text-white border-0 shrink-0" asChild>
                <a href={mapsHref} target="_blank" rel="noreferrer" aria-label="Ir a ubicación">
                  <Navigation className="size-3.5 mr-1" />
                  Ir
                </a>
              </Button>
              {cleanPhone ? (
                <Button size="sm" variant="secondary" className="bg-black/55 text-white border-0 shrink-0" asChild>
                  <a href={`tel:${cleanPhone}`} aria-label="Llamar">
                    <Phone className="size-3.5 mr-1" />
                    Llamar
                  </a>
                </Button>
              ) : null}
              {whatsappHref ? (
                <Button size="sm" variant="secondary" className="bg-black/55 text-white border-0 shrink-0" asChild>
                  <a href={whatsappHref} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${r.name}`}>
                    <MessageCircle className="size-3.5 mr-1" />
                    WhatsApp
                  </a>
                </Button>
              ) : null}
              {r.instagram ? (
                <Button size="sm" variant="secondary" className="bg-black/55 text-white border-0 shrink-0" asChild>
                  <a href={r.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                    <Instagram className="size-3.5 mr-1" />
                    Instagram
                  </a>
                </Button>
              ) : null}
              {r.tiktok ? (
                <Button size="sm" variant="secondary" className="bg-black/55 text-white border-0 shrink-0" asChild>
                  <a href={r.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok">
                    <Music2 className="size-3.5 mr-1" />
                    TikTok
                  </a>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                className="bg-black/55 text-white border-0 shrink-0"
                onClick={async () => {
                  await sharePicada({
                    picadaId: r.id,
                    name: r.name,
                    address: r.address,
                    imageUrl: mapsHref,
                    votes: picadaVotesCount,
                  })
                }}
                aria-label="Compartir local"
              >
                <Share2 className="size-3.5 mr-1" />
                Compartir
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-8 space-y-4">
          {/* Address + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-muted-foreground min-w-0">
              <MapPin className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium">{r.address}</p>
                <p className="text-xs">{r.comuna} · {r.distance}</p>
              </div>
            </div>
            <Badge
              variant={r.openNow ? 'default' : 'secondary'}
              className={cn('shrink-0', r.openNow && 'bg-green-600 hover:bg-green-600')}
            >
              <Clock className="size-3" />
              {r.openNow ? 'Abierto' : 'Cerrado'}
            </Badge>
          </div>

          {/* 4-action bar */}
          <div className="grid grid-cols-4 gap-2">
            {/* Reseña */}
            <button
              onClick={onAddReview}
              className="flex flex-col items-center gap-1.5 rounded-xl border bg-muted/40 px-1 pt-3 pb-2.5 hover:bg-orange-50 hover:border-orange-200 active:scale-95 transition-all"
            >
              <div className="size-9 rounded-full bg-orange-100 flex items-center justify-center">
                <Edit3 className="size-4 text-orange-600" />
              </div>
              <span className="text-[10px] font-bold leading-tight">Reseña</span>
              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 leading-none">
                hasta +{Math.round(XP_RULES.reviewWithPhoto * (r.coverageSparse ? 2 : 1))} XP{r.coverageSparse ? ' 🔥' : ''}
              </span>
            </button>

            {/* Foto */}
            <button
              onClick={onAddPhoto}
              className="flex flex-col items-center gap-1.5 rounded-xl border bg-muted/40 px-1 pt-3 pb-2.5 hover:bg-violet-50 hover:border-violet-200 active:scale-95 transition-all"
            >
              <div className="size-9 rounded-full bg-violet-100 flex items-center justify-center">
                <Camera className="size-4 text-violet-600" />
              </div>
              <span className="text-[10px] font-bold leading-tight">Foto</span>
              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 leading-none">
                +{Math.round(XP_RULES.photoOnly * (r.coverageSparse ? 2 : 1))} XP{r.coverageSparse ? ' 🔥' : ''}
              </span>
            </button>

            {/* Picada vote — botón principal de la app */}
            <motion.button
              onClick={async () => {
                const before = votedPicada
                await handleTogglePicadaVote()
                if (!before) {
                  setPicadaBurst(true)
                  window.setTimeout(() => setPicadaBurst(false), 600)
                }
              }}
              whileTap={{ scale: 0.84 }}
              className={cn(
                'relative flex flex-col items-center gap-1.5 rounded-xl px-1 pt-3 pb-2.5 overflow-hidden transition-all',
                votedPicada
                  ? 'bg-gradient-to-b from-red-500 to-orange-500 border border-red-400 shadow-[0_4px_16px_rgba(220,38,38,0.45)]'
                  : 'bg-red-600 border border-red-700 shadow-[0_4px_18px_rgba(220,38,38,0.55)]',
              )}
            >
              {/* Pulsing ring when not yet voted */}
              {!votedPicada && (
                <span
                  className="pointer-events-none absolute inset-0 rounded-xl border-2 border-red-300 animate-ping opacity-60"
                  style={{ animationDuration: '1.8s' }}
                />
              )}
              {/* Burst flash on first vote */}
              <AnimatePresence>
                {picadaBurst && (
                  <motion.span
                    key="burst"
                    className="absolute inset-0 rounded-xl bg-white pointer-events-none z-10"
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: 0 }}
                    exit={{}}
                    transition={{ duration: 0.5 }}
                  />
                )}
              </AnimatePresence>
              <div className="size-9 rounded-full bg-white/20 flex items-center justify-center relative z-[1]">
                <Flame className="size-4 text-white" />
              </div>
              <span className="text-[10px] font-bold leading-tight text-white relative z-[1]">
                {votedPicada ? '¡Picada!' : 'Picada'}
              </span>
              {!votedPicada ? (
                <span className="text-[9px] font-bold text-white/80 bg-white/15 rounded-full px-1.5 py-0.5 leading-none relative z-[1]">
                  +{XP_RULES.picadaVote} XP
                </span>
              ) : (
                <span className="text-[9px] font-bold text-white/80 leading-none relative z-[1]">✓ Votado</span>
              )}
            </motion.button>

            {/* Guardar */}
            <button
              onClick={() => onPickerOpen?.()}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-1 pt-3 pb-2.5 active:scale-95 transition-all',
                savedToCollection ? 'bg-rose-50 border-rose-300' : 'bg-muted/40 hover:bg-rose-50 hover:border-rose-200',
              )}
            >
              <div className={cn('size-9 rounded-full flex items-center justify-center', savedToCollection ? 'bg-rose-200' : 'bg-rose-100')}>
                <Heart className={cn('size-4', savedToCollection ? 'fill-rose-600 text-rose-600' : 'text-rose-400')} />
              </div>
              <span className="text-[10px] font-bold leading-tight">{savedToCollection ? 'Guardado' : 'Guardar'}</span>
              <span className="text-[9px] text-muted-foreground leading-none">{savedToCollection ? '✓' : 'lista'}</span>
            </button>
          </div>

          {/* Quick star rating — below action bar, always visible */}
          {!quickRated ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-900">¿Cómo lo calificas? Toca una estrella</p>
                <XpChip value={XP_RULES.quickReview} subtle />
              </div>
              <div className="flex items-center gap-1" role="group" aria-label="Calificación rápida">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => handleQuickRate(n)} aria-label={`${n} estrellas`} className="transition-transform active:scale-90">
                    <Star className={`size-7 transition-colors ${n <= quickRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
              <span className="text-green-600">✓</span>
              <p className="text-xs font-semibold text-green-700">¡Gracias por calificar!</p>
              <XpChip value={XP_RULES.quickReview} className="ml-auto" />
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="tablist">
            {([['reviews', 'Reseñas'], ['photos', 'Fotos'], ['info', 'Info'], ['catalog', 'Menú']] as const).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors',
                  tab === k
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border bg-muted/40 hover:border-orange-200 hover:bg-orange-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Reseñas ── */}
          {tab === 'reviews' && (
            <div className="space-y-3">

              {/* Community reels */}
              {reelPosts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Video className="size-3.5 text-violet-600" />Reels
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-0.5 px-0.5">
                    {reelPosts.map(post => (
                      <div key={post.id} className="min-w-[min(100%,280px)] max-w-[280px] shrink-0">
                        <CommunityPostCard post={post} placeName={r.name} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Community photo+review posts */}
              {photoFeedPosts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Camera className="size-3.5 text-orange-600" />Comunidad
                  </p>
                  <div className="space-y-3">
                    {photoFeedPosts.map(post => (
                      <CommunityPostCard key={post.id} post={post} placeName={r.name} />
                    ))}
                  </div>
                </div>
              )}

              {/* Text reviews (DB or Google fallback) */}
              {communityPosts.length === 0 && reviewsForDisplay.length === 0 && (
                <div className="rounded-xl bg-orange-500/10 border border-orange-300 p-4 text-center space-y-2">
                  <Flame className="size-6 text-orange-500 mx-auto" />
                  <p className="font-semibold text-sm">Sé el primero en dejar fuego</p>
                  <p className="text-xs text-muted-foreground">
                    {r.coverageSparse ? 'Poca cobertura en Google — foto o reseña vale el doble de XP.' : 'Agrega una reseña o foto y ayudas a toda la comunidad.'}
                  </p>
                </div>
              )}
              {communityPosts.length === 0 && reviewsForDisplay.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reseñas</p>
                  {reviewsForDisplay.slice(0, 10).map((review, idx) => (
                    <div key={idx} className="rounded-xl border p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {review.author ? `${review.author === 'Google Maps' ? '' : '@'}${sanitizeUserText(review.author)}` : 'Usuario'}
                        </p>
                        {review.rating ? (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star key={n} className={`size-3 ${n <= review.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {sanitizeUserText(review.text).trim() && <ExpandableText text={sanitizeUserText(review.text)} />}
                      {review.tags && review.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {review.tags.slice(0, 8).map(tag => (
                            <span key={`${review.createdAt || idx}-${tag}`} className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                              {displayTagLabel(tag)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {review.photoUrl && String(review.photoUrl).trim() ? (
                        <img src={String(review.photoUrl).trim()} alt="reseña" className="mt-1 h-36 w-full object-cover rounded-lg" />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Fotos ── */}
          {tab === 'photos' && (
            <div className="space-y-3">
              {r.coverageSparse && (
                <p className="text-[11px] rounded-lg border border-orange-200 bg-orange-500/10 px-3 py-2 text-center text-orange-900 dark:text-orange-100">
                  🔥 Fuego: poca foto en Google — la primera foto vale el doble de XP.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-10" onClick={onAddPhoto}>
                  <Camera className="size-4 mr-1.5" />Foto
                  <XpChip value={Math.round(XP_RULES.photoOnly * (r.coverageSparse ? 2 : 1))} subtle className="ml-1 border-white/40 bg-white/15 text-white" />
                </Button>
                <Button className="h-10" variant="outline" onClick={onAddPhoto}>
                  <Sparkles className="size-4 mr-1.5" />Foto + reseña
                  <XpChip value={Math.round(XP_RULES.photoPlusReview * (r.coverageSparse ? 2 : 1))} className="ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from(
                  new Set(
                    [...(r.gallery || []), r.imageUrl, ...communityPhotos]
                      .map(p => (typeof p === 'string' ? p.trim() : ''))
                      .filter(p => p.length > 0),
                  ),
                )
                  .slice(0, 12)
                  .map((photo, idx) => (
                  <button
                    key={`${photo}-${idx}`}
                    type="button"
                    className="rounded-xl overflow-hidden bg-muted border aspect-square"
                    onClick={() => setPhotoPreview(photo)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={`foto-${idx}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Info ── */}
          {tab === 'info' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{sanitizeUserText(r.description)}</p>
              <MatchScore score={match.score} reason={match.reasons[0]} />

              {/* Picada vote */}
              <div className="rounded-xl border p-3 space-y-2">
                <p className="text-sm font-bold">¿Lo recomendarías como picada?</p>
                <Button
                  className={cn('h-12 w-full rounded-2xl font-bold', votedPicada ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' : 'bg-orange-50 text-orange-700 border border-orange-300')}
                  onClick={handleTogglePicadaVote}
                >
                  🔥 {votedPicada ? '¡Es una Picada!' : 'Votar como Picada'} · {picadaVotesCount} votos
                </Button>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full transition-all', picadaVotesCount >= 20 ? 'bg-red-500' : picadaVotesCount >= 10 ? 'bg-orange-500' : 'bg-orange-300')}
                    style={{ width: `${Math.min(100, (picadaVotesCount / 20) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {picadaVotesCount >= 6 ? 'Ganando popularidad' : 'Aún poco conocido — descúbrelo'} · {savedCollections.length} lo guardaron
                </p>
              </div>

              {/* Social pulse */}
              {(socialPulse.pending_count > 0 || socialPulse.top_expert) && (
                <div className="space-y-1">
                  <p className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                    <Flame className="size-3.5" />{socialPulse.pending_count}+ personas lo tienen en pendientes
                  </p>
                  {socialPulse.top_expert && (
                    <p className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                      <Trophy className="size-3.5" />@{socialPulse.top_expert.user} es experto ({socialPulse.top_expert.reviews} reseñas)
                    </p>
                  )}
                </div>
              )}

              {/* Clasificación inicial IA (refinable por comunidad) */}
              {r.automatedSeedTags && r.automatedSeedTags.some(s => s.is_automated !== false) && (
                <div className="rounded-xl border border-dashed border-violet-200 bg-violet-500/5 p-3 space-y-2">
                  <p className="text-xs font-semibold text-violet-800 dark:text-violet-200 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 shrink-0" />
                    Clasificación inicial (IA)
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Estas etiquetas ayudan a encontrar el local. Si algo no calza, corrígelo: la comunidad tiene prioridad.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.automatedSeedTags
                      .filter(s => s.is_automated !== false)
                      .map(seed => {
                        const label = slugDisplayFromAutomatedSlug(seed.slug)
                        const state = automatedSeedFeedback[seed.slug]
                        const busy = seedFeedbackBusy === seed.slug
                        return (
                          <div
                            key={seed.slug}
                            className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-2 py-1 text-[11px]"
                          >
                            <span className="font-medium">{label}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {Math.round(seed.confidence_score * 100)}%
                            </span>
                            {state === 'confirmed' ? (
                              <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                <Check className="size-3" /> Ok
                              </span>
                            ) : state === 'rejected' ? (
                              <span className="text-amber-700 font-medium">corregido</span>
                            ) : r.placeExternalId ? (
                              <span className="inline-flex items-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="rounded-full p-0.5 hover:bg-emerald-100 text-emerald-700 disabled:opacity-40"
                                  title="Confirmar etiqueta"
                                  onClick={() => void sendAutomatedSeedFeedback(seed.slug, 'confirm')}
                                >
                                  <Check className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="rounded-full p-0.5 hover:bg-amber-100 text-amber-800 disabled:opacity-40"
                                  title="Esta etiqueta no aplica"
                                  onClick={() => void sendAutomatedSeedFeedback(seed.slug, 'reject')}
                                >
                                  <ThumbsDown className="size-3.5" />
                                </button>
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="space-y-3 rounded-xl border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Características</p>
                {(['ambiente', 'dresscode', 'comida'] as const).map(section => (
                  <div key={section}>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                      {section === 'dresscode' ? 'Vestimenta' : section === 'comida' ? 'Comida y dieta' : 'Ambiente'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sectionTags[section].map(label => (
                        <button
                          key={label}
                          type="button"
                          disabled={!!tagVotedByUser[label]}
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-55"
                          onClick={() => voteTag(label)}
                        >
                          <span>{label}</span>
                          <span className="text-muted-foreground">({tagVotes[label] || 0})</span>
                          <XpChip value={XP_RULES.tagVote} />
                        </button>
                      ))}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs"
                        onClick={() => setAddingTag(v => !v)}
                      >
                        <Plus className="size-3" />Agregar
                      </button>
                    </div>
                  </div>
                ))}
                {addingTag && (
                  <div className="flex items-center gap-2">
                    <input
                      list={`tag-suggestions-${r.id}`}
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      placeholder="Ej: Familiar, Chill, Vegano..."
                      className="h-9 flex-1 rounded-md border px-2 text-xs"
                    />
                    <datalist id={`tag-suggestions-${r.id}`}>
                      {tagSuggestions.map(s => <option value={s} key={s} />)}
                    </datalist>
                    <Button size="sm" onClick={() => { const l = newTag.trim(); if (!l) return; voteTag(l); setNewTag('') }}>
                      <XpChip value={XP_RULES.tagVote} />
                    </Button>
                  </div>
                )}
              </div>

              {/* Saved collections + notes */}
              {savedCollections.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {savedCollections.map(col => (
                    <span key={col.id} className="h-6 px-2 text-[10px] rounded-full border inline-flex items-center gap-1">
                      {col.emoji} {col.name}
                      <button type="button" onClick={() => removeFromCollection(col.id, r.id.replace(/^ext-/, ''))} className="text-muted-foreground">×</button>
                    </span>
                  ))}
                </div>
              )}
              {savedToCollection && (
                <div className="rounded-xl border p-3 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mis notas</p>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Ej: Preguntar por el menú del día, llegar antes de las 13h"
                    className="w-full min-h-[76px] rounded-lg border p-2 text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Menú ── */}
          {tab === 'catalog' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catálogo comunitario</p>
              {menuSummary.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aún no hay platos subidos por la comunidad.</p>
              ) : (
                menuSummary.slice(0, 12).map((item, idx) => (
                  <div key={`${item.item_name}-${idx}`} className="rounded-xl border p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{item.item_name}</p>
                      <Badge variant="outline">{item.avg_rating}/5</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">IA: {item.avg_kcal_ai || 0}kcal · Usuarios: {item.avg_kcal_user || 0}kcal</p>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedSummary(item); setDetailOpen(true) }}>
                      Ver detalle
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      {selectedSummary ? (
        <MenuCardDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          itemName={selectedSummary.item_name}
          topPhoto={selectedSummary.top_photo_url}
          avgRating={selectedSummary.avg_rating}
          avgKcalAi={selectedSummary.avg_kcal_ai}
          avgKcalUser={selectedSummary.avg_kcal_user}
          entries={selectedSummary.entries}
        />
      ) : null}
      <Dialog open={!!photoPreview} onOpenChange={open => !open && setPhotoPreview(null)}>
        <DialogContent className="max-w-3xl p-2" showCloseButton>
          <DialogTitle className="sr-only">Foto ampliada del local</DialogTitle>
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="Foto ampliada" className="w-full max-h-[80vh] object-contain rounded-lg bg-black/90" />
          ) : null}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}
