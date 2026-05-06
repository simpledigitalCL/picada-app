import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase'

const AFFINITY_KEY = 'picada.user.tag_affinity.v1'

type AffinityMap = Record<string, number>
type AffinityRow = { tag_slug: string; weight: number }

function readAffinity(): AffinityMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(AFFINITY_KEY)
    return raw ? (JSON.parse(raw) as AffinityMap) : {}
  } catch {
    return {}
  }
}

function writeAffinity(next: AffinityMap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AFFINITY_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function useUserAffinity() {
  const [weights, setWeights] = useState<AffinityMap>({})
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const local = readAffinity()
    setWeights(local)
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    let cancelled = false
    const hydrate = async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id || null
      if (cancelled) return
      setUserId(uid)
      if (!uid) return
      const { data: dbRows } = await supabase
        .from('user_tag_affinity')
        .select('tag_slug, weight')
        .eq('user_id', uid)
      if (cancelled) return
      const dbMap: AffinityMap = {}
      for (const row of (dbRows || []) as AffinityRow[]) {
        const slug = String(row.tag_slug || '').toLowerCase().trim()
        if (!slug) continue
        dbMap[slug] = Number(row.weight || 0)
      }
      const merged: AffinityMap = { ...local }
      for (const [slug, weight] of Object.entries(dbMap)) {
        merged[slug] = Number(merged[slug] || 0) + Number(weight || 0)
      }
      setWeights(merged)
      writeAffinity(merged)
    }
    void hydrate()

    const { data: authSub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const uid = session?.user?.id || null
      setUserId(uid)
    })

    return () => {
      cancelled = true
      authSub.subscription.unsubscribe()
    }
  }, [])

  const incrementDbAffinity = useCallback(async (uid: string, tags: string[]) => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || tags.length === 0) return

    const { data: existingRows } = await supabase
      .from('user_tag_affinity')
      .select('tag_slug, weight')
      .eq('user_id', uid)
      .in('tag_slug', tags)

    const existing = new Map<string, number>()
    for (const row of (existingRows || []) as AffinityRow[]) {
      const slug = String(row.tag_slug || '').toLowerCase().trim()
      if (!slug) continue
      existing.set(slug, Number(row.weight || 0))
    }

    const now = new Date().toISOString()
    const payload = tags.map(slug => ({
      user_id: uid,
      tag_slug: slug,
      weight: Number(existing.get(slug) || 0) + 1,
      updated_at: now,
    }))

    await supabase
      .from('user_tag_affinity')
      .upsert(payload, { onConflict: 'user_id,tag_slug' })
  }, [])

  const trackTags = useCallback((tags: string[]) => {
    const clean = [...new Set((tags || []).map(t => String(t || '').toLowerCase().trim()).filter(Boolean))]
    if (clean.length === 0) return
    setWeights(prev => {
      const next = { ...prev }
      for (const t of clean) next[t] = Number(next[t] || 0) + 1
      writeAffinity(next)
      return next
    })
    if (userId) {
      void incrementDbAffinity(userId, clean)
    }
  }, [incrementDbAffinity, userId])

  const topTags = useMemo(
    () =>
      Object.entries(weights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => tag),
    [weights],
  )

  return { weights, topTags, trackTags, trackInteraction: trackTags }
}

