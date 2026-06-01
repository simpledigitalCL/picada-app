'use client'

import type { ChangeEvent, RefObject } from 'react'
import { Input } from '@/components/ui/input'
import { MediaGallery } from '@/components/post-form/MediaGallery'
import { PostDetailsForm } from '@/components/post-form/PostDetailsForm'
import type { MediaUploadItem } from '@/lib/hooks/useMediaUpload'

type Props = {
  fileRef: RefObject<HTMLInputElement | null>
  items: MediaUploadItem[]
  canAddMore: boolean
  comment: string
  onPick: () => void
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: (id: string) => void
  onCommentChange: (value: string) => void
}

export function MediaStep({
  fileRef,
  items,
  canAddMore,
  comment,
  onPick,
  onFileChange,
  onRemove,
  onCommentChange,
}: Props) {
  return (
    <div className="space-y-4">
      <Input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onFileChange} />
      <MediaGallery items={items} canAddMore={canAddMore} onPick={onPick} onRemove={onRemove} mode="full" />
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
