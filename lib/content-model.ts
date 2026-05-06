export type ContentFormEntry = 'review' | 'media' | 'incognito' | 'new-picada'

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

