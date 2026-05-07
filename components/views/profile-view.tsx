'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import {
  Bookmark,
  Camera,
  CheckCircle2,
  Copy,
  Flame,
  Globe,
  Grid3X3,
  Instagram,
  Link2,
  MapPin,
  MessageCircle,
  Music2,
  Play,
  Share2,
  Star,
  Trophy,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { TagAutocompleteInput } from '@/components/tags/tag-autocomplete-input'
import { LocationAutocomplete } from '@/components/search/location-autocomplete'
import { ProfileFeedieChrome, type ProfileLens } from '@/components/views/profile-feedie-chrome'
import { AuthQuickRegister } from '@/components/auth/auth-quick-register'
import { CreatorDashboard } from '@/components/views/creator-dashboard'
import { LeaderboardPanel } from '@/components/views/leaderboard-panel'
import { XpChip } from '@/components/gamification/xp-chip'
import { cn } from '@/lib/utils'
import {
  DIETARY_RESTRICTIONS_CATALOG,
  FOOD_DISLIKES_CATALOG,
  FOOD_LIKES_CATALOG,
  RELIGION_CATALOG,
  RELIGION_RESTRICTIONS,
} from '@/lib/tags/food-catalog'
import {
  loadPreferences,
  loadReelInteractions,
  loadProfileSocialSettings,
  saveProfileSocialSettings,
  savePreferences,
} from '@/lib/feed/personalization'
import {
  loadPoints,
  loadBadges,
  loadStreak,
  loadChallenges,
  saveChallenges,
  grantPoints,
  getNivel,
  getSiguienteNivel,
  getProgreso,
  checkAndUnlockBadges,
  type Badge as BadgeType,
  type Challenge,
} from '@/lib/gamification/core'
import {
  loadFeaturedAchievement,
  getAllAchievementProgress,
  type FeaturedAchievement,
  type DynamicChallenge,
  type AchievementProgress,
  type Rarity,
} from '@/lib/gamification/achievement-engine'

const VISITED_KEY = 'picada.visited.places.v1'

// ─── Colores rareza (local para no requerir import de reward-modal) ────────────
const RARITY_DOT: Record<Rarity, string> = {
  Common:    'bg-slate-400',
  Rare:      'bg-orange-500',
  Epic:      'bg-green-500',
  Legendary: 'bg-purple-600',
}
const RARITY_LABEL: Record<Rarity, string> = {
  Common: 'Común', Rare: 'Raro', Epic: 'Épico', Legendary: 'Legendario',
}

// ─── Sección logros dinámicos ─────────────────────────────────────────────────

