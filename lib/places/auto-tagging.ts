import { slugSegment } from '@/lib/tags/slug'
import type { AutomatedTagSeed } from '@/lib/tags/types'

/** Ponderación solicitada: identidad fuerte (nombre + google types + editorial) vs reseñas */
export const WT_NAME_TYPES_EDITORIAL = 3
export const WT_REVIEWS = 1

export type AutomatedInferenceInput = {
  name: string
  google_types?: string[]
  editorial_summary?: string | null
  reviews?: string[]
}

type Accum = Map<string, { nt: number; rv: number }>

function inc(map: Accum, slug: string, dnt: number, drv: number) {
  const cur = map.get(slug) || { nt: 0, rv: 0 }
  cur.nt += dnt
  cur.rv += drv
  map.set(slug, cur)
}

function testAny(res: RegExp[], text: string): boolean {
  const t = text.toLowerCase()
  return res.some(re => {
    try {
      return re.test(t)
    } catch {
      return false
    }
  })
}

/** Google Places `types`: https://developers.google.com/maps/documentation/places/web-service/legacy/details */
function applyGoogleTypes(typesBlob: string, map: Accum) {
  const t = typesBlob.toLowerCase()
  const pairs: Array<[RegExp, string]> = [
    [/\bcoffee_shop\b|^cafe$|\bcafe\b/i, 'local_cafe_cafeteria'],
    [/bakery/, 'local_pasteleria_brunch'],
    [/hamburger_restaurant|^meal_takeaway$|\bmeal_takeaway\b|\bfast_food\b/, 'local_comida_rapida'],
    [/bar$|\bbar\b|^restaurant\b.*bar/i, 'local_bar'],
    [/sushi|^japanese_restaurant$|\bramen\b/i, 'food_tipo_plato_sushi_sashimi'],
    [/pizza|italian_restaurant/, 'food_tipo_plato_pizza'],
    [/mexican_restaurant|meal_takeaway.*taco/i, 'food_cuisine_mexicana'],
  ]
  // Evitar falsos positivos tipo "bakery"+ beauty - solo coincidencias de tipos conocidos simplificados
  const sane = [/cafe|coffee_shop|bakery|bar|meal_takeaway|fast_food|japanese|sushi|pizza|restaurant/i]
  if (!sane.some(r => r.test(t))) return

  for (const [re, slug] of pairs) {
    if (slug === 'local_cafe_cafeteria' && /beauty/i.test(typesBlob)) continue
    if (re.test(t)) inc(map, slug, 1.4, 0)
  }
}

function lexicalRules(ntCanvas: string, rvCanvas: string, map: Accum) {
  const rules: Array<{ slug: string; nt: RegExp[]; rv: RegExp[] }> = [
    {
      slug: 'food_restrictions_vegano',
      nt: [/\bvegano\b/i, /\bvegan\b/i, /\bvegetal(es)? plant based\b/i],
      rv: [/\bvegano\b/i, /\bvegan\b/i, /opc[ií]on vegana/i],
    },
    {
      slug: 'food_restrictions_sin_gluten',
      nt: [/sin\s*gluten/i, /\bgluten\s*free\b/i, /\bceliac/i, /\bsin\s*tacc\b/i],
      rv: [/sin\s*gluten/i, /\bgf\b/i],
    },
    {
      slug: 'food_restrictions_sin_lactosa',
      nt: [/sin\s+lactosa/i, /lactose free/i],
      rv: [/sin\s+lactosa/i],
    },
    {
      slug: 'food_tipo_plato_sushi_sashimi',
      nt: [/\bsushi\b/i, /\bsashimi\b/i, /\bmaki\b/i],
      rv: [/\bsushi\b/i],
    },
    {
      slug: 'food_nutrition_keto',
      nt: [/\bketo\b/i, /low\s*carb/i, /\blow-carb\b/i],
      rv: [/\bketo\b/i],
    },
    {
      slug: 'ambience_romantic',
      nt: [/romántic/i, /\bpara\s*citas\b/i],
      rv: [/cita\b/i, /pareja\b/i],
    },
    {
      slug: 'ambience_chill',
      nt: [/chill\b/i, /tranqui/i, /\bterraza\b/i],
      rv: [/tranquilo/i],
    },
    {
      slug: 'ambience_familiar',
      nt: [/\bfamiliar\b/i],
      rv: [/niños/i, /\bfamiliar\b/i],
    },
    {
      slug: 'ambience_dimly_lit',
      nt: [/dimly\s*lit\b/i, /\btenue\b/i, /poca\s*luz/i, /luces?\s*tenues/i, /oscurit[oa]/i],
      rv: [/íntimo/i, /ambientación\s*tenue/i],
    },
    {
      slug: 'ambience_ruidoso',
      nt: [/\bruidoso\b/i, /\bloud\b/i, /\bfull\b.*\bsonido/i],
      rv: [/\bmúsica\s*alta/i, /\bescandalos[oa]/i],
    },
    {
      slug: 'service_piscina',
      nt: [/\bpiscina\b/i, /\lpool\b/i],
      rv: [/pileta/i, /\bbalcony\s*pool/i],
    },
    {
      slug: 'service_pet_friendly',
      nt: [/\bpet\s*friendly\b/i, /\bmascotas\b/i, /\bdog\s*friendly\b/i],
      rv: [/\bperros?\b/i, /permiten\s*mascotas/i],
    },
    {
      slug: 'service_estacionamiento',
      nt: [/estacionamiento/i, /\bparking\b/i, /\bparqueo\b/i],
      rv: [/\bplaya\s*de\s*estacionamiento/i],
    },
    {
      slug: 'service_accesibilidad',
      nt: [/accesibilidad/i, /\bwheelchair\b/i, /\bmovilidad\b.*\breducida/i],
      rv: [/\brampa\b/i, /\bsin\s*escaleras/i],
    },
    {
      slug: 'service_dress_code',
      nt: [/dress\s*code/i, /código\s*de\s*vestimenta/i, /\bformal\b.*\bropa/i],
      rv: [/\belegante\b.*\bobligatorio/i],
    },
    {
      slug: 'service_excelente_atencion',
      nt: [/\bexcelente\s+atención\b/i, /\bservicio\b.*\b10\b/i],
      rv: [/mesero[s]?\s*muy\s*atentos/i, /\bteam\s*perfecto/i],
    },
    {
      slug: 'local_parrilla',
      nt: [/parrill/i, /\blas\s*brasas\b/i],
      rv: [/parrill/i],
    },
    {
      slug: 'food_picada_tipica_cl',
      nt: [/picada\b/i, /\bchorrillana\b/i, /\bcompleto\b/i, /\blomitos?\b/i],
      rv: [/completo italiano/i, /\blomito\b/i, /\bpicada\b/i],
    },
    {
      slug: 'local_fuente_de_soda',
      nt: [/\bfuente\s+de\s+soda\b/i],
      rv: [/fuente\b/i],
    },
  ]

  for (const { slug, nt, rv } of rules) {
    const bn = testAny(nt, ntCanvas)
    const br = testAny(rv, rvCanvas)
    if (bn || br) {
      inc(map, slug, bn ? 2.2 : 0, br ? 1.8 : 0)
    }
  }
}

