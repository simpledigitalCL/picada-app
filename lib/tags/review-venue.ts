/** Etiquetas de local (no comida): sensación, vestimenta, servicio, etc. Se persisten como `categoria_valor` en taxonomy.tags */

export const VENUE_TAG_MAX_PER_CATEGORY = 2
export const VENUE_TAG_XP_EACH = 2
export const VENUE_TAG_INITIAL_CATEGORIES = 2
export const VENUE_TAG_MORE_CATEGORIES = 2

export type VenueCategoryId =
  | 'ambiente'
  | 'vestimenta'
  | 'servicio'
  | 'espacio'
  | 'ocasion'
  | 'calidad'

export type VenueTagCategoryDef = {
  id: VenueCategoryId
  title: string
  hint?: string
  options: string[]
}

export const VENUE_TAG_CATEGORIES: VenueTagCategoryDef[] = [
  {
    id: 'ambiente',
    title: 'Ambiente y sensación',
    hint: 'Cómo se siente el local',
    options: [
      'Familiar',
      'Relajado',
      'Ruidoso',
      'Tranquilo',
      'Íntimo',
      'Animado',
      'Acogedor',
      'Festivo',
      'Romántico',
      'Sobrio',
      'Juvenil',
      'Elegante',
    ],
  },
  {
    id: 'vestimenta',
    title: 'Vestimenta',
    hint: 'Qué esperar para vestirse',
    options: [
      'Casual',
      'Smart casual',
      'Elegante sport',
      'Formal',
      'Deportivo',
      'Sin código claro',
      'Informal de barrio',
      'Arreglado sin corbata',
    ],
  },
  {
    id: 'servicio',
    title: 'Servicio y ritmo',
    options: [
      'Rápido',
      'Atento',
      'Despacio',
      'Personalizado',
      'Distendido',
      'Muy formal',
      'En la barra',
      'En mesa',
      'Autoservicio',
    ],
  },
  {
    id: 'espacio',
    title: 'Espacio físico',
    options: [
      'Amplio',
      'Acotado',
      'Terraza',
      'Barra',
      'Mucha luz natural',
      'Penumbra',
      'Vista linda',
      'Interior cerrado',
      'Mesas al aire libre',
    ],
  },
  {
    id: 'ocasion',
    title: 'Ocasión ideal',
    options: [
      'Negocios',
      'Cita',
      'Familia con niños',
      'Celebración',
      'After office',
      'Salida solo',
      'Grupo grande',
      'Algo rápido',
    ],
  },
  {
    id: 'calidad',
    title: 'Señales de calidad',
    hint: 'Para mejores filtros en el mapa',
    options: [
      'Limpio',
      'Precio acorde',
      'Carta clara',
      'Buena relación precio-calidad',
      'Ingredientes frescos',
      'Porciones generosas',
      'Atención al detalle',
      'Volvería seguro',
    ],
  },
]

function slugSegment(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/** Valor guardado en posts / pipeline (ej. ambiente_familiar) */
export function storedTagForPick(categoryId: VenueCategoryId, label: string): string {
  const v = slugSegment(label)
  if (!v) return ''
  return `${categoryId}_${v}`
}

export function countVenueTagPicks(picks: Record<string, string[]>): number {
  return Object.values(picks).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
}

export function flattenVenuePicksToStoredTags(picks: Record<string, string[]>): string[] {
  const out: string[] = []
  const known = new Set(VENUE_TAG_CATEGORIES.map(c => c.id))
  for (const [cat, labels] of Object.entries(picks)) {
    if (!known.has(cat as VenueCategoryId)) continue
    for (const label of labels || []) {
      const t = storedTagForPick(cat as VenueCategoryId, label)
      if (t) out.push(t)
    }
  }
  return [...new Set(out)]
}

/** Determinístico para SSR estable si hiciera falta */
export function shuffleCategoryIds(seed: number): VenueCategoryId[] {
  const ids = VENUE_TAG_CATEGORIES.map(c => c.id) as VenueCategoryId[]
  const out = [...ids]
  let s = seed >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

const CAT_IDS = VENUE_TAG_CATEGORIES.map(c => c.id) as VenueCategoryId[]
const CAT_IDS_LONGEST_FIRST = [...CAT_IDS].sort((a, b) => b.length - a.length)

/** Restaura picks desde tags ya guardados (draft / edición) */
export function parseStoredVenueTagsIntoPicks(tags: string[]): Record<string, string[]> {
  const picks: Record<string, string[]> = {}
  for (const raw of tags || []) {
    const t = raw.trim().toLowerCase()
    const cat = CAT_IDS_LONGEST_FIRST.find(c => t.startsWith(`${c}_`))
    if (!cat) continue
    const slugPart = t.slice(cat.length + 1)
    if (!slugPart) continue
    const def = VENUE_TAG_CATEGORIES.find(c => c.id === cat)
    const label =
      def?.options.find(o => slugSegment(o) === slugPart) ||
      slugPart.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())
    if (!picks[cat]) picks[cat] = []
    if (picks[cat]!.length < VENUE_TAG_MAX_PER_CATEGORY && !picks[cat]!.includes(label)) {
      picks[cat]!.push(label)
    }
  }
  return picks
}
