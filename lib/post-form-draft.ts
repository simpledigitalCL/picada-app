import type { PostFormType } from '@/components/global-action-button'

export const OPEN_POST_FORM_EVENT = 'picada:open-post-form'

export type PostFormDraft = {
  type: Exclude<PostFormType, 'scan'>
  mode?: 'quick_media' | 'full_review' | 'rating_quick' | 'new_place'
  place?: {
    id?: string
    name?: string
    address?: string
    rating?: number
    photoUrl?: string
    coverageSparse?: boolean
  }
  review?: {
    rating?: number
    comment?: string
    isIncognito?: boolean
  }
  media?: {
    url?: string | null
  }
  taxonomy?: {
    category?: string
    tags?: string[]
    moods?: string[]
  }
}

export function openUnifiedPostForm(draft: PostFormDraft) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_POST_FORM_EVENT, { detail: draft }))
}

