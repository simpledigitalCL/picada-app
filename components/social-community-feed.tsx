'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, ExternalLink, Heart, MapPin,
  MessageCircle, MoreHorizontal, RefreshCw, Share2, Star, X,
  UtensilsCrossed,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SocialPost } from '@/app/api/social-feed/route'
import { isAuthenticatedClient, requireAuthOrPrompt } from '@/lib/auth/gate'
import type { Restaurant } from '@/lib/places/restaurants'
import { slugDisplayFromAutomatedSlug } from '@/lib/tags/display'
import { sanitizeUserText } from '@/lib/utils/sanitize'
import { proxyVideoUrl, videoMimeFromUrl } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase'

// ─── Local post type (from localStorage) ──────────────────────────────────────

type LocalPost = {
  id: string
  type: 'photo' | 'review'
  text: string
  place?: string
  imageDataUrl?: string
  rating?: number
  tags?: string[]
  moods?: string[]
  createdAt: string
}

// ─── Story viewer ──────────────────────────────────────────────────────────────

type Story = {
  id: string
  imageUrl: string
  username: string
  place?: string | null
  createdAt: string
  placeData?: Restaurant | null
}

function displayTagLabel(raw: string): string {
  const norm = String(raw || '').trim().toLowerCase()
  if (!norm) return ''
  const pretty = slugDisplayFromAutomatedSlug(norm).replace(/\s+/g, ' ').trim()
  if (!pretty) return norm
  return pretty
}

