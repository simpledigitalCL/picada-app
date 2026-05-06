'use client'

import type { ChangeEvent, RefObject } from 'react'
import { Input } from '@/components/ui/input'
import { MediaGallery } from '@/components/post-form/MediaGallery'
import { PostDetailsForm } from '@/components/post-form/PostDetailsForm'

type Props = {
  fileRef: RefObject<HTMLInputElement | null>
  preview: string | null
  comment: string
  onPick: () => void
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  onCommentChange: (value: string) => void
}

export function MediaStep({
  fileRef,
  preview,
  comment,
  onPick,
  onFileChange,
  onRemove,
  onCommentChange,
}: Props) {
  return (
    <div className="space-y-4">
      <Input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFileChange} />
      <MediaGallery preview={preview} onPick={onPick} onRemove={onRemove} mode="full" />
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
