'use client'

import { create } from 'zustand'
import { getCurrentLocation, subscribeToLocationChanges } from '@/lib/location'
import { getUserInteraction, subscribeToSocialChanges, toggleVisitLater, votePicada } from '@/lib/social'

type InteractionState = {
  votedPicada: boolean
  picadaVotesCount: number
  savedForLater: boolean
}

type AppStore = {
  locationLabel: string
  interactions: Record<string, InteractionState>
  init: () => () => void
  refreshLocation: () => void
  refreshInteraction: (picadaId: string, placeName?: string) => void
  votePicada: (picadaId: string, placeName?: string, meta?: { placeAddress?: string; mapsUrl?: string }) => Promise<void>
  toggleVisitLater: (picadaId: string, placeName: string) => void
}

function defaultInteraction(): InteractionState {
  return { votedPicada: false, picadaVotesCount: 0, savedForLater: false }
}

export const useAppStore = create<AppStore>((set, get) => ({
  locationLabel: getCurrentLocation().label,
  interactions: {},

  init: () => {
    const onLocation = () => set({ locationLabel: getCurrentLocation().label })
    const onSocial = (picadaId?: string) => {
      if (!picadaId) return
      const current = get().interactions[picadaId] || defaultInteraction()
      const next = getUserInteraction(picadaId, undefined)
      if (
        current.votedPicada === next.votedPicada &&
        current.picadaVotesCount === next.picadaVotesCount
      ) {
        return
      }
      set({
        interactions: {
          ...get().interactions,
          [picadaId]: {
            ...current,
            votedPicada: next.votedPicada,
            picadaVotesCount: next.picadaVotesCount,
          },
        },
      })
    }
    const unSubLoc = subscribeToLocationChanges(onLocation)
    const unSubSocial = subscribeToSocialChanges(onSocial)
    onLocation()
    return () => {
      unSubLoc()
      unSubSocial()
    }
  },

  refreshLocation: () => set({ locationLabel: getCurrentLocation().label }),

  refreshInteraction: (picadaId: string, placeName?: string) => {
    const next = getUserInteraction(picadaId, placeName)
    const prev = get().interactions[picadaId]
    if (
      prev &&
      prev.votedPicada === next.votedPicada &&
      prev.picadaVotesCount === next.picadaVotesCount &&
      prev.savedForLater === next.savedForLater
    ) {
      return
    }
    set({
      interactions: {
        ...get().interactions,
        [picadaId]: next,
      },
    })
  },

  votePicada: async (picadaId: string, placeName?: string, meta?: { placeAddress?: string; mapsUrl?: string }) => {
    const next = await votePicada(picadaId, 'toggle', {
      placeName,
      placeAddress: meta?.placeAddress,
      mapsUrl: meta?.mapsUrl,
    })
    const prev = get().interactions[picadaId] || defaultInteraction()
    set({
      interactions: {
        ...get().interactions,
        [picadaId]: {
          ...prev,
          ...next,
          savedForLater: placeName ? getUserInteraction(picadaId, placeName).savedForLater : prev.savedForLater,
        },
      },
    })
  },

  toggleVisitLater: (picadaId: string, placeName: string) => {
    const next = toggleVisitLater(placeName)
    const prev = get().interactions[picadaId] || defaultInteraction()
    set({
      interactions: {
        ...get().interactions,
        [picadaId]: {
          ...prev,
          savedForLater: next.savedForLater,
        },
      },
    })
  },
}))

