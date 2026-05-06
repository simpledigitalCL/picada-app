'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { DynamicChallenge, Rarity } from '@/lib/achievement-engine'

const RARITY_STYLES: Record<Rarity, { bg: string; border: string; label: string; pulse: boolean }> = {
  Common:    { bg: '#94a3b8', border: '#94a3b8', label: 'Común',      pulse: false },
  Rare:      { bg: '#FF6B00', border: '#FB923C', label: 'Raro',       pulse: false },
  Epic:      { bg: '#22c55e', border: '#4ade80', label: 'Épico',      pulse: false },
  Legendary: { bg: '#a855f7', border: '#c084fc', label: 'Legendario', pulse: true  },
}

function AchievementVisual({ visual, rarity }: { visual: DynamicChallenge['visual']; rarity: Rarity }) {
  const styles = RARITY_STYLES[rarity]
  return (
    <div
      style={{
        backgroundColor: styles.bg,
        width: 48,
        height: 48,
        borderRadius: 16,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        animation: styles.pulse ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
      }}
    >
      {visual.type === 'emoji' && (
        <span style={{ fontSize: 24, lineHeight: 1 }} role="img">{visual.value}</span>
      )}
      {visual.type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={visual.value} alt="" style={{ width: 32, height: 32, borderRadius: 12, objectFit: 'cover' }} />
      )}
      {visual.type === 'svg' && (
        <span
          style={{ width: 28, height: 28, display: 'block' }}
          dangerouslySetInnerHTML={{ __html: visual.value }}
          aria-hidden
        />
      )}
    </div>
  )
}

function ThresholdBar({ ratio, color }: { ratio: number; color: string }) {
  const pct = Math.min(ratio * 100, 100)
  return (
    <div style={{ marginTop: 8, height: 4, width: '100%', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.15)' }}>
      <div
        style={{
          height: '100%',
          borderRadius: 9999,
          width: `${pct}%`,
          backgroundColor: '#fff',
          transition: 'width 0.7s ease',
        }}
      />
    </div>
  )
}

type ToastEvent = {
  id: number
  challenge: DynamicChallenge
  progress: number
  ratio: number
}

const TOAST_DURATION_MS = 5000

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

      const id = ++counter
      setToasts(prev => [...prev, { id, challenge, progress, ratio }])

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, TOAST_DURATION_MS)
    }

    window.addEventListener('picada:show-discovery-toast', handler)
    return () => window.removeEventListener('picada:show-discovery-toast', handler)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => {
          const styles = RARITY_STYLES[toast.challenge.rarity]
          const pct = Math.round(toast.ratio * 100)
          const isLegendary = toast.challenge.rarity === 'Legendary'

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 30, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              style={{
                pointerEvents: 'auto',
                width: 'min(90vw, 22rem)',
                maxWidth: 352,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 16,
                  border: `1.5px solid ${styles.border}`,
                  background: 'rgba(15,15,20,0.75)',
                  boxShadow: isLegendary
                    ? `0 8px 32px rgba(0,0,0,0.6), 0 0 0 2px ${styles.border}40`
                    : '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                {/* Glow legendario */}
                {isLegendary && (
                  <div
                    style={{
                      pointerEvents: 'none',
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 16,
                      opacity: 0.2,
                      background: `radial-gradient(ellipse at 30% 50%, ${styles.bg} 0%, transparent 70%)`,
                    }}
                  />
                )}

                <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16 }}>
                  <AchievementVisual visual={toast.challenge.visual} rarity={toast.challenge.rarity} />

                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Pill rareza */}
                    <span
                      style={{
                        display: 'inline-block',
                        marginBottom: 4,
                        borderRadius: 9999,
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#fff',
                        backgroundColor: `${styles.bg}44`,
                      }}
                    >
                      {styles.label} · {pct}%
                    </span>

                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: '#fff' }}>
                      {toast.challenge.title}
                    </p>
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: 12,
                      lineHeight: 1.4,
                      color: 'rgba(255,255,255,0.6)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {toast.challenge.description}
                    </p>

                    <ThresholdBar ratio={toast.ratio} color={styles.bg} />

                    <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                      {toast.progress} de {toast.challenge.target} · se oculta en {Math.ceil(TOAST_DURATION_MS / 1000)}s
                    </p>
                  </div>
                </div>

                {/* Barra de tiempo auto-dismiss */}
                <motion.div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: 2,
                    borderRadius: 9999,
                    backgroundColor: styles.bg,
                  }}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: TOAST_DURATION_MS / 1000, ease: 'linear' }}
                />
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
