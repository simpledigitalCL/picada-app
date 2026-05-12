'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'
export type VisualType = 'emoji' | 'svg' | 'image'

export type Visual = {
  type: VisualType
  value: string
}

export type DynamicChallenge = {
  id: string
  action_type: string
  category?: string
  target: number
  reveal_threshold: number
  title: string
  description: string
  rarity: Rarity
  visual: Visual
  time_range?: string // "HH:MM-HH:MM" — soporta cruces de medianoche
}

export type AchievementProgress = {
  count: number
  discoveryShown: boolean
  rewardShown: boolean
  unlockedAt?: string
}

export type FeaturedAchievement = {
  challengeId: string
  title: string
  description: string
  rarity: Rarity
  visual: Visual
  unlockedAt: string
}

export type TrackActionResult = {
  challengeId: string
  progress: number
  ratio: number
  discoveryTriggered: boolean
  rewardTriggered: boolean
}

// ─── Config cache (hot-reload amigable) ──────────────────────────────────────

let configCache: DynamicChallenge[] | null = null

/**
 * Carga el archivo madre de retos desde /config/challenges.json.
 * El resultado se cachea en memoria para evitar re-fetches innecesarios.
 *
 * Para que un Agente IA inserte un nuevo reto sin reiniciar la app:
 * 1. Editar public/config/challenges.json y agregar el objeto del reto.
 * 2. Llamar a `invalidateConfigCache()` desde la consola del navegador:
 *    window.__picadaAchievements.invalidateCache()
 *    window.__picadaAchievements.reloadConfig()
 *    El nuevo reto quedará activo en la próxima acción del usuario.
 *
 * Ejemplo de reto que un Agente IA puede insertar:
 * {
 *   "id": "ai-generated-reto-001",
 *   "action_type": "scan_complete",
 *   "target": 3,
 *   "reveal_threshold": 0.33,
 *   "title": "Trío Científico",
 *   "description": "3 platos escaneados. La IA trabaja para ti.",
 *   "rarity": "Rare",
 *   "visual": { "type": "emoji", "value": "🔬" }
 * }
 */
export async function loadChallengesConfig(): Promise<DynamicChallenge[]> {
  if (configCache) return configCache
  try {
    const res = await fetch('/config/challenges.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as DynamicChallenge[]
    configCache = data
    return data
  } catch (err) {
    console.warn('[AchievementEngine] No se pudo cargar challenges.json', err)
    return []
  }
}

export function invalidateConfigCache() {
  configCache = null
}

// ─── Progreso por reto ────────────────────────────────────────────────────────

const PROGRESS_PREFIX = 'picada.achieve.progress.'
const FEATURED_KEY = 'picada.achieve.featured'

function getProgressKey(challengeId: string): string {
  return `${PROGRESS_PREFIX}${challengeId}`
}

export function loadProgress(challengeId: string): AchievementProgress {
  if (typeof window === 'undefined') return { count: 0, discoveryShown: false, rewardShown: false }
  try {
    const raw = window.localStorage.getItem(getProgressKey(challengeId))
    if (!raw) return { count: 0, discoveryShown: false, rewardShown: false }
    return JSON.parse(raw) as AchievementProgress
  } catch {
    return { count: 0, discoveryShown: false, rewardShown: false }
  }
}

function saveProgressLocal(challengeId: string, progress: AchievementProgress): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getProgressKey(challengeId), JSON.stringify(progress))
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

// ─── BD persistence (fire-and-forget) ────────────────────────────────────────

function persistProgressToDB(challengeId: string, progress: AchievementProgress): void {
  getAuthToken().then(token => {
    if (!token) return
    fetch('/api/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        challengeId,
        count: progress.count,
        discoveryShown: progress.discoveryShown,
        rewardShown: progress.rewardShown,
        unlockedAt: progress.unlockedAt ?? null,
      }),
    }).catch(() => undefined)
  }).catch(() => undefined)
}

function saveProgress(challengeId: string, progress: AchievementProgress): void {
  saveProgressLocal(challengeId, progress)
  persistProgressToDB(challengeId, progress)
}

// ─── Sync desde BD al arrancar ────────────────────────────────────────────────

