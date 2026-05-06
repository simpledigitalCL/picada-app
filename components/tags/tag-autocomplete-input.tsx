'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { coerceFormTagSlug, type TagSlugDomainPrefix } from '@/lib/tags/slug'

type Props = {
  label: string
  values: string[]
  suggestions: string[]
  placeholder?: string
  onChange: (next: string[]) => void
  /** Si viene definido, cada chip se guarda como slug canónico (ej: food_* / ambience_*). Texto sin prefijo jamás llega en bruto al backend. */
  slugPrefix?: TagSlugDomainPrefix
}

export function TagAutocompleteInput({
  label,
  values,
  suggestions,
  placeholder,
  onChange,
  slugPrefix,
}: Props) {
  const [text, setText] = useState('')

  const canonic = useMemo(
    () => values.map(v => coerceFormTagSlug(v, slugPrefix)),
    [values, slugPrefix],
  )

  const normalizedSet = useMemo(() => new Set(canonic.map(v => v.toLowerCase())), [canonic])

  const list = useMemo(() => {
    const q = coerceFormTagSlug(text, slugPrefix).toLowerCase()
    const sugCanon = suggestions.map(s => coerceFormTagSlug(s, slugPrefix)).filter(Boolean)

    const base = sugCanon.filter(s => !normalizedSet.has(s.toLowerCase()))

    if (!q) return base.slice(0, 8)
    return base.filter(s => s.toLowerCase().includes(q) && !normalizedSet.has(s.toLowerCase())).slice(0, 8)
  }, [text, suggestions, slugPrefix, normalizedSet])

  const add = (value: string) => {
    const v = coerceFormTagSlug(value, slugPrefix)
    if (!v || normalizedSet.has(v.toLowerCase())) return
    onChange([...canonic, v])
    setText('')
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder || 'Escribe para agregar'}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(text)
          }
        }}
      />
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map(s => (
            <Badge
              key={s}
              variant="outline"
              className="cursor-pointer text-[11px]"
              title={slugPrefix ? `${slugPrefix}*` : undefined}
              onClick={() => add(s)}
            >
              + {s}
            </Badge>
          ))}
        </div>
      )}
      {canonic.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {canonic.map(v => (
            <Badge
              key={v}
              variant="secondary"
              className="gap-1 cursor-pointer font-mono text-[10px] max-w-[min(100%,20rem)] break-all"
              onClick={() => onChange(canonic.filter(i => i !== v))}
            >
              {v} <X className="size-3 shrink-0" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
