'use client'

/**
 * UnifiedTagInput — Matriz única de slugs: food_, attr_, ambience_, service_.
 * `context` ordena sugerencias rápidas; la búsqueda siempre recorre todas las dimensiones.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Plus, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { slugSegment } from '@/lib/tags/slug'

export type UnifiedTagContext = 'food' | 'venue'

const FOOD_POOL = [
  'food_completo_italiano', 'food_choripan', 'food_churrasco', 'food_barros_luco',
  'food_hamburguesa_smash', 'food_hamburguesa_clasica', 'food_chicken_burger',
  'food_pizza_margherita', 'food_pizza_napolitana', 'food_cuatro_quesos',
  'food_pepperoni', 'food_fugazzeta', 'food_pizza_masa_madre', 'food_calzone',
  'food_pasta_carbonara', 'food_pasta_pomodoro', 'food_lasana', 'food_risotto',
  'food_asado_vacuno', 'food_entraña', 'food_parrillada_mixta', 'food_plateada',
  'food_ceviche_clasico', 'food_paila_marina', 'food_reineta_frita', 'food_ostiones',
  'food_lomo_saltado', 'food_aji_de_gallina', 'food_causa_limena',
  'food_sushi_rolls', 'food_ramen', 'food_gyozas', 'food_pad_thai',
  'food_tacos_de_carne', 'food_quesadilla', 'food_nachos', 'food_burrito',
  'food_tostadas', 'food_avocado_toast', 'food_huevos_benedict', 'food_panqueques',
  'food_tabla_picoteo', 'food_papas_fritas', 'food_alitas', 'food_empanada',
  'food_cazuela', 'food_ensalada_completa', 'food_bowl_saludable', 'food_postre',
  'food_cafe_de_especialidad', 'food_cold_brew', 'food_cheesecake', 'food_croissant',
]

const ATTR_POOL = [
  'attr_vegano', 'attr_vegetariano', 'attr_sin_gluten', 'attr_sin_lactosa',
  'attr_keto', 'attr_paleo', 'attr_sin_azucar',
  'attr_alto_en_proteina', 'attr_bajo_en_calorias', 'attr_bajo_en_carbos',
  'attr_alto_en_fibra', 'attr_grasas_buenas',
  'attr_porcion_generosa', 'attr_porcion_pequena',
  'attr_economico', 'attr_buena_relacion_precio', 'attr_para_compartir',
]

const AMBIENCE_POOL = [
  'ambience_familiar',
  'ambience_romantic',
  'ambience_dimly_lit',
  'ambience_chill',
  'ambience_ruidoso',
  'ambience_grupos',
  'ambience_trabajo',
  'ambience_especial',
  'ambience_terraza',
  'ambience_tranquilo',
  'ambience_animado',
]

const SERVICE_POOL = [
  'service_pet_friendly',
  'service_piscina',
  'service_estacionamiento',
  'service_accesibilidad',
  'service_dress_code',
  'service_excelente_atencion',
]

type TagGroup = 'food' | 'attr' | 'ambience' | 'service' | 'other'

function getGroup(slug: string): TagGroup {
  if (slug.startsWith('food_')) return 'food'
  if (slug.startsWith('attr_')) return 'attr'
  if (slug.startsWith('ambience_')) return 'ambience'
  if (slug.startsWith('service_')) return 'service'
  return 'other'
}

function slugToLabel(slug: string): string {
  return slug
    .replace(/^(food_|attr_|ambience_|service_|local_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** Prefijo al crear con Enter: heurística + contexto (comida vs local). */