export function weightedConfidence(ntScaled: number, rvScaled: number): number {
  const raw =
    ntScaled * WT_NAME_TYPES_EDITORIAL + rvScaled * WT_REVIEWS
  const cap = 10 * WT_NAME_TYPES_EDITORIAL + 14 * WT_REVIEWS
  return Math.min(0.96, Math.max(0.15, raw / cap))
}

function provenanceFor(ntScaled: number, rvScaled: number): AutomatedTagSeed['provenance'] {
  const ntw = ntScaled * WT_NAME_TYPES_EDITORIAL
  const rvw = rvScaled * WT_REVIEWS
  if (ntw > 3 && rvw > 3) return 'both'
  if (rvw > ntw) return 'reviews'
  return 'name_types'
}

/**
 * Semillas automáticas iniciales: nombre + tipos Google + editorial + hasta 3 reseñas.
 * Salida con slugs canónicos donde aplica prefijo dominio (`local_`, `food_`, `ambience_`).
 */
export function inferAutomatedSeedTags(input: AutomatedInferenceInput): AutomatedTagSeed[] {
  const name = input.name.trim()
  const typesBlob = (input.google_types || []).join(',')
  const editorial = (input.editorial_summary || '').trim()
  const reviews = input.reviews || []
    .slice(0, 3)
    .map(s => String(s || '').trim())
    .filter(Boolean)

  const ntCanvas = [name, typesBlob, editorial].join('\n').trim()
  const rvCanvas = reviews.join('\n').trim()

  const map: Accum = new Map()

  lexicalRules(ntCanvas, rvCanvas || name, map)
  applyGoogleTypes(typesBlob.replace(/,/g, ' '), map)

  const seeds: AutomatedTagSeed[] = []
  for (const [slugBare, weights] of map) {
    const conf = weightedConfidence(weights.nt, weights.rv)
    if (conf < 0.19) continue
    const slug = ensureCanonicalSlug(slugBare)
    seeds.push({
      slug,
      confidence_score: conf,
      is_automated: true,
      provenance: provenanceFor(weights.nt, weights.rv),
    })
  }

  seeds.sort((a, b) => b.confidence_score - a.confidence_score)
  const seen = new Set<string>()
  return seeds.filter(s => {
    const k = s.slug.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 28)
}

function ensureCanonicalSlug(raw: string): string {
  const base = slugSegment(raw.replace(/\s+/g, '_'))
  if (/^(food_|local_|attr_|ambience_|service_)/i.test(base)) return base
  const r = raw.toLowerCase()
  if (r.includes('fuente_de_soda') || r.includes('parrill') || r.includes('comida_rapida') ||
      r.includes('cafe') || r.includes('pasteler') || r.includes('_bar')) {
    return `local_${base.replace(/^local_/, '')}`
  }
  if (
    r.includes('romantic') ||
    r.includes('_chill') ||
    r.includes('familiar') ||
    r.includes('ruidoso') ||
    r.includes('dimly') ||
    /^ambience/.test(base)
  ) {
    const rest = base.replace(/^ambience_/, '')
    return slugSegment(`ambience_${rest}`)
  }
  if (r.includes('piscina') || r.includes('pet_friendly') || r.includes('estacionamiento') || r.includes('dress') || r.includes('atencion')) {
    const rest = base.replace(/^service_/, '')
    return slugSegment(`service_${rest}`)
  }
  return `food_${base.replace(/^food_/, '')}`
}
