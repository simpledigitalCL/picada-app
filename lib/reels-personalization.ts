import type { ReelItem } from '@/lib/reels-types'

export type FoodPreference = {
  likes: string[]
  restrictions: string[]
  dislikes: string[]
  religion?: string
}

export type FavoriteItem = {
  id: string
  title: string
  author: string
  sourceUrl: string
}

export type ReelInteraction = {
  likedById: string[]
  favoriteById: string[]
  likedAuthors: string[]
  likedPlatforms: ReelItem['platform'][]
  favoriteItems: FavoriteItem[]
}

export type ProfileSocialSettings = {
  username: string
  bio: string
  avatarDataUrl?: string
  instagramUrl?: string
  tiktokUrl?: string
  websiteUrl?: string
  isPublic: boolean
  reviews: string[]
  visitedPlaces: string[]
  socialPosts?: Array<{
    id: string
    type: 'photo' | 'review'
    text: string
    place?: string
    imageDataUrl?: string
    rating?: number
    tags?: string[]
    moods?: string[]
    createdAt: string
  }>
}

const PREF_KEY = 'picada.preferences.v1'
const INTERACTIONS_KEY = 'picada.reels.interactions.v1'
const PROFILE_SOCIAL_KEY = 'picada.profile.social.v1'
const PICADA_TOOLTIP_SEEN_KEY = 'picada.tooltip.seen.v1'

const DEFAULT_PREFS: FoodPreference = {
  likes: ['picada', 'comida chilena', 'sushi'],
  restrictions: [],
  dislikes: [],
  religion: 'ninguna',
}

const GASTRO_BASE = [
  'picada',
  'restaurante',
  'comida',
  'santiago',
  'chile',
  'food',
  'barrio',
  'cafe',
  'sushi',
  'burger',
  'ramen',
  'sandwich',
]

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function uniqueLower(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const k = item.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

export function loadPreferences(): FoodPreference {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  const stored = safeParse<FoodPreference>(window.localStorage.getItem(PREF_KEY), DEFAULT_PREFS)
  return {
    likes: uniqueLower(stored.likes || DEFAULT_PREFS.likes),
    restrictions: uniqueLower(stored.restrictions || []),
    dislikes: uniqueLower(stored.dislikes || []),
    religion: stored.religion || DEFAULT_PREFS.religion,
  }
}

export function savePreferences(next: FoodPreference): FoodPreference {
  const normalized: FoodPreference = {
    likes: uniqueLower(next.likes),
    restrictions: uniqueLower(next.restrictions),
    dislikes: uniqueLower(next.dislikes),
    religion: next.religion || DEFAULT_PREFS.religion,
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(normalized))
    window.dispatchEvent(new CustomEvent('picada:prefs-updated'))
  }
  return normalized
}

export function loadReelInteractions(): ReelInteraction {
  const fallback: ReelInteraction = {
    likedById: [],
    favoriteById: [],
    likedAuthors: [],
    likedPlatforms: [],
    favoriteItems: [],
  }
  if (typeof window === 'undefined') return fallback
  const stored = safeParse<ReelInteraction>(window.localStorage.getItem(INTERACTIONS_KEY), fallback)
  return {
    likedById: [...new Set(stored.likedById || [])],
    favoriteById: [...new Set(stored.favoriteById || [])],
    likedAuthors: uniqueLower(stored.likedAuthors || []),
    likedPlatforms: [...new Set(stored.likedPlatforms || [])],
    favoriteItems: (stored.favoriteItems || []).filter(Boolean),
  }
}

export function saveReelInteractions(next: ReelInteraction): ReelInteraction {
  const normalized: ReelInteraction = {
    likedById: [...new Set(next.likedById)],
    favoriteById: [...new Set(next.favoriteById)],
    likedAuthors: uniqueLower(next.likedAuthors),
    likedPlatforms: [...new Set(next.likedPlatforms)],
    favoriteItems: [...new Map(next.favoriteItems.map(item => [item.id, item])).values()],
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(INTERACTIONS_KEY, JSON.stringify(normalized))
    window.dispatchEvent(new CustomEvent('picada:reels-interactions-updated'))
  }
  return normalized
}

