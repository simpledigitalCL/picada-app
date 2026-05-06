/** Filtro local “Mood Discovery” sobre resultados ya descargados (sin nueva API). */

import { placeClassificationCorpus } from '@/lib/places/category-filter'

export type MoodId =
  | ''
  | 'pobre'
  | 'cita'
  | 'resaca'
  | 'postpega'
  | 'familiar'
  | 'noche'
  | 'chill'
  | 'antojado'

type Place = {
  name: string
  address: string
  priceLevel: number | null
  rating: number
  inferredTags?: string[]
  automatedSeedTags?: Array<{ slug: string }>
}

function moodHaystack(p: Place) {
  return placeClassificationCorpus(p)
}

const MOOD: Record<Exclude<MoodId, ''>, (p: Place) => boolean> = {
  pobre: p =>
    (p.priceLevel != null && p.priceLevel <= 1) ||
    /econo|barato|picada|fuente|completo|chorrillana|casino/i.test(moodHaystack(p)),
  cita: p =>
    (p.priceLevel != null && p.priceLevel >= 2) ||
    /bistró|bistro|románt|romant|fine|wine|noche|japon|sushi|italian|frances/i.test(moodHaystack(p)),
  resaca: p =>
    /completo|fuente|sandwich|carretera|diner|hambur|despensa/i.test(moodHaystack(p)) || p.rating < 4.3,
  postpega: p =>
    /café|cafe|menú|menu|ejecutiv|wok|almuerz|lunch|office/i.test(moodHaystack(p)),
  familiar: p =>
    /parrilla|pizza|tip top|familiar|parque|jardín|parrillada|ambience_familiar/i.test(moodHaystack(p)),
  noche: p =>
    /bar|cerve|pub|club|bistró|noche|terraza|copas/i.test(moodHaystack(p)),
  chill: p =>
    /café|cafe|brunch|pastel|jardín|terraza|tranquil|japon|tea|matcha|ambience_chill/i.test(moodHaystack(p)),
  antojado: p =>
    p.rating >= 4.2 || /picada|parrilla|hambur|lomito|french|frito|dulce|postre/i.test(moodHaystack(p)),
}

export function filterPlacesByMood<T extends Place>(places: T[], mood: MoodId): T[] {
  if (!mood) return places
  const fn = MOOD[mood as Exclude<MoodId, ''>]
  if (!fn) return places
  return places.filter(fn)
}
