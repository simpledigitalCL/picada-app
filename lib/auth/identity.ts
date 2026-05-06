'use client'

const USER_ID_KEY = 'picada.user.id.v1'
const USERNAME_KEY = 'picada.user.username.v1'

export type UserIdentity = {
  userId: string
  username: string
}

export type VisibleUserIdentity = UserIdentity & {
  level: string
}

function randomId() {
  return `user-${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateIdentity(): UserIdentity {
  if (typeof window === 'undefined') return { userId: 'user-anon', username: 'foodie' }

  let userId = (window.localStorage.getItem(USER_ID_KEY) || '').trim()
  let username = (window.localStorage.getItem(USERNAME_KEY) || '').trim()

  if (!userId) {
    userId = randomId()
    window.localStorage.setItem(USER_ID_KEY, userId)
  }
  if (!username) {
    username = `foodie_${userId.slice(-4)}`
    window.localStorage.setItem(USERNAME_KEY, username)
  }
  return { userId, username }
}

export function setUsername(username: string) {
  if (typeof window === 'undefined') return
  const normalized = username.trim()
  if (!normalized) return
  window.localStorage.setItem(USERNAME_KEY, normalized)
}

export async function getVisibleIdentity(): Promise<VisibleUserIdentity> {
  const base = getOrCreateIdentity()
  if (typeof window === 'undefined') return { ...base, level: 'Explorador' }
  const { getNivel, loadPoints } = await import('@/lib/gamification/core')
  return { ...base, level: getNivel(loadPoints()).nombre }
}

