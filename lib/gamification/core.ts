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

export function loadBadges(): Badge[] {
  return BADGE_DEFS.map(b => ({ ...b, unlocked: false }))
}

export function unlockBadge(_id: BadgeId): boolean {
  return false
}

export function checkAndUnlockBadges(_points: number, _streakDays: number): BadgeId[] {
  return []
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
