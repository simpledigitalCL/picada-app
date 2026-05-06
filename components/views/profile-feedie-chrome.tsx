'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Bell,
  Bookmark,
  MessageCircle,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  User,
  UtensilsCrossed,
  X,
  MapPin,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Badge as BadgeType } from '@/lib/gamification/core'
import { getAllAchievementProgress, type FeaturedAchievement, type AchievementProgress, type DynamicChallenge, type Rarity } from '@/lib/gamification/achievement-engine'
import { cn } from '@/lib/utils'
import { SocialCommunityFeed } from '@/components/social-community-feed'

// ─── Estilos rareza ───────────────────────────────────────────────────────────
const RARITY_PILL: Record<Rarity, { bg: string; text: string; label: string }> = {
  Common:    { bg: 'bg-slate-500',  text: 'text-white', label: 'Común'      },
  Rare:      { bg: 'bg-orange-500', text: 'text-white', label: 'Raro'       },
  Epic:      { bg: 'bg-green-500',  text: 'text-white', label: 'Épico'      },
  Legendary: { bg: 'bg-purple-600', text: 'text-white', label: 'Legendario' },
}

const RARITY_BG: Record<Rarity, string> = {
  Common:    '#94a3b8',
  Rare:      '#FF6B00',
  Epic:      '#22c55e',
  Legendary: '#a855f7',
}

const RARITY_ORDER: Rarity[] = ['Legendary', 'Epic', 'Rare', 'Common']

// ─── Sheet: todas las insignias ───────────────────────────────────────────────

type AchievementItem = { challenge: DynamicChallenge; progress: AchievementProgress }
type FilterKey = 'all' | 'unlocked' | Rarity

const FILTER_LABELS: Record<FilterKey, string> = {
  all:       'Todos',
  unlocked:  '✓ Ganados',
  Legendary: '🟣 Legendario',
  Epic:      '🟢 Épico',
  Rare:      '🟠 Raro',
  Common:    '⚪ Común',
}

