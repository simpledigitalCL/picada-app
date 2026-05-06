/**
 * Etiquetas de menú/alimento en UI granular (categorías internas).
 * Persistencia canónica: `food_<categoria>_<valor>` ej. food_tipo_plato_hamburguesa.
 */

import { slugSegment } from '@/lib/tag-slug'

export const FOOD_TAG_MAX_PER_CATEGORY = 2
export const FOOD_TAG_XP_EACH = 2
export const FOOD_TAG_INITIAL_CATEGORIES = 2
export const FOOD_TAG_MORE_CATEGORIES = 2

export type FoodContentCategoryId =
  | 'tipo_plato'
  | 'sabor_y_aroma'
  | 'textura_sensacion'
  | 'ingredientes_destacados'
  | 'presentacion'
  | 'dieta_rest'

export type FoodTagCategoryDef = {
  id: FoodContentCategoryId
  title: string
  hint?: string
  options: string[]
}

export const FOOD_TAG_CATEGORIES: FoodTagCategoryDef[] = [
  {
    id: 'tipo_plato',
    title: 'Tipo de plato',
    hint: 'Qué comiste / pediste principalmente',
    options: [
      // Sándwiches / completos
      'Completo italiano', 'Completo dinámico', 'Choripán', 'Churrasco', 'Barros Jarpa', 'Barros Luco',
      'Hamburguesa smash', 'Hamburguesa clásica', 'Chicken burger',
      // Pizzas
      'Pizza Margherita', 'Pizza Napolitana', 'Cuatro quesos', 'Pepperoni', 'Hawaiana', 'Fugazzeta',
      'Pizza masa madre', 'Pizza masa fina', 'Pizza alta', 'Calzone',
      // Pasta / italianos
      'Pasta carbonara', 'Pasta pomodoro', 'Lasaña', 'Risotto',
      // Parrilla / carnes
      'Asado vacuno', 'Lomo vetado', 'Entraña', 'Parrillada mixta', 'Plateada', 'Pollo a la parrilla',
      // Mariscos / pescados
      'Ceviche clásico', 'Ceviche mixto', 'Paila marina', 'Caldillo congrio', 'Reineta frita', 'Ostiones',
      // Cocina peruana / latina
      'Lomo saltado', 'Ají de gallina', 'Causa limeña', 'Tiradito',
      // Asiático
      'Sushi rolls', 'Sashimi', 'Ramen', 'Gyozas', 'Pad thai', 'Wok de verduras',
      // Mexicano
      'Tacos de carne', 'Quesadilla', 'Nachos', 'Burrito', 'Tostadas',
      // Cafetería / desayuno
      'Tostadas / croissant', 'Avocado toast', 'Huevos benedict', 'Panqueques', 'Waffle',
      // Snack / share
      'Tabla de quesos', 'Tabla picoteo', 'Papas fritas', 'Alitas', 'Empanada',
      // Sopas / otros
      'Sopa del día', 'Cazuela', 'Ensalada completa', 'Bowl saludable', 'Postre del día',
    ],
  },
  {
    id: 'sabor_y_aroma',
    title: 'Sabor y aroma',
    hint: 'Perfil de sabor dominante del plato',
    options: [
      'Picante intenso', 'Picante suave', 'Ahumado', 'Cítrico fresco', 'Dulce equilibrado',
      'Salado intenso', 'Umami profundo', 'Hierbas frescas', 'Ajo y cebolla marcados',
      'Vinagreta destacada', 'Caramelizado', 'Marinado oriental', 'Chimichurri', 'Pebre chileno',
    ],
  },
  {
    id: 'textura_sensacion',
    title: 'Textura en boca',
    hint: 'Sensación al comer',
    options: [
      'Muy jugoso', 'Jugoso', 'Crocante por fuera', 'Crujiente total',
      'Cremoso suave', 'Tierno y meloso', 'Frito bien dorado', 'Al dente',
      'Derrite en boca', 'Denso y contundente', 'Ligero',
    ],
  },
  {
    id: 'ingredientes_destacados',
    title: 'Ingrediente principal',
    hint: 'Proteína o ingrediente que define el plato',
    options: [
      'Vacuno', 'Cerdo', 'Pollo', 'Cordero', 'Mariscos', 'Salmón', 'Atún',
      'Tofu / soya', 'Queso potente', 'Palta', 'Hongo / champiñón', 'Papas',
    ],
  },
  {
    id: 'presentacion',
    title: 'Presentación',
    hint: 'Cómo llega a la mesa',
    options: [
      'Muy fotogénico', 'Desorden rico', 'Minimalista elegante', 'Abundante',
      'Bowl colorido', 'En tabla de madera', 'Cerámica artesanal', 'Estilo bistró',
    ],
  },
  {
    id: 'dieta_rest',
    title: 'Foco nutricional',
    hint: 'Impacto nutricional y tipo de dieta — conecta con filtros keto, vegano, fit…',
    options: [
      // Dietas
      'Vegano', 'Vegetariano', 'Sin gluten', 'Sin lactosa', 'Keto / low-carb',
      'Paleo', 'Sin azúcar añadida',
      // Foco proteico / macro
      'Alto en proteína', 'Bajo en calorías', 'Bajo en carbohidratos',
      'Alto en fibra', 'Grasas buenas',
      // Porción / valor
      'Porción generosa', 'Porción pequeña', 'Buena relación precio/calidad',
      'Para compartir', 'Económico',
    ],
  },
]

