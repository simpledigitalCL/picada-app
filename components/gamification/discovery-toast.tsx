'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { DynamicChallenge, Rarity } from '@/lib/gamification/achievement-engine'

const RARITY_STYLES: Record<Rarity, { bg: string; border: string; label: string }> = {
  Common: { bg: '#94a3b8', border: '#94a3b8', label: 'Común' },
  Rare: { bg: '#FF6B00', border: '#FB923C', label: 'Raro' },
  Epic: { bg: '#22c55e', border: '#4ade80', label: 'Épico' },
  Legendary: { bg: '#a855f7', border: '#c084fc', label: 'Legendario' },
}

type ToastEvent = {
  id: number
  challenge: DynamicChallenge
  progress: number
  ratio: number
}

const TOAST_DURATION_MS = 4_500

export function DiscoveryToast() {
  const [toasts, setToasts] = useState<ToastEvent[]>([])

  useEffect(() => {
    let counter = 0
    const handler = (e: Event) => {
      const { challenge, progress, ratio } = (e as CustomEvent<{
        challenge: DynamicChallenge
        progress: number
        ratio: number
      }>).detail
      if (!challenge || (challenge.rarity !== 'Epic' && challenge.rarity !== 'Legendary')) return
      const id = ++counter
      setToasts(prev => [...prev, { id, challenge, progress, ratio }])
      window.setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, TOAST_DURATION_MS)
    }

    window.addEventListener('picada:show-discovery-toast', handler)
    return () => window.removeEventListener('picada:show-discovery-toast', handler)
  }, [])

  return (
    <div className="fixed top-3 right-3 z-[300] flex flex-col items-end gap-3 pointer-events-none max-w-[min(90vw,22rem)]">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => {
          const styles = RARITY_STYLES[toast.challenge.rarity]
          const pct = Math.round(toast.ratio * 100)
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="pointer-events-auto w-full overflow-hidden rounded-2xl border bg-[#0f0f14]/90 backdrop-blur-md shadow-xl"
              style={{ borderColor: styles.border }}
            >
              <div className="flex gap-3 p-3">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: styles.bg }}
                >
                  {toast.challenge.visual.type === 'emoji' ? toast.challenge.visual.value : '🏆'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
                    Logro {styles.label} en camino
                  </p>
                  <p className="truncate text-sm font-bold text-white">{toast.challenge.title}</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/70 line-clamp-2">
                    {toast.challenge.description}
                  </p>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-700"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-white/50">
                    {toast.progress} / {toast.challenge.target} · {pct}%
                  </p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
