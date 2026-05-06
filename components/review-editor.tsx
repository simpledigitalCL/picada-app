'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, UserRoundCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

export type ScanSuggestion = {
  nombre_estimado: string
  calorias_aprox: number
  proteinas_g: number
  carbohidratos_g: number
  grasas_g: number
  comentario: string
  es_apto_vegetariano: boolean
  es_apto_vegano: boolean
  es_sin_gluten: boolean
  es_sin_lactosa?: boolean
  score_viral: number
  confidence?: number
  etiquetas_detectadas?: string[]
  source?: 'AI_GENERATED'
}

type MacroSource = 'AI_GENERATED' | 'USER_MANUAL'

const DISH_SUGGESTIONS = [
  'Sanguchería',
  'Sandwich de Potito',
  'Sandwich de Mechada',
  'Completo italiano',
  'Chorrillana',
  'Paila marina',
  'Empanada de pino',
]

export function ReviewEditor({
  suggestion,
  onPublish,
}: {
  suggestion: ScanSuggestion
  onPublish: (payload: {
    dishName: string
    comment: string
    rating: number
    showNutrition: boolean
    nutrition: { kcal: number; protein: number; carbs: number; fat: number; source: MacroSource }
  }) => void
}) {
  const [dishName, setDishName] = useState(suggestion.nombre_estimado)
  const [comment, setComment] = useState(suggestion.comentario || '')
  const [rating, setRating] = useState(5)
  const [showNutrition, setShowNutrition] = useState(true)
  const [kcal, setKcal] = useState(suggestion.calorias_aprox)
  const [protein, setProtein] = useState(suggestion.proteinas_g)
  const [carbs, setCarbs] = useState(suggestion.carbohidratos_g)
  const [fat, setFat] = useState(suggestion.grasas_g)

  const macroSource: MacroSource = useMemo(() => {
    const changed =
      kcal !== suggestion.calorias_aprox ||
      protein !== suggestion.proteinas_g ||
      carbs !== suggestion.carbohidratos_g ||
      fat !== suggestion.grasas_g
    return changed ? 'USER_MANUAL' : 'AI_GENERATED'
  }, [kcal, protein, carbs, fat, suggestion])

  const localSuggestions = useMemo(() => {
    const q = dishName.trim().toLowerCase()
    if (q.length < 2) return []
    return DISH_SUGGESTIONS.filter(item => item.toLowerCase().includes(q)).slice(0, 4)
  }, [dishName])

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <p className="text-sm font-semibold">Borrador de reseña (humano primero)</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Plato detectado (puedes corregir)</p>
          <Input value={dishName} onChange={e => setDishName(e.target.value)} placeholder="Ej: Sandwich de Mechada" />
          {localSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {localSuggestions.map(s => (
                <Badge key={s} variant="outline" className="cursor-pointer" onClick={() => setDishName(s)}>
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input type="number" value={kcal} onChange={e => setKcal(Number(e.target.value) || 0)} placeholder="kcal" />
          <Input type="number" value={protein} onChange={e => setProtein(Number(e.target.value) || 0)} placeholder="protein" />
          <Input type="number" value={carbs} onChange={e => setCarbs(Number(e.target.value) || 0)} placeholder="carbs" />
          <Input type="number" value={fat} onChange={e => setFat(Number(e.target.value) || 0)} placeholder="fat" />
        </div>

        <div className="flex items-center justify-between rounded-xl border px-3 py-2">
          <p className="text-xs">Mostrar info nutricional en publicación</p>
          <Switch checked={showNutrition} onCheckedChange={setShowNutrition} />
        </div>

        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Origen macros:</p>
          <Badge variant={macroSource === 'USER_MANUAL' ? 'default' : 'secondary'}>
            {macroSource === 'USER_MANUAL' ? (
              <>
                <UserRoundCheck className="size-3 mr-1" />
                USER_MANUAL
              </>
            ) : 'AI_GENERATED'}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Tu comentario</p>
          <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="¿Qué tal estaba? ¿Lo recomiendas?" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Estrellas (1-5)</p>
          <Input type="number" min={1} max={5} value={rating} onChange={e => setRating(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} />
        </div>

        <Button
          className="w-full"
          onClick={() => onPublish({
            dishName,
            comment,
            rating,
            showNutrition,
            nutrition: { kcal, protein, carbs, fat, source: macroSource },
          })}
        >
          <CheckCircle2 className="size-4 mr-1.5" />
          Publicar reseña
        </Button>
      </CardContent>
    </Card>
  )
}

