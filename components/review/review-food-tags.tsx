'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FOOD_TAG_CATEGORIES,
  FOOD_TAG_MAX_PER_CATEGORY,
  FOOD_TAG_XP_EACH,
  canonicalFoodTagFor,
  type FoodContentCategoryId,
} from '@/lib/tags/food-content'
import { normalizeWithClosestMatch } from '@/lib/tags/normalization'
import { cn } from '@/lib/utils'

type Picks = Record<string, string[]>

type Props = {
  shuffleSeed: number
  picks: Picks
  onPicksChange: (next: Picks) => void
  quickSuggestFromKind?: string[]
  smartSuggestedTags?: string[]
}

// Categorías siempre visibles (las más útiles para el usuario)
const PRIMARY_CATS: FoodContentCategoryId[] = ['tipo_plato', 'dieta_rest']
// Categorías en sección avanzada — se expanden al presionar
const ADVANCED_CATS: FoodContentCategoryId[] = ['sabor_y_aroma', 'textura_sensacion', 'presentacion']
// ingredientes_destacados excluida: solapa con tipo_plato y confunde

const CAT_EMOJI: Record<FoodContentCategoryId, string> = {
  tipo_plato:              '🍽️',
  sabor_y_aroma:           '👅',
  textura_sensacion:       '✨',
  ingredientes_destacados: '🥬',
  presentacion:            '📸',
  dieta_rest:              '🌿',
}

const CAT_COLOR: Record<FoodContentCategoryId, string> = {
  tipo_plato:              'border-orange-200 bg-orange-50/60',
  sabor_y_aroma:           'border-rose-200 bg-rose-50/40',
  textura_sensacion:       'border-sky-200 bg-sky-50/40',
  ingredientes_destacados: 'border-green-200 bg-green-50/40',
  presentacion:            'border-violet-200 bg-violet-50/40',
  dieta_rest:              'border-emerald-200 bg-emerald-50/40',
}

const ACTIVE_COLOR: Record<FoodContentCategoryId, string> = {
  tipo_plato:              'bg-orange-500 text-white border-orange-500',
  sabor_y_aroma:           'bg-rose-500 text-white border-rose-500',
  textura_sensacion:       'bg-sky-500 text-white border-sky-500',
  ingredientes_destacados: 'bg-green-600 text-white border-green-600',
  presentacion:            'bg-violet-500 text-white border-violet-500',
  dieta_rest:              'bg-emerald-600 text-white border-emerald-600',
}

function getCatDef(id: FoodContentCategoryId) {
  return FOOD_TAG_CATEGORIES.find(c => c.id === id)
}

function togglePick(picks: Picks, cat: FoodContentCategoryId, label: string): Picks {
  const cur = picks[cat] || []
  const has = cur.some(x => x.toLowerCase() === label.toLowerCase())
  const nextLabels = has
    ? cur.filter(x => x.toLowerCase() !== label.toLowerCase())
    : cur.length >= FOOD_TAG_MAX_PER_CATEGORY ? cur : [...cur, label]
  if (nextLabels.length === 0) {
    const { [cat]: _r, ...rest } = picks
    return rest
  }
  return { ...picks, [cat]: nextLabels }
}

function addCustomPick(picks: Picks, cat: FoodContentCategoryId, raw: string): Picks {
  const catalog = getCatDef(cat)?.options || []
  const label = normalizeWithClosestMatch(raw, catalog).trim()
  if (label.length < 2 || label.length > 40) return picks
  const cur = picks[cat] || []
  if (cur.length >= FOOD_TAG_MAX_PER_CATEGORY) return picks
  if (cur.some(x => x.toLowerCase() === label.toLowerCase())) return picks
  return { ...picks, [cat]: [...cur, label] }
}

function sortBySmartSignal(cat: FoodContentCategoryId, options: string[], smartTags: string[]) {
  if (!smartTags.length) return options
  const map = new Map<string, number>()
  smartTags.forEach((raw, i) => {
    for (const opt of options) {
      if (canonicalFoodTagFor(cat, opt) === raw.toLowerCase()) { map.set(opt, i); break }
    }
  })
  return [...options].sort((a, b) => {
    const sa = map.has(a) ? map.get(a)! : Infinity
    const sb = map.has(b) ? map.get(b)! : Infinity
    return sa - sb
  })
}

