type Bucket = {
  count: number
  resetAt: number
}

const memoryBuckets = new Map<string, Bucket>()

function cleanupExpired(now: number) {
  for (const [k, v] of memoryBuckets.entries()) {
    if (v.resetAt <= now) memoryBuckets.delete(k)
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const first = forwarded.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  cleanupExpired(now)
  const current = memoryBuckets.get(key)
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs
    memoryBuckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt }
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt }
  }
  current.count += 1
  memoryBuckets.set(key, current)
  return { ok: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt }
}
