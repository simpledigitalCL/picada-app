'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  VENUE_TAG_CATEGORIES,
  VENUE_TAG_INITIAL_CATEGORIES,
  VENUE_TAG_MAX_PER_CATEGORY,
  VENUE_TAG_MORE_CATEGORIES,
  VENUE_TAG_XP_EACH,
  shuffleCategoryIds,
  type VenueCategoryId,
} from '@/lib/tags/review-venue'
import { cn } from '@/lib/utils'

type Picks = Record<string, string[]>

type Props = {
  /** Semilla estable mientras dure el paso 2 (p. ej. timestamp al entrar) */
  shuffleSeed: number
  picks: Picks
  onPicksChange: (next: Picks) => void
}

const CATEGORY_EMOJI: Record<VenueCategoryId, string> = {
  ambiente: '✨',
  vestimenta: '👕',
  servicio: '🧑‍🍳',
  espacio: '🪑',
  ocasion: '🎉',
  calidad: '🏅',
}

function getCategoryDef(id: VenueCategoryId) {
  return VENUE_TAG_CATEGORIES.find(c => c.id === id)
}

function togglePick(picks: Picks, cat: VenueCategoryId, label: string): Picks {
  const cur = picks[cat] || []
  const has = cur.some(x => x.toLowerCase() === label.toLowerCase())
  let nextLabels: string[]
  if (has) {
    nextLabels = cur.filter(x => x.toLowerCase() !== label.toLowerCase())
  } else {
    if (cur.length >= VENUE_TAG_MAX_PER_CATEGORY) return picks
    nextLabels = [...cur, label]
  }
  const next = { ...picks, [cat]: nextLabels }
  if (nextLabels.length === 0) delete next[cat]
  return next
}

function addCustomPick(picks: Picks, cat: VenueCategoryId, raw: string): Picks {
  const label = raw.trim()
  if (label.length < 2 || label.length > 40) return picks
  const cur = picks[cat] || []
  if (cur.length >= VENUE_TAG_MAX_PER_CATEGORY) return picks
  if (cur.some(x => x.toLowerCase() === label.toLowerCase())) return picks
  return { ...picks, [cat]: [...cur, label] }
}

export function ReviewVenueTags({ shuffleSeed, picks, onPicksChange }: Props) {
  const order = useMemo(() => shuffleCategoryIds(shuffleSeed), [shuffleSeed])
  const [visibleCount, setVisibleCount] = useState(VENUE_TAG_INITIAL_CATEGORIES)
  const [customText, setCustomText] = useState<Partial<Record<VenueCategoryId, string>>>({})

  const visibleIds = order.slice(0, Math.min(visibleCount, order.length))
  const canShowMore = visibleCount < order.length

  const totalPicks = useMemo(
    () => Object.values(picks).reduce((n, a) => n + (a?.length || 0), 0),
    [picks],
  )
  const bonusXp = totalPicks * VENUE_TAG_XP_EACH

  return (
    <div className="space-y-4 rounded-2xl border bg-gradient-to-b from-amber-50/70 via-background to-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Etiquetas del local ✨</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            Etiquetas de sensación y contexto (no de platos). Hasta {VENUE_TAG_MAX_PER_CATEGORY} por categoría ·{' '}
            <span className="font-semibold text-amber-700">+{VENUE_TAG_XP_EACH} XP</span> c/u
            {bonusXp > 0 ? <span className="text-amber-700"> · vas +{bonusXp} XP</span> : null}.
          </p>
        </div>
      </div>

      {visibleIds.map(cid => {
        const def = getCategoryDef(cid)
        if (!def) return null
        const selected = picks[cid] || []
        const draft = customText[cid] || ''

        return (
          <div key={cid} className="space-y-2 rounded-xl border border-amber-100/80 bg-white/80 p-2.5">
            <div>
              <p className="text-sm font-semibold text-foreground">
                <span className="mr-1.5">{CATEGORY_EMOJI[cid]}</span>
                {def.title}
              </p>
              {def.hint ? <p className="text-[10px] text-muted-foreground">{def.hint}</p> : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {def.options.map(opt => {
                const on = selected.some(s => s.toLowerCase() === opt.toLowerCase())
                const atCap = selected.length >= VENUE_TAG_MAX_PER_CATEGORY && !on
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={atCap}
                    onClick={() => onPicksChange(togglePick(picks, cid, opt))}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                      on
                        ? 'bg-orange-500 text-white border-orange-500 scale-[1.03] shadow-sm'
                        : 'border-border bg-background hover:border-orange-300 hover:bg-orange-50/80 hover:-translate-y-0.5',
                      atCap && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                value={draft}
                onChange={e => setCustomText(t => ({ ...t, [cid]: e.target.value }))}
                placeholder="Otro (Enter)"
                className="h-8 text-xs rounded-lg max-w-[200px]"
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const v = draft.trim()
                  if (!v) return
                  onPicksChange(addCustomPick(picks, cid, v))
                  setCustomText(t => ({ ...t, [cid]: '' }))
                }}
              />
              <span className="text-[10px] text-muted-foreground shrink-0">
                {selected.length}/{VENUE_TAG_MAX_PER_CATEGORY}
              </span>
            </div>
          </div>
        )
      })}

      {canShowMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-xl h-9 text-xs gap-1 border-dashed border-amber-300 text-amber-800 hover:bg-amber-50"
          onClick={() => setVisibleCount(c => Math.min(c + VENUE_TAG_MORE_CATEGORIES, order.length))}
        >
          <ChevronDown className="size-3.5" />
          Mostrar más categorías (+{VENUE_TAG_MORE_CATEGORIES}) — más opciones para sumar XP
        </Button>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground">Ya viste todas las categorías.</p>
      )}
    </div>
  )
}
