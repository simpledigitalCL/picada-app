'use client'

import { syncLocalState, votePicadaRemote } from '@/lib/api/social'
import { emitDomainEvent } from '@/lib/events'
import { grantPoints, loadPoints, loadStreak, checkAndUnlockBadges } from '@/lib/gamification/core'
import { XP_RULES } from '@/lib/gamification/standards'

const VOTES_KEY = 'picada.hot.votes.v1'
const USER_VOTES_KEY = 'picada.hot.userVotes.v1'
const VISIT_LATER_KEY = 'picada.pending.dishes.v1'
const SOCIAL_UPDATED_EVENT = 'picada:social-updated'

export type SocialInteraction = {
  votedPicada: boolean
  picadaVotesCount: number
  savedForLater: boolean
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function emitSocialUpdated(picadaId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SOCIAL_UPDATED_EVENT, { detail: { picadaId } }))
}

export function subscribeToSocialChanges(callback: (picadaId?: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (ev: Event) => {
    const detail = (ev as CustomEvent<{ picadaId?: string }>).detail
    callback(detail?.picadaId)
  }
  window.addEventListener(SOCIAL_UPDATED_EVENT, handler)
  return () => window.removeEventListener(SOCIAL_UPDATED_EVENT, handler)
}

export function getVotesState(): {
  votes: Record<string, number>
  userVotes: Record<string, boolean>
} {
  return {
    votes: readJson<Record<string, number>>(VOTES_KEY, {}),
    userVotes: readJson<Record<string, boolean>>(USER_VOTES_KEY, {}),
  }
}

export function getVisitLaterState(): string[] {
  return readJson<string[]>(VISIT_LATER_KEY, [])
}

export function getUserInteraction(picadaId: string, placeName?: string): SocialInteraction {
  const { votes, userVotes } = getVotesState()
  const visitLater = getVisitLaterState()
  return {
    votedPicada: Boolean(userVotes[picadaId]),
    picadaVotesCount: votes[picadaId] || 0,
    savedForLater: placeName ? visitLater.includes(placeName) : false,
  }
}

export async function votePicada(
  picadaId: string,
  voteType: 'toggle' | 'up' = 'toggle',
  meta?: { placeName?: string; placeAddress?: string; mapsUrl?: string },
): Promise<SocialInteraction> {
  const { votes, userVotes } = getVotesState()
  const isVoted = Boolean(userVotes[picadaId])
  const current = votes[picadaId] || 0
  const wasFirst = current === 0

  const shouldVoteUp = voteType === 'up' ? true : !isVoted
  votes[picadaId] = shouldVoteUp ? current + 1 : Math.max(0, current - 1)
  userVotes[picadaId] = shouldVoteUp

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(VOTES_KEY, JSON.stringify(votes))
    window.localStorage.setItem(USER_VOTES_KEY, JSON.stringify(userVotes))
  }

  emitSocialUpdated(picadaId)
  if (typeof window !== 'undefined' && shouldVoteUp) {
    const xp = wasFirst ? XP_RULES.picadaVoteFirst : XP_RULES.picadaVote
    grantPoints(xp)
    window.dispatchEvent(new CustomEvent('picada:vote-granted', {
      detail: { xp, wasFirst, placeName: meta?.placeName, picadaId },
    }))
    if (wasFirst) {
      const firstVotes = Number(window.localStorage.getItem('picada.first.votes.v1') || '0') + 1
      window.localStorage.setItem('picada.first.votes.v1', String(firstVotes))
      checkAndUnlockBadges(loadPoints(), loadStreak().current)
      window.dispatchEvent(new CustomEvent('picada:first-discovery', {
        detail: { placeName: meta?.placeName, picadaId },
      }))
    }
    if ((votes[picadaId] || 0) === 10) {
      grantPoints(XP_RULES.picadaMilestone10)
      window.dispatchEvent(new CustomEvent('picada:vote-milestone', {
        detail: { picadaId, placeName: meta?.placeName, votes: 10, xp: XP_RULES.picadaMilestone10 },
      }))
    }
  }
  emitDomainEvent('USER_VOTED', {
    picadaId,
    voted: shouldVoteUp,
    placeName: meta?.placeName,
    placeAddress: meta?.placeAddress,
    mapsUrl: meta?.mapsUrl,
  })
  void votePicadaRemote({ picadaId, voteType: shouldVoteUp ? 'up' : 'down' })
  void syncLocalState({ votes, userVotes, visitLater: getVisitLaterState() })

  return {
    votedPicada: shouldVoteUp,
    picadaVotesCount: votes[picadaId],
    savedForLater: false,
  }
}

export function toggleVisitLater(placeName: string): { savedForLater: boolean; list: string[] } {
  const pending = getVisitLaterState()
  const exists = pending.includes(placeName)
  const next = exists ? pending.filter(n => n !== placeName) : [...pending, placeName]
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(VISIT_LATER_KEY, JSON.stringify(next))
  }
  emitSocialUpdated(placeName)
  emitDomainEvent('USER_SAVED', { placeName, saved: !exists })
  const { votes, userVotes } = getVotesState()
  void syncLocalState({ votes, userVotes, visitLater: next })
  return { savedForLater: !exists, list: next }
}

