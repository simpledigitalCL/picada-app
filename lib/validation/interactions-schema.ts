import { z } from 'zod'

export const INTERACTION_TYPES = [
  'impression',
  'card_click',
  'detail_view',
  'save',
  'unsave',
  'like',
  'review',
  'visit',
  'share',
  'maps_click',
  'search_click',
  'scan',
] as const

export type InteractionType = (typeof INTERACTION_TYPES)[number]

export const interactionItemSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  // UUID interno, external_id de Google (ChIJ…) o id con prefijo `ext-` del map-view
  placeRef: z.string().trim().min(1).max(200).optional(),
  // { tab, position, query, sessionId, lat, lng, source, ... }
  context: z.record(z.unknown()).optional(),
})

export const interactionsBatchSchema = z.object({
  anonId: z
    .string()
    .trim()
    .regex(/^user-[a-z0-9-]{2,40}$/i)
    .optional(),
  items: z.array(interactionItemSchema).min(1).max(25),
})

export type InteractionsBatchInput = z.infer<typeof interactionsBatchSchema>
