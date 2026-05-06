'use client'

import type { PlaceSuggestion } from '@/components/search/place-selector'
import { LocationSelector } from '@/components/post-form/LocationSelector'

type Props = {
  locationQuery: string
  restaurantQuery: string
  selectedPlace: PlaceSuggestion | null
  placeStepError: boolean
  onRestaurantQueryChange: (value: string) => void
  onSelectPlace: (place: PlaceSuggestion) => void
}

export function LocationStep(props: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Selecciona el local</h3>
      <LocationSelector {...props} />
    </div>
  )
}
