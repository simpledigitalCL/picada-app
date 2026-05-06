/**
 * Slugs canónicos para tag_catalog y relaciones: local_, food_, attr_, ambience_, service_.
 * Una sola función de segmentación para cliente y servidor.
 */

/** Convierte texto humano a segmento seguro (guiones → _, sin espacios raros). */
export function slugSegment(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export const TAG_DOMAIN_PREFIXES = {
  local: 'local_' as const,
  food: 'food_' as const,
  attr: 'attr_' as const,
  ambience: 'ambience_' as const,
  service: 'service_' as const,
}

export function attrTagFromPlainLabel(raw: string): string {
  const v = slugSegment(raw)
  if (!v) return ''
  return `${TAG_DOMAIN_PREFIXES.attr}${v}`
}

export function ambienceTagFromPlainLabel(raw: string): string {
  const v = slugSegment(raw)
  if (!v) return ''
  return `${TAG_DOMAIN_PREFIXES.ambience}${v}`
}

export function serviceTagFromPlainLabel(raw: string): string {
  const v = slugSegment(raw)
  if (!v) return ''
  return `${TAG_DOMAIN_PREFIXES.service}${v}`
}

/** Si ya es slug con prefijo dominio, solo normaliza; si no, antepone prefijo para formulario libre. */
export type TagSlugDomainPrefix = (typeof TAG_DOMAIN_PREFIXES)[keyof typeof TAG_DOMAIN_PREFIXES]

export function coerceFormTagSlug(raw: string, prefix?: TagSlugDomainPrefix): string {
  const t = raw.trim().toLowerCase()
  if (!t) return ''
  if (/^(local_|food_|attr_|ambience_|service_)/.test(t)) return slugSegment(t)
  if (!prefix) return slugSegment(t)
  return `${prefix}${slugSegment(t)}`
}
