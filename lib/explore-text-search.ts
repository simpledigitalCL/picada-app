import { placeDiscoverSearchHaystack } from '@/lib/place-category-filter'
import { slugDisplayFromAutomatedSlug } from '@/lib/place-tags-display'

type SearchablePlace = {
  name: string
  address: string
  rating?: number
  reviews?: number
  inferredTags?: string[]
  automatedSeedTags?: Array<{ slug: string }>
}

type SearchScore = {
  matched: number
  total: number
  coverage: number
  score: number
}

const STOPWORDS = new Set([
  'con', 'para', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'a', 'un', 'una', 'que',
])

const TOKEN_ALIASES: Record<string, string[]> = {
  restaurant: ['restaurante', 'restaurant', 'local'],
  restaurante: ['restaurant', 'local'],
  hamburguesa: ['burger', 'hamburguesa', 'smash', 'smash burger'],
  hamburguesas: ['burger', 'hamburguesa', 'smash'],
  piscina: ['pool', 'piscina'],
  ninos: ['niños', 'familiar', 'kids'],
  ninas: ['niñas', 'familiar', 'kids'],
  sushi: ['sushi', 'sashimi', 'ramen', 'japones', 'japonés'],
}

const LEARN_KEY = 'picada.search.learn.v1'

function normalizeToken(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function tokenizeExploreQuery(query: string): string[] {
  return query
    .split(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g)
    .map(normalizeToken)
    .filter(Boolean)
    .filter(t => t.length >= 2 && !STOPWORDS.has(t))
}

function variantsFor(token: string): string[] {
  const t = normalizeToken(token)
  const variants = TOKEN_ALIASES[t] || []
  return [...new Set([t, ...variants.map(normalizeToken)])]
}

function tokenMatches(text: string, token: string): boolean {
  for (const v of variantsFor(token)) {
    if (text.includes(v)) return true
  }
  return false
}

export function scoreExplorePlaceQuery(place: SearchablePlace, query: string): SearchScore {
  const tokens = tokenizeExploreQuery(query)
  if (tokens.length === 0) return { matched: 0, total: 0, coverage: 0, score: 0 }
  const haystack = placeDiscoverSearchHaystack({
    name: place.name,
    address: place.address,
    inferredTags: place.inferredTags,
    automatedSeedTags: place.automatedSeedTags,
  })
  const name = normalizeToken(place.name)
  let matched = 0
  let score = 0
  for (const t of tokens) {
    if (!tokenMatches(haystack, t)) continue
    matched += 1
    score += 12
    if (tokenMatches(name, t)) score += 7
  }
  const coverage = matched / tokens.length
  score += coverage * 20
  score += Math.min(5, Number(place.rating || 0))
  score += Math.min(4, Math.log10(Math.max(1, Number(place.reviews || 0) + 1)))
  return { matched, total: tokens.length, coverage, score }
}

export function rankExplorePlacesByQuery<T extends SearchablePlace>(places: T[], query: string): T[] {
  const tokens = tokenizeExploreQuery(query)
  if (tokens.length === 0) return places
  const scored = places
    .map(p => ({ p, s: scoreExplorePlaceQuery(p, query) }))
    .filter(x => x.s.matched > 0)
    .sort((a, b) => {
      if (b.s.coverage !== a.s.coverage) return b.s.coverage - a.s.coverage
      if (b.s.score !== a.s.score) return b.s.score - a.s.score
      const br = Number(b.p.rating || 0)
      const ar = Number(a.p.rating || 0)
      if (br !== ar) return br - ar
      return Number(b.p.reviews || 0) - Number(a.p.reviews || 0)
    })
  return scored.map(x => x.p)
}

type LearnState = {
  tokenCounts: Record<string, number>
  pairCounts: Record<string, number>
}

function readLearnState(): LearnState {
  if (typeof window === 'undefined') return { tokenCounts: {}, pairCounts: {} }
  try {
    const raw = window.localStorage.getItem(LEARN_KEY)
    const data = raw ? (JSON.parse(raw) as LearnState) : { tokenCounts: {}, pairCounts: {} }
    return data
  } catch {
    return { tokenCounts: {}, pairCounts: {} }
  }
}

function writeLearnState(state: LearnState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LEARN_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function learnExploreSearchQuery(query: string) {
  const tokens = [...new Set(tokenizeExploreQuery(query))]
  if (tokens.length < 2) return
  const state = readLearnState()
  for (const t of tokens) state.tokenCounts[t] = Number(state.tokenCounts[t] || 0) + 1
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i]!
      const b = tokens[j]!
      const key = [a, b].sort().join('|')
      state.pairCounts[key] = Number(state.pairCounts[key] || 0) + 1
    }
  }
  writeLearnState(state)
}

export function relatedExploreSuggestions(query: string, limit = 6): string[] {
  const tokens = [...new Set(tokenizeExploreQuery(query))]
  if (tokens.length === 0) return []
  const state = readLearnState()
  const out = new Map<string, number>()
  for (const key of Object.keys(state.pairCounts)) {
    const [a, b] = key.split('|')
    if (!a || !b) continue
    for (const t of tokens) {
      if (a === t && !tokens.includes(b)) out.set(b, Math.max(out.get(b) || 0, state.pairCounts[key]!))
      if (b === t && !tokens.includes(a)) out.set(a, Math.max(out.get(a) || 0, state.pairCounts[key]!))
    }
  }
  return [...out.entries()].sort((x, y) => y[1] - x[1]).slice(0, limit).map(x => x[0])
}

export function trendingExploreTags(places: SearchablePlace[], limit = 10): string[] {
  const counts = new Map<string, number>()
  for (const p of places) {
    for (const s of p.automatedSeedTags || []) {
      const label = slugDisplayFromAutomatedSlug(s.slug).toLowerCase().trim()
      if (!label) continue
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    for (const t of p.inferredTags || []) {
      const label = slugDisplayFromAutomatedSlug(String(t || '')).toLowerCase().trim()
      if (!label) continue
      counts.set(label, (counts.get(label) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k)
}

/** Sugerencias por prefijo (ej: "compl" -> "completo", "completo gigante"). */
export function suggestExploreCompletions(places: SearchablePlace[], query: string, limit = 6): string[] {
  const q = normalizeToken(query)
  if (q.length < 2) return []
  const counts = new Map<string, number>()
  for (const p of places) {
    for (const s of p.automatedSeedTags || []) {
      const label = slugDisplayFromAutomatedSlug(s.slug).toLowerCase().trim()
      if (!label) continue
      counts.set(label, (counts.get(label) || 0) + 2)
    }
    for (const t of p.inferredTags || []) {
      const label = slugDisplayFromAutomatedSlug(String(t || '')).toLowerCase().trim()
      if (!label) continue
      counts.set(label, (counts.get(label) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .filter(([label]) => normalizeToken(label).startsWith(q))
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].length - b[0].length
    })
    .slice(0, limit)
    .map(([label]) => label)
}
