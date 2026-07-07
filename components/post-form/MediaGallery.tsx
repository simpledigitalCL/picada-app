'use client'

import { Plus, X, Video, RotateCw } from 'lucide-react'
import type { MediaUploadItem } from '@/lib/hooks/useMediaUpload'

type Props = {
  items: MediaUploadItem[]
  canAddMore: boolean
  onPick: () => void
  onRemove: (id: string) => void
  onRetry?: (id: string) => void
  mode?: 'compact' | 'full'
}

export function MediaGallery({ items, canAddMore, onPick, onRemove, onRetry, mode = 'compact' }: Props) {
  const empty = items.length === 0

  if (empty && mode === 'full') {
    return (
      <button
        type="button"
        onClick={onPick}
        className="w-full h-44 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 flex flex-col items-center justify-center gap-1 text-xs text-violet-600"
      >
        <Plus className="size-5" />
        Toca para subir hasta 3 fotos o 1 video
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {empty ? (
        <button
          type="button"
          onClick={onPick}
          className="w-full rounded-xl border border-dashed border-muted-foreground/40 py-3 text-xs text-muted-foreground hover:bg-muted/40"
        >
          + Agregar fotos o video
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map(item => (
            <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden border bg-muted">
              {item.kind === 'video' ? (
                <>
                  <video src={item.preview} className="h-full w-full object-cover" muted playsInline />
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/60 p-1 text-white">
                    <Video className="size-3" />
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.preview} alt="" className="h-full w-full object-cover" />
              )}

              {item.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </div>
              )}
              {item.error && (
                <button
                  type="button"
                  onClick={() => onRetry?.(item.id)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-red-900/60 p-1 text-center text-[9px] font-medium text-white"
                >
                  <RotateCw className="size-4" />
                  Reintentar
                </button>
              )}

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Quitar"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {canAddMore && (
            <button
              type="button"
              onClick={onPick}
              className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground hover:bg-muted/40"
            >
              <Plus className="size-5" />
              Agregar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
