'use client'

import { Textarea } from '@/components/ui/textarea'

type Props = {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  maxLength?: number
}

export function PostDetailsForm({ label, value, placeholder, onChange, maxLength }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <Textarea
        value={value}
        onChange={e => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        placeholder={placeholder}
        className="rounded-xl resize-none text-sm min-h-[80px]"
      />
      {typeof maxLength === 'number' ? (
        <div className="text-right text-[11px] text-muted-foreground">
          {value.length}/{maxLength}
        </div>
      ) : null}
    </div>
  )
}
