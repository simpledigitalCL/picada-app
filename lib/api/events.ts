'use client'

import type { DomainEvent } from '@/lib/events'
import { getAuthHeaders } from '@/lib/api/auth'

export async function trackDomainEvent(event: DomainEvent): Promise<{ ok: boolean }> {
  try {
    const authHeaders = await getAuthHeaders()
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(event),
    })
    if (!res.ok) return { ok: false }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

