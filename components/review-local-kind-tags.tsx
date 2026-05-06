'use client'

import { useMemo } from 'react'
import {
  LOCAL_KIND_MAX_SELECTIONS,
  LOCAL_KIND_XP_EACH,
  shuffleLocalKindOptions,
  type LocalClassificationCategoryId,
} from '@/lib/venue-classification-tags'
import { cn } from '@/lib/utils'

type Picks = Record<string, string[]>

type Props = {
  shuffleSeed: number
  picks: Picks
  onPicksChange: (next: Picks) => void
}

const CAT: LocalClassificationCategoryId = 'local'

function toggleKind(picks: Picks, label: string): Picks {
  const cur = picks[CAT] || []
  const has = cur.some(x => x.toLowerCase() === label.toLowerCase())
  let nextLabels: string[]
  if (has) {
    nextLabels = cur.filter(x => x.toLowerCase() !== label.toLowerCase())
  } else {
    if (cur.length >= LOCAL_KIND_MAX_SELECTIONS) return picks
    nextLabels = [...cur, label]
  }
  if (nextLabels.length === 0) {
    const { [CAT]: _removed, ...rest } = picks
    return rest
  }
  return { ...picks, [CAT]: nextLabels }
}

export function ReviewLocalKindTags({ shuffleSeed, picks, onPicksChange }: Props) {
  const order = useMemo(() => shuffleLocalKindOptions(shuffleSeed), [shuffleSeed])
  const selected = picks[CAT] || []
  const bonusXp = selected.length * LOCAL_KIND_XP_EACH

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/80 via-background to-background p-3 shadow-sm">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          ¿Qué tipo de local es? 🏷️
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          Así mejoramos filtros del mapa (comida rápida, café, sanguchería…). Elegí hasta{' '}
          {LOCAL_KIND_MAX_SELECTIONS} · <span className="font-semibold text-emerald-700">+{LOCAL_KIND_XP_EACH} XP</span>{' '}
          c/u{bonusXp > 0 ? <span className="text-emerald-700"> · vas +{bonusXp} XP</span> : null}.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {order.map(opt => {
          const on = selected.some(s => s.toLowerCase() === opt.toLowerCase())
          const atCap = selected.length >= LOCAL_KIND_MAX_SELECTIONS && !on
          return (
            <button
              key={opt}
              type="button"
              disabled={atCap}
              onClick={() => onPicksChange(toggleKind(picks, opt))}
              className={cn(
                'px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all leading-snug',
                on
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-[1.02]'
                  : 'border-border bg-background hover:border-emerald-400 hover:bg-emerald-50/80',
                atCap && 'opacity-45 cursor-not-allowed',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
