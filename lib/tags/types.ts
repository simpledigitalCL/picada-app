/**
 * Contrato público entre motor de seed automático, API y cliente.
 * La comunidad refina después; estos son solo clasificación inicial encontrable.
 */

export const PLACE_AUTOMATED_SEED_VERSION = 1

export type AutomatedTagSeed = {
  slug: string
  /** 0..1 — ponderación nombre/Google types/editorial (=3) vs reseñas (=1) */
  confidence_score: number
  /** false = comunidad/manual (prioridad sobre el bot semilla) */
  is_automated: boolean
  provenance: 'name_types' | 'reviews' | 'both'
}

export type CommunityTaggingState = {
  /** Slugs añadidos por usuarios — nunca se eliminan en un re-run solo-bot */
  manual_slugs: string[]
  confirmed_automated: string[]
  rejected_automated: string[]
  /**
   * Señal agregada (no binaria) para deprecación/robustez:
   * - upvotes: evidencia a favor
   * - downvotes: evidencia en contra
   * - last_feedback_at: último evento observado para decay temporal
   */
  tag_signals?: Record<string, { upvotes: number; downvotes: number; last_feedback_at: string }>
}

export type PlaceTaggingMeta = {
  seed_version: number
  automated_seed?: {
    generated_at: string
    weights_applied: { name_types_editorial: number; reviews: number }
    tags: AutomatedTagSeed[]
  }
  community?: CommunityTaggingState
}