function StoryViewer({
  stories,
  initialIndex,
  onClose,
  onSelectPlace,
}: {
  stories: Story[]
  initialIndex: number
  onClose: () => void
  onSelectPlace?: (r: Restaurant) => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  const story = stories[idx]
  const safeStoryUsername = sanitizeUserText(story?.username || '')
  const safeStoryPlace = sanitizeUserText(story?.place || '')

  const advance = () => setIdx(i => (i + 1 < stories.length ? i + 1 : -1))

  useEffect(() => {
    if (idx < 0) { onClose(); return }
    setProgress(0)
    timerRef.current = window.setInterval(() => {
      setProgress(p => {
        if (p >= 100) { advance(); return 0 }
        return p + 2
      })
    }, 100)
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  if (!story) return null

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Hace ${hrs} h`
    return `Hace ${Math.floor(hrs / 24)} d`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3 pb-1">
        {stories.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <Avatar className="size-8 ring-2 ring-white/40">
          <AvatarFallback className="bg-gradient-to-br from-orange-400 to-amber-300 text-white font-bold text-xs">
            {safeStoryUsername.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">{safeStoryUsername}</p>
          {story.place && (
            <p className="text-white/70 text-[10px] flex items-center gap-0.5 truncate">
              <MapPin className="size-2.5 shrink-0" />{safeStoryPlace}
            </p>
          )}
        </div>
        <span className="text-white/50 text-[10px]">{timeAgo(story.createdAt)}</span>
        <button onClick={onClose} className="text-white/70 hover:text-white ml-1">
          <X className="size-5" />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={story.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />

        {/* Tap zones: prev / next */}
        <button
          className="absolute left-0 top-0 h-full w-1/3"
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          aria-label="Historia anterior"
        />
        <button
          className="absolute right-0 top-0 h-full w-1/3"
          onClick={advance}
          aria-label="Historia siguiente"
        />
      </div>

      {/* Footer: Ver local */}
      {story.place && (
        <div className="px-4 py-4 bg-gradient-to-t from-black/80 to-transparent -mt-16 relative z-10">
          <button
            className="w-full flex items-center justify-center gap-2 bg-white/90 text-black rounded-2xl py-3 text-sm font-semibold shadow-lg"
            onClick={() => {
              if (onSelectPlace && story.place) {
                onSelectPlace({
                  id: story.id,
                  name: story.place,
                  address: '',
                  category: 'picada',
                  description: '',
                  comuna: '',
                  lat: 0, lng: 0,
                  rating: 0, reviewCount: 0,
                  distance: '', priceRange: 1,
                  tags: [],
                  imageUrl: story.imageUrl,
                  starPlate: 'none' as any,
                  openNow: false,
                  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(story.place)}`,
                })
                onClose()
              }
            }}
          >
            <UtensilsCrossed className="size-4" />
            Ver local · {safeStoryPlace}
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Post card ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  username,
  isOwn,
  liked,
  onToggleLike,
  onSelectPlace,
}: {
  post: SocialPost | (LocalPost & { username: string; source: 'local' })
  username: string
  isOwn: boolean
  liked: boolean
  onToggleLike: () => void
  onSelectPlace?: (r: Restaurant) => void
}) {
  const isLocal = 'source' in post && post.source === 'local'
  const likeCount = isLocal ? 0 : ((post as SocialPost).like_count ?? 0)

  const placeName = isLocal ? (post as LocalPost).place || null : (post as SocialPost).place_name
  const content = isLocal ? (post as LocalPost).text : (post as SocialPost).content
  const safeContent = sanitizeUserText(content || '')
  const rating = isLocal ? (post as LocalPost).rating : (post as SocialPost).rating
  const mediaUrl = isLocal ? (post as LocalPost).imageDataUrl || null : (post as SocialPost).media_url
  const postType = isLocal ? (post as LocalPost).type : (post as SocialPost).type
  const createdAt = isLocal ? (post as LocalPost).createdAt : (post as SocialPost).created_at
  const moodTags = isLocal ? ((post as LocalPost).moods || []) : (post as SocialPost).mood_tags || []
  const taxonomyTags = isLocal ? ((post as LocalPost).tags || []) : ((post as SocialPost).tags || [])
  const detailTags = [...new Set([...taxonomyTags, ...moodTags].map(t => displayTagLabel(String(t || ''))).filter(Boolean))]
  const postUsername = sanitizeUserText(isLocal ? username : (post as SocialPost).username)
  const safePlaceName = sanitizeUserText(placeName || '')
  const isVideo = postType === 'video' || (mediaUrl?.startsWith('data:video') ?? false)

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Hace ${hrs} h`
    return `Hace ${Math.floor(hrs / 24)} d`
  }

  const handleOpenPlace = () => {
    if (!placeName || !onSelectPlace) return
    onSelectPlace({
      id: post.id,
      name: placeName,
      address: '',
      category: 'picada',
      description: safeContent,
      comuna: '', lat: 0, lng: 0,
      rating: rating || 0,
      reviewCount: 0, distance: '',
      priceRange: 1, tags: detailTags,
      imageUrl: mediaUrl || '',
      starPlate: 'none' as any, openNow: false,
      reviewsText: safeContent ? [safeContent] : [],
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`,
    })
  }

  return (
    <article className="border-b border-orange-100/60 bg-background">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button
          type="button"
          disabled={isOwn}
          className="shrink-0 disabled:cursor-default"
          onClick={() => {
            if (isOwn) return
            const userId = !isLocal ? (post as SocialPost).user_id : null
            if (!userId) return
            window.dispatchEvent(new CustomEvent('picada:open-user-profile', {
              detail: { userId, username: postUsername },
            }))
          }}
        >
          <Avatar className="size-10 ring-2 ring-orange-100">
            <AvatarFallback className="bg-gradient-to-br from-orange-400 to-amber-300 text-white font-bold text-sm">
              {postUsername.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isOwn}
              className="text-sm font-bold truncate disabled:cursor-default hover:underline disabled:no-underline"
              onClick={() => {
                if (isOwn) return
                const userId = !isLocal ? (post as SocialPost).user_id : null
                if (!userId) return
                window.dispatchEvent(new CustomEvent('picada:open-user-profile', {
                  detail: { userId, username: postUsername },
                }))
              }}
            >
              {postUsername}
            </button>
            {isOwn && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">Tú</Badge>}
          </div>
          {placeName && (
            <button
              onClick={handleOpenPlace}
              className="text-xs text-orange-600 font-medium flex items-center gap-0.5 truncate hover:text-orange-700 transition-colors"
            >
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{safePlaceName}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-[10px] text-muted-foreground">{timeAgo(createdAt)}</p>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Media o placeholder de local */}
      {mediaUrl ? (
        <div className="relative bg-muted overflow-hidden">
          {isVideo ? (
            <div className="relative aspect-video bg-black">
              <video
                className="w-full h-full object-cover"
                controls
                playsInline
                preload="metadata"
              >
                {/* Proxy same-origin para evitar bloqueos de Firefox ETP/CORS */}
                <source src={proxyVideoUrl(mediaUrl) ?? undefined} type={videoMimeFromUrl(mediaUrl)} />
                <source src={mediaUrl} type={videoMimeFromUrl(mediaUrl)} />
                <p className="flex items-center justify-center text-xs text-white/70 p-4 text-center">
                  Tu navegador no puede reproducir este video.
                </p>
              </video>
            </div>
          ) : mediaUrl.startsWith('data:') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="w-full max-h-80 object-cover" />
          ) : (
            <div className="relative aspect-square">
              <Image src={mediaUrl} alt="" fill className="object-cover" />
            </div>
          )}
          {placeName && !isVideo && (
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[11px] px-2 py-1 rounded-full flex items-center gap-1 max-w-[70%] truncate">
              <MapPin className="size-3 shrink-0" />{safePlaceName}
            </div>
          )}
        </div>
      ) : placeName && postType === 'review' ? (
        /* Reseña sin foto: mostrar banner del local */
        <button
          onClick={handleOpenPlace}
          className="w-full relative bg-gradient-to-br from-orange-50 to-amber-50 border-y border-orange-100/60 px-4 py-5 flex items-center gap-3 text-left hover:bg-orange-50 transition-colors"
        >
          <div className="size-12 shrink-0 rounded-xl bg-gradient-to-br from-orange-400 to-amber-300 flex items-center justify-center shadow-sm">
            <UtensilsCrossed className="size-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate">{safePlaceName}</p>
            <p className="text-xs text-orange-600 font-medium">Toca para ver el local →</p>
          </div>
          <ExternalLink className="size-4 text-orange-400 shrink-0" />
        </button>
      ) : null}

      {/* Acciones */}
      <div className="flex items-center gap-3 px-4 pt-2.5">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onToggleLike}
          className="flex items-center gap-1"
          aria-label="Me gusta"
        >
          <Heart className={`size-5 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
          <span className="text-xs font-medium">{likeCount + (liked ? 1 : 0)}</span>
        </motion.button>
        <button className="flex items-center gap-1 text-foreground" aria-label="Comentar">
          <MessageCircle className="size-5" />
        </button>
        <button className="flex items-center gap-1 text-foreground" aria-label="Compartir">
          <Share2 className="size-4.5" />
        </button>
        {rating && (
          <div className="flex items-center gap-1 ml-auto">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`size-3.5 ${n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
            ))}
          </div>
        )}
        {/* Botón Ver local — siempre visible cuando hay place */}
        {placeName && onSelectPlace && (
          <button
            onClick={handleOpenPlace}
            className={`flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors ${rating ? 'ml-2' : 'ml-auto'}`}
          >
            <ExternalLink className="size-3.5" />
            Ver local
          </button>
        )}
      </div>

      {/* Contenido */}
      {(safeContent || detailTags.length > 0) && (
        <div className="px-4 pt-1.5 pb-3 space-y-1.5">
          {safeContent && <p className="text-sm leading-relaxed text-foreground/90">{safeContent}</p>}
          {detailTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {detailTags.map(tag => (
                <span key={tag} className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// ─── Stories row ───────────────────────────────────────────────────────────────

function StoriesRow({
  localPosts,
  username,
  onAddStory,
  onSelectPlace,
}: {
  localPosts: LocalPost[]
  username: string
  onAddStory: () => void
  onSelectPlace?: (r: Restaurant) => void
}) {
  const [viewerStories, setViewerStories] = useState<Story[] | null>(null)
  const [viewerStart, setViewerStart] = useState(0)
  const photoPosts = localPosts.filter(p => p.imageDataUrl).slice(0, 6)

  const openStory = (stories: Story[], startIndex: number) => {
    setViewerStories(stories)
    setViewerStart(startIndex)
  }

  const allStories: Story[] = photoPosts.map(p => ({
    id: p.id,
    imageUrl: p.imageDataUrl!,
    username,
    place: p.place || null,
    createdAt: p.createdAt,
  }))

  return (
    <>
      <div className="border-b border-orange-100/60 bg-gradient-to-b from-orange-50/70 to-transparent px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground mb-2 text-center tracking-wide">Historias</p>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">

          {/* Agregar historia */}
          <button type="button" onClick={onAddStory} className="flex shrink-0 flex-col items-center gap-1">
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-orange-300 bg-white/90 shadow-sm text-orange-400 text-2xl">
              +
            </div>
            <span className="max-w-[4.5rem] truncate text-[10px] font-medium text-muted-foreground">Tu historia</span>
          </button>

          {/* Historias propias (fotos de posts locales) */}
          {photoPosts.map((post, i) => (
            <button
              key={post.id}
              type="button"
              onClick={() => openStory(allStories, i)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <div className="rounded-full p-[2.5px] bg-gradient-to-br from-orange-500 via-pink-500 to-amber-400 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.imageDataUrl!}
                  alt=""
                  className="size-16 rounded-full border-2 border-background object-cover"
                />
              </div>
              <span className="max-w-[4rem] truncate text-[10px] font-semibold text-foreground/85">
                {post.place || 'Mi foto'}
              </span>
            </button>
          ))}

          {/* Accesos rápidos visuales a otras secciones */}
          {photoPosts.length === 0 && (
            <>
              {[
                { name: 'Picadas 🔥', emoji: '🍜', hint: 'Descubre' },
                { name: 'Top local ⭐', emoji: '⭐', hint: 'Ranking' },
                { name: 'Reels 🎬', emoji: '🎬', hint: 'Videos' },
              ].map(s => (
                <div key={s.name} className="flex shrink-0 flex-col items-center gap-1 opacity-40 select-none">
                  <div className="flex size-16 items-center justify-center rounded-full border-2 border-orange-200 bg-orange-50 text-2xl">
                    {s.emoji}
                  </div>
                  <span className="max-w-[4rem] truncate text-[10px] text-muted-foreground">{s.name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {viewerStories && (
          <StoryViewer
            stories={viewerStories}
            initialIndex={viewerStart}
            onClose={() => setViewerStories(null)}
            onSelectPlace={onSelectPlace}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface SocialCommunityFeedProps {
  username: string
  onAddStory: () => void
  filterTab?: 'all' | 'photos' | 'reviews' | 'picadas' | 'reels'
  onSelectPlace?: (r: Restaurant) => void
}

export function SocialCommunityFeed({
  username,
  onAddStory,
  filterTab = 'all',
  onSelectPlace,
}: SocialCommunityFeedProps) {
  const [remotePosts, setRemotePosts] = useState<SocialPost[]>([])
  const [localPosts, setLocalPosts] = useState<LocalPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set())
  const myUserId = useRef<string>('')

  const loadLocalPosts = () => {
    try {
      const raw = window.localStorage.getItem('picada.profile.social.v1')
      const data = raw ? JSON.parse(raw) : {}
      return (data.socialPosts || []) as LocalPost[]
    } catch { return [] as LocalPost[] }
  }

  const fetchRemote = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/social-feed?limit=40')
      if (res.ok) {
        const data = (await res.json()) as { posts: SocialPost[] }
        const posts = data.posts || []
        setRemotePosts(posts)

        // Batch-fetch which posts the current user has liked
        const ids = posts.map(p => p.id).filter(Boolean)
        if (ids.length > 0) {
          const supabase = getSupabaseBrowserClient()
          const token = supabase
            ? (await supabase.auth.getSession()).data.session?.access_token
            : null
          if (token) {
            fetch(`/api/likes?post_ids=${ids.join(',')}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then(r => r.ok ? r.json() : null)
              .then((d: { liked?: string[] } | null) => {
                if (d?.liked) setLikedPostIds(new Set(d.liked))
              })
              .catch(() => null)
          }
        }
      }
    } catch { /* keep existing */ } finally { setRefreshing(false) }
  }

  const handleToggleLike = async (post: SocialPost) => {
    if (!isAuthed) { requireAuthOrPrompt(); return }

    const isLiked = likedPostIds.has(post.id)
    // Optimistic update
    setLikedPostIds(prev => {
      const next = new Set(prev)
      isLiked ? next.delete(post.id) : next.add(post.id)
      return next
    })

    const supabase = getSupabaseBrowserClient()
    const token = supabase
      ? (await supabase.auth.getSession()).data.session?.access_token
      : null
    if (!token) return

    const allTags = [...(post.tags || []), ...(post.mood_tags || [])]
    if (!isLiked) {
      window.dispatchEvent(new CustomEvent('picada:like-given', { detail: { postId: post.id } }))
    }
    fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        post_id: post.id,
        action: isLiked ? 'unlike' : 'like',
        author_id: post.user_id,
        tags: allTags,
      }),
    }).catch(() => {
      // Revert on failure
      setLikedPostIds(prev => {
        const next = new Set(prev)
        isLiked ? next.add(post.id) : next.delete(post.id)
        return next
      })
    })
  }

  useEffect(() => {
    void isAuthenticatedClient().then(setIsAuthed)
    myUserId.current = window.localStorage.getItem('picada.user.id.v1') || ''
    const local = loadLocalPosts()
    setLocalPosts(local)
    fetchRemote().finally(() => setLoading(false))

    const onPublished = (e: Event) => {
      const post = (e as CustomEvent<LocalPost>).detail
      setLocalPosts(prev => [post, ...prev])
    }
    const onPostPublished = () => { void fetchRemote(true) }
    window.addEventListener('picada:review-published', onPublished)
    window.addEventListener('picada:post-published', onPostPublished)
    return () => {
      window.removeEventListener('picada:review-published', onPublished)
      window.removeEventListener('picada:post-published', onPostPublished)
    }
  }, [])

  const localAsSocial = localPosts.map(p => ({ ...p, username, source: 'local' as const }))

  const filterPost = (p: SocialPost | (LocalPost & { username: string; source: 'local' })) => {
    if (filterTab === 'all') return true
    const type = 'source' in p ? p.type : (p as SocialPost).type
    const mediaUrl = 'source' in p ? p.imageDataUrl : (p as SocialPost).media_url
    const entryType = 'source' in p ? '' : ((p as SocialPost).entry_type || '')
    if (filterTab === 'photos') return type === 'photo' || !!mediaUrl
    if (filterTab === 'reviews') return type === 'review'
    if (filterTab === 'reels') return type === 'video' || entryType === 'media'
    if (filterTab === 'picadas') return entryType === 'new-picada'
    return true
  }

  const allPosts = [
    ...localAsSocial,
    ...remotePosts.filter(r => !localPosts.find(l => l.id === r.id)),
  ].filter(filterPost)

  if (loading) {
    return (
      <div className="space-y-0">
        <StoriesRow localPosts={[]} username={username} onAddStory={onAddStory} onSelectPlace={onSelectPlace} />
        {[1, 2, 3].map(i => (
          <div key={i} className="border-b border-orange-100/60 p-4 space-y-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-full bg-muted" />
              <div className="space-y-1 flex-1">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-2.5 bg-muted rounded w-1/4" />
              </div>
            </div>
            <div className="h-48 bg-muted rounded-2xl" />
            <div className="h-3 bg-muted rounded w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {!isAuthed && (
        <div className="mx-3 mt-3 rounded-xl border border-orange-200 bg-orange-50/70 p-3">
          <p className="text-xs font-semibold text-orange-700">Comunidad Foodie</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Puedes mirar publicaciones sin cuenta. Para reseñar, subir fotos y participar, inicia sesión.
          </p>
          <Button
            size="sm"
            className="mt-2 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => void requireAuthOrPrompt()}
          >
            Iniciar sesión para participar
          </Button>
        </div>
      )}

      <StoriesRow
        localPosts={localPosts}
        username={username}
        onAddStory={() => {
          if (!isAuthed) { void requireAuthOrPrompt(); return }
          onAddStory()
        }}
        onSelectPlace={onSelectPlace}
      />

      {/* Barra de refresh */}
      <div className="border-b border-orange-100/50 bg-background px-3 py-2 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {allPosts.length > 0
            ? `${allPosts.length} publicaciones · comunidad + tus aportes`
            : 'Sin publicaciones aún — ¡sé el primero!'}
        </p>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchRemote(true)} aria-label="Refrescar">
          <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Posts */}
      <AnimatePresence>
        {allPosts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <span className="text-5xl">🍽️</span>
            <p className="font-bold">Aún sin publicaciones</p>
            <p className="text-sm text-muted-foreground">
              Sé el primero en compartir una reseña, foto o picada.
            </p>
          </div>
        ) : (
          allPosts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
            >
              <PostCard
                post={post}
                username={username}
                isOwn={'source' in post && post.source === 'local'}
                liked={!('source' in post) && likedPostIds.has(post.id)}
                onToggleLike={() => {
                  if ('source' in post) return
                  void handleToggleLike(post as SocialPost)
                }}
                onSelectPlace={onSelectPlace}
              />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  )
}
