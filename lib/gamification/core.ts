'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase'

export type BadgeId =
  | 'primer_plato'
  | 'explorador_10'
  | 'critico_elite'
  | 'racha_caliente'
  | 'espia_gourmet'
  | 'foto_viral'
  | 'mood_master'
  | 'picada_rey'
  | 'descubridor'

export type Badge = {
  id: BadgeId
  name: string
  emoji: string
  description: string
  unlocked: boolean
  unlockedAt?: string
}

export type ChallengeType = 'scan' | 'review' | 'visit' | 'explore' | 'social'

export type Challenge = {
  id: string
  icon: string
  title: string
  description: string
  pts: number
  progress: number
  target: number
  completed: boolean
  type: ChallengeType
}

export type StreakData = {
  current: number
  longest: number
  lastActiveDate: string
}

export type GamificationState = {
  points: number
  badges: Badge[]
  streak: StreakData
  challenges: Challenge[]
}

const DEFAULT_STREAK: StreakData = { current: 0, longest: 0, lastActiveDate: '' }
let pointsCache = 0

const BADGE_DEFS: Omit<Badge, 'unlocked' | 'unlockedAt'>[] = [
  { id: 'primer_plato', name: 'Primer Plato', emoji: '🍕', description: 'Subiste tu primera foto' },
  { id: 'explorador_10', name: 'Explorador', emoji: '🗺️', description: 'Visitaste 10 locales distintos' },
  { id: 'critico_elite', name: 'Crítico de Élite', emoji: '⭐', description: 'Escribiste 50 reseñas' },
  { id: 'racha_caliente', name: 'Racha Caliente', emoji: '🔥', description: '7 días consecutivos activo' },
  { id: 'espia_gourmet', name: 'Espía Gourmet', emoji: '🤫', description: '5 reviews en modo incógnito' },
  { id: 'foto_viral', name: 'Foto Viral', emoji: '📸', description: 'Una foto tuya recibió 10 votos útiles' },
  { id: 'mood_master', name: 'Mood Master', emoji: '🎭', description: 'Usaste todos los moods' },
  { id: 'picada_rey', name: 'Rey Picada', emoji: '👑', description: 'Alcanzaste 5000 puntos de influencia' },
  { id: 'descubridor', name: 'Descubridor', emoji: '🌟', description: 'Fuiste el primero en votar 3 locales como Picada' },
]

export async function refreshGamificationProfile(): Promise<number> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return pointsCache
  const { data: auth } = await supabase.auth.getSession()
  const uid = auth.session?.user?.id
  if (!uid) return pointsCache
  const { data } = await supabase.from('profiles').select('points').eq('id', uid).maybeSingle()
  pointsCache = Number(data?.points || 0)
  return pointsCache
}

export function loadPoints(): number {
  return pointsCache
}

export function getStreakMultiplier(): number {
  return 1
}

// Deprecated: XP is computed server-side (DB triggers + profiles.points).
export function grantPoints(_amount: number): number {
  return pointsCache
}

export function isStreakAtRisk(): boolean {
  return false
}

const BADGES_KEY = 'picada.badges.v1'

type BadgeStore = Record<string, { unlockedAt: string }>

function loadBadgeStore(): BadgeStore {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(BADGES_KEY) ?? '{}') as BadgeStore
  } catch { return {} }
}

function saveBadgeStore(store: BadgeStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BADGES_KEY, JSON.stringify(store))
}

export function loadBadges(): Badge[] {
  const store = loadBadgeStore()
  return BADGE_DEFS.map(b => ({
    ...b,
    unlocked: Boolean(store[b.id]),
    unlockedAt: store[b.id]?.unlockedAt,
  }))
}

export function unlockBadge(id: BadgeId): boolean {
  const store = loadBadgeStore()
  if (store[id]) return false // ya estaba desbloqueada

  const unlockedAt = new Date().toISOString()
  saveBadgeStore({ ...store, [id]: { unlockedAt } })

  // Sync a Supabase en background (sin bloquear)
  fetch('/api/badges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ badgeId: id, unlockedAt }),
  }).catch(() => undefined)

  return true
}

export function checkAndUnlockBadges(points: number, streakDays: number): BadgeId[] {
  const store = loadBadgeStore()
  const newlyUnlocked: BadgeId[] = []

  const check = (id: BadgeId, condition: boolean) => {
    if (condition && !store[id]) {
      unlockBadge(id)
      newlyUnlocked.push(id)
    }
  }

  check('racha_caliente', streakDays >= 7)
  check('picada_rey', points >= 5000)

  return newlyUnlocked
}

/** Llama al hacer login — descarga insignias de Supabase y actualiza localStorage */
export async function syncBadgesFromSupabase(): Promise<void> {
  try {
    const res = await fetch('/api/badges')
    if (!res.ok) return
    const json = (await res.json()) as { ok: boolean; badges: Array<{ badge_id: string; unlocked_at: string }> }
    if (!json.ok || !Array.isArray(json.badges)) return

    const store = loadBadgeStore()
    for (const row of json.badges) {
      if (!store[row.badge_id]) {
        store[row.badge_id] = { unlockedAt: row.unlocked_at }
      }
    }
    saveBadgeStore(store)
  } catch { /* offline — localStorage sigue siendo válido */ }
}

export function loadStreak(): StreakData {
  return DEFAULT_STREAK
}

export function tickStreak(): StreakData {
  return DEFAULT_STREAK
}

export function loadChallenges(): Challenge[] {
  return []
}

export function saveChallenges(_challenges: Challenge[]) {}

export function progressChallenge(_type: ChallengeType, _amount = 1): Challenge[] {
  return []
}

export const NIVELES = [
  { nombre: 'Explorador', emoji: '🧭', min: 0, max: 400, color: 'text-sky-600' },
  { nombre: 'Crítico', emoji: '🍽️', min: 400, max: 1500, color: 'text-violet-600' },
  { nombre: 'Inspector', emoji: '🔍', min: 1500, max: 5000, color: 'text-amber-600' },
  { nombre: 'Rey Picada', emoji: '👑', min: 5000, max: 9999, color: 'text-rose-600' },
] as const

export function getNivel(points: number) {
  return [...NIVELES].reverse().find(n => points >= n.min) ?? NIVELES[0]
}

export function getSiguienteNivel(points: number) {
  const current = getNivel(points)
  const idx = NIVELES.findIndex(n => n.nombre === current.nombre)
  return NIVELES[idx + 1] ?? null
}

export function getProgreso(points: number): number {
  const nivel = getNivel(points)
  const siguiente = getSiguienteNivel(points)
  if (!siguiente) return 100
  return ((points - nivel.min) / (siguiente.min - nivel.min)) * 100
}