function inferCreatePrefix(raw: string, context: UnifiedTagContext): 'food_' | 'attr_' | 'ambience_' | 'service_' {
  const l = raw.toLowerCase()

  if (/piscina|\bpool\b/i.test(l)) return 'service_'
  if (/pet|mascotas?|dog\s*friendly/i.test(l)) return 'service_'
  if (/estacionam|parqueo|parking/i.test(l)) return 'service_'
  if (/accesibil|wheelchair|rampa|movilidad/i.test(l)) return 'service_'
  if (/dress\s*code|código\s*(de\s*)?vestimenta|formal\s*obligatorio/i.test(l)) return 'service_'
  if (/excelente\s*atención|mejor\s*servicio|servicio\s*10/i.test(l)) return 'service_'

  if (/dimly|tenue|oscur|íntim|luz\s*baja|poca\s*luz/i.test(l)) return 'ambience_'
  if (/ruidos[oa]|fiesta|música\s*alta/i.test(l)) return 'ambience_'
  if (/románt|cita|pareja|chandela/i.test(l)) return 'ambience_'
  if (/\bchill\b|tranqui/i.test(l)) return 'ambience_'
  if (/familiar|niños/i.test(l)) return 'ambience_'

  if (/vegano|vegetarian|keto|sin\s*lactosa|sin\s*gluten|proteín|fibra|carb|calor|paleo|azúcar/i.test(l)) {
    return 'attr_'
  }

  if (context === 'venue') {
    return 'ambience_'
  }
  return 'food_'
}

/** Orden de resultados de búsqueda: prioridad según contexto, sin ocultar otros grupos. */
function sortSearchIdsForContext(ids: string[], q: string, context: UnifiedTagContext): string[] {
  const score = (slug: string): number => {
    const g = getGroup(slug)
    const label = slugToLabel(slug).toLowerCase()
    const hay = label.includes(q.toLowerCase()) || slug.includes(q.toLowerCase()) ? 1 : 0
    let pri = 50
    if (context === 'food') {
      if (g === 'food') pri = 0
      else if (g === 'attr') pri = 1
      else if (g === 'ambience') pri = 3
      else if (g === 'service') pri = 2
    } else {
      if (g === 'ambience' || g === 'service') pri = 0
      else if (g === 'attr') pri = 2
      else if (g === 'food') pri = 3
    }
    return pri * 10 - hay * 5 + (label.startsWith(q.toLowerCase()) ? 0 : 1)
  }
  return [...ids].sort((a, b) => score(a) - score(b))
}

const GROUP_META: Record<TagGroup, { label: string; chipIdle: string; chipActive: string }> = {
  food:     { label: '🍽️ Platos', chipIdle: 'border-orange-200 bg-orange-50/80 text-orange-800 hover:border-orange-400', chipActive: 'bg-orange-500 text-white border-orange-500 shadow-sm' },
  attr:     { label: '🌿 Nutrición', chipIdle: 'border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:border-emerald-400', chipActive: 'bg-emerald-600 text-white border-emerald-600 shadow-sm' },
  ambience: { label: '✨ Sensaciones', chipIdle: 'border-violet-200 bg-violet-50/80 text-violet-700 hover:border-violet-400', chipActive: 'bg-violet-500 text-white border-violet-500 shadow-sm' },
  service:  { label: '🏗️ Servicios', chipIdle: 'border-sky-200 bg-sky-50/80 text-sky-800 hover:border-sky-400', chipActive: 'bg-sky-600 text-white border-sky-600 shadow-sm' },
  other:    { label: '🏷️ Otros', chipIdle: 'border-border bg-muted/40 text-foreground hover:border-muted-foreground', chipActive: 'bg-foreground text-background border-foreground shadow-sm' },
}

interface Props {
  selectedSlugs: string[]
  onSlugsChange: (slugs: string[]) => void
  /** Comida: prioriza platos y nutrición. Local: prioriza vibe y servicios. La búsqueda es global. */
  context?: UnifiedTagContext
  /** Slug del tipo de local (local_*) — refuerza sugerencias food via /api/suggestions */
  localSlug?: string | null
  xpPerTag?: number
}

