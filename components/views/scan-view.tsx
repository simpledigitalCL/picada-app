'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Camera, Upload, Loader2, Share2, Sparkles, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ReviewEditor, type ScanSuggestion } from '@/components/review/review-editor'
import { openUnifiedPostForm } from '@/lib/content/post-form-draft'

interface ScanResult {
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

export function ScanView() {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [published, setPublished] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [mood, setMood] = useState<'epico' | 'clean' | 'barato'>('epico')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = async e => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      setLoading(true)
      setResult(null)
      setPublished(false)
      setScannerError(null)

      try {
        const base64 = dataUrl.split(',')[1]
        const res = await fetch('/api/scanner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagen_base64: base64, media_type: file.type }),
        })
        const data = await res.json()
        if (data.error === 'not_food_detected') {
          setScannerError('No detecté comida o menú claramente. Sube otra foto.')
          setResult(null)
          return
        }
        if (data.error) throw new Error(data.error)
        setResult(data)
        window.dispatchEvent(new CustomEvent('picada:scan-complete'))
      } catch {
        setScannerError('No se pudo analizar la imagen. Intenta nuevamente.')
        setResult(null)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function reset() {
    setPreview(null)
    setResult(null)
    setLoading(false)
    setPublished(false)
    setScannerError(null)
  }

  const maxKcal = 900

  return (
    <ScrollArea className="h-full">
      <div className="px-4 pt-5 pb-24 space-y-5 max-w-md mx-auto">

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Escanear plato</h1>
          <p className="text-sm text-muted-foreground mt-0.5">IA analiza tus macros al instante</p>
        </div>

        {/* Zona de upload / preview */}
        {!preview ? (
          <Card
            className="border-dashed border-2 cursor-pointer hover:border-primary transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="size-14 rounded-full bg-muted flex items-center justify-center">
                <Camera className="size-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">Subir foto del plato</p>
                <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG o HEIC · Máx 10 MB</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="size-4" /> Elegir imagen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="relative rounded-xl overflow-hidden aspect-video">
            <Image src={preview} alt="Plato escaneado" fill className="object-cover" />
            {!loading && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-3 right-3 bg-black/60 text-white hover:bg-black/80 border-0"
                onClick={reset}
              >
                Cambiar foto
              </Button>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <Loader2 className="size-5 animate-spin text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold">Analizando con IA...</p>
                <p className="text-xs text-muted-foreground">Detectando ingredientes y macros</p>
              </div>
            </CardContent>
          </Card>
        )}
        {scannerError ? (
          <Card><CardContent className="py-4 text-sm text-red-600">{scannerError}</CardContent></Card>
        ) : null}

        {/* Resultado IA + borrador humano */}
        {result && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{result.nombre_estimado}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Sugerencias IA (no publicadas aún)</CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5 shrink-0">
                    <Sparkles className="size-3.5 text-yellow-500" />
                    <span className="text-xs font-bold">{result.score_viral}/10</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Barra de calorías */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Calorías</span>
                    <span className="font-bold text-foreground">{result.calorias_aprox} kcal</span>
                  </div>
                  <Progress value={(result.calorias_aprox / maxKcal) * 100} className="h-2" />
                </div>

                <Separator />

                {/* Macros grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Proteína', value: result.proteinas_g, unit: 'g', color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Carbs',    value: result.carbohidratos_g, unit: 'g', color: 'text-orange-600 dark:text-orange-400' },
                    { label: 'Grasas',   value: result.grasas_g, unit: 'g', color: 'text-yellow-600 dark:text-yellow-400' },
                  ].map(m => (
                    <div key={m.label} className="bg-muted rounded-xl p-3 text-center">
                      <p className={`text-xl font-extrabold leading-none ${m.color}`}>{m.value}<span className="text-xs font-normal text-muted-foreground">{m.unit}</span></p>
                      <p className="text-[10px] text-muted-foreground mt-1">{m.label}</p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Comentario IA */}
                <p className="text-sm text-muted-foreground italic leading-relaxed">"{result.comentario}"</p>

                <Separator />

                {/* Tags dietéticos */}
                <div className="flex gap-2 flex-wrap">
                  {result.es_apto_vegetariano && <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">🌿 Vegetariano</Badge>}
                  {result.es_apto_vegano && <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">🌱 Vegano</Badge>}
                  {result.es_sin_gluten && <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">🌾 Sin Gluten</Badge>}
                  {result.es_sin_lactosa && <Badge variant="outline" className="text-sky-700 border-sky-300 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800">🥥 Sin Lactosa</Badge>}
                  {!result.es_apto_vegetariano && !result.es_apto_vegano && !result.es_sin_gluten && (
                    <Badge variant="secondary" className="text-xs">🥩 Contiene carnes y gluten</Badge>
                  )}
                </div>
                {(result.etiquetas_detectadas || []).length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Etiquetas IA: {(result.etiquetas_detectadas || []).join(', ')}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <ReviewEditor
              suggestion={result as ScanSuggestion}
              onPublish={async (payload) => {
                openUnifiedPostForm({
                  type: 'review',
                  mode: 'full_review',
                  place: { name: payload.dishName || 'Local sin nombre' },
                  review: { comment: payload.comment, rating: payload.rating },
                  media: { url: preview },
                  taxonomy: {
                    category: 'comida',
                    tags: result.etiquetas_detectadas || [],
                    moods: [mood],
                  },
                })
                const gained = 15 + Number(result.score_viral || 0) // estimación UX
                setXpEarned(gained)
                setPublished(true)
              }}
            />
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground mb-2">Sticker de Mood</p>
                <div className="flex gap-2">
                  <Button size="sm" variant={mood === 'epico' ? 'default' : 'outline'} onClick={() => setMood('epico')}>🔥 Épico</Button>
                  <Button size="sm" variant={mood === 'clean' ? 'default' : 'outline'} onClick={() => setMood('clean')}>🌿 Clean</Button>
                  <Button size="sm" variant={mood === 'barato' ? 'default' : 'outline'} onClick={() => setMood('barato')}>💸 Barato</Button>
                </div>
              </CardContent>
            </Card>
            {published && (
              <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-4 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-green-700 dark:text-green-400">¡Publicado en la comunidad!</p>
                  {xpEarned > 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Zap className="size-3 text-orange-500" /> +{xpEarned} XP ganados
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => {
                  const text = `Escaneé mi plato con Picada.App 🍕 — ${result?.nombre_estimado ?? 'plato delicioso'} · ${result?.calorias_aprox ?? '?'} kcal`
                  if (navigator.share) navigator.share({ title: 'Mi plato en Picada.App', text }).catch(() => null)
                  else navigator.clipboard.writeText(text).catch(() => null)
                }}>
                  <Share2 className="size-3.5" /> Compartir
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  )
}
