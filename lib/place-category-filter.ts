import { slugDisplayFromAutomatedSlug } from '@/lib/place-tags-display'

/** Metadatos visuales para todos los chips de exploración (superset de CATEGORY_META). */
export const EXPLORE_CHIP_META: Record<string, { label: string; emoji: string }> = {
  all:       { label: 'Todos',      emoji: '🍽️' },
  picada:    { label: 'Picada',     emoji: '🥩' },
  parrilla:  { label: 'Parrilla',   emoji: '🔥' },
  cafe:      { label: 'Café',       emoji: '☕' },
  vegano:    { label: 'Vegano',     emoji: '🌱' },
  japones:   { label: 'Japonés',    emoji: '🍣' },
  pizza:     { label: 'Pizza',      emoji: '🍕' },
  peruano:   { label: 'Peruano',    emoji: '🫙' },
  mariscos:  { label: 'Mariscos',   emoji: '🦐' },
  mexicano:  { label: 'Mexicano',   emoji: '🌮' },
  bar:       { label: 'Bar',        emoji: '🍺' },
  fitness:   { label: 'Fitness',    emoji: '💪' },
  keto:      { label: 'Keto',       emoji: '🥑' },
  premium:   { label: 'Premium',    emoji: '⭐' },
}

const CATEGORY_RE: Record<string, RegExp> = {
  picada:    /picada|chilena|fuente de soda|sanguchería|sangucheria|completo|lomito|chorrillana|food_picada|local_fuente|local_sangucheria|local_comida_rapida|food_sandwich|food_completo|food_lomito/,
  parrilla:  /parrilla|asado|churrasco|vacuno|chorizo|local_parrilla|food_parrilla|food_asado|parrillada/,
  vegano:    /vegano|vegana|vegan|plant.based|vegetariano|vegetariana|sin carne|restrictions_vegano|restrictions_vegetariano|food_vegano/,
  fitness:   /fitness|protein|proteina|saludable|healthy|bowl|ensalada|light|nutrition_fit|food_saludable/,
  keto:      /keto|low carb|sin azucar|sin gluten|nutrition_keto|food_keto|restrictions_keto/,
  premium:   /premium|gourmet|chef|cocina de autor|alta cocina|degustacion|maridaje|local_alto|food_gourmet/,
  cafe:      /café|cafetería|cafeteria|coffee|brunch|pasteleria|pastelería|tostadas|cold brew|local_cafe|local_cafeteria|local_pasteleria|food_cafe/,
  japones:   /japon|sushi|ramen|izakaya|wok|gyoza|japonés|local_japones|food_sushi|food_ramen|tipo_plato_sushi/,
  pizza:     /pizza|pizzeria|pizzería|local_pizzeria|food_pizza|napolitana/,
  peruano:   /peruano|peruana|ceviche|cevicheria|causa|aji de gallina|lomo saltado|local_cevicheria|food_ceviche|food_peruano/,
  mexicano:  /mexican|taco|tacos|quesadilla|nachos|burrito|local_mexicana|food_tacos/,
  bar:       /\bbar\b|cocktail|cóctel|coctel|cerveza artesanal|picoteo|local_bar|food_cocktail/,
  mariscos:  /marisco|marisqueria|marisquería|reineta|ostiones|paila marina|seafood|local_marisqueria|food_marisco/,
}

/** Texto unificado para chips y filtros: nombre + dirección + inferidas + slugs IA (legible y crudo). */
export function placeClassificationCorpus(p: {
  name: string
  address: string
  inferredTags?: string[]
  automatedSeedTags?: Array<{ slug: string }>
}): string {
  const parts = [p.name, p.address, ...(p.inferredTags || [])]
  for (const s of p.automatedSeedTags || []) {
    parts.push(s.slug.replace(/_/g, ' '))
    parts.push(s.slug)
    parts.push(slugDisplayFromAutomatedSlug(s.slug))
  }
  return parts.join(' ').toLowerCase()
}

export function placeMatchesCategory(
  p: { name: string; address: string; inferredTags?: string[]; automatedSeedTags?: Array<{ slug: string }> },
  category: string,
): boolean {
  if (!category) return true
  const re = CATEGORY_RE[category]
  if (!re) return true
  return re.test(placeClassificationCorpus(p))
}

/** Orden fijo para contadores/chips dinámicos (mapa + inicio/explore). Debe cubrir todas las keys de CATEGORY_RE útiles para UI. */
export const EXPLORE_CATEGORY_ORDER = ['picada', 'parrilla', 'cafe', 'vegano', 'japones', 'pizza', 'peruano', 'mariscos', 'mexicano', 'bar', 'fitness', 'keto', 'premium'] as const
export type ExploreCategoryId = (typeof EXPLORE_CATEGORY_ORDER)[number]
export type ExploreChipId = 'all' | ExploreCategoryId

type ClassifiablePlace = {
  name: string
  address: string
  inferredTags?: string[]
  automatedSeedTags?: Array<{ slug: string }>
}

/** Conteos por categoría sobre el mismo corpus que placeMatchesCategory (un local puede sumar más de uno). */
export function tallyExploreCategoryCounts(places: ClassifiablePlace[]): Record<ExploreCategoryId, number> {
  const counters = {
    picada: 0,
    parrilla: 0,
    cafe: 0,
    vegano: 0,
    japones: 0,
    pizza: 0,
    peruano: 0,
    mariscos: 0,
    mexicano: 0,
    bar: 0,
    fitness: 0,
    keto: 0,
    premium: 0,
  } satisfies Record<ExploreCategoryId, number>
  for (const p of places) {
    const text = placeClassificationCorpus(p)
    for (const id of EXPLORE_CATEGORY_ORDER) {
      const re = CATEGORY_RE[id]
      if (re?.test(text)) counters[id] += 1
    }
  }
  return counters
}

/** Lista de chips: `all` + categorías presentes ordenadas por frecuencia. */
export function computeDynamicExploreChips(places: ClassifiablePlace[]): ExploreChipId[] {
  const counters = tallyExploreCategoryCounts(places)
  const sorted = [...EXPLORE_CATEGORY_ORDER]
    .filter(id => counters[id] > 0)
    .sort((a, b) => counters[b] - counters[a])
  return ['all', ...sorted]
}

/** Cadena única para búsqueda (nombre, dirección, inferidas + slugs IA). */
export function placeDiscoverSearchHaystack(p: ClassifiablePlace): string {
  return placeClassificationCorpus(p)
}
