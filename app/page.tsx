'use client'

import { useEffect, useRef, useState } from 'react'
import { BottomNav, type Tab } from '@/components/bottom-nav'
import { ReelsFeed } from '@/components/views/reels-feed'
import { ReelsView } from '@/components/views/reels-view'
import { HotPicadaView } from '@/components/views/hot-picada-view'
import { MapView } from '@/components/views/map-view'
import { ScanView } from '@/components/views/scan-view'
import { ProfileView } from '@/components/views/profile-view'
import { RestaurantDetail } from '@/components/restaurant/restaurant-detail'
import { GlobalActionButton, type PostFormType } from '@/components/global-action-button'
import { PostForm } from '@/components/post-form'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { type Restaurant } from '@/lib/places/restaurants'
import { cn } from '@/lib/utils'
import { OnboardingModal } from '@/components/auth/onboarding-modal'
import { XpNotification, BadgeNotification, LevelUpNotification } from '@/components/gamification/xp-notification'
import { DiscoveryToast } from '@/components/gamification/discovery-toast'
import { RewardModal } from '@/components/gamification/reward-modal'
import { initAchievementEngine } from '@/lib/gamification/achievement-engine'
import { ErrorBoundary } from '@/components/error-boundary'
import { tickStreak, isStreakAtRisk } from '@/lib/gamification/core'
import { getCurrentLocation, setCurrentLocation, setLocationMode as saveLocationMode } from '@/lib/location/core'
import { useAppStore } from '@/lib/stores/app-store'
import { getOrCreateIdentity } from '@/lib/auth/identity'
import { initGamificationEvents } from '@/lib/gamification/events'
import { emitDomainEvent } from '@/lib/events'
import { OPEN_POST_FORM_EVENT, type PostFormDraft } from '@/lib/content/post-form-draft'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { AdvancedSearchModal } from '@/components/search/advanced-search-modal'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { ensureProfileForSession } from '@/lib/auth/sync-profile'
import { syncCollectionsFromSupabase } from '@/lib/social/collections'
import { AuthQuickRegister } from '@/components/auth/auth-quick-register'
import { CollectionPickerSheet } from '@/components/restaurant/collection-picker-sheet'
import { AchievementToast } from '@/components/gamification/AchievementToast'
import { Input } from '@/components/ui/input'

const ONBOARDING_KEY = 'picada.onboarding.done.v1'

