'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Heart, MapPin, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CATEGORY_META, priceLabel, type Restaurant } from '@/lib/restaurants'
import { cn } from '@/lib/utils'

interface ReelCardProps {
  restaurant: Restaurant
  onSelect: (r: Restaurant) => void
}

export function ReelCard({ restaurant: r, onSelect }: ReelCardProps) {
  const [liked,     setLiked]     = useState(false)
  const [showNutri, setShowNutri] = useState(false)
  const meta = CATEGORY_META[r.category]

  return (
    <Card className="overflow-hidden border-border">

      {/* ── Imagen ── */}
      <div
        className="relative w-full h-44 cursor-pointer"
        onClick={() => onSelect(r)}
      >
        <Image
          src={r.imageUrl}
          alt={r.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {!r.openNow && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary" className="font-semibold">Cerrado ahora</Badge>
          </div>
        )}

        {/* Categoría */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge className={cn('border-0 text-xs font-semibold', meta.color)}>
            {meta.emoji} {meta.label}
          </Badge>
          <Badge variant="secondary" className="text-xs font-bold bg-black/40 text-white border-0">
            {priceLabel(r.priceRange)}
          </Badge>
        </div>

        {/* Rating */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/50 text-white rounded-full px-2 py-0.5">
          <Star className="size-3 fill-yellow-400 stroke-none" />
          <span className="text-xs font-bold">{r.rating}</span>
          <span className="text-[10px] opacity-75">({r.reviewCount})</span>
        </div>

        {/* Corazón */}
        <button
          className="absolute top-3 right-3 size-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
          onClick={e => { e.stopPropagation(); setLiked(l => !l) }}
        >
          <Heart className={cn('size-4', liked ? 'fill-rose-500 stroke-rose-500' : 'stroke-foreground')} />
        </button>
      </div>

      {/* ── Contenido ── */}
      <CardContent className="px-4 pt-3 pb-4 space-y-2">

        {/* Nombre + distancia */}
        <div
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => onSelect(r)}
        >
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight truncate">{r.name}</p>
            <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="text-xs">{r.comuna} · {r.distance}</span>
            </div>
          </div>
        </div>

        {/* Descripción */}
        <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
          {r.description}
        </p>

        {/* Tags */}
        <div className="flex gap-1.5 flex-wrap">
          {r.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <Separator />

        {/* Botones de acción */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => setShowNutri(v => !v)}
          >
            {showNutri ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {showNutri ? 'Ocultar' : 'Nutrición'}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onSelect(r)}
          >
            Ver detalle
          </Button>
        </div>

        {/* Macros — solo si showNutri */}
        {showNutri && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[
              { label: 'Kcal',   value: String(r.starPlate.kcal) },
              { label: 'Prot',   value: `${r.starPlate.protein}g` },
              { label: 'Carbs',  value: `${r.starPlate.carbs}g` },
              { label: 'Grasas', value: `${r.starPlate.fat}g` },
            ].map(m => (
              <div key={m.label} className="bg-muted rounded-lg py-2 text-center">
                <p className="text-xs font-bold leading-none">{m.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{m.label}</p>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  )
}
