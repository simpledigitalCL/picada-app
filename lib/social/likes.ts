const LIKES_KEY = 'picada.likes.v1'
const LIKED_KEY = 'picada.liked.posts.v1'
const FOLLOWING_KEY = 'picada.following.users.v1'

export function getLikeCount(postId: string): number {
  try {
    const raw = window.localStorage.getItem(LIKES_KEY)
    const likes: Record<string, number> = raw ? JSON.parse(raw) : {}
    return likes[postId] || 0
  } catch { return 0 }
}

export function hasLiked(postId: string): boolean {
  try {
    const raw = window.localStorage.getItem(LIKED_KEY)
    const liked: string[] = raw ? JSON.parse(raw) : []
    return liked.includes(postId)
  } catch { return false }
}

export function toggleLike(postId: string, initialCount = 0): { liked: boolean; count: number } {
  try {
    const likedRaw = window.localStorage.getItem(LIKED_KEY)
    const liked: string[] = likedRaw ? JSON.parse(likedRaw) : []
    const alreadyLiked = liked.includes(postId)
    const likesRaw = window.localStorage.getItem(LIKES_KEY)
    const likes: Record<string, number> = likesRaw ? JSON.parse(likesRaw) : {}
    const current = likes[postId] ?? initialCount
    if (alreadyLiked) {
      window.localStorage.setItem(LIKED_KEY, JSON.stringify(liked.filter(id => id !== postId)))
      likes[postId] = Math.max(0, current - 1)
    } else {
      liked.push(postId)
      window.localStorage.setItem(LIKED_KEY, JSON.stringify(liked))
      likes[postId] = current + 1
    }
    window.localStorage.setItem(LIKES_KEY, JSON.stringify(likes))
    return { liked: !alreadyLiked, count: likes[postId] }
  } catch { return { liked: false, count: initialCount } }
}

export function isFollowing(username: string): boolean {
  try {
    const raw = window.localStorage.getItem(FOLLOWING_KEY)
    const following: string[] = raw ? JSON.parse(raw) : []
    return following.includes(username)
  } catch { return false }
}

export function toggleFollow(username: string): boolean {
  try {
    const raw = window.localStorage.getItem(FOLLOWING_KEY)
    const following: string[] = raw ? JSON.parse(raw) : []
    const idx = following.indexOf(username)
    if (idx >= 0) following.splice(idx, 1)
    else following.push(username)
    window.localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following))
    window.dispatchEvent(new CustomEvent('picada:following-updated'))
    return idx < 0
  } catch { return false }
}

export function getFollowing(): string[] {
  try {
    const raw = window.localStorage.getItem(FOLLOWING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
