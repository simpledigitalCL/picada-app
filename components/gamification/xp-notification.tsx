'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { triggerLevelUpTone, triggerTapHaptic } from '@/lib/utils/device-feedback'

type XpEvent = { amount: number; currentTotal: number; id: number }

export function XpNotification() {
  const [events, setEvents] = useState<XpEvent[]>([])

  useEffect(() => {
    let counter = 0
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ amount?: number; currentTotal?: number }>).detail
      const amount = Number(detail?.amount || 0)
      const currentTotal = Number(detail?.currentTotal || 0)
      if (!amount) return
      const id = ++counter
      setEvents(prev => [...prev, { amount, currentTotal, id }])
      setTimeout(() => {
        setEvents(prev => prev.filter(ev => ev.id !== id))
      }, 2200)
    }
    window.addEventListener('picada:xp-granted', handler)
    return () => window.removeEventListener('picada:xp-granted', handler)
  }, [])

  return (
    <div className="fixed top-16 right-4 z-[200] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {events.map(ev => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="flex items-center gap-1.5 bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg"
          >
            <span>+{ev.amount} XP</span>
            {ev.currentTotal > 0 ? <span className="text-[10px] opacity-85">({ev.currentTotal})</span> : null}
            <span>⚡</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

type LevelUpEvent = { nivel: { nombre: string; emoji: string; color: string } }

export function LevelUpNotification() {
  const [event, setEvent] = useState<LevelUpEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      setEvent((e as CustomEvent<LevelUpEvent>).detail)
      triggerTapHaptic(35)
      triggerLevelUpTone()
      setTimeout(() => setEvent(null), 4000)
    }
    window.addEventListener('picada:level-up', handler)
    return () => window.removeEventListener('picada:level-up', handler)
  }, [])

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 280, damping: 20 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
        >
          <div className="bg-background border-2 border-orange-400 shadow-2xl rounded-2xl px-6 py-4 flex flex-col items-center gap-1 text-center min-w-[200px]">
            <span className="text-4xl">{event.nivel.emoji}</span>
            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">¡Subiste de nivel!</p>
            <p className={`text-lg font-extrabold ${event.nivel.color}`}>{event.nivel.nombre}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type BadgeEvent = { name: string; emoji: string; description: string }

export function BadgeNotification() {
  const [badge, setBadge] = useState<BadgeEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BadgeEvent>).detail
      setBadge(detail)
      triggerTapHaptic(25)
      setTimeout(() => setBadge(null), 3500)
    }
    window.addEventListener('picada:badge-unlocked', handler)
    return () => window.removeEventListener('picada:badge-unlocked', handler)
  }, [])

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 350, damping: 24 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
        >
          <div className="bg-background border shadow-xl rounded-2xl px-5 py-3 flex items-center gap-3 min-w-[220px]">
            <span className="text-3xl">{badge.emoji}</span>
            <div>
              <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">Badge desbloqueado</p>
              <p className="text-sm font-bold leading-tight">{badge.name}</p>
              <p className="text-xs text-muted-foreground">{badge.description}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
