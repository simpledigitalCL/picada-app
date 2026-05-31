'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Share2, Sparkles, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { equipAchievement, type DynamicChallenge, type Rarity } from '@/lib/gamification/achievement-engine'
import { notifyRewardModalClosed } from '@/lib/gamification/achievement-engine'

// ─── Estilos por rareza ───────────────────────────────────────────────────────

const RARITY_CONFIG: Record<Rarity, {
  bg: string
  glow: string
  border: string
  label: string
  gradient: string
  foil: boolean
}> = {
  Common: {
    bg: '#94a3b8',
    glow: 'shadow-slate-400/30',
    border: 'border-slate-300',
    label: 'Común',
    gradient: 'from-slate-400 to-slate-500',
    foil: false,
  },
  Rare: {
    bg: '#FF6B00',
    glow: 'shadow-orange-500/40',
    border: 'border-orange-400',
    label: 'Raro',
    gradient: 'from-orange-500 to-amber-500',
    foil: false,
  },
  Epic: {
    bg: '#22c55e',
    glow: 'shadow-green-500/40',
    border: 'border-green-400',
    label: 'Épico',
    gradient: 'from-green-500 to-emerald-600',
    foil: true,
  },
  Legendary: {
    bg: '#a855f7',
    glow: 'shadow-purple-500/50',
    border: 'border-purple-400',
    label: 'Legendario',
    gradient: 'from-purple-600 via-fuchsia-500 to-pink-500',
    foil: true,
  },
}

// ─── Carta Coleccionable ──────────────────────────────────────────────────────

function CollectibleCard({ challenge, unlockedAt }: { challenge: DynamicChallenge; unlockedAt: string }) {
  const cfg = RARITY_CONFIG[challenge.rarity]
  const date = new Date(unlockedAt).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <motion.div
      initial={{ rotateY: -25, scale: 0.85 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      className={cn(
        'relative mx-auto w-56 overflow-hidden rounded-3xl border-2 shadow-2xl',
        cfg.border,
        cfg.glow,
      )}
      style={{ perspective: '800px' }}
    >
      {/* Fondo degradado de rareza */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-95', cfg.gradient)} />

      {/* Efecto holográfico para Epic y Legendary */}
      {cfg.foil && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background:
              'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1.5 }}
        />
      )}

      {/* Contenido */}
      <div className="relative flex flex-col items-center gap-3 px-6 py-8 text-center text-white">
        {/* Rarity pill */}
        <span className="rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest">
          ✦ {cfg.label} ✦
        </span>

        {/* Ícono central */}
        <div className="flex size-24 items-center justify-center rounded-full bg-white/20 shadow-inner backdrop-blur-sm">
          {challenge.visual.type === 'emoji' && (
            <span className="text-5xl leading-none" role="img">{challenge.visual.value}</span>
          )}
          {challenge.visual.type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={challenge.visual.value} alt="" className="size-16 rounded-full object-cover" />
          )}
          {challenge.visual.type === 'svg' && (
            <span
              className="size-12"
              dangerouslySetInnerHTML={{ __html: challenge.visual.value }}
              aria-hidden
            />
          )}
        </div>

        {/* Título */}
        <h2 className="text-xl font-extrabold leading-tight drop-shadow-md">
          {challenge.title}
        </h2>

        {/* Descripción */}
        <p className="text-xs leading-relaxed opacity-85">
          {challenge.description}
        </p>

        {/* Sello de fecha */}
        <div className="mt-1 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
          <Trophy className="size-3 shrink-0 opacity-80" />
          <span className="text-[10px] font-semibold opacity-80">{date}</span>
        </div>

        {/* Número de edición decorativo */}
        <p className="text-[9px] font-mono opacity-50">
          PICADA.APP · #{challenge.id.toUpperCase().slice(0, 12)}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

type RewardEvent = {
  challenge: DynamicChallenge
  unlockedAt: string
}

export function RewardModal() {
  const [event, setEvent] = useState<RewardEvent | null>(null)
  const [equipped, setEquipped] = useState(false)
  const [published, setPublished] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<RewardEvent & { unlockedAt?: string }>).detail
      setEvent({
        challenge: detail.challenge,
        unlockedAt: detail.unlockedAt ?? new Date().toISOString(),
      })
      setEquipped(false)
      setPublished(false)
    }
    window.addEventListener('picada:show-reward-modal', handler)
    return () => window.removeEventListener('picada:show-reward-modal', handler)
  }, [])

  const closeModal = () => {
    setEvent(null)
    notifyRewardModalClosed()
  }

  const handleEquip = () => {
    if (!event) return
    equipAchievement(event.challenge, event.unlockedAt)
    setEquipped(true)
  }

  const handlePublish = () => {
    if (!event) return
    const { challenge, unlockedAt } = event
    const cfg = RARITY_CONFIG[challenge.rarity]

    // Emite el post tipo "Carta Coleccionable" en La Ruta
    const post = {
      id: `achieve-${challenge.id}-${Date.now()}`,
      type: 'review' as const,
      text: `🏆 ¡Logro desbloqueado: "${challenge.title}"!\n${challenge.description}\n\n✦ ${cfg.label} — Picada.App`,
      place: undefined,
      imageDataUrl: undefined,
      rating: undefined,
      createdAt: unlockedAt,
      achievementMeta: {
        challengeId: challenge.id,
        rarity: challenge.rarity,
        visual: challenge.visual,
      },
    }

    window.dispatchEvent(new CustomEvent('picada:review-published', { detail: post }))
    setPublished(true)
  }

  const handleShare = async () => {
    if (!event) return
    const { challenge } = event
    const text = `🏆 Desbloqueé "${challenge.title}" en Picada.App!\n${challenge.description}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: challenge.title, text }).catch(() => null)
    } else if (typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(text).catch(() => null)
    }
  }

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <motion.div
            initial={{ y: 80, scale: 0.92 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 80, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="relative w-full max-w-sm rounded-t-3xl bg-[#0f0f14] pb-safe-bottom p-6 sm:rounded-3xl"
          >
            {/* Cerrar */}
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>

            {/* Header */}
            <div className="mb-5 text-center">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <Sparkles className="size-4 text-yellow-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">
                  Logro completado
                </span>
                <Sparkles className="size-4 text-yellow-400" />
              </div>
              <p className="text-sm text-white/50">Tu carta coleccionable está lista</p>
            </div>

            {/* Carta */}
            <CollectibleCard challenge={event.challenge} unlockedAt={event.unlockedAt} />

            {/* Acciones */}
            <div className="mt-6 flex flex-col gap-2">
              <Button
                className={cn(
                  'h-12 w-full rounded-2xl text-sm font-bold',
                  equipped
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-white text-black hover:bg-white/90',
                )}
                onClick={handleEquip}
              >
                <Trophy className="mr-2 size-4 shrink-0" />
                {equipped ? '✓ Título equipado en tu perfil' : 'Equipar título en perfil'}
              </Button>

              <Button
                className={cn(
                  'h-12 w-full rounded-2xl text-sm font-bold',
                  published
                    ? 'bg-green-700/80 text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white',
                )}
                onClick={handlePublish}
                disabled={published}
              >
                <Sparkles className="mr-2 size-4 shrink-0" />
                {published ? '✓ Publicado en La Ruta' : 'Publicar en La Ruta'}
              </Button>

              <Button
                variant="ghost"
                className="h-10 w-full rounded-2xl text-sm text-white/60 hover:bg-white/10 hover:text-white"
                onClick={handleShare}
              >
                <Share2 className="mr-2 size-4 shrink-0" />
                Compartir logro
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
