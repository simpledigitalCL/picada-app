'use client'

import { getAuthHeaders } from '@/lib/api/auth'
import type { InteractionType } from '@/lib/validation/interactions-schema'

type QueueItem = {
  type: InteractionType
  placeRef?: string
  context?: Record<string, unknown>
}

const ANON_ID_KEY = 'picada.user.id.v1'
const ANON_ID_PATTERN = /^user-[a-z0-9-]{2,40}$/i
const MAX_BATCH = 25
const FLUSH_MS = 15_000

let queue: QueueItem[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
// Una impresión por lugar+tab por carga de página
const seenImpressions = new Set<string>()

function readAnonId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const stored = (window.localStorage.getItem(ANON_ID_KEY) || '').trim()
  // Tras el login este valor pasa a ser el UUID real; la identidad va en el Bearer
  return ANON_ID_PATTERN.test(stored) && stored !== 'user-anon' ? stored : undefined
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (flushing || queue.length === 0) return
  flushing = true
  const items = queue.slice(0, MAX_BATCH)
  queue = queue.slice(items.length)
  try {
    const authHeaders = await getAuthHeaders()
    await fetch('/api/interactions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ anonId: readAnonId(), items }),
      keepalive: true,
    })
  } catch {
    // señal best-effort: nunca interrumpir la UI por telemetría
  } finally {
    flushing = false
  }
  if (queue.length > 0 && !timer) {
    timer = setTimeout(() => void flush(), FLUSH_MS)
  }
}

/**
 * Encola una interacción usuario↔lugar y la envía en batch a
 * /api/interactions/batch (cada 25 items o 15s, lo que ocurra primero).
 * Las impresiones se deduplican por lugar+tab dentro de la carga de página.
 */
export function trackInteraction(
  type: InteractionType,
  placeRef?: string,
  context?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return
  if (type === 'impression') {
    const key = `${placeRef || ''}::${String(context?.tab || '')}`
    if (seenImpressions.has(key)) return
    seenImpressions.add(key)
  }
  queue.push({ type, placeRef, context })
  if (queue.length >= MAX_BATCH) {
    void flush()
    return
  }
  if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS)
}

/** Registra las impresiones de una lista renderizada, con posición. */
export function trackImpressions(
  items: Array<{ placeRef: string }>,
  tab: string,
  extraContext?: Record<string, unknown>,
): void {
  items.forEach((item, idx) => {
    if (!item.placeRef) return
    trackInteraction('impression', item.placeRef, { tab, position: idx, ...extraContext })
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}
