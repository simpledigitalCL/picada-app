export type ReelItem = {
  id: string
  platform: 'youtube' | 'tiktok' | 'instagram'
  title: string
  description: string
  author: string
  thumbnailUrl: string
  embedUrl: string
  sourceUrl: string
  likes?: number
  tags: string[]
}

export type ReelsApiResponse = {
  items: ReelItem[]
  source: string
  at: string
}
