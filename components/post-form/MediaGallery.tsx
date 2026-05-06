'use client'

import { Button } from '@/components/ui/button'

type Props = {
  preview: string | null
  onPick: () => void
  onRemove?: () => void
  mode?: 'compact' | 'full'
}

export function MediaGallery({ preview, onPick, onRemove, mode = 'compact' }: Props) {
  if (mode === 'compact') {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" className="w-full justify-start" onClick={onPick}>
          Agregar foto/video
        </Button>
        {preview ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="preview" className="size-20 rounded-lg object-cover border" />
            {onRemove ? (
              <button type="button" className="text-xs text-muted-foreground underline" onClick={onRemove}>
                Quitar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="w-full max-h-52 object-cover" />
        </div>
      ) : (
        <button
          onClick={onPick}
          className="w-full h-44 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 flex items-center justify-center text-xs text-violet-600"
        >
          Toca para subir foto o video
        </button>
      )}
    </div>
  )
}
