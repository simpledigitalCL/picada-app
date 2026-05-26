'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { Camera, MessageSquare, EyeOff, MapPin } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { PostFormType } from '@/components/global-action-button'
import type { Restaurant } from '@/lib/places/restaurants'
import type { PostFormDraft } from '@/lib/content/post-form-draft'
import { usePostFormFlow } from '@/lib/hooks/usePostFormFlow'
import { useMediaUpload } from '@/lib/hooks/useMediaUpload'
import { usePostFormSubmit } from '@/lib/hooks/usePostFormSubmit'
import { loadProfileSocialSettings, saveProfileSocialSettings } from '@/lib/feed/personalization'
import { UnifiedTagInput } from '@/components/tags/unified-tag-input'
import { MediaStep } from '@/components/post-form/steps/MediaStep'

const LocationStep = dynamic(
  () => import('@/components/post-form/steps/LocationStep').then(m => m.LocationStep),
  { ssr: false, loading: () => <div className="h-24 rounded-2xl bg-muted/50 animate-pulse" /> },
)
const ReviewDetailsStep = dynamic(
  () => import('@/components/post-form/steps/ReviewDetailsStep').then(m => m.ReviewDetailsStep),
  { ssr: false, loading: () => <div className="h-32 rounded-2xl bg-muted/50 animate-pulse" /> },
)
const NewPicadaMapStep = dynamic(
  () => import('@/components/post-form/steps/NewPicadaMapStep').then(m => m.NewPicadaMapStep),
  { ssr: false, loading: () => <div className="h-64 rounded-2xl bg-muted/50 animate-pulse" /> },
)
const NewPicadaDetailsStep = dynamic(
  () => import('@/components/post-form/steps/NewPicadaDetailsStep').then(m => m.NewPicadaDetailsStep),
  { ssr: false, loading: () => <div className="h-32 rounded-2xl bg-muted/50 animate-pulse" /> },
)

interface Props {
  type: PostFormType | null
  locationQuery: string
  contextRestaurant?: Restaurant | null
  draft?: PostFormDraft | null
  onClose: () => void
}

const FORM_META: Record<
  NonNullable<PostFormType>,
  { label: string; icon: React.ReactNode; accent: string }
> = {
  review:     { label: 'Nueva reseña',       icon: <MessageSquare className="size-4" />, accent: 'text-orange-600'  },
  incognito:  { label: 'Modo incógnito',     icon: <EyeOff        className="size-4" />, accent: 'text-slate-600'   },
  media:      { label: 'Foto / Reel',        icon: <Camera        className="size-4" />, accent: 'text-violet-600'  },
  'new-picada': { label: 'Nueva picada',     icon: <MapPin        className="size-4" />, accent: 'text-rose-600'    },
  scan:       { label: 'Escanear plato',     icon: <Camera        className="size-4" />, accent: 'text-emerald-600' },
}

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit:  (dir: number) => ({ opacity: 0, x: dir >= 0 ? -28 : 28 }),
}
const slideTransition = { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const }

