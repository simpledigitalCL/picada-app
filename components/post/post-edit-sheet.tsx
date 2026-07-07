'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StarRating } from '@/components/ui/star-rating'
import { MediaGallery } from '@/components/post-form/MediaGallery'
import { useMediaUpload } from '@/lib/hooks/useMediaUpload'
import { useToast } from '@/components/ui/use-toast'
import { updatePost, isLocalPostId, type PostMedia } from '@/lib/api/posts'
import { updateLocalSocialPost } from '@/lib/feed/personalization'

export type EditablePost = {
  id: string
  text?: string
  rating?: number
  media?: PostMedia[]
}

type Props = {
  post: EditablePost | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama tras guardar, con los campos nuevos, para sincronizar la vista. */
  onSaved?: (result: { id: string; text: string; rating: number; media: PostMedia[] }) => void
}

export function PostEditSheet({ post, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast()
  const media = useMediaUpload()
  const [text, setText] = useState('')
  const [rating, setRating] = useState(0)
  const [saving, setSaving] = useState(false)

  // Sembrar el formulario cuando se abre con un post.
  useEffect(() => {
    if (open && post) {
      setText(post.text || '')
      setRating(post.rating || 0)
      media.seedMedia(post.media || [])
    }
    if (!open) media.resetMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post?.id])

  const handleSave = async () => {
    if (!post) return
    const mediaList: PostMedia[] = media.items
      .filter(it => it.url && /^https?:\/\//i.test(it.url))
      .map(it => ({ url: it.url as string, kind: it.kind }))

    // No guardar con fotos a medio subir (mismo guard que la creación).
    const pending = media.items.filter(it => !it.url || !/^https?:\/\//i.test(it.url))
    if (pending.length > 0) {
      toast({
        title: 'Faltan fotos por subir',
        description: 'Reintenta o quita las fotos con error antes de guardar.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const cleanText = text.trim()
      if (!isLocalPostId(post.id)) {
        await updatePost(post.id, { content: cleanText || null, rating, mediaList })
      }
      // Espejar en el historial local (localStorage) para respuesta inmediata.
      updateLocalSocialPost(post.id, {
        text: cleanText,
        rating: rating || undefined,
        imageDataUrl: mediaList[0]?.url,
        media: mediaList.length > 0 ? mediaList : undefined,
        type: mediaList.length > 0 ? 'photo' : 'review',
      })
      window.dispatchEvent(
        new CustomEvent('picada:post-updated', {
          detail: { id: post.id, text: cleanText, rating, media: mediaList },
        }),
      )
      toast({ title: 'Publicación actualizada' })
      onSaved?.({ id: post.id, text: cleanText, rating, media: mediaList })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'update_failed'
      toast({
        title: 'No se pudo guardar',
        description: message === 'forbidden' ? 'No eres el autor de esta publicación.' : 'Reintenta más tarde.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={o => !saving && onOpenChange(o)}>
      <SheetContent side="bottom" className="h-[92dvh] rounded-t-3xl p-0 flex flex-col overflow-hidden">
        <SheetTitle className="px-5 pt-5 pb-3 text-lg font-bold shrink-0">Editar publicación</SheetTitle>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">Calificación</p>
            <StarRating value={rating} onChange={setRating} allowClear size={30} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Fotos / video</p>
            <Input
              ref={media.fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={media.handleFileChange}
            />
            <MediaGallery
              items={media.items}
              canAddMore={media.canAddMore}
              onPick={() => media.fileRef.current?.click()}
              onRemove={media.removeItem}
              onRetry={media.retryItem}
              mode="full"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Comentario</p>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Cuenta tu experiencia…"
              maxLength={4000}
              rows={4}
            />
          </div>
        </div>

        <div className="border-t px-5 py-4 shrink-0 flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl h-12" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="flex-1 rounded-2xl h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            onClick={handleSave}
            disabled={saving || media.uploading || media.compressing || media.hasErrors}
          >
            {saving
              ? 'Guardando…'
              : media.compressing
                ? `Comprimiendo… ${media.compressProgress}%`
                : media.uploading
                  ? 'Subiendo…'
                  : media.hasErrors
                    ? 'Reintenta las fotos'
                    : 'Guardar cambios'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
