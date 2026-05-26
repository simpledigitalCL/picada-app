'use client'

import { useCallback, useMemo, useState } from 'react'
import type { PostFormType } from '@/components/global-action-button'
import type { PlaceSuggestion } from '@/components/search/place-selector'

export type PostFormAccumulator = {
  restaurantQuery:  string
  selectedPlace:    PlaceSuggestion | null
  /** Slug del tipo de local derivado de la categoría (local_bar, local_cafe_cafeteria…). Alimenta UnifiedTagInput. */
  localSlug:        string | null
  /** Categoría/tipo de local seleccionado para contexto de UI + payload. */
  placeCategory:    string | null
  rating:           number
  comment:          string
  contentCategory:  string
  contentTags:      string[]
  moods:            string[]
  // Campos exclusivos del flujo nueva picada
  picadaLat:        number | null
  picadaLng:        number | null
  picadaAddress:    string | null
  picadaCommune:    string | null
  picadaCity:       string | null
  picadaRegion:     string | null
  picadaName:       string
  picadaCategory:   string
  picadaPhone:      string
  picadaInstagram:  string
}

const DEFAULT_ACCUMULATOR: PostFormAccumulator = {
  restaurantQuery: '',
  selectedPlace:   null,
  localSlug:       null,
  placeCategory:   null,
  rating:          0,
  comment:         '',
  contentCategory: 'experiencia',
  contentTags:     [],
  moods:           [],
  picadaLat:       null,
  picadaLng:       null,
  picadaAddress:   null,
  picadaCommune:   null,
  picadaCity:      null,
  picadaRegion:    null,
  picadaName:      '',
  picadaCategory:  '',
  picadaPhone:     '',
  picadaInstagram: '',
}

/** Tipos que requieren lugar seleccionado antes de avanzar al paso 1 */
const PLACE_REQUIRED_TYPES: Array<PostFormType | null> = [
  'review', 'incognito', 'media', 'new-picada',
]

export function usePostFormFlow(type: PostFormType | null) {
  const [step, setStep]               = useState(0)
  const [formAccumulator, setFormAccumulator] = useState<PostFormAccumulator>(DEFAULT_ACCUMULATOR)

  const isReviewFlow = type === 'review' || type === 'incognito'
  const isMediaFlow  = type === 'media'

  // Todos los tipos con contenido enriquecido tienen 2 pasos (0: lugar, 1: detalle+tags)
  const maxStep = useMemo(
    () => (isReviewFlow || isMediaFlow || type === 'new-picada' || type === 'scan' ? 1 : 0),
    [isMediaFlow, isReviewFlow, type],
  )

  // No se puede avanzar sin completar el paso actual
  const canAdvance = useMemo(() => {
    if (type === 'new-picada') {
      if (step === 0) return formAccumulator.picadaLat != null && formAccumulator.picadaLng != null
      if (step === 1) return Boolean(formAccumulator.picadaName.trim()) && Boolean(formAccumulator.picadaCategory)
      return true
    }
    if (step !== 0) return true
    if (type === 'media') return Boolean(formAccumulator.selectedPlace)
    if (type === 'review' || type === 'incognito') return Boolean(formAccumulator.selectedPlace)
    if (PLACE_REQUIRED_TYPES.includes(type)) return Boolean(formAccumulator.selectedPlace)
    return true
  }, [
    formAccumulator.picadaLat, formAccumulator.picadaLng,
    formAccumulator.picadaName, formAccumulator.picadaCategory,
    formAccumulator.selectedPlace, step, type,
  ])

  const nextStep = useCallback(() => {
    if (!canAdvance) return
    setStep(prev => Math.min(maxStep, prev + 1))
  }, [canAdvance, maxStep])

  const prevStep = useCallback(() => {
    setStep(prev => Math.max(0, prev - 1))
  }, [])

  const patchAccumulator = useCallback((patch: Partial<PostFormAccumulator>) => {
    setFormAccumulator(prev => ({ ...prev, ...patch }))
  }, [])

  const resetFlow = useCallback(() => {
    setStep(0)
    setFormAccumulator(DEFAULT_ACCUMULATOR)
  }, [])

  return {
    step,
    maxStep,
    canAdvance,
    formAccumulator,
    patchAccumulator,
    nextStep,
    prevStep,
    resetFlow,
  }
}
