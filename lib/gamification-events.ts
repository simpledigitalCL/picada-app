'use client'

import { subscribeDomainEvents } from '@/lib/events'
import { grantPoints, progressChallenge } from '@/lib/gamification'

let initialized = false

export function initGamificationEvents(): () => void {
  if (initialized) return () => {}
  initialized = true

  const unsub = subscribeDomainEvents(ev => {
    const xp = typeof ev.payload?.xp === 'number' ? ev.payload.xp : null
    if (ev.type === 'CONTENT_CREATED') {
      grantPoints(xp ?? 10)
      progressChallenge('review', 1)
      return
    }
    if (ev.type === 'USER_REVIEWED') {
      grantPoints(xp ?? 10)
      progressChallenge('review', typeof ev.payload?.challengeAmount === 'number' ? ev.payload.challengeAmount : 1)
      return
    }
    if (ev.type === 'USER_VISITED') {
      grantPoints(xp ?? 10)
      progressChallenge('visit')
      return
    }
    if (ev.type === 'USER_VOTED') {
      if (ev.payload?.voted === false) return
      grantPoints(xp ?? 2)
      progressChallenge('social')
      return
    }
    if (ev.type === 'USER_SAVED') {
      if (ev.payload?.saved === false) return
      grantPoints(xp ?? 3)
      progressChallenge('social')
      return
    }
    if (ev.type === 'USER_SCANNED') {
      grantPoints(xp ?? 10)
      progressChallenge('scan')
    }
  })

  return () => {
    initialized = false
    unsub()
  }
}