export function PostForm({ type, locationQuery, contextRestaurant, draft, onClose }: Props) {
  const isOpen  = type !== null
  const meta    = type ? FORM_META[type] : null
  const { toast } = useToast()

  const flow      = usePostFormFlow(type)
  const media     = useMediaUpload()
  const submitter = usePostFormSubmit()
  const stepIndicators = useMemo(
    () => Array.from({ length: flow.maxStep + 1 }, (_, i) => i),
    [flow.maxStep],
  )

  // Dirección de animación: 1 = avanzar (→), -1 = retroceder (←)
  const directionRef = useRef(0)

  // ── Cargar estado inicial (contextRestaurant / draft) ──────────────────────
  useEffect(() => {
    if (!isOpen) return

    if (contextRestaurant) {
      flow.patchAccumulator({
        restaurantQuery: contextRestaurant.name,
        selectedPlace: {
          id:             contextRestaurant.id,
          name:           contextRestaurant.name,
          address:        contextRestaurant.address,
          rating:         contextRestaurant.rating,
          photoUrl:       contextRestaurant.imageUrl,
          coverageSparse: contextRestaurant.coverageSparse,
          localSlug:      (contextRestaurant as { localSlug?: string | null }).localSlug ?? null,
          category:       (contextRestaurant as { category?: string | null }).category ?? null,
          businessType:   (contextRestaurant as { businessType?: string | null }).businessType ?? null,
        },
        localSlug: (contextRestaurant as { localSlug?: string | null }).localSlug ?? null,
        placeCategory: (contextRestaurant as { category?: string | null }).category ?? null,
      })
    }

    if (draft?.type === type) {
      flow.patchAccumulator({
        restaurantQuery: draft.place?.name || '',
        selectedPlace: draft.place?.name
          ? {
              id:             draft.place.id || draft.place.name,
              name:           draft.place.name,
              address:        draft.place.address || '',
              rating:         draft.place.rating || 0,
              photoUrl:       draft.place.photoUrl,
              coverageSparse: draft.place.coverageSparse,
              category: draft.taxonomy?.category || null,
              businessType: draft.taxonomy?.category || null,
            }
          : null,
        rating:          draft.review?.rating  || 0,
        comment:         draft.review?.comment || '',
        contentCategory: draft.taxonomy?.category || 'experiencia',
        contentTags:     draft.taxonomy?.tags  || [],
        moods:           draft.taxonomy?.moods || [],
        placeCategory: draft.taxonomy?.category || null,
      })
      if (draft.media?.url) media.setPreview(draft.media.url)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    flow.resetFlow()
    media.resetMedia()
    submitter.setSubmitError(null)
    directionRef.current = 0
    onClose()
  }, [flow, media, submitter, onClose])

  const handleNext = useCallback(() => {
    directionRef.current = 1
    flow.nextStep()
  }, [flow])

  const handleBack = useCallback(() => {
    directionRef.current = -1
    flow.prevStep()
  }, [flow])

  const handleSubmit = useCallback(async () => {
    const kind = (
      type === 'incognito'  ? 'incognito'  :
      type === 'media'      ? 'media'      :
      type === 'new-picada' ? 'new-picada' :
      'review'
    ) as 'review' | 'incognito' | 'media' | 'new-picada'

    const mediaUrl = media.uploadedUrl ||
      (media.preview && /^https?:\/\//i.test(media.preview) ? media.preview : null)

    const selected = flow.formAccumulator.selectedPlace
      ? {
          id:      flow.formAccumulator.selectedPlace.id,
          name:    flow.formAccumulator.selectedPlace.name,
          address: flow.formAccumulator.selectedPlace.address,
          category: flow.formAccumulator.selectedPlace.category ?? flow.formAccumulator.placeCategory ?? null,
          businessType: flow.formAccumulator.selectedPlace.businessType ?? null,
        }
      : null

    if (process.env.NODE_ENV === 'development') {
      console.log('FORM_ACCUMULATOR_PRE_SUBMIT:', {
        place_id: selected?.id || null,
        place_name: selected?.name || null,
        category: flow.formAccumulator.placeCategory || selected?.category || selected?.businessType || null,
        local_slug: flow.formAccumulator.localSlug || null,
        rating: flow.formAccumulator.rating,
        tags: flow.formAccumulator.contentTags,
        moods: flow.formAccumulator.moods,
      })
    }

    let postId = `local-${Date.now()}`
    try {
      const result = await submitter.submit({
        type: kind,
        rating:           flow.formAccumulator.rating,
        comment:          flow.formAccumulator.comment,
        selectedPlace:    selected,
        category:         flow.formAccumulator.contentCategory,
        tags:             flow.formAccumulator.contentTags,
        moods:            flow.formAccumulator.moods,
        mediaUrl,
        mediaKind:        media.previewKind,
        picadaLat:        flow.formAccumulator.picadaLat,
        picadaLng:        flow.formAccumulator.picadaLng,
        picadaAddress:    flow.formAccumulator.picadaAddress,
        picadaCommune:    flow.formAccumulator.picadaCommune,
        picadaCity:       flow.formAccumulator.picadaCity,
        picadaRegion:     flow.formAccumulator.picadaRegion,
        picadaName:       flow.formAccumulator.picadaName,
        picadaCategory:   flow.formAccumulator.picadaCategory,
        picadaPhone:      flow.formAccumulator.picadaPhone,
        picadaInstagram:  flow.formAccumulator.picadaInstagram,
        picadaGalleryUrl: media.uploadedUrl || null,
      })
      const rv = result?.value as { post_id?: string; quality_score?: number } | null
      if (rv?.post_id) postId = rv.post_id
      if (rv?.quality_score && rv.quality_score >= 0.7) {
        confetti({ particleCount: 90, spread: 65, origin: { y: 0.72 } })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo publicar.'
      toast({ title: 'Error al publicar', description: message, variant: 'destructive' })
      return
    }

    if (type === 'new-picada') {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.72 } })
      toast({ title: '¡Picada enviada!', description: 'Será revisada y publicada pronto. ¡Gracias!' })
      handleClose()
      return
    }

    toast({ title: '¡Publicado!', description: 'Tu aporte se guardó correctamente.' })

    // Persist post to localStorage so it appears in the profile photo grid
    const localPost = {
      id: postId,
      type: (mediaUrl ? 'photo' : 'review') as 'photo' | 'review',
      text: flow.formAccumulator.comment || '',
      place: flow.formAccumulator.selectedPlace?.name,
      imageDataUrl: mediaUrl ?? undefined,
      rating: flow.formAccumulator.rating || undefined,
      tags: flow.formAccumulator.contentTags,
      moods: flow.formAccumulator.moods,
      createdAt: new Date().toISOString(),
    }
    const profileSettings = loadProfileSocialSettings()
    saveProfileSocialSettings({
      ...profileSettings,
      socialPosts: [localPost, ...(profileSettings.socialPosts || [])],
    })
    window.dispatchEvent(new CustomEvent('picada:review-published', { detail: localPost }))
    window.dispatchEvent(new CustomEvent('picada:post-published'))
    if (localPost.type === 'photo') {
      window.dispatchEvent(new CustomEvent('picada:photo-uploaded'))
    }
    handleClose()
  }, [type, media, flow, submitter, toast, handleClose])

  // ── Step content ──────────────────────────────────────────────────────────
  const renderStep = () => {
    // ── Nueva Picada flow ─────────────────────────────────────────────────
    if (type === 'new-picada') {
      if (flow.step === 0) {
        return (
          <NewPicadaMapStep
            lat={flow.formAccumulator.picadaLat}
            lng={flow.formAccumulator.picadaLng}
            address={flow.formAccumulator.picadaAddress}
            onLocationSet={(lat, lng, address, geo) =>
              flow.patchAccumulator({
                picadaLat:     lat,
                picadaLng:     lng,
                picadaAddress: address,
                picadaCommune: geo.commune,
                picadaCity:    geo.city,
                picadaRegion:  geo.region,
              })
            }
          />
        )
      }
      return (
        <NewPicadaDetailsStep
          name={flow.formAccumulator.picadaName}
          category={flow.formAccumulator.picadaCategory}
          phone={flow.formAccumulator.picadaPhone}
          instagram={flow.formAccumulator.picadaInstagram}
          onNameChange={v => flow.patchAccumulator({ picadaName: v })}
          onCategoryChange={v => flow.patchAccumulator({ picadaCategory: v })}
          onPhoneChange={v => flow.patchAccumulator({ picadaPhone: v })}
          onInstagramChange={v => flow.patchAccumulator({ picadaInstagram: v })}
          photoPreview={media.preview}
          photoUploading={media.uploading}
          photoError={media.uploadError}
          fileRef={media.fileRef}
          onFileChange={media.handleFileChange}
          onRemovePhoto={() => { media.setPreview(null); media.setUploadedUrl(null) }}
        />
      )
    }

    if (flow.step === 0) {
      return (
        <LocationStep
          locationQuery={locationQuery}
          restaurantQuery={flow.formAccumulator.restaurantQuery}
          selectedPlace={flow.formAccumulator.selectedPlace}
          placeStepError={!flow.canAdvance && (
            type === 'review' || type === 'incognito' || type === 'media'
          )}
          onRestaurantQueryChange={v =>
            flow.patchAccumulator({ restaurantQuery: v, selectedPlace: null, localSlug: null, placeCategory: null })
          }
          onSelectPlace={place =>
            flow.patchAccumulator({
              selectedPlace:    place,
              restaurantQuery:  place.name,
              localSlug:        place.localSlug ?? null,
              placeCategory:    place.category ?? place.businessType ?? null,
              contentCategory:  place.category ?? place.businessType ?? flow.formAccumulator.contentCategory,
            })
          }
        />
      )
    }

    if (type === 'media') {
      return (
        <MediaStep
          fileRef={media.fileRef}
          preview={media.preview}
          comment={flow.formAccumulator.comment}
          onPick={() => media.fileRef.current?.click()}
          onFileChange={media.handleFileChange}
          onRemove={() => media.setPreview(null)}
          onCommentChange={v => flow.patchAccumulator({ comment: v })}
        />
      )
    }

    // review / incognito
    return (
      <ReviewDetailsStep
        type={type === 'incognito' ? 'incognito' : 'review'}
        rating={flow.formAccumulator.rating}
        comment={flow.formAccumulator.comment}
        moods={flow.formAccumulator.moods}
        placeName={flow.formAccumulator.selectedPlace?.name || null}
        placeCategory={flow.formAccumulator.placeCategory || flow.formAccumulator.selectedPlace?.businessType || null}
        onRatingChange={v => flow.patchAccumulator({ rating: v })}
        onCommentChange={v => flow.patchAccumulator({ comment: v })}
        onMoodsChange={v => flow.patchAccumulator({ moods: v })}
      />
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Sheet open={isOpen} onOpenChange={open => !open && handleClose()}>
      <SheetContent
        side="bottom"
        showCloseButton
        className="h-[90dvh] rounded-t-3xl p-0 flex flex-col overflow-hidden"
      >
        <SheetTitle className="sr-only">
          {meta?.label ?? 'Publicar'}
        </SheetTitle>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {meta && (
              <span className={cn('flex items-center justify-center size-7 rounded-xl bg-muted', meta.accent)}>
                {meta.icon}
              </span>
            )}
            <p className="font-semibold text-[15px]">{meta?.label ?? 'Publicar'}</p>
          </div>

          {/* Indicador de pasos */}
          {flow.maxStep > 0 && (
            <div className="flex items-center gap-1.5 mr-auto ml-4">
              {stepIndicators.map(i => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === flow.step
                      ? 'w-5 bg-orange-500'
                      : i < flow.step
                        ? 'w-2 bg-orange-300'
                        : 'w-2 bg-border',
                  )}
                />
              ))}
            </div>
          )}

        </div>

        {/* ── Contenido con animación de paso ───────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <AnimatePresence initial={false} custom={directionRef.current} mode="wait">
            <motion.div
              key={flow.step}
              custom={directionRef.current}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
              className="absolute inset-0 overflow-y-auto px-5 py-4 space-y-5"
            >
              {renderStep()}

              {/* Tags — visible en step > 0, excepto nueva picada */}
              {flow.step > 0 && type !== 'new-picada' && (
                <UnifiedTagInput
                  context={type === 'media' ? 'food' : 'venue'}
                  localSlug={flow.formAccumulator.localSlug}
                  selectedSlugs={flow.formAccumulator.contentTags}
                  onSlugsChange={tags => flow.patchAccumulator({ contentTags: tags })}
                />
              )}

              {/* Progreso de compresión de video */}
              {media.compressing && (
                <div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 space-y-1.5">
                  <p className="text-xs text-orange-700 font-medium">Comprimiendo video… {media.compressProgress}%</p>
                  <div className="h-1.5 rounded-full bg-orange-100 overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{ width: `${media.compressProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error de upload de media */}
              {media.uploadError && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {media.uploadError}
                </p>
              )}

              {/* Error de submit */}
              {submitter.submitError && (
                <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2 font-medium">
                  {submitter.submitError}
                </p>
              )}

              {/* Padding de seguridad inferior para el botón fijo */}
              <div className="h-2" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border px-5 py-4 flex gap-2.5 bg-background">
          {flow.step > 0 && (
            <Button
              variant="outline"
              className="flex-1 rounded-2xl h-12"
              onClick={handleBack}
              disabled={submitter.isSubmitting}
            >
              Atrás
            </Button>
          )}

          {flow.step < flow.maxStep ? (
            <Button
              className="flex-1 rounded-2xl h-12 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleNext}
              disabled={!flow.canAdvance}
            >
              Continuar
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-2xl h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              onClick={handleSubmit}
              disabled={submitter.isSubmitting || media.uploading || media.compressing}
            >
              {submitter.isSubmitting
                ? (type === 'new-picada' ? 'Enviando…' : 'Publicando…')
                : media.compressing
                  ? `Comprimiendo… ${media.compressProgress}%`
                  : media.uploading
                    ? 'Subiendo archivo…'
                    : type === 'new-picada'
                      ? 'Agregar picada'
                      : 'Publicar'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
