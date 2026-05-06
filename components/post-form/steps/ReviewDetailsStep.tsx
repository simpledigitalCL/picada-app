'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PostDetailsForm } from '@/components/post-form/PostDetailsForm'

const MOODS = [
  { id: 'casual',    label: 'Casual',    emoji: '😎' },
  { id: 'familiar',  label: 'Familiar',  emoji: '👨‍👩‍👧' },
  { id: 'romantico', label: 'Romántico', emoji: '❤️' },
  { id: 'tranquilo', label: 'Tranquilo', emoji: '☕' },
  { id: 'animado',   label: 'Animado',   emoji: '🎉' },
  { id: 'especial',  label: 'Especial',  emoji: '🌟' },
]

const STAR_LABELS = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente']

type Props = {
  type?: 'review' | 'incognito' | 'new-picada'
  rating: number
  comment: string
  moods: string[]
  placeName?: string | null
  placeCategory?: string | null
  onRatingChange: (value: number) => void
  onCommentChange: (value: string) => void
  onMoodsChange: (value: string[]) => void
}

export function ReviewDetailsStep({
  type = 'review',
  rating,
  comment,
  moods,
  placeName,
  placeCategory,
  onRatingChange,
  onCommentChange,
  onMoodsChange,
}: Props) {
  const isPicada = type === 'new-picada'

  const toggleMood = (id: string) => {
    onMoodsChange(
      moods.includes(id) ? moods.filter(m => m !== id) : [...moods, id],
    )
  }

  return (
    <div className="space-y-5 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 p-4">
      {(placeName || placeCategory) && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-[11px] text-orange-100/90 font-medium tracking-tight">
            Estás en: <span className="font-semibold">{placeName || 'Local seleccionado'}</span>
            {placeCategory ? <span className="text-orange-200/90"> · {placeCategory}</span> : null}
          </p>
        </div>
      )}
      {/* ── Calificación ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-tight text-orange-100">
            {isPicada ? 'Calificación (opcional)' : 'Calificación'}
          </p>
          {rating > 0 && (
            <Badge className="bg-orange-500/20 text-orange-100 border-orange-300/40 hover:bg-orange-500/20">
              {STAR_LABELS[rating]}
            </Badge>
          )}
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <Button
              key={n}
              type="button"
              variant="ghost"
              onClick={() => onRatingChange(rating === n && isPicada ? 0 : n)}
              className="group h-auto w-auto p-0 transition-all active:scale-90 hover:bg-transparent"
              aria-label={`${n} estrellas`}
            >
              <Star
                className={cn(
                  'size-8 transition-colors',
                  n <= rating
                    ? 'fill-amber-400 text-amber-500 drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]'
                    : 'text-border group-hover:text-amber-300',
                )}
              />
            </Button>
          ))}
        </div>
      </div>

      {/* ── Comentario ── */}
      <PostDetailsForm
        label={isPicada ? 'Descripción de la picada' : 'Comentario'}
        value={comment}
        placeholder={
          isPicada
            ? '¿Qué la hace especial? ¿Qué pedir sí o sí?'
            : 'Cuéntale a la comunidad tu experiencia…'
        }
        onChange={onCommentChange}
        maxLength={280}
      />

      {/* ── Mood / Ambiente ── */}
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-tight text-orange-100">
          Ambiente
        </p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map(m => {
            const active = moods.includes(m.id)
            return (
              <Button
                key={m.id}
                type="button"
                variant="outline"
                onClick={() => toggleMood(m.id)}
                className={cn(
                  'h-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all bg-gradient-to-r from-[#FF6B00] to-[#FF8800] hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]',
                  active
                    ? 'text-white border-[#FF8800]'
                    : 'text-white/90 border-[#FF8800]/60 opacity-85',
                )}
              >
                <span>{m.emoji}</span>
                {m.label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