export function UnifiedTagInput({
  selectedSlugs,
  onSlugsChange,
  context = 'food',
  localSlug,
  xpPerTag = 2,
}: Props) {
  const [query, setQuery] = useState('')
  const [contextFood, setContextFood] = useState<string[]>([])
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [venueExtraOpen, setVenueExtraOpen] = useState(false)
  const [foodPlatosVenueOpen, setFoodPlatosVenueOpen] = useState(false)
  const [venueComidaExtraOpen, setVenueComidaExtraOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!localSlug) {
      setContextFood([])
      return
    }
    const ctrl = new AbortController()
    setLoadingCtx(true)
    fetch(`/api/suggestions?source=${encodeURIComponent(localSlug)}&type=local_to_food&limit=20`, {
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then((d: unknown) => {
        const data = d as { ok?: boolean; suggestions?: string[] }
        if (data.ok && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setContextFood(data.suggestions)
        } else {
          setContextFood([])
        }
      })
      .catch(() => setContextFood([]))
      .finally(() => setLoadingCtx(false))
    return () => ctrl.abort()
  }, [localSlug])

  const foodPool = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of [...contextFood, ...FOOD_POOL]) {
      if (!seen.has(s)) {
        seen.add(s)
        out.push(s)
      }
    }
    return out.slice(0, 26)
  }, [contextFood])

  const allPool = useMemo(
    () => [...new Set([...foodPool, ...ATTR_POOL, ...AMBIENCE_POOL, ...SERVICE_POOL])],
    [foodPool],
  )

  const searchResults = useMemo(() => {
    if (query.trim().length < 1) return [] as string[]
    const q = query.toLowerCase().trim()
    const matched = allPool.filter(s => {
      const label = slugToLabel(s).toLowerCase()
      return label.includes(q) || s.toLowerCase().includes(q)
    })
    return sortSearchIdsForContext(matched, q, context).slice(0, 16)
  }, [query, allPool, context])

  const selectedSet = useMemo(() => new Set(selectedSlugs.map(s => s.toLowerCase())), [selectedSlugs])

  const addSlug = useCallback(
    (slug: string) => {
      const next = slug.trim()
      const key = next.toLowerCase()
      if (!key || selectedSet.has(key)) return
      onSlugsChange([...selectedSlugs, next])
      setQuery('')
    },
    [selectedSlugs, selectedSet, onSlugsChange],
  )

  const removeSlug = useCallback(
    (slug: string) => {
      onSlugsChange(selectedSlugs.filter(s => s !== slug))
    },
    [selectedSlugs, onSlugsChange],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && query.trim().length >= 2) {
      e.preventDefault()
      const prefix = inferCreatePrefix(query, context)
      addSlug(prefix + slugSegment(query))
    }
    if (e.key === 'Backspace' && query === '' && selectedSlugs.length > 0) {
      removeSlug(selectedSlugs[selectedSlugs.length - 1]!)
    }
  }

  const totalXp = selectedSlugs.length * xpPerTag
  const createSlugPreview = inferCreatePrefix(query, context) + slugSegment(query)

  const PoolChip = ({ slug }: { slug: string }) => {
    const g = getGroup(slug)
    const m = GROUP_META[g]
    const selectedEntry = selectedSlugs.find(s => s.toLowerCase() === slug.toLowerCase())
    const on = Boolean(selectedEntry)
    return (
      <button
        key={slug}
        type="button"
        onClick={() => (on && selectedEntry ? removeSlug(selectedEntry) : addSlug(slug))}
        className={cn(
          'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all leading-none',
          on ? m.chipActive : m.chipIdle,
        )}
      >
        {on ? '✓ ' : ''}
        {slugToLabel(slug)}
      </button>
    )
  }

  const headline =
    context === 'venue'
      ? { title: '¿Cómo es el lugar?', sub: 'Sensaciones, servicios e infra — todo suma al perfil del local' }
      : { title: '¿Qué comiste? ¿Cómo fue?', sub: 'Platos, nutrición y vibe en una sola matriz' }

  return (
    <div className="space-y-3 rounded-2xl border border-orange-100 bg-gradient-to-b from-orange-50/50 to-background p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">{headline.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {headline.sub}
            {totalXp > 0 && <span className="text-orange-600 font-semibold"> · +{totalXp} XP acumulados</span>}
          </p>
        </div>
        {loadingCtx && <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />}
      </div>

      {selectedSlugs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {selectedSlugs.map(slug => {
              const g = getGroup(slug)
              const m = GROUP_META[g]
              return (
                <motion.span
                  key={slug}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn('inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-semibold border', m.chipActive)}
                >
                  {slugToLabel(slug)}
                  <button
                    type="button"
                    onClick={() => removeSlug(slug)}
                    className="size-3.5 rounded-full flex items-center justify-center opacity-70 hover:opacity-100"
                  >
                    <X className="size-2.5" />
                  </button>
                </motion.span>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Busca cualquier etiqueta (plato, vibe, piscina…) — Enter para crear"
          className="w-full h-9 rounded-xl border border-border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
        />
      </div>

      {query.trim().length >= 1 && (
        <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
          {searchResults.length > 0 ? (
            <div className="p-2 flex flex-wrap gap-1.5">
              {searchResults.map(s => (
                <PoolChip key={s} slug={s} />
              ))}
            </div>
          ) : (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">Escribe otra palabra o crea abajo</p>
          )}
          {query.trim().length >= 2 && !selectedSet.has(createSlugPreview.toLowerCase()) ? (
            <button
              type="button"
              onClick={() => addSlug(createSlugPreview)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 border-t border-border transition-colors"
            >
              <Plus className="size-3.5 shrink-0 text-orange-500" />
              Crear "<span className="font-semibold text-foreground">{query.trim()}</span>"
              <span className="ml-auto text-[10px] text-muted-foreground/70">{inferCreatePrefix(query, context)}…</span>
            </button>
          ) : null}
        </div>
      )}

      {query === '' && (
        <>
          {context === 'food' ? (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1.5">
                  🍽️ Platos {localSlug && contextFood.length > 0 ? '· sugeridos para este local' : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">{foodPool.slice(0, 16).map(s => (
                  <PoolChip key={s} slug={s} />
                ))}</div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1.5">
                  🌿 Nutrición y atributos
                </p>
                <div className="flex flex-wrap gap-1.5">{ATTR_POOL.map(s => (
                  <PoolChip key={s} slug={s} />
                ))}</div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setVenueExtraOpen(v => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-700 mb-1"
                >
                  <Sparkles className="size-3" />
                  Sensaciones · servicios (local)
                  <ChevronDown className={cn('size-3 transition-transform', venueExtraOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {venueExtraOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 pt-1">
                      <div className="flex flex-wrap gap-1.5">{AMBIENCE_POOL.map(s => (
                        <PoolChip key={s} slug={s} />
                      ))}</div>
                      <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide text-sky-800">Servicios e infra</p>
                      <div className="flex flex-wrap gap-1.5">{SERVICE_POOL.map(s => (
                        <PoolChip key={s} slug={s} />
                      ))}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700 mb-1.5">✨ Sensaciones (vibe)</p>
                <div className="flex flex-wrap gap-1.5">{AMBIENCE_POOL.map(s => (
                  <PoolChip key={s} slug={s} />
                ))}</div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-800 mb-1.5">🏗️ Servicios e infraestructura</p>
                <div className="flex flex-wrap gap-1.5">{SERVICE_POOL.map(s => (
                  <PoolChip key={s} slug={s} />
                ))}</div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setFoodPlatosVenueOpen(v => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-700 mb-1"
                >
                  🍽️ Platos sugeridos {localSlug ? '· desde el local' : ''}
                  <ChevronDown className={cn('size-3 transition-transform', foodPlatosVenueOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {foodPlatosVenueOpen ? (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                      <div className="flex flex-wrap gap-1.5 pt-1">{foodPool.slice(0, 16).map(s => (
                        <PoolChip key={s} slug={s} />
                      ))}</div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 opacity-90">{foodPool.slice(0, 6).map(s => (
                      <PoolChip key={s} slug={s} />
                    ))}</div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setVenueComidaExtraOpen(v => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1"
                >
                  🌿 Nutrición (si también mostraste el plato)
                  <ChevronDown className={cn('size-3 transition-transform', venueComidaExtraOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {venueComidaExtraOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                      <div className="flex flex-wrap gap-1.5 pt-1">{ATTR_POOL.map(s => (
                        <PoolChip key={s} slug={s} />
                      ))}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            +{xpPerTag} XP por etiqueta · se indexan en las relaciones entre tags para ranking y filtros
          </p>
        </>
      )}
    </div>
  )
}
