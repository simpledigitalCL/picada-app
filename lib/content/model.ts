export type ContentFormEntry = 'review' | 'media' | 'incognito' | 'new-picada'

/** Una pieza de media subida (ya alojada en storage, URL http). */
export type MediaItem = { url: string; kind: 'photo' | 'video' }

export type UnifiedContentPayload = {
  entry: ContentFormEntry
  user: {
    id: string
    username?: string | null
  }
  place: {
    id?: string | null
    name?: string | null
    address?: string | null
  }
  media: {
    url?: string | null
    kind?: 'photo' | 'video' | null
  }
  /** Lista completa de media (hasta 3 fotos, o 1 video). `media` arriba es el primero (retrocompat). */
  mediaList?: MediaItem[]
  review: {
    comment?: string | null
    rating?: number | null
    isIncognito?: boolean
    markAsPicada?: boolean
  }
  taxonomy: {
    category?: string | null
    tags: string[]
    moods: string[]
  }
  meta?: Record<string, unknown>
}