function AllAchievementsSheet({
  open,
  onOpenChange,
  items,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: AchievementItem[]
}) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const sorted = [...items].sort((a, b) => {
    const ra = RARITY_ORDER.indexOf(a.challenge.rarity)
    const rb = RARITY_ORDER.indexOf(b.challenge.rarity)
    if (ra !== rb) return ra - rb
    const ua = a.progress.rewardShown ? 0 : 1
    const ub = b.progress.rewardShown ? 0 : 1
    if (ua !== ub) return ua - ub
    const ratioA = a.progress.count / a.challenge.target
    const ratioB = b.progress.count / b.challenge.target
    return ratioB - ratioA
  })

  const filtered = sorted.filter(({ challenge, progress }) => {
    if (filter === 'all') return true
    if (filter === 'unlocked') return progress.rewardShown
    return challenge.rarity === filter
  })

  const unlockedCount = items.filter(i => i.progress.rewardShown).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] rounded-t-3xl p-0 flex flex-col overflow-hidden">
        <SheetTitle className="sr-only">Mis Insignias</SheetTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-orange-100">
          <div>
            <h2 className="text-base font-bold">🏅 Mis Insignias</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unlockedCount} ganadas · {items.length - unlockedCount} por descubrir
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none border-b border-orange-50 shrink-0">
          {(['all', 'unlocked', 'Legendary', 'Epic', 'Rare', 'Common'] as FilterKey[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f
                  ? 'bg-orange-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-orange-50 hover:text-orange-700',
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 && (
            <div className="py-14 text-center">
              <p className="text-3xl mb-2">🔒</p>
              <p className="text-sm text-muted-foreground">Sin insignias en esta categoría aún</p>
            </div>
          )}
          {filtered.map(({ challenge, progress }) => {
            const ratio = Math.min(progress.count / challenge.target, 1)
            const pct = Math.round(ratio * 100)
            const unlocked = progress.rewardShown
            const bg = RARITY_BG[challenge.rarity]
            const pill = RARITY_PILL[challenge.rarity]

            return (
              <div
                key={challenge.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3 transition-colors',
                  unlocked
                    ? 'border-orange-100 bg-white shadow-sm'
                    : 'border-border/40 bg-muted/20 opacity-60 grayscale',
                )}
              >
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm"
                  style={{ backgroundColor: unlocked ? bg : undefined }}
                >
                  {challenge.visual.type === 'emoji' ? challenge.visual.value : '🏅'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span
                      className={cn('rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white', pill.bg)}
                    >
                      {pill.label}
                    </span>
                    {unlocked && (
                      <span className="rounded-full bg-green-500 px-1.5 py-px text-[9px] font-bold text-white">
                        ✓ Ganado
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold leading-tight text-foreground truncate">{challenge.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{challenge.description}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: bg }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground tabular-nums">
                      {progress.count}/{challenge.target}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export type ProfileLens = 'profile' | 'foodie' | 'guardados'

const MOCK_STORIES = [
  { id: 1, name: 'Ana', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', isLive: true },
  { id: 2, name: 'Carlos', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', isLive: false },
  { id: 3, name: 'María', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop', isLive: false },
  { id: 4, name: 'Diego', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop', isLive: true },
  { id: 5, name: 'Laura', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', isLive: false },
]

/** Publicaciones demo de cuentas que “sigues” (misma lógica visual que Instagram following). */
const MOCK_FOLLOWING_FEED = [
  {
    id: 'p1',
    handle: 'maria_foodie',
    name: 'María',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop',
    place: 'Picada El Hoyo',
    text: 'Mejor lomito de la semana 🔥 la salsa es otro nivel.',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&h=480&fit=crop',
    time: 'Hace 2 h',
  },
  {
    id: 'p2',
    handle: 'carlos_picadas',
    name: 'Carlos',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop',
    place: 'Café de barrio',
    text: 'Reel nuevo: 3 picadas baratas en Santiago Centro.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=480&fit=crop',
    time: 'Hace 5 h',
  },
  {
    id: 'p3',
    handle: 'foodie_cl',
    name: 'Diego',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop',
    place: null,
    text: '¿Alguien probó la nueva hamburguesa de Providencia? Dejo link en historias.',
    image: null as string | null,
    time: 'Ayer',
  },
]

const MOCK_CHATS = [
  { id: 1, name: 'María García', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', lastMessage: '¡Ese lugar quedó brutal!', time: '2m', unread: 2 },
  { id: 2, name: 'Carlos Ruiz', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', lastMessage: '¿Vamos a la picada nueva?', time: '15m', unread: 0 },
  { id: 3, name: 'Ana López', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop', lastMessage: 'Te pasé el mapa por WhatsApp', time: '1h', unread: 1 },
]

const MOCK_PROFILES = [
  { handle: 'maria_foodie', name: 'María G.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop' },
  { handle: 'carlos_picadas', name: 'Carlos R.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop' },
  { handle: 'foodie_cl', name: 'Diego M.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop' },
  { handle: 'sabor_stgo', name: 'Laura P.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop' },
]

// ─── Saved places view ────────────────────────────────────────────────────────

type SavedPlace = { id: string; name: string; address?: string; mapsUrl?: string }

function openRestaurant(p: SavedPlace) {
  window.dispatchEvent(new CustomEvent('picada:open-restaurant', {
    detail: { id: p.id, name: p.name, address: p.address || '', mapsUrl: p.mapsUrl || '' },
  }))
}

function GuardadosView() {
  const [saved, setSaved] = useState<SavedPlace[]>([])
  const [visitLater, setVisitLater] = useState<string[]>([])

  const loadData = () => {
    // "Visitar más tarde" — stored as string[] (place names)
    try {
      const raw = window.localStorage.getItem('picada.pending.dishes.v1')
      const items: unknown = raw ? JSON.parse(raw) : []
      if (Array.isArray(items)) {
        const names = items.map(i => (typeof i === 'string' ? i : String((i as { name?: string }).name || i)))
        setVisitLater(names)
      }
    } catch { /* ignore */ }

    // "Lugares votados" — cross-reference votes with visited places for real names/addresses
    try {
      const votesRaw = window.localStorage.getItem('picada.hot.userVotes.v1')
      const votes: Record<string, boolean> = votesRaw ? JSON.parse(votesRaw) : {}
      const votedIds = Object.entries(votes).filter(([, v]) => v).map(([id]) => id)

      const visitedRaw = window.localStorage.getItem('picada.visited.places.v1')
      const visited: Array<{ id: string; name: string; address: string }> = visitedRaw ? JSON.parse(visitedRaw) : []
      const visitedById = Object.fromEntries(visited.map(v => [v.id, v]))

      const result = votedIds.map(id => ({
        id,
        name: visitedById[id]?.name || id,
        address: visitedById[id]?.address,
      }))
      setSaved(result)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadData()
    window.addEventListener('picada:social-updated', loadData)
    return () => window.removeEventListener('picada:social-updated', loadData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const empty = saved.length === 0 && visitLater.length === 0

  return (
    <div className="px-4 py-4 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bookmark className="size-4 text-sky-500" />
          <h2 className="font-bold text-sm">Visitar más tarde</h2>
          {visitLater.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">{visitLater.length}</Badge>
          )}
        </div>
        {visitLater.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Aún no tienes lugares guardados. Usa "Guardar para después" en los platos del ranking.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visitLater.map((name, i) => (
              <Card key={`vl-${i}`} className="overflow-hidden">
                <CardContent className="py-2.5 px-3 flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-sky-100 flex items-center justify-center text-lg shrink-0">📍</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">Guardado para visitar</p>
                  </div>
                  <Badge className="bg-sky-500 text-white text-[10px] shrink-0">Pendiente</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Star className="size-4 text-yellow-500" />
          <h2 className="font-bold text-sm">Lugares votados</h2>
          {saved.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">{saved.length}</Badge>
          )}
        </div>
        {saved.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-yellow-200 bg-yellow-50/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Aún no has votado ninguna picada. Explora el ranking y vota los lugares que más te gusten.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {saved.slice(0, 20).map(p => (
              <Card key={p.id}>
                <CardContent className="py-2.5 px-3 flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-yellow-100 flex items-center justify-center text-lg shrink-0">⭐</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    {p.address && <p className="text-xs text-muted-foreground truncate">{p.address}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                      onClick={() => openRestaurant(p)}
                    >
                      <MapPin className="size-3 mr-1" />
                      Abrir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground"
                      onClick={async () => {
                        const text = `🍽️ ${p.name}${p.address ? ` · ${p.address}` : ''} — visto en Picada`
                        if (navigator.share) {
                          await navigator.share({ title: p.name, text }).catch(() => null)
                        } else {
                          await navigator.clipboard.writeText(text).catch(() => null)
                        }
                      }}
                      aria-label="Compartir"
                    >
                      <Share2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {empty && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="text-5xl">📌</span>
          <p className="font-bold text-base">Sin guardados aún</p>
          <p className="text-sm text-muted-foreground">Explora el ranking de picadas, vota y guarda los locales que quieras visitar.</p>
        </div>
      )}
    </div>
  )
}

function FoodieMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-md shadow-orange-200/50',
        className,
      )}
      aria-hidden
    >
      <UtensilsCrossed className="size-3.5" strokeWidth={2.5} />
    </span>
  )
}

export type ProfileFeedieChromeProps = {
  lens: ProfileLens
  onLensChange: (next: ProfileLens) => void
  username: string
  bio: string
  avatarDataUrl: string
  nivelNombre: string
  nivelEmoji: string
  nivelColorClass: string
  puntos: number
  followers: number
  following: number
  moodTags: string[]
  badges: BadgeType[]
  /** Logro dinámico equipado como título destacado. */
  featuredAchievement?: FeaturedAchievement | null
  /** Abre tu perfil en tab Feed para publicar (historia propia). */
  onAddStory: () => void
  onSharePassport: () => void | Promise<void>
  onOpenSettings?: () => void
  onSelectPlace?: (r: import('@/lib/places/restaurants').Restaurant) => void
}

export function ProfileFeedieChrome({
  lens,
  onLensChange,
  username,
  bio,
  avatarDataUrl,
  nivelNombre,
  nivelEmoji,
  nivelColorClass,
  puntos,
  followers,
  following,
  moodTags,
  badges,
  featuredAchievement,
  onAddStory,
  onSharePassport,
  onOpenSettings,
  onSelectPlace,
}: ProfileFeedieChromeProps) {
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [achievementsSheetOpen, setAchievementsSheetOpen] = useState(false)
  const [achievementItems, setAchievementItems] = useState<AchievementItem[]>([])

  useEffect(() => {
    getAllAchievementProgress().then(setAchievementItems).catch(() => null)
    const refresh = () => getAllAchievementProgress().then(setAchievementItems).catch(() => null)
    window.addEventListener('picada:achievement-equipped', refresh)
    window.addEventListener('picada:show-reward-modal', refresh)
    return () => {
      window.removeEventListener('picada:achievement-equipped', refresh)
      window.removeEventListener('picada:show-reward-modal', refresh)
    }
  }, [])

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return MOCK_PROFILES
    return MOCK_PROFILES.filter(
      p => p.handle.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
    )
  }, [searchQuery])

  const unlockedBadges = badges.filter(b => b.unlocked)

  return (
    <div className="space-y-0 -mx-4">
      <header className="sticky top-0 z-30 border-b border-orange-100/90 bg-background/92 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none" aria-hidden>
              🔥
            </span>
            <span className="font-extrabold text-sm tracking-tight text-foreground">
              Picada<span className="text-orange-500">.</span>
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-orange-600" aria-label="Buscar perfiles">
                  <Search className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-2rem,20rem)] p-0 border-orange-100 shadow-lg" align="end">
                <div className="border-b border-orange-100/80 p-2.5 bg-orange-50/40">
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar @usuario o nombre…"
                    className="h-9 rounded-xl border-orange-200/80 bg-white"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Comunidad (demo)
                  </p>
                  {filteredProfiles.map(p => (
                    <button
                      key={p.handle}
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-orange-50"
                      onClick={() => setSearchOpen(false)}
                    >
                      <Image src={p.avatar} alt="" width={40} height={40} className="size-10 rounded-full object-cover ring-2 ring-orange-100" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">@{p.handle}</p>
                      </div>
                    </button>
                  ))}
                  {filteredProfiles.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">Sin resultados de demo</p>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-orange-600" aria-label="Notificaciones">
              <Bell className="size-5" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-orange-500" />
            </Button>
            {onOpenSettings ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-orange-600"
                aria-label="Ajustes"
                onClick={onOpenSettings}
              >
                <Settings className="size-5" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-orange-600"
              aria-label="Mensajes"
              onClick={() => setMessagesOpen(true)}
            >
              <MessageCircle className="size-5" />
            </Button>
          </div>
        </div>

        <div className="flex gap-1 border-t border-orange-50/80 px-3 pb-2 pt-1.5">
          <button
            type="button"
            onClick={() => onLensChange('foodie')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-colors',
              lens === 'foodie'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-orange-50/80 text-muted-foreground hover:bg-orange-100/90 hover:text-foreground',
            )}
          >
            <FoodieMark className="shrink-0" />
            Feed
          </button>
          <button
            type="button"
            onClick={() => onLensChange('guardados')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-colors',
              lens === 'guardados'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-orange-50/80 text-muted-foreground hover:bg-orange-100/90 hover:text-foreground',
            )}
          >
            <Bookmark className="size-3.5 shrink-0" />
            Guardados
          </button>
          <button
            type="button"
            onClick={() => onLensChange('profile')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-colors',
              lens === 'profile'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-orange-50/80 text-muted-foreground hover:bg-orange-100/90 hover:text-foreground',
            )}
          >
            <User className="size-4 shrink-0" />
            Perfil
          </button>
        </div>
      </header>

      {lens === 'foodie' ? (
        <SocialCommunityFeed username={username} onAddStory={onAddStory} onSelectPlace={onSelectPlace} />
      ) : lens === 'guardados' ? (
        <GuardadosView />
      ) : (
        <>
          <div className="px-4 pb-2 pt-5 text-center">
            <div className="mx-auto flex max-w-sm flex-col items-center">
              <div className="relative">
                <div className="rounded-full bg-gradient-to-br from-orange-500 via-amber-400 to-yellow-400 p-[3px] shadow-lg shadow-orange-200/40">
                  <Avatar className="size-28 border-4 border-background">
                    {avatarDataUrl ? (
                      <img src={avatarDataUrl} alt={username} className="size-full rounded-full object-cover" />
                    ) : (
                      <AvatarFallback className="text-4xl bg-orange-50">{nivelEmoji}</AvatarFallback>
                    )}
                  </Avatar>
                </div>
                <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
                  <Sparkles className="size-3 shrink-0" />
                  {nivelNombre}
                </div>
              </div>

              <h1 className="mt-7 text-xl font-bold tracking-tight text-foreground">{username || 'Explorador'}</h1>
              <p className="text-sm text-muted-foreground">@{username || 'usuario'}</p>

              <div className="mt-6 flex w-full max-w-xs justify-around gap-4 border-y border-orange-100/80 py-4">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg font-bold tabular-nums text-foreground">{followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Seguidores</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg font-bold tabular-nums text-foreground">{following}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Siguiendo</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="flex items-center gap-1 text-lg font-bold tabular-nums text-orange-600">
                    <Sparkles className="size-4 shrink-0" />
                    {puntos >= 1000 ? `${(puntos / 1000).toFixed(1)}k` : puntos}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Picada XP</span>
                </div>
              </div>

              {bio ? (
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-foreground/85">{bio}</p>
              ) : (
                <p className="mt-4 max-w-xs text-sm italic text-muted-foreground">Añade una bio en Ajustes → Perfil público.</p>
              )}

              {moodTags.length > 0 ? (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {moodTags.slice(0, 6).map(tag => (
                    <span
                      key={tag}
                      className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-800 dark:text-orange-200"
                    >
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 flex w-full max-w-xs gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 flex-1 rounded-full border border-orange-200/80 bg-white shadow-sm"
                  onClick={() => onLensChange('foodie')}
                >
                  <UtensilsCrossed className="mr-2 size-4 text-orange-600" />
                  Ver Foodie
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full border border-orange-200/80 bg-white shadow-sm"
                  onClick={() => setMessagesOpen(true)}
                >
                  <MessageCircle className="size-5 text-orange-600" />
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="h-11 flex-1 rounded-full bg-orange-500 font-semibold text-white shadow-md hover:bg-orange-600"
                  onClick={() => void onSharePassport()}
                >
                  <Share2 className="mr-2 size-4" />
                  Pasaporte
                </Button>
              </div>

              <Badge variant="outline" className={cn('mt-3 text-xs font-semibold', nivelColorClass)}>
                {nivelEmoji} {nivelNombre}
              </Badge>

              {/* ── Logro destacado equipado ── */}
              {featuredAchievement && (() => {
                const pill = RARITY_PILL[featuredAchievement.rarity]
                return (
                  <div className={cn(
                    'mt-4 flex w-full max-w-xs items-center gap-3 rounded-2xl border px-4 py-3',
                    featuredAchievement.rarity === 'Legendary'
                      ? 'border-purple-300 bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/20 dark:border-purple-700'
                      : featuredAchievement.rarity === 'Epic'
                      ? 'border-green-200 bg-green-50/60 dark:bg-green-950/20 dark:border-green-700'
                      : featuredAchievement.rarity === 'Rare'
                      ? 'border-orange-200 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-700'
                      : 'border-slate-200 bg-slate-50/60 dark:bg-slate-800/20 dark:border-slate-600',
                  )}>
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl text-xl shadow',
                        featuredAchievement.rarity === 'Legendary' && 'animate-pulse',
                        pill.bg,
                      )}
                    >
                      {featuredAchievement.visual.type === 'emoji' ? featuredAchievement.visual.value : '🏆'}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wider', pill.bg, pill.text)}>
                          {pill.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-bold leading-tight text-foreground truncate">
                        {featuredAchievement.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">
                        {featuredAchievement.description}
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* ── Insignias ── */}
          {(() => {
            const sorted = [...achievementItems].sort((a, b) => {
              const ra = RARITY_ORDER.indexOf(a.challenge.rarity)
              const rb = RARITY_ORDER.indexOf(b.challenge.rarity)
              if (ra !== rb) return ra - rb
              const ua = a.progress.rewardShown ? 0 : 1
              const ub = b.progress.rewardShown ? 0 : 1
              if (ua !== ub) return ua - ub
              return (b.progress.count / b.challenge.target) - (a.progress.count / a.challenge.target)
            })
            const topFour = sorted.slice(0, 4)
            const unlockedCount = achievementItems.filter(i => i.progress.rewardShown).length

            return (
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Insignias</h3>
                  {achievementItems.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">{unlockedCount}/{achievementItems.length} ganadas</span>
                  )}
                </div>

                {topFour.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-orange-100 p-5 text-center">
                    <p className="text-2xl mb-1">🔒</p>
                    <p className="text-xs text-muted-foreground">Explora locales y gana tus primeras insignias</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {topFour.map(({ challenge, progress }) => {
                      const unlocked = progress.rewardShown
                      const bg = RARITY_BG[challenge.rarity]
                      const ratio = Math.min(progress.count / challenge.target, 1)
                      const pct = Math.round(ratio * 100)
                      return (
                        <button
                          key={challenge.id}
                          type="button"
                          onClick={() => setAchievementsSheetOpen(true)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition active:scale-95',
                            unlocked
                              ? 'border-orange-100 bg-gradient-to-b from-white to-orange-50/80 shadow-sm'
                              : 'border-border/60 bg-muted/30',
                          )}
                        >
                          <div
                            className={cn('flex size-11 items-center justify-center rounded-xl text-2xl shadow', !unlocked && 'grayscale opacity-50')}
                            style={{ backgroundColor: unlocked ? bg : undefined }}
                          >
                            {challenge.visual.type === 'emoji' ? challenge.visual.value : '🏅'}
                          </div>
                          <span className="line-clamp-2 text-center text-[9px] font-medium leading-tight text-foreground/80">
                            {challenge.title}
                          </span>
                          {!unlocked && (
                            <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setAchievementsSheetOpen(true)}
                  className="mt-3 w-full rounded-xl border border-orange-200 py-2.5 text-xs font-semibold text-orange-700 hover:bg-orange-50 transition-colors"
                >
                  🏅 Mostrar todas las insignias
                </button>
              </div>
            )
          })()}
        </>
      )}

      <AllAchievementsSheet
        open={achievementsSheetOpen}
        onOpenChange={setAchievementsSheetOpen}
        items={achievementItems}
      />

      <Sheet open={messagesOpen} onOpenChange={setMessagesOpen}>
        <SheetContent side="right" className="flex w-full max-w-sm flex-col border-l border-orange-100 bg-background p-0">
          <SheetHeader className="border-b border-orange-100 px-4 py-3 text-left">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-lg font-bold">Mensajes</SheetTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setMessagesOpen(false)} aria-label="Cerrar">
                <X className="size-4" />
              </Button>
            </div>
            <p className="text-left text-xs font-normal text-muted-foreground">Vista tipo Feedie · conversaciones de ejemplo</p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {MOCK_CHATS.map(chat => (
              <button
                key={chat.id}
                type="button"
                className="flex w-full items-center gap-3 border-b border-orange-50/90 px-4 py-3.5 text-left transition hover:bg-orange-50/50"
              >
                <div className="relative shrink-0">
                  <Image src={chat.avatar} alt="" width={48} height={48} className="size-12 rounded-full object-cover ring-2 ring-orange-100" />
                  {chat.unread > 0 ? (
                    <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                      {chat.unread}
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-foreground">{chat.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{chat.time}</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{chat.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-orange-100 p-3">
            <div className="flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50/50 px-3 py-2">
              <input
                type="text"
                readOnly
                placeholder="Pronto podrás chatear…"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <Button size="icon" className="h-8 w-8 shrink-0 rounded-full bg-orange-500 text-white hover:bg-orange-600" type="button" aria-label="Enviar">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
