'use client'

import { useState } from 'react'
import { getAuthHeaders } from '@/lib/api/auth'
import { getOrCreateIdentity } from '@/lib/auth/identity'
import type { UnifiedContentPayload } from '@/lib/content/model'
import { validatePostDetailsInput } from '@/lib/validation/post-form-schema'

type SubmitInput = {
  type: 'review' | 'incognito' | 'media' | 'new-picada'
  rating: number
  comment: string
  selectedPlace: { id: string; name: string; address: string; category?: string | null; businessType?: string | null } | null
  category: string
  tags: string[]
  moods: string[]
  mediaUrl: string | null
  mediaKind: 'photo' | 'video' | null
  picadaLat?: number | null
  picadaLng?: number | null
  picadaAddress?: string | null
  picadaCommune?: string | null
  picadaCity?: string | null
  picadaRegion?: string | null
  picadaName?: string
  picadaCategory?: string
  picadaPhone?: string
  picadaInstagram?: string
  picadaGalleryUrl?: string | null
}

export function usePostFormSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submit = async (input: SubmitInput) => {
    const normalizedRating = Number.isFinite(Number(input.rating))
      ? Math.max(0, Math.min(5, Math.round(Number(input.rating))))
      : 0
    setSubmitError(null)

    // --- Validaciones de formulario (muestran error en UI) ---
    const parsed = validatePostDetailsInput({
      content: input.comment,
      comment: input.comment,
      description: input.comment,
    })
    if (!parsed.success) {
      setSubmitError('El texto supera el límite permitido.')
      throw new Error('El texto supera el límite permitido.')
    }
    if ((input.type === 'review' || input.type === 'incognito') && !normalizedRating) {
      setSubmitError('Agrega una calificación antes de publicar.')
      throw new Error('Agrega una calificación.')
    }
    if ((input.type === 'review' || input.type === 'incognito' || input.type === 'media') && !input.selectedPlace) {
      setSubmitError('Selecciona un local primero.')
      throw new Error('Selecciona un local.')
    }

    // --- Guard de autenticación: emite evento para abrir modal de login ---
    const authHeaders = await getAuthHeaders()
    if (!authHeaders.Authorization) {
      window.dispatchEvent(new CustomEvent('picada:require-auth'))
      setSubmitError('Inicia sesión para publicar tu aporte.')
      throw new Error('Inicia sesión para publicar.')
    }

    // ── Nueva Picada: insertar lugar pendiente ──────────────────────────
    if (input.type === 'new-picada') {
      if (!input.picadaName?.trim() || !input.picadaCategory || input.picadaLat == null || input.picadaLng == null) {
        setSubmitError('Completa el nombre y categoría del local.')
        throw new Error('Datos incompletos.')
      }
      setIsSubmitting(true)
      try {
        const res = await fetch('/api/places/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            name:      input.picadaName.trim(),
            category:  input.picadaCategory,
            lat:       input.picadaLat,
            lng:       input.picadaLng,
            address:   input.picadaAddress || '',
            commune:   input.picadaCommune || undefined,
            city:      input.picadaCity || undefined,
            region:    input.picadaRegion || undefined,
            phone:     input.picadaPhone || undefined,
            instagram: input.picadaInstagram || undefined,
            gallery:   input.picadaGalleryUrl ? [input.picadaGalleryUrl] : undefined,
            tags:      input.tags,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          const msg =
            data?.error === 'unauthorized'   ? 'Inicia sesión para enviar una picada.' :
            data?.error === 'rate_limited'   ? 'Demasiados intentos. Intenta en un momento.' :
            data?.error || `Error al enviar (HTTP ${res.status}).`
          throw new Error(msg)
        }
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; value?: { place_id?: string } }
        return { ok: true as const, value: { place_id: data?.value?.place_id || null } as Record<string, unknown> }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo enviar.'
        setSubmitError(msg)
        throw e
      } finally {
        setIsSubmitting(false)
      }
    }

    const identity = getOrCreateIdentity()
    const safeMediaUrl =
      typeof input.mediaUrl === 'string' && input.mediaUrl.trim() && !input.mediaUrl.startsWith('data:')
        ? input.mediaUrl.trim()
        : null

    const payload: UnifiedContentPayload = {
      entry: input.type,
      user: { id: identity.userId, username: identity.username },
      place: {
        id: input.selectedPlace?.id || null,
        name: input.selectedPlace?.name || null,
        address: input.selectedPlace?.address || null,
      },
      media: { url: safeMediaUrl, kind: input.mediaKind },
      review: {
        comment: input.comment || null,
        rating: normalizedRating || null,
        isIncognito: input.type === 'incognito',
        markAsPicada: false,
      },
      taxonomy: { category: input.category, tags: input.tags, moods: input.moods },
      meta: {
        schema_version: 'v1',
        from_form: input.type,
        from_unified_form: true,
        user_id: identity.userId,
        place_category: input.selectedPlace?.category || null,
        place_business_type: input.selectedPlace?.businessType || null,
      },
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; message?: string; details?: string; hint?: string }
        const backendMessage = [data?.error, data?.message, data?.details, data?.hint]
          .map(v => String(v || '').trim())
          .find(Boolean)
        const msg =
          data?.error === 'unauthorized'
            ? 'Inicia sesión para publicar tu aporte.'
            : data?.error === 'rate_limited'
              ? 'Demasiados intentos. Intenta en un momento.'
              : backendMessage || `No se pudo publicar (HTTP ${res.status}).`
        throw new Error(msg)
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        value?: {
          post_id?: string
          quality_score?: number
          engagement_score?: number
          completeness?: number
          tags?: string[]
          current_total?: number
        }
      }
      const currentTotal = Number(data?.value?.current_total || 0)
      window.dispatchEvent(new Event('picada:menu-items-updated'))
      window.dispatchEvent(
        new CustomEvent('picada:xp-granted', {
          detail: { amount: 50, currentTotal },
        }),
      )
      return { ok: true as const, value: data?.value || null }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo publicar.'
      setSubmitError(msg)
      throw e
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting, submitError, setSubmitError }
}