export default function Home() {
  const { toast } = useToast()
  const initAppStore = useAppStore(s => s.init)
  const [tab, setTab] = useState<Tab>('explore')
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerBlock, setPickerBlock] = useState(false)
  const [defaultLocation, setDefaultLocation] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationMode, setLocationMode] = useState<'manual' | 'auto'>('manual')
  const [locationGateOpen, setLocationGateOpen] = useState(false)
  const [bootstrapSearchOpen, setBootstrapSearchOpen] = useState(false)
  const [profileSection, setProfileSection] = useState<'profile' | 'feed'>('profile')
  const [postFormType, setPostFormType] = useState<PostFormType | null>(null)
  const [postFormDraft, setPostFormDraft] = useState<PostFormDraft | null>(null)
  const [reviewPrefill, setReviewPrefill] = useState<Restaurant | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [authRequiredOpen, setAuthRequiredOpen] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [streakRisk, setStreakRisk] = useState(false)

  useEffect(() => {
    const saved = getCurrentLocation().label
    setDefaultLocation(saved)
    setLocationQuery(saved)
    // Mostrar onboarding sólo si nunca lo completó
    const done = window.localStorage.getItem(ONBOARDING_KEY)
    const shouldShowOnboarding = !done
    if (shouldShowOnboarding) {
      setShowOnboarding(true)
    } else if (!saved.trim()) {
      // Si no hay onboarding pendiente, sí abrimos el gate de ubicación.
      setLocationGateOpen(true)
    }
    tickStreak()
    setStreakRisk(isStreakAtRisk())
    const identity = getOrCreateIdentity()
    const stopGamificationEvents = initGamificationEvents()
    const stopAchievementEngine = initAchievementEngine(identity.userId)

    // Registrar apertura de app para el reto midnight-snack y similares
    window.dispatchEvent(new CustomEvent('picada:app-opened'))

    return () => {
      stopGamificationEvents()
      stopAchievementEngine()
    }
  }, [])

  useEffect(() => {
    const dispose = initAppStore()
    return () => dispose()
  }, [initAppStore])

  useEffect(() => {
    if (pickerOpen) {
      setPickerBlock(true)
    } else {
      const t = window.setTimeout(() => setPickerBlock(false), 350)
      return () => window.clearTimeout(t)
    }
  }, [pickerOpen])

  useEffect(() => {
    const handler = (ev: Event) => {
      const draft = (ev as CustomEvent<PostFormDraft>).detail
      if (!draft?.type) return
      setSelected(null)
      setScanOpen(false)
      setReviewPrefill(null)
      setPostFormDraft(draft)
      setPostFormType(draft.type)
    }
    window.addEventListener(OPEN_POST_FORM_EVENT, handler)
    return () => window.removeEventListener(OPEN_POST_FORM_EVENT, handler)
  }, [])

  useEffect(() => {
    const onFirst = (ev: Event) => {
      const detail = (ev as CustomEvent<{ placeName?: string }>).detail
      toast({
        title: '🌟 ¡Primer voto!',
        description: `Eres el primero en descubrir ${detail?.placeName || 'este lugar'}`,
      })
    }
    window.addEventListener('picada:first-discovery', onFirst)
    return () => window.removeEventListener('picada:first-discovery', onFirst)
  }, [toast])

  useEffect(() => {
    const onRequireAuth = () => setAuthRequiredOpen(true)
    window.addEventListener('picada:require-auth', onRequireAuth)
    return () => window.removeEventListener('picada:require-auth', onRequireAuth)
  }, [])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setIsAuthed(false)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      const authed = Boolean(data.session?.user)
      setIsAuthed(authed)
      if (authed) setAuthRequiredOpen(false)
      if (data.session) void ensureProfileForSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.localStorage.removeItem('picada.profile.social.v1')
        window.localStorage.removeItem('picada.collections.v1')
        window.location.reload()
        return
      }
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
        return
      }
      const authed = Boolean(session?.user)
      setIsAuthed(authed)
      if (authed) setAuthRequiredOpen(false)
      if (session) {
        void ensureProfileForSession(session)
        void syncCollectionsFromSupabase()
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ id: string; name: string; address: string; mapsUrl?: string }>).detail
      if (!detail?.id) return
      handleSelect({
        id: detail.id,
        name: detail.name,
        address: detail.address,
        mapsUrl: detail.mapsUrl || '',
        category: 'picada',
        description: '',
        comuna: '',
        lat: 0,
        lng: 0,
        rating: 0,
        reviewCount: 0,
        distance: '',
        priceRange: 1,
        tags: [],
        imageUrl: '',
        starPlate: { name: '', kcal: 0, protein: 0, carbs: 0, fat: 0 },
        openNow: false,
      })
    }
    window.addEventListener('picada:open-restaurant', onOpen)
    return () => window.removeEventListener('picada:open-restaurant', onOpen)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setCurrentLocation(defaultLocation)
  }, [defaultLocation])

  useEffect(() => {
    const savedMode = getCurrentLocation().mode
    setLocationMode(savedMode)
  }, [])

  useEffect(() => {
    saveLocationMode(locationMode)
  }, [locationMode])

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      try {
        const r = await fetch(`/api/locations/reverse?lat=${lat}&lng=${lng}`)
        const data = (await r.json()) as { location?: string }
        if (data.location) {
          setLocationQuery(data.location)
          setDefaultLocation(data.location)
          setLocationGateOpen(false)
          return
        }
      } catch {
        // ignore
      }
      setBootstrapSearchOpen(true)
    }, () => {
      setBootstrapSearchOpen(true)
    })
  }

  useEffect(() => {
    if (locationMode !== 'auto') return
    handleUseCurrentLocation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationMode])

  const VISITED_KEY = 'picada.visited.places.v1'
  const handleSelect = (r: Restaurant) => {
    setSelected(r)
    emitDomainEvent('USER_VISITED', {
      placeId: r.id,
      placeName: r.name,
      placeAddress: r.address,
      mapsUrl: r.mapsUrl,
    })
    // Auto-track visita
    try {
      const raw = window.localStorage.getItem(VISITED_KEY)
      const visited: Array<{ id: string; name: string; address: string; visitedAt: string }> =
        raw ? JSON.parse(raw) : []
      if (!visited.find(v => v.id === r.id)) {
        visited.unshift({ id: r.id, name: r.name, address: r.address, visitedAt: new Date().toISOString() })
        window.localStorage.setItem(VISITED_KEY, JSON.stringify(visited.slice(0, 50)))
      }
    } catch { /* ignore */ }
  }
  const handleClose  = () => {
    if (pickerOpen || pickerBlock) return
    setSelected(null)
  }
  /** Misma lógica en perfil, inicio, mapa y picada: etiqueta + persistencia global (geo la define el modal). */
  const applyGlobalLocationLabel = (value: string) => {
    const v = value.trim()
    if (!v) return
    if (locationMode === 'auto') setLocationMode('manual')
    setLocationQuery(v)
    setDefaultLocation(v)
  }
  const handleAddReviewFromDetail = () => {
    if (!selected) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) {
        setAuthRequiredOpen(true)
        return
      }
      setReviewPrefill(selected)
      setSelected(null)
      setPostFormType('review')
    })
  }
  const handleAddPhotoFromDetail = () => {
    if (!selected) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) {
        setAuthRequiredOpen(true)
        return
      }
      setReviewPrefill(selected)
      setSelected(null)
      setPostFormType('media')
    })
  }
  const handleLocationChange = applyGlobalLocationLabel
  const handleTab = (t: Tab) => {
    setSelected(null)
    setTab(t)
    if (t === 'profile') setProfileSection('profile')
  }

  const handleFabAction = async (type: PostFormType) => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) {
      setAuthRequiredOpen(true)
      return
    }
    if (type === 'scan') {
      setScanOpen(true)
      return
    }
    setSelected(null)
    setReviewPrefill(null)
    setPostFormDraft(null)
    setPostFormType(type)
  }

  const handleOnboardingComplete = () => {
    window.localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
    // Al completar onboarding, abrir gate de ubicación si aún no hay label.
    if (!getCurrentLocation().label.trim()) {
      setLocationGateOpen(true)
    }
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      {/* Onboarding primer uso */}
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}

      <Dialog open={locationGateOpen && !showOnboarding} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Activa tu zona para comenzar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No cargaremos locales hasta que elijas ubicación. Puedes usar geolocalización o búsqueda manual.
          </p>
          <div className="space-y-2 pt-1">
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => {
                setLocationMode('auto')
                void handleUseCurrentLocation()
              }}
            >
              Usar mi ubicación
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setLocationMode('manual')
                setLocationGateOpen(false)
                setBootstrapSearchOpen(true)
              }}
            >
              Búsqueda manual avanzada
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {selected && (
        <CollectionPickerSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          place={{ placeId: selected.id.replace(/^ext-/, ''), placeName: selected.name, placeAddress: selected.address, placePhoto: selected.imageUrl }}
        />
      )}
      <Dialog open={authRequiredOpen} onOpenChange={setAuthRequiredOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Inicia sesión para participar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Puedes explorar locales sin login. Para reseñar, publicar y usar funciones de comunidad, inicia sesión.
          </p>
          <AuthQuickRegister />
        </DialogContent>
      </Dialog>

      <AdvancedSearchModal
        open={bootstrapSearchOpen}
        onOpenChange={setBootstrapSearchOpen}
        initialLocation={locationQuery}
        onApply={({ locationLabel }) => {
          const v = locationLabel.trim()
          if (!v) return
          setLocationQuery(v)
          setDefaultLocation(v)
          setLocationGateOpen(false)
        }}
      />

      {/* Notificaciones flotantes de XP, badges y level-up */}
      <XpNotification />
      <BadgeNotification />
      <LevelUpNotification />
      <DiscoveryToast />
      <RewardModal />

      {/* Banner streak en riesgo */}
      {streakRisk && (
        <div className="fixed top-0 left-0 right-0 z-[90] bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-2 py-2 px-4">
          <span>🔥 ¡Tu racha está en riesgo! Explora algo hoy para mantenerla.</span>
          <button
            className="ml-2 underline opacity-80 hover:opacity-100"
            onClick={() => setStreakRisk(false)}
            aria-label="Cerrar aviso de racha"
          >
            OK
          </button>
        </div>
      )}

      <main className="absolute inset-0 bottom-14">
        <ErrorBoundary>
          <View active={tab === 'explore'}>
            <ReelsFeed
              onSelect={handleSelect}
              locationQuery={locationQuery}
              onLocationChange={handleLocationChange}
              active={tab === 'explore'}
            />
          </View>
        </ErrorBoundary>

        <ErrorBoundary>
          <View active={tab === 'reels'}>
            <ReelsView
              locationQuery={locationQuery}
              onLocationChange={handleLocationChange}
            />
          </View>
        </ErrorBoundary>

        <ErrorBoundary>
          <View active={tab === 'picada'}>
            <HotPicadaView
              locationQuery={locationQuery}
              onSelect={handleSelect}
              onLocationChange={handleLocationChange}
              onNewPicada={() => handleFabAction('new-picada')}
              active={tab === 'picada'}
            />
          </View>
        </ErrorBoundary>

        <ErrorBoundary>
          <View active={tab === 'map'}>
            <MapView
              onSelect={handleSelect}
              active={tab === 'map'}
              locationQuery={locationQuery}
              onLocationChange={handleLocationChange}
            />
          </View>
        </ErrorBoundary>

        <ErrorBoundary>
          <View active={tab === 'profile'}>
            <ProfileView
              locationQuery={locationQuery}
              onLocationChange={applyGlobalLocationLabel}
              locationMode={locationMode}
              onLocationModeChange={setLocationMode}
              onUseCurrentLocation={handleUseCurrentLocation}
              section={profileSection}
              onSectionChange={setProfileSection}
              profileTabActive={tab === 'profile'}
              onSelectPlace={handleSelect}
            />
          </View>
        </ErrorBoundary>
      </main>

      <BottomNav active={tab} onChange={handleTab} />

      <GlobalActionButton
        onAction={handleFabAction}
        hidden={!isAuthed || !!selected || tab === 'reels' || tab === 'map'}
        suppressed={!!postFormType || scanOpen || showOnboarding}
      />

      <PostForm
        type={postFormType}
        locationQuery={locationQuery}
        contextRestaurant={reviewPrefill}
        draft={postFormDraft}
        onClose={() => {
          setPostFormType(null)
          setPostFormDraft(null)
          setReviewPrefill(null)
        }}
      />

      {/* Scanner como sheet accesible desde el FAB */}
      <Sheet open={scanOpen} onOpenChange={open => !open && setScanOpen(false)}>
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-3xl p-0 flex flex-col overflow-hidden">
          <SheetTitle className="sr-only">Escanear plato</SheetTitle>
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 shrink-0" />
          <ScanView />
        </SheetContent>
      </Sheet>

      <Toaster />
      <SonnerToaster />
      <AchievementToast />

      <Sheet open={!!selected} onOpenChange={open => !open && !pickerOpen && !pickerBlock && handleClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[90dvh] rounded-t-3xl p-0 flex flex-col overflow-hidden"
          onPointerDownOutside={(e) => pickerOpen && e.preventDefault()}
        >
          <SheetTitle className="sr-only">Detalle del restaurante</SheetTitle>
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 shrink-0" />
          {selected && (
            <RestaurantDetail
              restaurant={selected}
              onClose={handleClose}
              onAddReview={handleAddReviewFromDetail}
              onAddPhoto={handleAddPhotoFromDetail}
              onPickerOpen={() => setPickerOpen(true)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function View({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'absolute inset-0 transition-opacity duration-200',
        active
          ? 'opacity-100 pointer-events-auto z-10'
          : 'opacity-0 pointer-events-none z-0',
      )}
    >
      {children}
    </div>
  )
}
