'use client'

import { cn } from '@/lib/utils'
import type { MoodId } from '@/lib/feed/mood-filter'

const MOODS: { id: Exclude<MoodId, ''>; emoji: string; label: string; ring: string }[] = [
  { id: 'pobre', emoji: '🦆', label: 'Ando pato', ring: 'ring-yellow-500/30' },
  { id: 'cita', emoji: '🌹', label: 'Cita', ring: 'ring-pink-500/30' },
  { id: 'resaca', emoji: '🍹', label: 'Resaca', ring: 'ring-violet-500/30' },
  { id: 'postpega', emoji: '💼', label: 'Post-pega', ring: 'ring-sky-500/30' },
  { id: 'familiar', emoji: '👨‍👩‍👧', label: 'Familiar', ring: 'ring-emerald-500/30' },
  { id: 'noche', emoji: '🌆', label: 'Tarde', ring: 'ring-indigo-500/30' },
  { id: 'chill', emoji: '😌', label: 'Chill', ring: 'ring-teal-500/30' },
  { id: 'antojado', emoji: '🔥', label: 'Me antojé', ring: 'ring-orange-500/40' },
]

type Props = {
  value: MoodId
  onChange: (m: MoodId) => void
}

export function MoodDiscoveryStrip({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none -mx-1 px-1">
      <span className="text-[10px] text-muted-foreground shrink-0 pr-0.5">Mood</span>
      <button
        type="button"
        onClick={() => onChange('')}
        className={cn(
          'shrink-0 rounded-2xl border px-2.5 py-1 text-[10px] font-medium transition-colors',
          !value ? 'bg-foreground text-background' : 'bg-muted/60 text-muted-foreground hover:bg-muted',
        )}
      >
        Todos
      </button>
      {MOODS.map(m => {
        const active = value === m.id
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(active ? '' : m.id)}
            className={cn(
              'shrink-0 flex items-center gap-1 rounded-2xl border px-2.5 py-1.5 text-[10px] font-medium transition-all',
              active
                ? `bg-orange-500/15 text-orange-800 border-orange-500/50 ring-2 ${m.ring}`
                : 'bg-background/80 border-border text-foreground/80 hover:border-orange-500/30',
            )}
          >
            <span>{m.emoji}</span>
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
