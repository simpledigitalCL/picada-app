'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, MapPin, Sparkles, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { savePreferences } from '@/lib/feed/personalization'
import { grantPoints, tickStreak } from '@/lib/gamification/core'

const LIKES_OPTIONS = [
  'sushi', 'pizza', 'completo', 'ramen', 'ceviche', 'empanadas',
  'hamburguesa', 'tacos', 'pasta', 'asado', 'mariscos', 'vegano',
]

const RESTRICTION_OPTIONS = [
  'sin gluten', 'vegetariano', 'vegano', 'sin lactosa',
  'sin mariscos', 'sin cerdo', 'sin nueces', 'halal', 'kosher',
]

type Step = 'welcome' | 'likes' | 'restrictions' | 'done'

interface OnboardingModalProps {
  onComplete: () => void
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [likes, setLikes] = useState<string[]>([])
  const [restrictions, setRestrictions] = useState<string[]>([])

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  const handleDone = () => {
    savePreferences({ likes, restrictions, dislikes: [], religion: 'ninguna' })
    tickStreak()
    grantPoints(50)
    onComplete()
  }

  const steps: Step[] = ['welcome', 'likes', 'restrictions', 'done']
  const stepIndex = steps.indexOf(step)

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-10 pb-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= stepIndex ? 'bg-orange-500 w-6' : 'bg-muted w-3'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6"
            >
              <div className="text-7xl">🔥</div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Bienvenido a<br /><span className="text-orange-500">Picada.App</span></h1>
                <p className="text-muted-foreground mt-3 text-base leading-relaxed">
                  Descubre los mejores locales cerca de ti, gana puntos y sube de nivel explorando.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <div className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left">
                  <MapPin className="size-5 text-orange-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Descubrimiento local</p>
                    <p className="text-xs text-muted-foreground">Restaurantes reales de Google Maps</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left">
                  <Sparkles className="size-5 text-violet-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">IA gastronómica</p>
                    <p className="text-xs text-muted-foreground">Analiza tus platos y estima macros</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left">
                  <Heart className="size-5 text-rose-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Personalizado para ti</p>
                    <p className="text-xs text-muted-foreground">Recomendaciones según tus gustos</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'likes' && (
            <motion.div
              key="likes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col px-6 pt-6 gap-5"
            >
              <div>
                <h2 className="text-2xl font-extrabold">¿Qué te gusta comer? 🍜</h2>
                <p className="text-muted-foreground text-sm mt-1">Selecciona todo lo que quieras. Esto personaliza tu feed.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {LIKES_OPTIONS.map(item => (
                  <Badge
                    key={item}
                    variant={likes.includes(item) ? 'default' : 'outline'}
                    className="cursor-pointer text-sm py-2 px-3 capitalize select-none"
                    onClick={() => toggle(likes, setLikes, item)}
                  >
                    {likes.includes(item) ? '✓ ' : ''}{item}
                  </Badge>
                ))}
              </div>
              {likes.length > 0 && (
                <p className="text-xs text-muted-foreground">{likes.length} seleccionado{likes.length > 1 ? 's' : ''}</p>
              )}
            </motion.div>
          )}

          {step === 'restrictions' && (
            <motion.div
              key="restrictions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col px-6 pt-6 gap-5"
            >
              <div>
                <h2 className="text-2xl font-extrabold">¿Tienes restricciones? 🥗</h2>
                <p className="text-muted-foreground text-sm mt-1">Opcional. Las usamos para filtrar locales compatibles.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {RESTRICTION_OPTIONS.map(item => (
                  <Badge
                    key={item}
                    variant={restrictions.includes(item) ? 'default' : 'outline'}
                    className="cursor-pointer text-sm py-2 px-3 capitalize select-none"
                    onClick={() => toggle(restrictions, setRestrictions, item)}
                  >
                    {restrictions.includes(item) ? '✓ ' : ''}{item}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                className="text-7xl"
              >
                🎉
              </motion.div>
              <div>
                <h2 className="text-2xl font-extrabold">¡Listo, Explorador!</h2>
                <p className="text-muted-foreground mt-2">Tu perfil está personalizado. Ganaste <span className="text-orange-500 font-bold">+50 XP</span> por comenzar.</p>
              </div>
              <div className="rounded-xl border bg-muted/40 px-5 py-4 w-full max-w-xs text-left space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tu primer desafío</p>
                <p className="text-sm font-medium">📷 Escanea un plato hoy</p>
                <p className="text-xs text-muted-foreground">Usa la IA para analizar tu comida · +50 XP</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer buttons */}
      <div className="px-6 pb-10 pt-4 flex gap-3">
        {step !== 'welcome' && step !== 'done' && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setStep(steps[stepIndex - 1] ?? 'welcome')}
          >
            Atrás
          </Button>
        )}
        {step === 'welcome' && (
          <Button className="flex-1 gap-2 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setStep('likes')}>
            Comenzar <ChevronRight className="size-4" />
          </Button>
        )}
        {step === 'likes' && (
          <Button className="flex-1 gap-2" onClick={() => setStep('restrictions')}>
            {likes.length === 0 ? 'Omitir' : 'Siguiente'} <ChevronRight className="size-4" />
          </Button>
        )}
        {step === 'restrictions' && (
          <Button className="flex-1 gap-2" onClick={() => setStep('done')}>
            {restrictions.length === 0 ? 'Omitir' : 'Siguiente'} <ChevronRight className="size-4" />
          </Button>
        )}
        {step === 'done' && (
          <Button className="flex-1 gap-2 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleDone}>
            Explorar Picada.App 🔥
          </Button>
        )}
      </div>
    </div>
  )
}
