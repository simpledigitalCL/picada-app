'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle2, Zap } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const SUGGEST_MAP: Record<string, { icon: string; label: string; className: string }[]> = {
  sushi: [{ icon: '🍣', label: 'Japonés', className: 'bg-violet-500/10 text-violet-700 border-violet-500/30' }],
  japon: [{ icon: '🍣', label: 'Japonés', className: 'bg-violet-500/10 text-violet-700 border-violet-500/30' }],
  ruid: [{ icon: '🔇', label: 'Ruidoso', className: 'bg-red-500/10 text-red-700 border-red-500/30' }],
  tranqu: [{ icon: '🔈', label: 'Tranquilo', className: 'bg-green-500/10 text-green-700 border-green-500/30' }],
  econom: [{ icon: '💸', label: 'Económico', className: 'bg-amber-500/10 text-amber-800 border-amber-500/30' }],
  barato: [{ icon: '💸', label: 'Económico', className: 'bg-amber-500/10 text-amber-800 border-amber-500/30' }],
  vegano: [{ icon: '🌱', label: 'Vegano', className: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30' }],
  veg: [{ icon: '🥗', label: 'Vegetariano', className: 'bg-lime-500/10 text-lime-800 border-lime-500/30' }],
  picada: [{ icon: '🏆', label: 'Picada', className: 'bg-orange-500/10 text-orange-800 border-orange-500/30' }],
  familia: [{ icon: '👨‍👩‍👧', label: 'Familiar', className: 'bg-blue-500/10 text-blue-800 border-blue-500/30' }],
  romant: [{ icon: '🌹', label: 'Romántico', className: 'bg-pink-500/10 text-pink-800 border-pink-500/30' }],
}

type Tag = (typeof SUGGEST_MAP)['sushi'][number]

type Props = {
  value: string
  onChange: (t: string) => void
  className?: string
}

export function AIReviewTags({ value, onChange, className }: Props) {
  const [suggested, setSuggested] = useState<Tag[]>([])
  const [added, setAdded] = useState<string[]>([])
  const [points, setPoints] = useState(0)
  const [hint, setHint] = useState('')

  useEffect(() => {
    const lower = value.toLowerCase()
    const found: Tag[] = []
    for (const [key, list] of Object.entries(SUGGEST_MAP)) {
      if (lower.includes(key)) {
        for (const t of list) {
          if (!found.find(f => f.label === t.label)) found.push(t)
        }
      }
    }
    setSuggested(found.filter(t => !added.includes(t.label)))

    if (value.length < 10) setHint('Escribe al menos 10 caracteres para publicar.')
    else if (value.length < 30) setHint('Agrega un poco más de detalle para ayudar a la comunidad.')
    else if (value.length < 60) setHint('Puedes añadir etiquetas detectadas para +3 pts cada una.')
    else setHint('Reseña sólida. ¡Gracias por el aporte!')

    setPoints(
      Math.min(50, Math.floor(value.length / 4) + added.length * 3),
    )
  }, [value, added])

  const addTag = (t: Tag) => {
    setAdded(p => [...p, t.label])
    setSuggested(s => s.filter(x => x.label !== t.label))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Editor con asistencia (basado en lo que escribes)</p>
        <motion.div
          key={points}
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5"
        >
          <Zap className="size-3 text-orange-500" />
          <span className="text-xs font-bold text-orange-600">+{points} pts</span>
        </motion.div>
      </div>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Mínimo 10 caracteres. Describe ambiente, platos, atención…"
        className="rounded-2xl resize-none text-sm min-h-[120px] bg-muted/40 border-dashed"
      />
      <div className="flex justify-end">
        <span className="text-[10px] text-muted-foreground">{value.length} caracteres</span>
      </div>

      <AnimatePresence mode="wait">
        {hint && (
          <motion.div
            key={hint}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-xl border bg-muted/30 px-3 py-2"
          >
            <Sparkles className="size-3.5 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {suggested.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Detectado — toca para sumar al texto</p>
            <div className="flex flex-wrap gap-1.5">
              {suggested.map((t, i) => (
                <motion.button
                  key={t.label}
                  type="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => addTag(t)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1',
                    t.className,
                  )}
                >
                  {t.icon} {t.label} <span className="opacity-60">+3</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {added.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {added.map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-800"
            >
              <CheckCircle2 className="size-2.5" /> {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