function CategoryBlock({
  cid,
  picks,
  onPicksChange,
  smartSuggestedTags = [],
}: {
  cid: FoodContentCategoryId
  picks: Picks
  onPicksChange: (p: Picks) => void
  smartSuggestedTags?: string[]
}) {
  const def = getCatDef(cid)
  if (!def) return null
  const selected = picks[cid] || []
  const [customText, setCustomText] = useState('')

  return (
    <div className={cn('rounded-2xl border p-3 space-y-2.5', CAT_COLOR[cid])}>
      <div>
        <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <span>{CAT_EMOJI[cid]}</span>
          {def.title}
          {selected.length > 0 && (
            <span className={cn('ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full', ACTIVE_COLOR[cid])}>
              {selected.length} sel.
            </span>
          )}
        </p>
        {def.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{def.hint}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sortBySmartSignal(cid, def.options, smartSuggestedTags).map(opt => {
          const on = selected.some(s => s.toLowerCase() === opt.toLowerCase())
          const atCap = selected.length >= FOOD_TAG_MAX_PER_CATEGORY && !on
          return (
            <button
              key={opt}
              type="button"
              disabled={atCap}
              onClick={() => onPicksChange(togglePick(picks, cid, opt))}
              className={cn(
                'px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all',
                on ? ACTIVE_COLOR[cid] : 'border-border bg-background/80 hover:border-current',
                atCap && 'opacity-40 cursor-not-allowed',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {/* Custom entry */}
      <div className="flex gap-1.5 items-center">
        <input
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          placeholder="Agregar otro..."
          className="h-7 flex-1 rounded-lg border border-border bg-background/70 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
          onKeyDown={e => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (!customText.trim()) return
            onPicksChange(addCustomPick(picks, cid, customText))
            setCustomText('')
          }}
        />
        <span className="text-[10px] text-muted-foreground shrink-0">{selected.length}/{FOOD_TAG_MAX_PER_CATEGORY}</span>
      </div>
    </div>
  )
}

export function ReviewFoodTags({
  picks,
  onPicksChange,
  quickSuggestFromKind = [],
  smartSuggestedTags = [],
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const totalPicks = useMemo(
    () => Object.values(picks).reduce((n, a) => n + (a?.length || 0), 0),
    [picks],
  )
  const advancedPicks = ADVANCED_CATS.reduce((n, c) => n + (picks[c]?.length || 0), 0)
  const bonusXp = totalPicks * FOOD_TAG_XP_EACH

  const platterCat: FoodContentCategoryId = 'tipo_plato'
  const quickList = useMemo(() => {
    if (!quickSuggestFromKind.length) return []
    return [...quickSuggestFromKind].slice(0, 8)
  }, [quickSuggestFromKind])

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
          Sobre la comida
        </p>
        {bonusXp > 0 && (
          <span className="text-[11px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
            +{bonusXp} XP ganados
          </span>
        )}
      </div>

      {/* Quick suggestions from local kind */}
      {quickList.length > 0 && (
        <div className="rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 p-3 space-y-2">
          <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">
            ⚡ Sugerencias según el local
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickList.map(label => {
              const cur = picks[platterCat] || []
              const on = cur.some(s => s.toLowerCase() === label.toLowerCase())
              const atCap = cur.length >= FOOD_TAG_MAX_PER_CATEGORY && !on
              return (
                <button
                  key={label}
                  type="button"
                  disabled={atCap}
                  onClick={() => onPicksChange(togglePick(picks, platterCat, label))}
                  className={cn(
                    'px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all',
                    on ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'border-orange-300 bg-white hover:bg-orange-100',
                    atCap && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {on ? '✓ ' : '+ '}{label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Primary categories — always visible */}
      {PRIMARY_CATS.map(cid => (
        <CategoryBlock
          key={cid}
          cid={cid}
          picks={picks}
          onPicksChange={onPicksChange}
          smartSuggestedTags={smartSuggestedTags}
        />
      ))}

      {/* Advanced section */}
      <button
        type="button"
        onClick={() => setAdvancedOpen(v => !v)}
        className={cn(
          'w-full rounded-2xl border-2 border-dashed px-4 py-3 flex items-center justify-between transition-all',
          advancedOpen
            ? 'border-violet-400 bg-violet-50/60'
            : 'border-violet-200 bg-gradient-to-r from-violet-50/40 to-pink-50/40 hover:border-violet-300',
        )}
      >
        <div className="flex items-center gap-2.5 text-left">
          <div className="size-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Sparkles className="size-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-violet-900">Detalles del plato</p>
            <p className="text-[10px] text-violet-600">
              {advancedOpen
                ? 'Sabor · Textura · Presentación'
                : advancedPicks > 0
                  ? `${advancedPicks} detalles añadidos · +${advancedPicks * FOOD_TAG_XP_EACH} XP extra`
                  : `Sabor, textura, presentación · +${FOOD_TAG_XP_EACH} XP c/u`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {advancedPicks > 0 && !advancedOpen && (
            <span className="text-[10px] font-bold text-white bg-violet-500 rounded-full px-1.5 py-0.5">
              {advancedPicks}
            </span>
          )}
          {advancedOpen
            ? <ChevronUp className="size-4 text-violet-500" />
            : <ChevronDown className="size-4 text-violet-400" />}
        </div>
      </button>

      <AnimatePresence>
        {advancedOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              <div className="rounded-2xl border border-violet-200 bg-violet-50/30 p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1">
                  <Sparkles className="size-3" /> Nivel avanzado · más XP
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Estos datos nos ayudan a construir el perfil gastronómico del local. Suma <strong className="text-violet-700">+{FOOD_TAG_XP_EACH} XP</strong> por cada etiqueta.
                </p>
              </div>
              {ADVANCED_CATS.map(cid => (
                <CategoryBlock
                  key={cid}
                  cid={cid}
                  picks={picks}
                  onPicksChange={onPicksChange}
                  smartSuggestedTags={smartSuggestedTags}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
