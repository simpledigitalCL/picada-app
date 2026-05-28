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

// ─── Anti-abuso (escalera + dedupe) ───────────────────────────────────────────

type ActionMetadata = Record<string, unknown>

const SEEN_KEY = 'picada.achieve.seen.v1'
const COOLDOWN_KEY = 'picada.achieve.cooldown.v1'

/** Preview parcial solo para retos de alta rareza (ver shouldShowDiscoveryPreview). */
function shouldShowDiscoveryPreview(challenge: DynamicChallenge): boolean {
  return challenge.rarity === 'Epic' || challenge.rarity === 'Legendary'
}

type SeenStore = Record<string, Record<string, number>>
type CooldownStore = Record<string, number>

function readSeen(): SeenStore {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '{}') as SeenStore
  } catch {
    return {}
  }
}

function writeSeen(store: SeenStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(store))
}

function readCooldown(): CooldownStore {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(sessionStorage.getItem(COOLDOWN_KEY) ?? '{}') as CooldownStore
  } catch {
    return {}
  }
}

function writeCooldown(store: CooldownStore): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(COOLDOWN_KEY, JSON.stringify(store))
}

function localDateKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function markSeen(bucket: string, id: string): void {
  const store = readSeen()
  if (!store[bucket]) store[bucket] = {}
  store[bucket][id] = Date.now()
  writeSeen(store)
}

function hasSeen(bucket: string, id: string): boolean {
  return Boolean(readSeen()[bucket]?.[id])
}

function cooldownMs(key: string, ms: number): boolean {
  const store = readCooldown()
  const last = store[key] ?? 0
  const now = Date.now()
  if (now - last < ms) return false
  store[key] = now
  writeCooldown(store)
  return true
}

function inferPlaceCategories(metadata?: ActionMetadata): string[] {
  const cats = new Set<string>()
  const primary = metadata?.category
  if (typeof primary === 'string' && primary) cats.add(primary)
  if (Array.isArray(metadata?.categories)) {
    for (const c of metadata.categories) {
      if (typeof c === 'string' && c) cats.add(c)
    }
  }
  const hay = [
    String(metadata?.placeName ?? metadata?.name ?? ''),
    ...(Array.isArray(metadata?.tags) ? metadata.tags.map(String) : []),
  ]
    .join(' ')
    .toLowerCase()
  if (/completo|hot.?dog|vienesa|tomate.?mayo/i.test(hay)) cats.add('completos')
  return [...cats]
}

function challengeMatchesCategory(
  challenge: DynamicChallenge,
  metadata?: ActionMetadata,
): boolean {
  if (!challenge.category) return true
  if (challenge.action_type === 'category_visit') {
    return inferPlaceCategories(metadata).includes(challenge.category)
  }
  if (challenge.action_type === 'review_written') {
    return inferPlaceCategories(metadata).includes(challenge.category)
  }
  return true
}

function pickLadderChallenge(
  challenges: DynamicChallenge[],
  getCount: (challengeId: string) => number,
): DynamicChallenge | null {
  const sorted = [...challenges].sort((a, b) => a.target - b.target)
  for (const c of sorted) {
    if (getCount(c.id) >= c.target) continue
    return c
  }
  return null
}

function acceptActionForAchievements(
  actionType: string,
  metadata?: ActionMetadata,
): { ok: true } | { ok: false } {
  const placeId = String(metadata?.placeId ?? '').trim()

  switch (actionType) {
    case 'place_view': {
      if (!placeId) return { ok: false }
      if (hasSeen('place_view', placeId)) return { ok: false }
      markSeen('place_view', placeId)
      return { ok: true }
    }
    case 'category_visit': {
      if (!placeId) return { ok: false }
      const cat = String(metadata?.category ?? inferPlaceCategories(metadata)[0] ?? 'any')
      const bucket = `category_visit:${cat}`
      if (hasSeen(bucket, placeId)) return { ok: false }
      markSeen(bucket, placeId)
      return { ok: true }
    }
    case 'map_view':
      return cooldownMs('map_view', 45_000) ? { ok: true } : { ok: false }
    case 'app_open': {
      const day = localDateKey()
      if (hasSeen('app_open', day)) return { ok: false }
      markSeen('app_open', day)
      return { ok: true }
    }
    case 'like_given': {
      const postId = String(metadata?.postId ?? '').trim()
      if (postId) {
        if (hasSeen('like_given', postId)) return { ok: false }
        markSeen('like_given', postId)
        return { ok: true }
      }
      return cooldownMs('like_given', 3_000) ? { ok: true } : { ok: false }
    }
    case 'picada_voted': {
      const picadaId = String(metadata?.picadaId ?? '').trim()
      if (!picadaId || hasSeen('picada_voted', picadaId)) return { ok: false }
      markSeen('picada_voted', picadaId)
      return { ok: true }
    }
    case 'review_written': {
      const postId = String(metadata?.postId ?? metadata?.reviewId ?? '').trim()
      if (postId) {
        if (hasSeen('review_written', postId)) return { ok: false }
        markSeen('review_written', postId)
        return { ok: true }
      }
      return cooldownMs('review_written', 5_000) ? { ok: true } : { ok: false }
    }
    case 'photo_uploaded': {
      const postId = String(metadata?.postId ?? '').trim()
      if (postId) {
        if (hasSeen('photo_uploaded', postId)) return { ok: false }
        markSeen('photo_uploaded', postId)
        return { ok: true }
      }
      return cooldownMs('photo_uploaded', 5_000) ? { ok: true } : { ok: false }
    }
    case 'scan_complete':
      return cooldownMs('scan_complete', 8_000) ? { ok: true } : { ok: false }
    case 'profile_shared':
      return cooldownMs('profile_shared', 30_000) ? { ok: true } : { ok: false }
    case 'mood_used':
      return cooldownMs('mood_used', 10_000) ? { ok: true } : { ok: false }
    default:
      return cooldownMs(`action:${actionType}`, 2_000) ? { ok: true } : { ok: false }
  }
}

