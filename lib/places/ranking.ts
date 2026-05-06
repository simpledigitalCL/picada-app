export type RankUser = {
  userId: string
  points: number
  reviews: number
  visits: number
  votes: number
}

export type RankPicada = {
  picadaId: string
  baseRating: number
  externalReviews: number
  communityVotes: number
  isOpenNow?: boolean
}

export type EventLike = {
  type: 'USER_VOTED' | 'USER_REVIEWED' | 'USER_SAVED' | 'USER_VISITED' | 'USER_SCANNED'
  payload?: Record<string, unknown>
}

export function calculateScore(user: RankUser): number {
  return (
    user.points * 1 +
    user.reviews * 25 +
    user.visits * 8 +
    user.votes * 4
  )
}

export function aggregateUserFromEvents(userId: string, events: EventLike[]): RankUser {
  let reviews = 0
  let visits = 0
  let votes = 0
  let points = 0

  for (const ev of events) {
    if (String(ev.payload?.userId || '') !== userId) continue
    const xp = Number(ev.payload?.xp || 0)
    if (Number.isFinite(xp) && xp > 0) points += xp
    if (ev.type === 'USER_REVIEWED') reviews += 1
    if (ev.type === 'USER_VISITED') visits += 1
    if (ev.type === 'USER_VOTED' && ev.payload?.voted !== false) votes += 1
  }

  return { userId, points, reviews, visits, votes }
}

export function aggregatePicadaVotes(events: EventLike[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const ev of events) {
    if (ev.type !== 'USER_VOTED') continue
    const picadaId = String(ev.payload?.picadaId || '')
    if (!picadaId) continue
    const delta = ev.payload?.voted === false ? -1 : 1
    out[picadaId] = Math.max(0, (out[picadaId] || 0) + delta)
  }
  return out
}

export function calculatePicadaRanking(picadas: RankPicada[]): RankPicada[] {
  const scored = picadas.map(p => {
    const score =
      p.baseRating * 20 +
      p.externalReviews * 0.7 +
      p.communityVotes * 9 +
      (p.isOpenNow ? 12 : 0)
    return { ...p, _score: score }
  })

  return scored
    .sort((a, b) => (b as RankPicada & { _score: number })._score - (a as RankPicada & { _score: number })._score)
    .map(({ _score: _omit, ...rest }) => rest as RankPicada)
}

