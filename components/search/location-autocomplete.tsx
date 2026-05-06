'use client'

import { useState } from 'react'
import { ChevronRight, MapPin } from 'lucide-react'
import { AdvancedSearchModal } from '@/components/search/advanced-search-modal'
import { DEFAULT_LOCATION_PLACEHOLDER } from '@/lib/location/search'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  /** Clases del control (antes aplicadas al input). */
  inputClassName?: string
  dark?: boolean
}

/**
 * Única entrada de zona: abre siempre el modal de búsqueda avanzada (mapa + radio).
 * El cambio de ubicación debe propagarse desde el padre a toda la app (mismo estado global).
 */
export function LocationAutocomplete({
  value,
  onChange,
  placeholder = DEFAULT_LOCATION_PLACEHOLDER,
  className,
  inputClassName,
  dark = false,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const display = value.trim() || placeholder
  const isPlaceholder = !value.trim()

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setAdvancedOpen(true)}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm shadow-sm transition-colors',
          dark
            ? 'border-white/20 bg-black/45 text-white hover:bg-black/55'
            : 'border-input bg-background hover:bg-accent/40',
          isPlaceholder && !dark && 'text-muted-foreground',
          isPlaceholder && dark && 'text-white/60',
          inputClassName,
        )}
      >
        <MapPin className={cn('size-4 shrink-0', dark ? 'text-orange-400' : 'text-orange-500')} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <span className="sr-only">Abrir búsqueda de zona con mapa</span>
        <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden />
      </button>

      <AdvancedSearchModal
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        initialLocation={value}
        onApply={payload => {
          onChange(payload.locationLabel)
        }}
      />
    </div>
  )
}
