/** Etiqueta legible sólo para UI (no usar como slug persistente definitivo sin catálogo). */
export function slugDisplayFromAutomatedSlug(slug: string): string {
  const s = String(slug || '')
    .replace(/^(food_|local_|attr_|ambience_|service_|attr__|ambience__)/i, '')
    .replace(/_/g, ' ')
    .trim()
  if (!s) return slug
  return s.charAt(0).toUpperCase() + s.slice(1)
}