/**
 * Descarga el progreso guardado en BD y lo fusiona en localStorage.
 * La BD gana si tiene mayor count o si el logro está desbloqueado allá pero no aquí.
 * Esto restaura el progreso en nuevos dispositivos o tras limpiar caché.
 */
export async function syncAchievementsFromDB(): Promise<void> {
  if (typeof window === 'undefined') return
  const token = await getAuthToken()
  if (!token) return

  try {
    const res = await fetch('/api/achievements', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const json = (await res.json()) as {
      ok: boolean
      achievements: Array<{
        challenge_id: string
        count: number
        discovery_shown: boolean
        reward_shown: boolean
        unlocked_at: string | null
        is_featured: boolean
      }>
    }
    if (!json.ok) return

    for (const row of json.achievements) {
      const local = loadProgress(row.challenge_id)

      // DB wins if it has higher count or if the reward is unlocked there but not locally
      const dbWins = row.count > local.count || (row.reward_shown && !local.rewardShown)
      if (!dbWins) continue

      const merged: AchievementProgress = {
        count: Math.max(row.count, local.count),
        discoveryShown: row.discovery_shown || local.discoveryShown,
        rewardShown: row.reward_shown || local.rewardShown,
        unlockedAt: row.unlocked_at ?? local.unlockedAt,
      }
      saveProgressLocal(row.challenge_id, merged)

      // Restore featured achievement from DB
      if (row.is_featured && row.reward_shown && row.unlocked_at) {
        const existing = loadFeaturedAchievement()
        if (!existing || existing.challengeId !== row.challenge_id) {
          // We need the challenge config to rebuild the featured object
          loadChallengesConfig().then(challenges => {
            const challenge = challenges.find(c => c.id === row.challenge_id)
            if (!challenge || !row.unlocked_at) return
            const featured: FeaturedAchievement = {
              challengeId: challenge.id,
              title: challenge.title,
              description: challenge.description,
              rarity: challenge.rarity,
              visual: challenge.visual,
              unlockedAt: row.unlocked_at,
            }
            window.localStorage.setItem(FEATURED_KEY, JSON.stringify(featured))
          }).catch(() => undefined)
        }
      }
    }
  } catch {
    // Silent — offline or auth error, localStorage is still valid
  }
}

// ─── Restricción de horario ───────────────────────────────────────────────────

function isInTimeRange(timeRange?: string): boolean {
  if (!timeRange) return true
  const parts = timeRange.split('-')
  if (parts.length < 2) return true
  const [startStr, endStr] = parts as [string, string]
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = startStr.split(':').map(Number)
  const [eh, em] = endStr.split(':').map(Number)
  const startMinutes = (sh ?? 0) * 60 + (sm ?? 0)
  const endMinutes = (eh ?? 0) * 60 + (em ?? 0)
  // Soporte cruces de medianoche (ej: 23:00-02:00)
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes
}

// ─── Motor principal ──────────────────────────────────────────────────────────

/**
 * Registra una acción del usuario y evalúa todos los retos que la escuchan.
 * Emite eventos de ventana según los umbrales definidos en challenges.json.
 *
 * @param userId  - ID del usuario (para metadatos de eventos).
 * @param actionType - Tipo de acción (debe coincidir con action_type del JSON).
 * @param metadata - Datos adicionales opcionales para el payload del evento.
 */
export async function trackAction(
  userId: string,
  actionType: string,
  metadata?: Record<string, unknown>,
): Promise<TrackActionResult[]> {
  if (typeof window === 'undefined') return []

  const challenges = await loadChallengesConfig()
  const results: TrackActionResult[] = []

  const matching = challenges.filter(c => c.action_type === actionType)

  for (const challenge of matching) {
    if (!isInTimeRange(challenge.time_range)) continue

    const prev = loadProgress(challenge.id)
    if (prev.rewardShown) continue

    const newCount = Math.min(prev.count + 1, challenge.target)
    const ratio = newCount / challenge.target

    let discoveryTriggered = false
    let rewardTriggered = false

    const next: AchievementProgress = { ...prev, count: newCount }

    // Umbral de descubrimiento — específico por reto
    if (!prev.discoveryShown && ratio >= challenge.reveal_threshold) {
      next.discoveryShown = true
      discoveryTriggered = true
      window.dispatchEvent(
        new CustomEvent('picada:show-discovery-toast', {
          detail: { challenge, progress: newCount, ratio, userId, ...metadata },
        }),
      )
    }

    // Completado al 100%
    if (ratio >= 1.0 && !prev.rewardShown) {
      next.rewardShown = true
      next.unlockedAt = new Date().toISOString()
      rewardTriggered = true
      window.dispatchEvent(
        new CustomEvent('picada:show-reward-modal', {
          detail: { challenge, progress: newCount, ratio, userId, unlockedAt: next.unlockedAt, ...metadata },
        }),
      )
    }

    saveProgress(challenge.id, next)
    results.push({ challengeId: challenge.id, progress: newCount, ratio, discoveryTriggered, rewardTriggered })
  }

  return results
}

// ─── Logro destacado (Equipar) ────────────────────────────────────────────────

export function loadFeaturedAchievement(): FeaturedAchievement | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FEATURED_KEY)
    return raw ? (JSON.parse(raw) as FeaturedAchievement) : null
  } catch {
    return null
  }
}

