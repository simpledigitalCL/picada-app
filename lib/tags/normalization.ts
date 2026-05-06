/** Utilidades cliente/servidor: normalización de etiquetas y metadatos de catálogo. */

/** Alineado a CHECK en Postgres (dress aloja attr_* canonical y legado vestimenta) */
export type TagCatalogCategory = 'food' | 'dress' | 'ambience' | 'local' | 'service'

export function inferCatalogCategoryFromSlug(tag: string): TagCatalogCategory {
  const t = tag.trim().toLowerCase()
  if (t.startsWith('local_')) return 'local'
  if (t.startsWith('food_')) return 'food'
  if (t.startsWith('attr_')) return 'dress'
  if (t.startsWith('service_')) return 'service'
  if (t.startsWith('ambience_')) return 'ambience'

  if (t.startsWith('vestimenta_') || t.startsWith('dress_code_') || t.startsWith('dress_')) return 'dress'
  if (
    t.startsWith('ambiente_') ||
    t.startsWith('servicio_') ||
    t.startsWith('espacio_') ||
    t.startsWith('ocasion_') ||
    t.startsWith('calidad_')
  ) {
    return 'ambience'
  }
  if (
    t.startsWith('comida_') ||
    t.startsWith('tipo_plato_') ||
    t.startsWith('sabor_y_aroma_') ||
    t.startsWith('textura_sensacion_') ||
    t.startsWith('ingredientes_destacados_') ||
    t.startsWith('presentacion_') ||
    t.startsWith('dieta_rest_')
  ) {
    return 'food'
  }
  return 'food'
}

export function slugToDisplayName(slug: string): string {
  const s = slug.replace(/_/g, ' ').trim()
  if (!s) return slug
  return s.replace(/\b\w/g, ch => ch.toUpperCase())
}

export function inferTagCatalogFields(slugRaw: string): {
  slug: string
  display_name: string
  category: TagCatalogCategory
} {
  const slug = String(slugRaw || '').trim().toLowerCase()
  const category = inferCatalogCategoryFromSlug(slug)
  return {
    slug,
    display_name: slugToDisplayName(slug),
    category,
  }
}

function stripAccents(raw: string): string {
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function sanitizeTagLabel(raw: string): string {
  return stripAccents(raw).toLowerCase().trim().replace(/\s+/g, ' ')
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, () => 0))
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }
  return dp[m]![n]!
}

export function normalizeWithClosestMatch(raw: string, catalog: string[]): string {
  const input = sanitizeTagLabel(raw)
  if (!input) return ''
  let best = ''
  let bestDist = Number.POSITIVE_INFINITY
  for (const candidate of catalog) {
    const norm = sanitizeTagLabel(candidate)
    if (!norm) continue
    const d = levenshtein(input, norm)
    if (d < bestDist) {
      bestDist = d
      best = candidate
    }
  }
  if (!best) return input.replace(/\b\w/g, x => x.toUpperCase())
  const threshold = input.length <= 5 ? 1 : 2
  if (bestDist <= threshold) return best
  return input.replace(/\b\w/g, x => x.toUpperCase())
}