/** Prefijo único dominio para acuerdo con catálogo /stats */
const FOOD_CANONICAL_PREFIX = 'food_'

/** Slug estable para guardar/subir — siempre canonical `food_*` */
export function storedTagForFoodPick(categoryId: FoodContentCategoryId, label: string): string {
  const tail = slugSegment(`${categoryId}_${label}`)
  if (!tail) return ''
  return `${FOOD_CANONICAL_PREFIX}${tail}`
}

/** Etiqueta canónica para comparar contra /api/suggestions (mismo criterio que storedTagForFoodPick) */
export function canonicalFoodTagFor(categoryId: FoodContentCategoryId, label: string): string {
  return storedTagForFoodPick(categoryId, label).toLowerCase()
}

export { slugSegment }

export function countFoodTagPicks(picks: Record<string, string[]>): number {
  return Object.values(picks).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
}

export function flattenFoodPicksToTags(picks: Record<string, string[]>): string[] {
  const out: string[] = []
  const known = new Set(FOOD_TAG_CATEGORIES.map(c => c.id))
  for (const [cat, labels] of Object.entries(picks)) {
    if (!known.has(cat as FoodContentCategoryId)) continue
    for (const label of labels || []) {
      const t = storedTagForFoodPick(cat as FoodContentCategoryId, label)
      if (t) out.push(t)
    }
  }
  return [...new Set(out)]
}

export function shuffleFoodCategoryIds(seed: number): FoodContentCategoryId[] {
  const ids = FOOD_TAG_CATEGORIES.map(c => c.id) as FoodContentCategoryId[]
  const out = [...ids]
  let s = seed >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

const CAT_IDS = FOOD_TAG_CATEGORIES.map(c => c.id)
const CAT_IDS_LONGEST_FIRST = [...CAT_IDS].sort((a, b) => b.length - a.length)

function parseOneFoodTagTail(rest: string, picks: Record<string, string[]>) {
  const cat = CAT_IDS_LONGEST_FIRST.find(c => rest.startsWith(`${c}_`))
  if (!cat) return
  const slugPart = rest.slice(cat.length + 1)
  if (!slugPart) return
  const def = FOOD_TAG_CATEGORIES.find(c => c.id === cat)
  const label =
    def?.options.find(o => slugSegment(o) === slugPart) ||
    slugPart.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())
  if (!picks[cat]) picks[cat] = []
  if (
    picks[cat]!.length < FOOD_TAG_MAX_PER_CATEGORY &&
    !picks[cat]!.some(x => x.toLowerCase() === label.toLowerCase())
  ) {
    picks[cat]!.push(label)
  }
}

/** Restaura picks desde drafts: `food_tipo_plato_*` y legado `tipo_plato_*` (sin prefijo dominio). */
export function parseStoredFoodTagsIntoPicks(tags: string[]): Record<string, string[]> {
  const picks: Record<string, string[]> = {}
  for (const raw of tags || []) {
    const t = raw.trim().toLowerCase()
    if (!t) continue
    const rest = t.startsWith(FOOD_CANONICAL_PREFIX) ? t.slice(FOOD_CANONICAL_PREFIX.length) : t
    parseOneFoodTagTail(rest, picks)
  }
  return picks
}
