/**
 * Clasificación del local (no sensaciones vestimenta ni ambiente detallado).
 * Persistimos como `local_<slug>` para filtros tipo "comida rápida vs cafetería".
 */

import { slugSegment } from '@/lib/tag-slug'

export const LOCAL_KIND_MAX_SELECTIONS = 2
export const LOCAL_KIND_XP_EACH = 3

export type LocalClassificationCategoryId = 'local'

export const LOCAL_KIND_OPTIONS: string[] = [
  'Comida rápida',
  'Café / cafetería',
  'Bar',
  'Sanguchería',
  'Fuente de soda',
  'Parrilla / asados',
  'Pizzería',
  'Pastelería / brunch',
  'Marisquería',
  'Comida peruana / cevichería',
  'Comida asiática',
  'Mexicana / tacos',
  'Restaurante de carta',
  'Alto / cocina de autor',
  'Food truck / carrito',
  'Buffet / servicio corrido',
  'Otro',
]

/** Sugerencias típicas de plato/contexto cuando el usuario marca un tipo de local */
export const LOCAL_KIND_DEFAULT_FOOD_SUGGESTIONS: Record<string, string[]> = {
  'Comida rápida': ['Hamburguesa smash', 'Papas fritas', 'Combo', 'Chicken'],
  'Café / cafetería': ['Café de especialidad', 'Tostadas / croissant', 'Cheesecake', 'Cold brew'],
  Bar: ['Tabla', 'Cóctel', 'Cerveza artesanal', 'Picoteo'],
  Sanguchería: ['Completo italiano', 'Churrasco', 'Sándwich en pan amasado', 'Vacuno'],
  'Fuente de soda': ['Completo', 'Ensalada chilena', 'Pepito caliente', 'Jugo natural'],
  'Parrilla / asados': ['Vacuno', 'Chorizo', 'Parrillada mixta'],
  Pizzería: ['Mediana masa', 'Napolitana', 'Pasta al horno', 'Mozzarella'],
  'Pastelería / brunch': ['Panqueques', 'Waffle', 'Pain au chocolat', 'Huevos benedict'],
  Marisquería: ['Paila marina', 'Reineta', 'Ostiones', 'Ceviche mixto'],
  'Comida peruana / cevichería': ['Causa', 'Ají de gallina', 'Lomo saltado', 'Suspiro'],
  'Comida asiática': ['Ramen', 'Sushi rolls', 'Wok', 'Gyozas'],
  'Mexicana / tacos': ['Tacos carnitas', 'Quesadilla', 'Nachos'],
  'Restaurante de carta': ['Entrada', 'Fuerte', 'Chef recomienda'],
  'Alto / cocina de autor': ['Degustación', 'Menú temporada', 'Maridaje'],
  'Food truck / carrito': ['Mechada', 'Completo xl', 'Burger veggie'],
  'Buffet / servicio corrido': ['Postre buffet', 'Sopa del día'],
  Otro: [],
}

export function storedTagForLocalKind(label: string): string {
  const v = slugSegment(label)
  if (!v) return ''
  return `local_${v}`
}

export function countLocalKindPicks(picks: Record<string, string[]>): number {
  const arr = picks.local || []
  return Array.isArray(arr) ? arr.length : 0
}

export function flattenLocalKindPicksToTags(picks: Record<string, string[]>): string[] {
  const out: string[] = []
  for (const label of picks.local || []) {
    const t = storedTagForLocalKind(label)
    if (t) out.push(t)
  }
  return [...new Set(out)]
}

/** Orden visual aleatorio de tipos de local (misma semilla = mismo orden) */
export function shuffleLocalKindOptions(seed: number): string[] {
  const opts = [...LOCAL_KIND_OPTIONS]
  let s = seed >>> 0
  for (let i = opts.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[opts[i], opts[j]] = [opts[j]!, opts[i]!]
  }
  return opts
}

export function parseLocalKindTagsIntoPicks(tags: string[]): Record<string, string[]> {
  const labels: string[] = []
  for (const raw of tags || []) {
    const t = raw.trim().toLowerCase()
    if (!t.startsWith('local_')) continue
    const slugPart = t.slice('local_'.length)
    if (!slugPart) continue
    const label =
      LOCAL_KIND_OPTIONS.find(o => slugSegment(o) === slugPart) ||
      slugPart.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())
    if (labels.length < LOCAL_KIND_MAX_SELECTIONS && !labels.some(l => l.toLowerCase() === label.toLowerCase())) {
      labels.push(label)
    }
  }
  return labels.length ? { local: labels } : {}
}

export function getFoodSuggestionsForLocalKinds(selectedLabels: string[]): string[] {
  const out: string[] = []
  for (const k of selectedLabels) {
    const arr = LOCAL_KIND_DEFAULT_FOOD_SUGGESTIONS[k]
    if (arr) for (const x of arr) if (!out.includes(x)) out.push(x)
  }
  return out.slice(0, 12)
}
