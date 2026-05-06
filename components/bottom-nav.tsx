'use client'

import { Flame, Home, Map, Play, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Tab = 'explore' | 'reels' | 'picada' | 'map' | 'scan' | 'profile'

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'explore', label: 'Inicio',  Icon: Home },
  { id: 'reels',   label: 'Reels',   Icon: Play },
  { id: 'picada',  label: 'Picada',  Icon: Flame },
  { id: 'map',     label: 'Mapa',    Icon: Map },
  { id: 'profile', label: 'Social', Icon: Users },
]

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-border">
      <div className="flex items-stretch justify-around">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 min-h-[56px]',
                'transition-colors select-none',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('size-5', isActive && 'stroke-[2.5px]')} />
              <span className={cn(
                'text-[10px] font-medium leading-none',
                isActive && 'font-bold',
              )}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
