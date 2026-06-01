'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StarRatingProps = {
  /** Current rating, supports halves (e.g. 3.5). 0 = sin calificar. */
  value: number
  /** Required for interactive mode. Omitted/readOnly => display only. */
  onChange?: (value: number) => void
  readOnly?: boolean
  /** When true, a second tap on a half-star clears the rating to 0 (optional ratings). */
  allowClear?: boolean
  /** px size of each star */
  size?: number
  /** gap between stars in px */
  gap?: number
  className?: string
  fillClassName?: string
  emptyClassName?: string
  ariaLabel?: string
}

/** Fraction (0, 0.5 or 1) that star `i` (1-based) should be filled for `value`. */
const fillFraction = (value: number, i: number) => Math.max(0, Math.min(1, value - (i - 1)))

function StarGlyph({
  fraction,
  size,
  fillClassName,
  emptyClassName,
}: {
  fraction: number
  size: number
  fillClassName: string
  emptyClassName: string
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <Star className={cn('absolute inset-0', emptyClassName)} style={{ width: size, height: size }} />
      {fraction > 0 && (
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fraction * 100}%` }}>
          <Star className={cn(fillClassName)} style={{ width: size, height: size, maxWidth: 'none' }} />
        </span>
      )}
    </span>
  )
}

/**
 * Estrellas con soporte de mitades estilo Letterboxd.
 * Interactivo: el primer toque marca la estrella completa (n), el segundo toque
 * la baja a media (n - 0.5). Un tercer toque vuelve a completa, o limpia a 0 si
 * `allowClear` está activo.
 */
export function StarRating({
  value,
  onChange,
  readOnly = false,
  allowClear = false,
  size = 28,
  gap = 6,
  className,
  fillClassName = 'fill-amber-400 text-amber-500',
  emptyClassName = 'text-muted-foreground/30',
  ariaLabel,
}: StarRatingProps) {
  const interactive = !readOnly && typeof onChange === 'function'

  const handleTap = (n: number) => {
    if (!onChange) return
    if (value === n) onChange(n - 0.5)
    else if (value === n - 0.5) onChange(allowClear ? 0 : n)
    else onChange(n)
  }

  return (
    <div
      className={cn('inline-flex items-center', className)}
      style={{ gap }}
      role={interactive ? 'group' : 'img'}
      aria-label={ariaLabel ?? (interactive ? 'Calificación' : `${value} de 5 estrellas`)}
    >
      {[1, 2, 3, 4, 5].map(n => {
        const fraction = fillFraction(value, n)
        const glyph = (
          <StarGlyph fraction={fraction} size={size} fillClassName={fillClassName} emptyClassName={emptyClassName} />
        )
        if (!interactive) return <span key={n}>{glyph}</span>
        return (
          <button
            key={n}
            type="button"
            onClick={() => handleTap(n)}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            className="transition-transform active:scale-90"
          >
            {glyph}
          </button>
        )
      })}
    </div>
  )
}
