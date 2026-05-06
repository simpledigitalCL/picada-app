'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Edit3, Camera, Ghost, MapPin, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PostFormType = 'review' | 'media' | 'incognito' | 'new-picada' | 'scan'

const BLOCK_FAB = 'picada:block-fab'

const ACTIONS: {
  id: PostFormType
  icon: React.ComponentType<{ className?: string }>
  emoji: string
  label: string
  description: string
  color: string
  bg: string
  ring: string
  featured?: boolean
}[] = [
  {
    id: 'new-picada',
    icon: MapPin,
    emoji: '📍',
    label: 'Nueva picada',
    description: 'Agrega un local que la gente no conoce',
    color: 'text-white',
    bg: 'bg-gradient-to-br from-orange-500 to-amber-600',
    ring: 'ring-orange-300/50',
  },
  {
    id: 'scan',
    icon: ScanLine,
    emoji: '🤖',
    label: 'Escanear plato',
    description: 'Analiza tu comida con IA',
    color: 'text-white',
    bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    ring: 'ring-emerald-300/50',
  },
  {
    id: 'incognito',
    icon: Ghost,
    emoji: '👻',
    label: 'Modo incógnito',
    description: 'Publica sin vincular tu perfil',
    color: 'text-white',
    bg: 'bg-gradient-to-br from-slate-600 to-slate-800',
    ring: 'ring-slate-400/40',
  },
  {
    id: 'media',
    icon: Camera,
    emoji: '📸',
    label: 'Foto / Video',
    description: 'Sube contenido con análisis de IA',
    color: 'text-white',
    bg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    ring: 'ring-violet-300/50',
  },
  {
    id: 'review',
    icon: Edit3,
    emoji: '✍️',
    label: 'Reseña rápida',
    description: 'Comparte tu experiencia en el local',
    color: 'text-white',
    bg: 'bg-gradient-to-br from-sky-500 to-blue-600',
    ring: 'ring-sky-300/50',
    featured: true,
  },
]

export function GlobalActionButton({
  onAction,
  hidden = false,
  /** Formulario, escáner u otros: ocultar FAB para no estorbar */
  suppressed = false,
}: {
  onAction: (id: PostFormType) => void
  /** Ocultar en mapa, Reels, detalle abierto, etc. */
  hidden?: boolean
  suppressed?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [blockedByProfile, setBlockedByProfile] = useState(false)

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ blocked?: boolean }>).detail
      setBlockedByProfile(Boolean(d?.blocked))
    }
    window.addEventListener(BLOCK_FAB, h as EventListener)
    return () => window.removeEventListener(BLOCK_FAB, h as EventListener)
  }, [])

  const blocked = hidden || suppressed || blockedByProfile

  useEffect(() => {
    if (blocked) setOpen(false)
  }, [blocked])

  if (blocked) return null

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-[72px] right-4 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {open && ACTIONS.map((action, i) => (
            <motion.div
              key={action.id}
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 18, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.92 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 380, damping: 26 }}
            >
              <div
                className={cn(
                  'max-w-[min(220px,calc(100vw-6.5rem))] rounded-2xl border px-3.5 py-2.5 text-right shadow-lg',
                  'border-zinc-200/90 bg-white dark:border-zinc-700 dark:bg-zinc-900',
                  'ring-1 ring-black/5 dark:ring-white/10',
                  action.featured && 'border-sky-300/90 bg-sky-50 dark:bg-sky-950/40',
                )}
              >
                <p className="text-sm font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                  {action.emoji} {action.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-300">
                  {action.description}
                </p>
                {action.featured ? (
                  <p className="mt-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300">Recomendado para ganar XP rápido ⚡</p>
                ) : null}
              </div>

              <motion.button
                type="button"
                className={cn(
                  'size-12 shrink-0 rounded-full shadow-lg ring-2 relative',
                  action.bg,
                  action.color,
                  action.ring,
                  'flex items-center justify-center',
                )}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setOpen(false)
                  onAction(action.id)
                }}
                aria-label={action.label}
              >
                {action.featured ? (
                  <span className="absolute -inset-1 rounded-full border-2 border-sky-200/80 motion-safe:animate-ping" />
                ) : null}
                <action.icon className="size-5" />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>

        <motion.button
          type="button"
          className={cn(
            'relative z-10 flex size-14 items-center justify-center rounded-full',
            'bg-gradient-to-br from-orange-500 via-orange-500 to-amber-600 text-white',
            'shadow-[0_8px_30px_rgba(234,88,12,0.45)] ring-2 ring-white/30 dark:ring-orange-950/40',
          )}
          onClick={() => setOpen(v => !v)}
          animate={{ rotate: open ? 45 : 0 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          aria-label="Crear contenido"
        >
          <Plus className="size-6 stroke-[2.5px]" />
        </motion.button>
        {!open ? (
          <motion.button
            type="button"
            onClick={() => {
              setOpen(true)
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-full border border-orange-200 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-orange-700 shadow-sm hover:bg-orange-50"
          >
            ✍️ Publica una reseña y gana XP
          </motion.button>
        ) : null}
      </div>
    </>
  )
}