export function equipAchievement(challenge: DynamicChallenge, unlockedAt: string): void {
  if (typeof window === 'undefined') return
  const featured: FeaturedAchievement = {
    challengeId: challenge.id,
    title: challenge.title,
    description: challenge.description,
    rarity: challenge.rarity,
    visual: challenge.visual,
    unlockedAt,
  }
  window.localStorage.setItem(FEATURED_KEY, JSON.stringify(featured))
  window.dispatchEvent(new CustomEvent('picada:achievement-equipped', { detail: featured }))

  // Persist to DB (fire-and-forget)
  getAuthToken().then(token => {
    if (!token) return
    fetch('/api/achievements/featured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ challengeId: challenge.id }),
    }).catch(() => undefined)
  }).catch(() => undefined)
}

// ─── Vista general de progreso ────────────────────────────────────────────────

export async function getAllAchievementProgress(): Promise<
  Array<{ challenge: DynamicChallenge; progress: AchievementProgress }>
> {
  const challenges = await loadChallengesConfig()
  return challenges.map(c => ({ challenge: c, progress: loadProgress(c.id) }))
}

// ─── Init — conecta eventos existentes de Picada al motor ─────────────────────

/**
 * Inicializa el motor escuchando eventos del sistema ya existentes.
 * Llámalo desde page.tsx junto a initGamificationEvents().
 * Sincroniza el progreso desde la BD al arrancar (restaura logros en dispositivos nuevos).
 */
export function initAchievementEngine(userId: string): () => void {
  const handlers: Array<{ event: string; fn: EventListener }> = []

  const on = (event: string, actionType: string, getMeta?: (e: Event) => Record<string, unknown>) => {
    const fn = (e: Event) => {
      void trackAction(userId, actionType, getMeta?.(e))
    }
    window.addEventListener(event, fn)
    handlers.push({ event, fn })
  }

  on('picada:review-published', 'review_written')
  on('picada:photo-uploaded', 'photo_uploaded')
  on('picada:scan-complete', 'scan_complete')
  on('picada:vote-granted', 'picada_voted')
  on('picada:map-viewed', 'map_view')
  on('picada:like-given', 'like_given')
  on('picada:place-visited', 'place_view')
  on('picada:app-opened', 'app_open')
  on('picada:mood-used', 'mood_used')
  on('picada:profile-shared', 'profile_shared')

  // Sync progress from DB on init (restores progress after cache clear or new device)
  void syncAchievementsFromDB()

  // Exponer API global para que un Agente IA pueda recargar el config en caliente
  if (typeof window !== 'undefined') {
    ;(window as unknown as Record<string, unknown>).__picadaAchievements = {
      invalidateCache: invalidateConfigCache,
      reloadConfig: loadChallengesConfig,
      trackAction: (type: string, meta?: Record<string, unknown>) => trackAction(userId, type, meta),
      syncFromDB: syncAchievementsFromDB,
    }
  }

  return () => {
    handlers.forEach(({ event, fn }) => window.removeEventListener(event, fn))
  }
}
