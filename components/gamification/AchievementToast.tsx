'use client'

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase'

export function AchievementToast() {
  const lastPointsRef = useRef<number | null>(null)
  const lastLevelRef = useRef<number | null>(null)

  useEffect(() => {
    // --- Feedback para usuarios anónimos via CustomEvent ---
    const onXpGranted = (e: Event) => {
      const detail = (e as CustomEvent<{ amount?: number; currentTotal?: number }>).detail
      const amount = Number(detail?.amount || 0)
      const currentTotal = Number(detail?.currentTotal || 0)
      if (!amount) return
      toast.success(`+${amount} XP ganados`, {
        description: currentTotal > 0 ? `Total actual: ${currentTotal} puntos.` : 'Gracias por tu aporte a la comunidad.',
        duration: 3000,
      })
    }
    window.addEventListener('picada:xp-granted', onXpGranted)

    // --- Feedback para usuarios autenticados via Supabase Realtime ---
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return () => window.removeEventListener('picada:xp-granted', onXpGranted)

    let channel: ReturnType<typeof supabase.channel> | null = null

    const init = async () => {
      const { data: auth } = await supabase.auth.getSession()
      const uid = auth.session?.user?.id
      if (!uid) return

      const { data: profile } = await supabase.from('profiles').select('points, level').eq('id', uid).maybeSingle()
      lastPointsRef.current = Number(profile?.points || 0)
      lastLevelRef.current = Number(profile?.level || 1)

      channel = supabase
        .channel('profiles')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, payload => {
          const nextPoints = Number((payload.new as { points?: number })?.points || 0)
          const nextLevel = Number((payload.new as { level?: number })?.level || 1)
          const prevPoints = lastPointsRef.current ?? nextPoints
          const prevLevel = lastLevelRef.current ?? nextLevel
          const delta = nextPoints - prevPoints

          // Usuarios autenticados reciben el delta real desde la DB — no duplicar el evento anónimo
          window.removeEventListener('picada:xp-granted', onXpGranted)

          if (delta > 0) {
            toast.success(`+${delta} XP`, { description: `Ahora tienes ${nextPoints} puntos.` })
          }
          if (nextLevel > prevLevel) {
            toast.success(`¡Subiste a nivel ${nextLevel}!`, { description: 'Excelente aporte a la comunidad.' })
            confetti({ particleCount: 110, spread: 75, origin: { y: 0.65 } })
          }

          lastPointsRef.current = nextPoints
          lastLevelRef.current = nextLevel
        })
        .subscribe()
    }

    void init()
    return () => {
      window.removeEventListener('picada:xp-granted', onXpGranted)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return null
}
