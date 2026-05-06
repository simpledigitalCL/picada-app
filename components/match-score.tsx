'use client'

import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Props = {
  score: number
  reason?: string
}

export function MatchScore({ score, reason }: Props) {
  const tone =
    score >= 90
      ? 'bg-emerald-600 text-white'
      : score >= 75
        ? 'bg-amber-500 text-black'
        : 'bg-slate-600 text-white'
  return (
    <div className="flex items-center gap-1.5">
      <Badge className={`rounded-2xl px-2.5 py-1 text-[10px] font-bold ${tone}`}>
        <Sparkles className="size-3 mr-1" />
        {score}% Match
      </Badge>
      {reason ? <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">{reason}</span> : null}
    </div>
  )
}

