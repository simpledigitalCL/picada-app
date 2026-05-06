'use client'

import { Coins } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  value: number
  className?: string
  subtle?: boolean
}

export function XpChip({ value, className, subtle = false }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        subtle
          ? 'border-amber-300/60 bg-amber-100/80 text-amber-800'
          : 'border-amber-300 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-900 shadow-sm',
        'motion-safe:animate-[pulse_2.6s_ease-in-out_infinite]',
        className,
      )}
    >
      <Coins className="size-3.5" />
      +{value} XP
    </span>
  )
}

