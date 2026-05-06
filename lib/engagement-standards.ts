export const XP_RULES = {
  tagVote: 1,
  ratingOnly: 5,
  reviewShort: 8,
  quickReview: 5,
  review: 10,
  reviewDetailed: 15,
  reviewWithPhoto: 20,
  picadaVote: 3,
  picadaVoteFirst: 10,
  picadaMilestone10: 25,
  photoOnly: 10,
  photoPlusReview: 15,
  newPicada: 15,
} as const

export type ContributionKind = keyof typeof XP_RULES

export function getXpLabel(kind: ContributionKind): string {
  const value = XP_RULES[kind]
  return `+${value} XP`
}

export const STANDARD_NOTES = {
  review: 'Reseña visible en pestaña Reseñas',
  photo: 'Foto visible en pestaña Fotos',
  cross: 'Si agregas texto + foto, aparece en Fotos y Reseñas',
} as const