function DynamicAchievementsSection() {
  const [items, setItems] = useState<Array<{ challenge: DynamicChallenge; progress: AchievementProgress }>>([])

  useEffect(() => {
    getAllAchievementProgress().then(setItems).catch(() => null)
    const refresh = () => { getAllAchievementProgress().then(setItems).catch(() => null) }
    window.addEventListener('picada:achievement-equipped', refresh)
    window.addEventListener('picada:show-reward-modal', refresh)
    return () => {
      window.removeEventListener('picada:achievement-equipped', refresh)
      window.removeEventListener('picada:show-reward-modal', refresh)
    }
  }, [])

  const unlocked = items.filter(i => i.progress.rewardShown)
  const inProgress = items.filter(i => !i.progress.rewardShown && i.progress.discoveryShown)
  const hidden = items.filter(i => !i.progress.rewardShown && !i.progress.discoveryShown)

  if (items.length === 0) return null

  return (
    <div>
      <h2 className="font-bold text-base mb-3">Logros dinámicos</h2>

      {unlocked.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completados</p>
          {unlocked.map(({ challenge, progress }) => (
            <Card key={challenge.id} className="border-l-4 border-l-green-500">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xl ${RARITY_DOT[challenge.rarity]}`}>
                  {challenge.visual.type === 'emoji' ? challenge.visual.value : '🏆'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold">{challenge.title}</p>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-white ${RARITY_DOT[challenge.rarity]}`}>
                      {RARITY_LABEL[challenge.rarity]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{challenge.description}</p>
                  {progress.unlockedAt && (
                    <p className="text-[10px] text-green-600">
                      ✓ {new Date(progress.unlockedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descubiertos</p>
          {inProgress.map(({ challenge, progress }) => {
            const pct = Math.round((progress.count / challenge.target) * 100)
            return (
              <Card key={challenge.id} className="border-l-4 border-l-orange-400">
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xl ${RARITY_DOT[challenge.rarity]}`}>
                    {challenge.visual.type === 'emoji' ? challenge.visual.value : '🔓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold">{challenge.title}</p>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-white ${RARITY_DOT[challenge.rarity]}`}>
                        {RARITY_LABEL[challenge.rarity]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{challenge.description}</p>
                    <div className="mt-1.5 space-y-0.5">
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground">{progress.count} de {challenge.target} · {pct}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {hidden.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ocultos ({hidden.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {hidden.map(({ challenge }) => (
              <div
                key={challenge.id}
                title="Logro aún no descubierto"
                className="flex size-12 items-center justify-center rounded-2xl bg-muted/50 text-xl grayscale opacity-40 border border-border"
              >
                ?
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Sigue usando la app para descubrirlos.</p>
        </div>
      )}
    </div>
  )
}

function VisitedHistory() {
  const [places, setPlaces] = useState<Array<{ id: string; name: string; address: string; visitedAt: string }>>([])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VISITED_KEY)
      setPlaces(raw ? JSON.parse(raw) : [])
    } catch { setPlaces([]) }
  }, [])

  return (
    <div>
      <h2 className="font-bold text-base mb-3">Historial de visitas</h2>
      <Card>
        <CardContent className="py-3 space-y-2">
          {places.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no has abierto ningún local. Explora el feed para comenzar.</p>
          ) : places.slice(0, 10).map(p => (
            <div key={`${p.id}-${p.visitedAt}`} className="flex items-start gap-2 border-b last:border-b-0 pb-2 last:pb-0">
              <span className="text-base mt-0.5">📍</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(p.visitedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Streak banner ─────────────────────────────────────────────────────────────

function StreakBanner({ current, longest }: { current: number; longest: number }) {
  if (current === 0) return null
  const multiplier = current >= 7 ? 2.0 : current >= 3 ? 1.5 : 1.0
  const hasBonus = multiplier > 1.0

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${hasBonus ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700' : 'bg-muted/40 border-border'}`}>
      <span className="text-2xl">{current >= 7 ? '🔥' : current >= 3 ? '🌟' : '⚡'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-orange-700 dark:text-orange-400">
          {current} día{current > 1 ? 's' : ''} de racha
        </p>
        <p className="text-xs text-muted-foreground">
          Máxima: {longest} día{longest > 1 ? 's' : ''}
          {hasBonus && <span className="ml-1 font-semibold text-orange-500"> · XP ×{multiplier} activo 🎯</span>}
        </p>
      </div>
      {hasBonus && (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs shrink-0 font-bold">
          ×{multiplier} XP
        </Badge>
      )}
    </div>
  )
}

// ─── Badge grid ─────────────────────────────────────────────────────────────────

// ─── Dynamic challenge card ────────────────────────────────────────────────────

function ChallengeCard({ challenge, onComplete }: { challenge: Challenge; onComplete: (c: Challenge) => void }) {
  const pct = challenge.target > 1 ? (challenge.progress / challenge.target) * 100 : 0
  const isAlmostDone = challenge.target > 1 && !challenge.completed && challenge.progress === challenge.target - 1

  return (
    <Card className={challenge.completed ? 'opacity-60' : 'border-l-4 border-l-orange-400'}>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-lg">
          {challenge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium leading-tight">{challenge.title}</p>
            {!challenge.completed && (
              <span className="text-[9px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full leading-none shrink-0">
                HOY
              </span>
            )}
            {isAlmostDone && (
              <span className="text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full leading-none shrink-0">
                ¡CASI!
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{challenge.description}</p>
          {challenge.target > 1 && !challenge.completed && (
            <div className="mt-1.5 space-y-0.5">
              <Progress value={pct} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                {challenge.progress} de {challenge.target} completados
              </p>
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <XpChip value={challenge.pts} />
          {challenge.completed ? (
            <CheckCircle2 className="size-5 text-green-500" />
          ) : (
            <Button
              size="sm"
              className="text-xs h-7 px-3 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => onComplete(challenge)}
            >
              Hacer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Contextual level progress ─────────────────────────────────────────────────

function LevelProgressHint({ points }: { points: number }) {
  const siguiente = getSiguienteNivel(points)
  if (!siguiente) return null
  const remaining = siguiente.min - points
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs"
    >
      <TrendingUp className="size-3.5 text-orange-500 shrink-0 mt-0.5" />
      <span className="text-muted-foreground min-w-0 break-words">
        <span className="font-semibold text-foreground">{remaining} XP más</span>
        {' '}para llegar a{' '}
        <span className="font-semibold text-foreground">{siguiente.nombre} {siguiente.emoji}</span>
      </span>
    </motion.div>
  )
}

// ─── Voted picadas tab ─────────────────────────────────────────────────────────

function VotedPicadasTab() {
  const [voted, setVoted] = useState<Array<{ id: string; name: string; address?: string }>>([])
  const [votedPublic, setVotedPublic] = useState(true)

  useEffect(() => {
    try {
      const votesRaw = window.localStorage.getItem('picada.hot.userVotes.v1')
      const votes: Record<string, boolean> = votesRaw ? JSON.parse(votesRaw) : {}
      const ids = Object.entries(votes).filter(([, v]) => v).map(([id]) => id)
      const visitedRaw = window.localStorage.getItem('picada.visited.places.v1')
      const visited: Array<{ id: string; name: string; address: string }> = visitedRaw ? JSON.parse(visitedRaw) : []
      const byId = Object.fromEntries(visited.map(v => [v.id, v]))
      setVoted(ids.map(id => ({ id, name: byId[id]?.name || id, address: byId[id]?.address })))
    } catch { /* ignore */ }
    const raw = window.localStorage.getItem('picada.voted.public.v1')
    setVotedPublic(raw !== 'false')
  }, [])

  const togglePublic = () => {
    const next = !votedPublic
    setVotedPublic(next)
    window.localStorage.setItem('picada.voted.public.v1', String(next))
  }

  const shareVoted = async () => {
    const lines = voted.map(p => `• ${p.name}${p.address ? ` (${p.address})` : ''}`).join('\n')
    const text = `🔥 Mis picadas favoritas en Picada:\n${lines}`
    if (navigator.share) {
      await navigator.share({ title: 'Mis picadas favoritas', text }).catch(() => null)
    } else {
      await navigator.clipboard.writeText(text).catch(() => null)
    }
  }

  if (voted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-14 text-center px-4">
        <span className="text-5xl">🔥</span>
        <p className="font-bold text-base">Sin picadas votadas aún</p>
        <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
          Explora el ranking de Picadas y vota los locales que más te gusten. Aparecerán aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-0.5 pt-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">{voted.length} picada{voted.length !== 1 ? 's' : ''} votada{voted.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePublic}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              votedPublic
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            {votedPublic ? '🌍 Público' : '🔒 Privado'}
          </button>
          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" onClick={shareVoted}>
            <Share2 className="size-3 mr-1" />
            Compartir
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {voted.map(p => (
          <Card key={p.id}>
            <CardContent className="py-2.5 px-3 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-orange-100 flex items-center justify-center text-lg shrink-0">🔥</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                {p.address && <p className="text-xs text-muted-foreground truncate">{p.address}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2.5 border-orange-200 text-orange-700 hover:bg-orange-50 shrink-0"
                onClick={() => window.dispatchEvent(new CustomEvent('picada:open-restaurant', {
                  detail: { id: p.id, name: p.name, address: p.address || '' },
                }))}
              >
                <MapPin className="size-3 mr-1" />
                Abrir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface ProfileViewProps {
  locationQuery: string
  onLocationChange: (value: string) => void
  locationMode: 'manual' | 'auto'
  onLocationModeChange: (value: 'manual' | 'auto') => void
  onUseCurrentLocation: () => void
  section: 'profile' | 'feed'
  onSectionChange: (section: 'profile' | 'feed') => void
  /** True cuando la pestaña inferior Social está visible (para abrir siempre en Foodie). */
  profileTabActive: boolean
  onSelectPlace?: (r: import('@/lib/places/restaurants').Restaurant) => void
}

export function ProfileView({
  locationQuery,
  onLocationChange,
  locationMode,
  onLocationModeChange,
  onUseCurrentLocation,
  section,
  onSectionChange,
  profileTabActive,
  onSelectPlace,
}: ProfileViewProps) {
  const [puntos, setPuntos] = useState(0)
  const [likes, setLikes] = useState<string[]>([])
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [dislikes, setDislikes] = useState<string[]>([])
  const [religion, setReligion] = useState('ninguna')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [reviewsText, setReviewsText] = useState('')
  const [visitedText, setVisitedText] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [avatarDataUrl, setAvatarDataUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [favoriteItems, setFavoriteItems] = useState<{ id: string; title: string; author: string; sourceUrl: string }[]>([])
  const [socialPosts, setSocialPosts] = useState<Array<{
    id: string
    type: 'photo' | 'review'
    text: string
    place?: string
    imageDataUrl?: string
    rating?: number
    createdAt: string
  }>>([])
  /** Pestañas principales estilo Feedie (lo que ven quienes siguen tu perfil). */
  const [foodieTab, setFoodieTab] = useState<'feed' | 'reels' | 'picadas' | 'reviews'>('feed')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileLens, setProfileLens] = useState<ProfileLens>('foodie')
  const wasProfileTabActive = useRef(false)
  const [selectedPhoto, setSelectedPhoto] = useState<(typeof socialPosts)[0] | null>(null)
  const [influencePoints, setInfluencePoints] = useState(0)
  const [recommendationClicks, setRecommendationClicks] = useState(0)
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [pendingDishes, setPendingDishes] = useState(0)
  const [badges, setBadges] = useState<BadgeType[]>([])
  const [streak, setStreak] = useState({ current: 0, longest: 0, lastActiveDate: '' })
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [featuredAchievement, setFeaturedAchievement] = useState<FeaturedAchievement | null>(null)

  useEffect(() => {
    const p = loadPreferences()
    setLikes(p.likes)
    setRestrictions(p.restrictions)
    setDislikes(p.dislikes)
    setReligion(p.religion || 'ninguna')
    const i = loadReelInteractions()
    setLikesCount(i.likedById.length)
    setFavoritesCount(i.favoriteById.length)
    setFavoriteItems(i.favoriteItems || [])
    const social = loadProfileSocialSettings()
    setUsername(social.username)
    setBio(social.bio)
    setAvatarDataUrl(social.avatarDataUrl || '')

    // Sobreescribir con datos reales de Supabase si hay sesión
    const supabase = getSupabaseBrowserClient()
    if (supabase) {
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const userId = sessionData.session?.user?.id
        if (!userId) return
        supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', userId)
          .single()
          .then(({ data: profile }) => {
            if (profile?.username) setUsername(profile.username)
            if (profile?.avatar_url && !social.avatarDataUrl) setAvatarDataUrl(profile.avatar_url)
          })
        // Cargar posts propios del servidor para que aparezcan en la grilla
        fetch(`/api/social-feed?user_id=${encodeURIComponent(userId)}&limit=40`)
          .then(r => r.ok ? r.json() as Promise<{ posts: Array<{ id: string; type: string; content: string | null; rating: number | null; place_name: string | null; media_url: string | null; created_at: string }> }> : { posts: [] })
          .then(({ posts }) => {
            if (!posts?.length) return
            setSocialPosts(prev => {
              const localIds = new Set(prev.map(p => p.id))
              const fromRemote = posts
                .filter(p => !localIds.has(p.id))
                .map(p => ({
                  id: p.id,
                  type: (p.type === 'photo' || p.type === 'video' ? 'photo' : 'review') as 'photo' | 'review',
                  text: p.content || '',
                  place: p.place_name ?? undefined,
                  imageDataUrl: p.media_url ?? undefined,
                  rating: p.rating ?? undefined,
                  createdAt: p.created_at,
                }))
              return fromRemote.length ? [...fromRemote, ...prev] : prev
            })
          })
          .catch(() => undefined)
      })
    }
    setInstagramUrl(social.instagramUrl || '')
    setTiktokUrl(social.tiktokUrl || '')
    setWebsiteUrl(social.websiteUrl || '')
    setIsPublic(social.isPublic)
    setReviewsText(social.reviews.join('\n'))
    setVisitedText(social.visitedPlaces.join('\n'))
    setSocialPosts(social.socialPosts || [])
    const pts = loadPoints()
    setPuntos(pts)
    setInfluencePoints(Number(window.localStorage.getItem('picada.influence.points.v1') || '0'))
    setRecommendationClicks(Number(window.localStorage.getItem('picada.creator.clicks.v1') || '0'))
    setBadges(loadBadges())
    const s = loadStreak()
    setStreak(s)
    setChallenges(loadChallenges())
    checkAndUnlockBadges(pts, s.current)
    setFeaturedAchievement(loadFeaturedAchievement())

    const userId = window.localStorage.getItem('picada.user.id.v1') || `user-${social.username || 'guest'}`
    window.localStorage.setItem('picada.user.id.v1', userId)
    fetch(`/api/social?user_id=${encodeURIComponent(userId)}`)
      .then(r => (r.ok ? r.json() : { followers: 0, following: 0, pending: 0 }))
      .then((d: { followers?: number; following?: number; pending?: number }) => {
        setFollowers(d.followers || 0)
        setFollowing(d.following || 0)
        setPendingDishes(d.pending || 0)
      })
      .catch(() => {
        setFollowers(0)
        setFollowing(0)
        setPendingDishes(0)
      })
  }, [])

  useEffect(() => {
    const updateInfluence = () => {
      setInfluencePoints(Number(window.localStorage.getItem('picada.influence.points.v1') || '0'))
      setRecommendationClicks(Number(window.localStorage.getItem('picada.creator.clicks.v1') || '0'))
    }
    const updateChallenges = () => setChallenges(loadChallenges())
    const updateStreak = (e: Event) => {
      const detail = (e as CustomEvent<typeof streak>).detail
      setStreak(detail)
    }
    const updateXP = () => {
      const pts = loadPoints()
      setPuntos(pts)
      setBadges(loadBadges())
      const s = loadStreak()
      checkAndUnlockBadges(pts, s.current)
    }
    const onAchievementEquipped = (e: Event) => {
      setFeaturedAchievement((e as CustomEvent<FeaturedAchievement>).detail)
    }
    const onReviewPublished = (e: Event) => {
      const post = (e as CustomEvent<{
        id: string; type: 'photo' | 'review'; text: string;
        place?: string; imageDataUrl?: string; rating?: number; createdAt: string
      }>).detail
      setSocialPosts(prev => [post, ...prev])
    }
    window.addEventListener('picada:influence-updated', updateInfluence)
    window.addEventListener('picada:challenges-updated', updateChallenges)
    window.addEventListener('picada:streak-updated', updateStreak)
    window.addEventListener('picada:xp-granted', updateXP)
    window.addEventListener('picada:review-published', onReviewPublished)
    window.addEventListener('picada:achievement-equipped', onAchievementEquipped)
    return () => {
      window.removeEventListener('picada:influence-updated', updateInfluence)
      window.removeEventListener('picada:challenges-updated', updateChallenges)
      window.removeEventListener('picada:streak-updated', updateStreak)
      window.removeEventListener('picada:xp-granted', updateXP)
      window.removeEventListener('picada:review-published', onReviewPublished)
      window.removeEventListener('picada:achievement-equipped', onAchievementEquipped)
    }
  }, [])

  const nivel = getNivel(puntos)
  const siguiente = getSiguienteNivel(puntos)
  const progreso = getProgreso(puntos)

  const prefStats = useMemo(() => ({
    likes: likes.length,
    restrictions: restrictions.length,
    dislikes: dislikes.length,
  }), [likes, restrictions, dislikes])

  const publicProfileUrl = useMemo(() => {
    const payload = {
      username,
      bio,
      favorites: favoriteItems.slice(0, 20),
      reviews: reviewsText.split('\n').map(s => s.trim()).filter(Boolean),
      visited: visitedText.split('\n').map(s => s.trim()).filter(Boolean),
    }
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))))
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/public-profile?data=${encoded}`
  }, [username, bio, favoriteItems, reviewsText, visitedText])

  const handleSharePassport = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `@${username || 'yo'} en Picada`,
          text: 'Mira mi perfil gastronómico en Picada',
          url: publicProfileUrl,
        })
      } else if (typeof navigator !== 'undefined' && publicProfileUrl) {
        await navigator.clipboard.writeText(publicProfileUrl)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1600)
      }
    } catch {
      /* cancelado o sin permiso */
    }
  }

  const feedItems = useMemo(() => {
    const fromPosts = socialPosts.map(p => ({
      id: p.id,
      type: p.type,
      text: p.text,
      place: p.place,
      imageDataUrl: p.imageDataUrl,
      rating: p.rating,
      createdAt: p.createdAt,
    }))
    const reviews = reviewsText
      .split('\n').map(s => s.trim()).filter(Boolean)
      .map((text, i) => ({ id: `rv-${i}`, type: 'review' as const, text }))
    const visits = visitedText
      .split('\n').map(s => s.trim()).filter(Boolean)
      .map((text, i) => ({ id: `vs-${i}`, type: 'visit' as const, text }))
    const favs = favoriteItems.slice(0, 20).map((f, i) => ({ id: `fv-${i}`, type: 'favorite' as const, text: f.title, url: f.sourceUrl }))
    return [...fromPosts, ...reviews, ...visits, ...favs]
  }, [socialPosts, reviewsText, visitedText, favoriteItems])

  const handleChallengeAction = (challenge: Challenge) => {
    if (challenge.completed) return
    const next = challenges.map(c => {
      if (c.id !== challenge.id) return c
      const progress = Math.min(c.progress + 1, c.target)
      const completed = progress >= c.target
      if (completed && !c.completed) grantPoints(c.pts)
      return { ...c, progress, completed }
    })
    setChallenges(next)
    saveChallenges(next)
  }

  useEffect(() => {
    if (profileTabActive) {
      if (!wasProfileTabActive.current) setProfileLens('foodie')
      wasProfileTabActive.current = true
    } else {
      wasProfileTabActive.current = false
    }
  }, [profileTabActive])

  useEffect(() => {
    if (section !== 'feed') return
    setFoodieTab('feed')
    setProfileLens('profile')
    onSectionChange('profile')
  }, [section, onSectionChange])

  const reviewsTabItems = useMemo(
    () => feedItems.filter(i => i.type === 'review'),
    [feedItems],
  )
  const staticReviews = useMemo(
    () => reviewsText.split('\n').map(s => s.trim()).filter(Boolean),
    [reviewsText],
  )

  const foodieTabs = [
    { id: 'feed' as const, icon: Grid3X3, label: 'Feed' },
    { id: 'reels' as const, icon: Play, label: 'Reels' },
    { id: 'picadas' as const, icon: Bookmark, label: 'Picadas' },
    { id: 'reviews' as const, icon: Star, label: 'Reseñas' },
  ]

  useEffect(() => {
    const blocked = Boolean(settingsOpen && profileTabActive)
    window.dispatchEvent(new CustomEvent('picada:block-fab', { detail: { blocked } }))
    return () => {
      window.dispatchEvent(new CustomEvent('picada:block-fab', { detail: { blocked: false } }))
    }
  }, [settingsOpen, profileTabActive])

  return (
    <ScrollArea className="h-full">
      <div className="px-4 pt-5 pb-24 space-y-5 max-w-md mx-auto">
        <ProfileFeedieChrome
          lens={profileLens}
          onLensChange={setProfileLens}
          username={username}
          bio={bio}
          avatarDataUrl={avatarDataUrl}
          nivelNombre={nivel.nombre}
          nivelEmoji={nivel.emoji}
          nivelColorClass={nivel.color}
          puntos={puntos}
          followers={followers}
          following={following}
          moodTags={likes}
          badges={badges}
          featuredAchievement={featuredAchievement}
          onAddStory={() => {
            setProfileLens('profile')
            setFoodieTab('feed')
          }}
          onSharePassport={handleSharePassport}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectPlace={onSelectPlace}
        />

        {profileLens === 'profile' ? (
          <>
        <div className="sticky top-0 z-20 -mx-4 border-b border-orange-100/90 bg-background/95 px-2 py-0 backdrop-blur-md">
          <div className="flex">
            {foodieTabs.map(tab => {
              const Icon = tab.icon
              const active = foodieTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFoodieTab(tab.id)}
                  className={cn(
                    'relative flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-semibold transition-colors sm:flex-row sm:text-xs',
                    active ? 'text-orange-600' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <span>{tab.label}</span>
                  {active ? <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-orange-500" /> : null}
                </button>
              )
            })}
          </div>
        </div>

        {foodieTab === 'feed' ? (
          <div className="space-y-0">
            {/* Photo grid — Instagram style */}
            {socialPosts.filter(p => p.imageDataUrl).length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 py-14 text-center px-4"
              >
                <div className="size-20 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <span className="text-4xl">📸</span>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-base">Sin fotos aún</p>
                  <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
                    Usa el botón <span className="font-semibold text-orange-500">+</span> para subir fotos y reels de tus experiencias gastronómicas.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gana <span className="font-semibold text-orange-500">+10 XP</span> por tu primera foto
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-3 gap-px bg-muted/30">
                {socialPosts.filter(p => p.imageDataUrl).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedPhoto(item)}
                    className="relative aspect-square overflow-hidden bg-muted"
                  >
                    {item.imageDataUrl!.startsWith('data:video') ? (
                      <div className="relative h-full w-full bg-black/80 flex items-center justify-center">
                        <Play className="size-8 text-white/90" />
                        <span className="absolute top-1 right-1 bg-black/60 rounded px-1 text-[9px] text-white font-bold">REEL</span>
                      </div>
                    ) : (
                      <img
                        src={item.imageDataUrl!}
                        alt={item.place || 'foto'}
                        className="h-full w-full object-cover transition-transform hover:scale-105"
                      />
                    )}
                    {item.place && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4">
                        <p className="text-[9px] text-white font-medium truncate">{item.place}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : foodieTab === 'reels' ? (
          <div className="space-y-3 px-0.5">
            <p className="text-xs text-muted-foreground">
              Favoritos de Reels: lo que marcaste para volver a ver o compartir.
            </p>
            {favoriteItems.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Aún no tienes reels guardados. Ve a la pestaña Reels de la app y marca favoritos.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {favoriteItems.map(f => (
                  <a
                    key={f.id}
                    href={f.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-xl border border-orange-100 bg-gradient-to-b from-orange-100 to-muted p-2 shadow-sm transition hover:border-orange-300"
                  >
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="size-9 text-white drop-shadow-lg" />
                    </div>
                    <p className="relative z-[1] line-clamp-3 text-[10px] font-bold leading-tight text-white drop-shadow-md">{f.title}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : foodieTab === 'picadas' ? (
          <VotedPicadasTab />
        ) : (
          <div className="space-y-3 px-0.5">
            <p className="text-xs text-muted-foreground">Reseñas publicadas y notas de texto.</p>
            {reviewsTabItems.length === 0 && staticReviews.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Sin reseñas aún. Usa el tab Feed y el botón + para publicar.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reviewsTabItems.map(item => (
                  <Card key={item.id}>
                    <CardContent className="space-y-2 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px]">✍️ Reseña</Badge>
                        {'createdAt' in item && item.createdAt ? (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.createdAt as string).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : null}
                      </div>
                      {item.text ? <p className="text-sm leading-snug">{item.text}</p> : null}
                      {'rating' in item && item.rating ? (
                        <p className="text-sm font-semibold tracking-wide text-amber-600">
                          {'★'.repeat(item.rating as number)}{'☆'.repeat(5 - (item.rating as number))}
                        </p>
                      ) : null}
                      {'place' in item && item.place ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          {item.place}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
                {staticReviews.map((text, i) => (
                  <Card key={`note-${i}`}>
                    <CardContent className="py-3">
                      <Badge variant="outline" className="mb-2 text-[10px]">Nota</Badge>
                      <p className="text-sm leading-snug">{text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
          </>
        ) : null}

        {/* Photo detail sheet */}
        <Sheet open={!!selectedPhoto} onOpenChange={open => !open && setSelectedPhoto(null)}>
          <SheetContent side="bottom" className="h-[90dvh] rounded-t-3xl p-0 flex flex-col overflow-hidden">
            <SheetTitle className="sr-only">Foto</SheetTitle>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 shrink-0" />
            {selectedPhoto && (
              <div className="flex flex-col flex-1 overflow-y-auto">
                <div className="relative bg-black flex items-center justify-center" style={{ maxHeight: '60dvh' }}>
                  {selectedPhoto.imageDataUrl?.startsWith('data:video') ? (
                    <video src={selectedPhoto.imageDataUrl} controls playsInline className="max-h-[60dvh] w-full object-contain" />
                  ) : (
                    <img src={selectedPhoto.imageDataUrl!} alt="" className="max-h-[60dvh] w-full object-contain" />
                  )}
                </div>
                <div className="px-4 py-4 space-y-2">
                  {selectedPhoto.place && (
                    <p className="text-xs text-orange-600 font-medium flex items-center gap-1">
                      <MapPin className="size-3.5 shrink-0" />
                      {selectedPhoto.place}
                    </p>
                  )}
                  {selectedPhoto.text && (
                    <p className="text-sm leading-relaxed">{selectedPhoto.text}</p>
                  )}
                  {selectedPhoto.rating ? (
                    <p className="text-sm text-amber-500 font-semibold">
                      {'★'.repeat(selectedPhoto.rating)}{'☆'.repeat(5 - selectedPhoto.rating)}
                      <span className="text-xs text-muted-foreground ml-1 font-normal">{selectedPhoto.rating}/5</span>
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(selectedPhoto.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent side="bottom" className="h-[92dvh] rounded-t-3xl flex flex-col gap-0 p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-orange-100 px-5 py-3.5 shrink-0">
              <div>
                <SheetTitle className="text-lg font-bold">Ajustes</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ubicación, gustos, cuenta, progreso y comunidad
                </p>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="w-full space-y-5 p-4 pb-8 max-w-lg mx-auto">
            <Card className="border-orange-100/80 bg-gradient-to-br from-orange-50/40 to-transparent">
              <CardContent className="space-y-2 py-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Zap className="size-3.5 text-orange-500" />
                    Progreso de nivel
                  </span>
                  {siguiente ? (
                    <span>
                      {siguiente.nombre} {siguiente.emoji} en {siguiente.min - puntos} XP
                    </span>
                  ) : null}
                </div>
                <Progress value={progreso} className="h-2.5" />
                <LevelProgressHint points={puntos} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: MessageCircle, label: 'Reseñas', value: String(socialPosts.filter(p => p.type === 'review').length + reviewsText.split('\n').filter(Boolean).length), highlight: true },
                { icon: Star, label: 'Likes', value: String(likesCount) },
                { icon: Camera, label: 'Favoritos', value: String(favoritesCount) },
                { icon: Flame, label: 'Pendientes', value: String(pendingDishes) },
              ].map(({ icon: Icon, label, value, highlight }) => (
                <Card key={label} className={highlight ? 'border-orange-200 dark:border-orange-800' : ''}>
                  <CardContent className="flex flex-col items-center gap-1 px-1 py-3">
                    <Icon className={`size-4 ${highlight ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    <p className={`text-base font-extrabold leading-none ${highlight ? 'text-orange-600 dark:text-orange-400' : ''}`}>{value}</p>
                    <p className="text-[9px] text-muted-foreground text-center leading-tight">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <StreakBanner current={streak.current} longest={streak.longest} />

            <Separator />

            {/* Logros dinámicos desde JSON */}
            <DynamicAchievementsSection />

            <Separator />

            {/* Desafíos dinámicos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-base">Desafíos de hoy</h2>
                <Badge variant="secondary" className="text-xs">
                  <Trophy className="size-3 mr-1" />
                  {challenges.filter(d => d.completed).length}/{challenges.length}
                </Badge>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {challenges.map(c => (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <ChallengeCard challenge={c} onComplete={handleChallengeAction} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <Separator />

            {/* Leaderboard local */}
            <div>
              <LeaderboardPanel locationQuery={locationQuery} />
            </div>

            <Separator />

            {/* Historial de visitas */}
            <VisitedHistory />

            <Separator />

            <div>
              <h2 className="font-bold text-base mb-3">Mi Impacto</h2>
              <CreatorDashboard
                locationQuery={locationQuery}
                influencePoints={influencePoints}
                recommendationsClicks={recommendationClicks}
                inspectorLevel={nivel.nombre}
                topDiscovery={socialPosts[0]?.place || favoriteItems[0]?.title}
              />
            </div>

            <Separator />
            <div>
              <h2 className="font-bold text-base mb-3">Cuenta y registro</h2>
              <Card>
                <CardContent className="py-4">
                  <AuthQuickRegister />
                </CardContent>
              </Card>
            </div>

            <Separator />
            <div>
              <h2 className="font-bold text-base mb-3">Ubicación inteligente</h2>
              <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="text-xs">
                      <p className="font-semibold">Usar mi ubicación actual</p>
                      <p className="text-muted-foreground">Personaliza reels, mapa y publicaciones</p>
                    </div>
                    <Switch
                      checked={locationMode === 'auto'}
                      onCheckedChange={checked => onLocationModeChange(checked ? 'auto' : 'manual')}
                    />
                  </div>
                  <LocationAutocomplete value={locationQuery} onChange={onLocationChange} />
                  <Button variant="outline" className="w-full" onClick={onUseCurrentLocation}>
                    Actualizar con mi ubicación ahora
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Separator />
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-base">Tus gustos gastronómicos</h2>
                {saved && <Badge variant="secondary" className="text-xs">Guardado ✓</Badge>}
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Personalización del feed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <TagAutocompleteInput label="Gustos gastronómicos" values={likes} suggestions={FOOD_LIKES_CATALOG} onChange={setLikes} />
                  <TagAutocompleteInput label="Restricciones alimenticias" values={restrictions} suggestions={DIETARY_RESTRICTIONS_CATALOG} onChange={setRestrictions} />
                  <TagAutocompleteInput label="No me gusta" values={dislikes} suggestions={FOOD_DISLIKES_CATALOG} onChange={setDislikes} />
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Religión (opcional)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {RELIGION_CATALOG.map(r => (
                        <Badge
                          key={r}
                          variant={religion === r ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setReligion(r)
                            const adds = RELIGION_RESTRICTIONS[r] || []
                            setRestrictions(prev => [...new Set([...prev, ...adds])])
                          }}
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs">Gustos: {prefStats.likes}</Badge>
                    <Badge variant="outline" className="text-xs">Restricciones: {prefStats.restrictions}</Badge>
                    <Badge variant="outline" className="text-xs">No me gusta: {prefStats.dislikes}</Badge>
                  </div>
                  <Button className="w-full" onClick={() => {
                    savePreferences({ likes, restrictions, dislikes, religion })
                    setSaved(true)
                    window.setTimeout(() => setSaved(false), 1600)
                  }}>
                    Guardar preferencias
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Separator />
            <div>
              <h2 className="font-bold text-base mb-3">Tus favoritos</h2>
              <Card>
                <CardContent className="py-4 space-y-3">
                  {favoriteItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Marca favoritos en Reels y aparecerán aquí.</p>
                  ) : (
                    favoriteItems.slice(0, 8).map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2 border-b last:border-b-0 pb-2 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.author}</p>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <a href={item.sourceUrl} target="_blank" rel="noreferrer">Ver</a>
                        </Button>
                      </div>
                    ))
                  )}
                  <Button variant="secondary" className="w-full gap-2" onClick={async () => {
                    const text = favoriteItems.map(f => `- ${f.title} (${f.sourceUrl})`).join('\n') || 'Sin favoritos'
                    await navigator.clipboard.writeText(text)
                  }}>
                    <Copy className="size-4" />
                    Copiar lista de favoritos
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Separator />
            <div>
              <h2 className="font-bold text-base mb-3">Perfil público y compartir</h2>
              <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Usuario público</p>
                    <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Bio</p>
                    <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Cuéntale a otros qué te gusta comer..." />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Foto de perfil</p>
                    <Input type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => { if (typeof reader.result === 'string') setAvatarDataUrl(reader.result) }
                      reader.readAsDataURL(file)
                    }} />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="Instagram URL" className="pl-9" />
                    </div>
                    <div className="relative">
                      <Music2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input value={tiktokUrl} onChange={e => setTiktokUrl(e.target.value)} placeholder="TikTok URL" className="pl-9" />
                    </div>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="Sitio web / Linktree" className="pl-9" />
                    </div>
                  </div>
                  <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 px-3 py-2.5 space-y-1">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                      <MessageCircle className="size-3.5" />
                      {socialPosts.length > 0 ? `${socialPosts.length} reseña${socialPosts.length > 1 ? 's' : ''} publicada${socialPosts.length > 1 ? 's' : ''}` : 'Aún sin reseñas'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Tus reseñas se guardan automáticamente cuando publicas desde el botón <span className="font-semibold text-orange-500">+</span>. Aparecen en tu feed.
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="text-xs">
                      <p className="font-semibold">Perfil público</p>
                      <p className="text-muted-foreground">Otros pueden ver tus reseñas y favoritos</p>
                    </div>
                    <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  </div>
                  <Button className="w-full gap-2 rounded-xl" onClick={() => {
                    saveProfileSocialSettings({ username, bio, avatarDataUrl, instagramUrl, tiktokUrl, websiteUrl, isPublic, reviews: reviewsText.split('\n').map(s => s.trim()).filter(Boolean), visitedPlaces: visitedText.split('\n').map(s => s.trim()).filter(Boolean), socialPosts })
                    setSaved(true)
                    window.setTimeout(() => setSaved(false), 1600)
                  }}>
                    <Globe className="size-4" />
                    Guardar perfil público
                  </Button>

                  {isPublic && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/10 p-4 space-y-3"
                    >
                      <div className="text-center">
                        <p className="text-sm font-bold">¡Tu perfil es público! 🎉</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Compártelo con amigos y construye tu reputación gastronómica</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 rounded-xl border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => {
                            const text = `🍽️ Mira mi perfil gastronómico en Picada.app\n${publicProfileUrl}`
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
                          }}
                        >
                          <MessageCircle className="size-3.5 text-green-500" />
                          WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 rounded-xl"
                          onClick={async () => {
                            try {
                              if (navigator.share) {
                                await navigator.share({ title: `@${username} en Picada.app`, text: `Mira mi mapa gastronómico 🗺️`, url: publicProfileUrl })
                              } else {
                                await navigator.clipboard.writeText(publicProfileUrl)
                                setSaved(true)
                                window.setTimeout(() => setSaved(false), 1600)
                              }
                            } catch { /* cancelled */ }
                          }}
                        >
                          <Share2 className="size-3.5" />
                          Compartir
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground gap-1.5"
                        onClick={async () => {
                          await navigator.clipboard.writeText(publicProfileUrl)
                          setSaved(true)
                          window.setTimeout(() => setSaved(false), 1600)
                        }}
                      >
                        <Copy className="size-3" />
                        Copiar link del perfil
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Niveles */}
            <Separator />
            <div>
              <h2 className="font-bold text-base mb-3">Tus niveles</h2>
              <div className="space-y-2">
                {(['Explorador', 'Crítico', 'Inspector', 'Rey Picada'] as const).map(nombre => {
                  const n = { 'Explorador': { emoji: '🧭', min: 0, color: 'text-sky-600' }, 'Crítico': { emoji: '🍽️', min: 400, color: 'text-violet-600' }, 'Inspector': { emoji: '🔍', min: 1500, color: 'text-amber-600' }, 'Rey Picada': { emoji: '👑', min: 5000, color: 'text-rose-600' } }[nombre]!
                  const unlocked = puntos >= n.min
                  return (
                    <div key={nombre} className={`flex items-center gap-3 p-3 rounded-xl border ${unlocked ? 'bg-muted/50' : 'opacity-40'}`}>
                      <span className="text-2xl">{n.emoji}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${unlocked ? n.color : 'text-muted-foreground'}`}>{nombre}</p>
                        <p className="text-xs text-muted-foreground">Desde {n.min} XP</p>
                      </div>
                      {unlocked && <Badge className="text-xs bg-green-600 hover:bg-green-600">Activo</Badge>}
                    </div>
                  )
                })}
              </div>
            </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </ScrollArea>
  )
}