// ─── Cola de modales de premio (uno a la vez) ─────────────────────────────────

type RewardModalPayload = {
  challenge: DynamicChallenge
  progress: number
  ratio: number
  userId: string
  unlockedAt: string
  [key: string]: unknown
}

const rewardQueue: RewardModalPayload[] = []
let rewardModalBusy = false

function enqueueRewardModal(payload: RewardModalPayload): void {
  if (typeof window === 'undefined') return
  rewardQueue.push(payload)
  drainRewardModals()
}

function drainRewardModals(): void {
  if (rewardModalBusy || rewardQueue.length === 0) return
  rewardModalBusy = true
  window.dispatchEvent(new CustomEvent('picada:show-reward-modal', { detail: rewardQueue.shift() }))
}

/** Llamar al cerrar RewardModal para encadenar el siguiente premio pendiente. */
export function notifyRewardModalClosed(): void {
  rewardModalBusy = false
  drainRewardModals()
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

  const guard = acceptActionForAchievements(actionType, metadata)
  if (!guard.ok) return []

  const challenges = await loadChallengesConfig()
  const eligible = challenges.filter(
    c =>
      c.action_type === actionType &&
      isInTimeRange(c.time_range) &&
      challengeMatchesCategory(c, metadata),
  )

  const challenge = pickLadderChallenge(eligible, id => loadProgress(id).count)
  if (!challenge) return []

  const prev = loadProgress(challenge.id)
  if (prev.rewardShown) return []

  const newCount = Math.min(prev.count + 1, challenge.target)
  const ratio = newCount / challenge.target

  let discoveryTriggered = false
  let rewardTriggered = false

  const next: AchievementProgress = { ...prev, count: newCount }

  if (!prev.discoveryShown && ratio >= challenge.reveal_threshold) {
    next.discoveryShown = true
    discoveryTriggered = true
    if (shouldShowDiscoveryPreview(challenge)) {
      window.dispatchEvent(
        new CustomEvent('picada:show-discovery-toast', {
          detail: { challenge, progress: newCount, ratio, userId, ...metadata },
        }),
      )
    }
  }

  if (ratio >= 1.0 && !prev.rewardShown) {
    next.rewardShown = true
    next.unlockedAt = new Date().toISOString()
    rewardTriggered = true
    enqueueRewardModal({
      challenge,
      progress: newCount,
      ratio,
      userId,
      unlockedAt: next.unlockedAt,
      ...metadata,
    })
  }

  saveProgress(challenge.id, next)
  return [{ challengeId: challenge.id, progress: newCount, ratio, discoveryTriggered, rewardTriggered }]
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

  const placeMeta = (e: Event) => {
    const d = ((e as CustomEvent).detail || {}) as Record<string, unknown>
    const categories = inferPlaceCategories(d)
    return { ...d, categories, category: d.category ?? categories[0] }
  }

  const reviewMeta = (e: Event) => {
    const d = ((e as CustomEvent).detail || {}) as Record<string, unknown>
    return {
      postId: d.id ?? d.postId,
      placeId: d.placeId,
      placeName: d.place,
      tags: d.tags,
      category: d.category,
      categories: inferPlaceCategories({
        placeName: d.place,
        tags: d.tags,
        category: d.category,
      }),
    }
  }

  on('picada:review-published', 'review_written', reviewMeta)
  on('picada:photo-uploaded', 'photo_uploaded', e => {
    const d = ((e as CustomEvent).detail || {}) as Record<string, unknown>
    return { postId: d.id ?? d.postId }
  })
  on('picada:scan-complete', 'scan_complete')
  on('picada:vote-granted', 'picada_voted', e => {
    const d = ((e as CustomEvent).detail || {}) as Record<string, unknown>
    return { picadaId: d.picadaId, placeName: d.placeName }
  })
  on('picada:map-viewed', 'map_view')
  on('picada:like-given', 'like_given', e => {
    const d = ((e as CustomEvent).detail || {}) as Record<string, unknown>
    return { postId: d.postId }
  })
  const onPlaceVisited = (e: Event) => {
    const meta = placeMeta(e)
    void trackAction(userId, 'place_view', meta)
    const cats = inferPlaceCategories(meta)
    const seenCat = new Set<string>()
    for (const cat of cats) {
      if (seenCat.has(cat)) continue
      seenCat.add(cat)
      void trackAction(userId, 'category_visit', { ...meta, category: cat })
    }
  }
  window.addEventListener('picada:place-visited', onPlaceVisited)
  handlers.push({ event: 'picada:place-visited', fn: onPlaceVisited })

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
