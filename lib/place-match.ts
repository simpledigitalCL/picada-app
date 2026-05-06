export type UserDietProfile = {
  likes: string[]
  restrictions: string[]
  dislikes: string[]
}

const INFERENCE_RULES: Array<{ tag: string; keywords: string[] }> = [
  { tag: 'sin_lactosa', keywords: ['sin lactosa', 'lactose free', 'leche vegetal', 'leche de coco', 'sin crema'] },
  { tag: 'vegano', keywords: ['vegano', 'vegana', 'vegan', 'plant based', 'opcion vegana', 'opción vegana'] },
  { tag: 'sin_gluten', keywords: ['sin gluten', 'gluten free', 'celiaco', 'celíaco', 'sin tacc'] },
  { tag: 'ambiente_chill', keywords: ['tranquilo', 'relajado', 'musica suave', 'música suave', 'terraza'] },
  { tag: 'ambiente_ruidoso', keywords: ['musica fuerte', 'música fuerte', 'ruidoso'] },
]

function tokenize(text: string): string {
  return text.toLowerCase()
}

export function inferTagsFromText(parts: string[]): string[] {
  const haystack = tokenize(parts.join(' '))
  const tags = new Set<string>()
  for (const rule of INFERENCE_RULES) {
    if (rule.keywords.some(k => haystack.includes(k))) tags.add(rule.tag)
  }
  return [...tags]
}

export function computePlaceMatchScore(args: {
  user: UserDietProfile
  placeName: string
  placeAddress: string
  placeReviewsText?: string[]
  inferredTags?: string[]
}) {
  const text = tokenize([
    args.placeName,
    args.placeAddress,
    ...(args.placeReviewsText || []),
    ...(args.inferredTags || []),
  ].join(' '))

  let score = 55
  const reasons: string[] = []
  const restrictions = args.user.restrictions.map(r => r.toLowerCase())

  for (const r of restrictions) {
    if (text.includes(r)) {
      score += 18
      reasons.push(`Menciona ${r}`)
      continue
    }
    if (r.includes('lactosa') && text.includes('sin_lactosa')) {
      score += 18
      reasons.push('Oferta sin lactosa validada')
    }
    if (r.includes('veg') && text.includes('vegano')) {
      score += 16
      reasons.push('Opciones veganas detectadas')
    }
    if (r.includes('gluten') && text.includes('sin_gluten')) {
      score += 16
      reasons.push('Opciones sin gluten detectadas')
    }
  }

  for (const d of args.user.dislikes.map(s => s.toLowerCase())) {
    if (d && text.includes(d)) score -= 10
  }
  for (const l of args.user.likes.map(s => s.toLowerCase())) {
    if (l && text.includes(l)) score += 4
  }

  score = Math.max(5, Math.min(99, score))
  if (reasons.length === 0) reasons.push('Compatibilidad general por ubicación y reseñas')

  return {
    score,
    reasons: reasons.slice(0, 2),
    glow: score >= 90,
  }
}

