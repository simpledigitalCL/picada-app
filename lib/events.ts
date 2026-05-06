'use client'

import { getOrCreateIdentity } from '@/lib/identity'
import { trackDomainEvent } from '@/lib/api/events'

export type DomainEventType =
  | 'CONTENT_CREATED'
  | 'USER_VOTED'
  | 'USER_REVIEWED'
  | 'USER_SAVED'
  | 'USER_VISITED'
  | 'USER_SCANNED'

export type DomainEvent = {
  type: DomainEventType
  payload?: Record<string, unknown>
  ts: number
}

const EVENT_NAME = 'picada:domain-event'

export function emitDomainEvent(type: DomainEventType, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const identity = getOrCreateIdentity()
  const ev: DomainEvent = { type, payload, ts: Date.now() }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ev }))
  void trackDomainEvent({
    ...ev,
    payload: {
      ...payload,
      userId: identity.userId,
      username: identity.username,
    },
  })
}

export function subscribeDomainEvents(handler: (ev: DomainEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<DomainEvent>).detail
    if (detail?.type) handler(detail)
  }
  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}

