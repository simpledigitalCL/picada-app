'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'picada',         label: '🍽️ Picada'            },
  { value: 'restaurant',     label: '🏠 Restorán'           },
  { value: 'cafe',           label: '☕ Café'               },
  { value: 'fuente_de_soda', label: '🥤 Fuente de soda'    },
  { value: 'bar',            label: '🍺 Bar'                },
  { value: 'fast_food',      label: '🍔 Comida rápida'      },
  { value: 'bakery',         label: '🥐 Panadería'          },
  { value: 'heladeria',      label: '🍦 Heladería'          },
  { value: 'other',          label: '📍 Otro'               },
]

type Props = {
  name: string
  category: string
  phone: string
  instagram: string
  onNameChange:      (v: string) => void
  onCategoryChange:  (v: string) => void
  onPhoneChange:     (v: string) => void
  onInstagramChange: (v: string) => void
}

export function NewPicadaDetailsStep({
  name, category, phone, instagram,
  onNameChange, onCategoryChange, onPhoneChange, onInstagramChange,
}: Props) {
  return (
    <div className="space-y-5 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 p-4">
      {/* Nombre */}
      <div className="space-y-1.5">
        <Label className="text-xs font-black uppercase tracking-tight text-orange-100">
          Nombre del local <span className="text-red-400">*</span>
        </Label>
        <Input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Ej: El Rincón de Don Pancho"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-orange-400"
          maxLength={80}
        />
      </div>

      {/* Categoría */}
      <div className="space-y-2">
        <Label className="text-xs font-black uppercase tracking-tight text-orange-100">
          Tipo <span className="text-red-400">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => onCategoryChange(c.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                category === c.value
                  ? 'bg-orange-500 border-orange-400 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                  : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Teléfono */}
      <div className="space-y-1.5">
        <Label className="text-xs font-black uppercase tracking-tight text-orange-100">
          Teléfono <span className="text-white/40 font-normal normal-case">(opcional)</span>
        </Label>
        <Input
          value={phone}
          onChange={e => onPhoneChange(e.target.value)}
          placeholder="+56 9 1234 5678"
          type="tel"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-orange-400"
        />
      </div>

      {/* Instagram */}
      <div className="space-y-1.5">
        <Label className="text-xs font-black uppercase tracking-tight text-orange-100">
          Instagram <span className="text-white/40 font-normal normal-case">(opcional)</span>
        </Label>
        <Input
          value={instagram}
          onChange={e => onInstagramChange(e.target.value)}
          placeholder="@local_instagram"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-orange-400"
        />
      </div>
    </div>
  )
}
