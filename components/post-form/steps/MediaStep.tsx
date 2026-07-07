'use client'

import type { ChangeEvent, RefObject } from 'react'
import { Input } from '@/components/ui/input'
import { MediaGallery } from '@/components/post-form/MediaGallery'
import { PostDetailsForm } from '@/components/post-form/PostDetailsForm'
import { StarRating } from '@/components/ui/star-rating'
import type { MediaUploadItem } from '@/lib/hooks/useMediaUpload'

type Props = {
  fileRef: RefObject<HTMLInputElement | null>
  items: MediaUploadItem[]
  canAddMore: boolean
  comment: string
  rating: number
  onPick: () => void
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onCommentChange: (value: string) => void
  onRatingChange: (value: number) => void
}

export function MediaStep({
  fileRef,
  items,
  canAddMore,
  comment,
  rating,
  onPick,
  onFileChange,
  onRemove,
  onRetry,
  onCommentChange,
  onRatingChange,
}: Props) {
  return (
    <div className="space-y-4">
      <Input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onFileChange} />
      <MediaGallery items={items} canAddMore={canAddMore} onPick={onPick} onRemove={onRemove} onRetry={onRetry} mode="full" />
      <div>
        <p className="mb-1.5 text-sm font-medium">Calificación <span className="text-xs font-normal text-muted-foreground">(opcional)</span></p>
        <StarRating value={rating} onChange={onRatingChange} allowClear size={28} />
      </div>
      <PostDetailsForm
        label="Descripción"
        value={comment}
        placeholder="Describe la foto o reel..."
        onChange={onCommentChange}
        maxLength={280}
      />
    </div>
  )
}