function countHits(text: string, tokens: string[]): number {
  return tokens.reduce((acc, token) => (text.includes(token) ? acc + 1 : acc), 0)
}

export function scoreReel(
  item: ReelItem,
  prefs: FoodPreference,
  interactions: ReelInteraction,
): number {
  const text = `${item.title} ${item.description} ${item.author} ${item.tags.join(' ')}`.toLowerCase()
  let score = 0

  score += countHits(text, GASTRO_BASE) * 1.1
  score += countHits(text, prefs.likes) * 2.4
  score -= countHits(text, prefs.dislikes) * 3
  score -= countHits(text, prefs.restrictions) * 6

  if (interactions.favoriteById.includes(item.id)) score += 8
  if (interactions.likedById.includes(item.id)) score += 5
  if (interactions.likedAuthors.includes(item.author.toLowerCase())) score += 3.5
  if (interactions.likedPlatforms.includes(item.platform)) score += 1.8

  if (item.likes && Number.isFinite(item.likes)) {
    score += Math.min(Math.log10(Math.max(item.likes, 1)), 3)
  }

  return score
}

export function rankReels(
  items: ReelItem[],
  prefs: FoodPreference,
  interactions: ReelInteraction,
): ReelItem[] {
  return [...items].sort((a, b) => {
    const sa = scoreReel(a, prefs, interactions)
    const sb = scoreReel(b, prefs, interactions)
    return sb - sa
  })
}

export function splitCsvInput(raw: string): string[] {
  return uniqueLower(raw.split(',').map(s => s.trim()).filter(Boolean))
}

export function loadProfileSocialSettings(): ProfileSocialSettings {
  const fallback: ProfileSocialSettings = {
    username: 'claudio',
    bio: 'Food hunter de picadas y spots nuevos.',
    avatarDataUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    websiteUrl: '',
    isPublic: false,
    reviews: [],
    visitedPlaces: [],
    socialPosts: [],
  }
  if (typeof window === 'undefined') return fallback
  return safeParse<ProfileSocialSettings>(
    window.localStorage.getItem(PROFILE_SOCIAL_KEY),
    fallback,
  )
}

export function saveProfileSocialSettings(next: ProfileSocialSettings): ProfileSocialSettings {
  const normalized: ProfileSocialSettings = {
    ...next,
    username: next.username.trim().toLowerCase().replace(/\s+/g, '-'),
    reviews: next.reviews.filter(Boolean).slice(0, 20),
    visitedPlaces: next.visitedPlaces.filter(Boolean).slice(0, 40),
    socialPosts: (next.socialPosts || []).slice(0, 40),
  }
  if (typeof window !== 'undefined') {
    const tryPersist = (payload: ProfileSocialSettings): boolean => {
      try {
        window.localStorage.setItem(PROFILE_SOCIAL_KEY, JSON.stringify(payload))
        return true
      } catch {
        return false
      }
    }
    if (!tryPersist(normalized)) {
      const noAvatar: ProfileSocialSettings = { ...normalized, avatarDataUrl: '' }
      if (!tryPersist(noAvatar)) {
        const noPostMedia: ProfileSocialSettings = {
          ...noAvatar,
          socialPosts: (noAvatar.socialPosts || [])
            .map(post => ({ ...post, imageDataUrl: undefined }))
            .slice(0, 20),
        }
        if (!tryPersist(noPostMedia)) {
          const minimal: ProfileSocialSettings = {
            ...noPostMedia,
            socialPosts: (noPostMedia.socialPosts || []).slice(0, 10),
            reviews: noPostMedia.reviews.slice(0, 10),
            visitedPlaces: noPostMedia.visitedPlaces.slice(0, 20),
          }
          tryPersist(minimal)
        }
      }
    }
    window.dispatchEvent(new CustomEvent('picada:profile-updated'))
  }
  return normalized
}

export function hasSeenPicadaTooltip(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(PICADA_TOOLTIP_SEEN_KEY) === '1'
}

export function markPicadaTooltipSeen(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PICADA_TOOLTIP_SEEN_KEY, '1')
}
