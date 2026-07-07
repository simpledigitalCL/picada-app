import { z } from 'zod'

export const postMediaItemSchema = z.object({
  url: z.string().trim().url().max(2000),
  kind: z.enum(['photo', 'video']),
})

// Set completo de media deseada tras la edición (reemplaza el actual).
// Regla del producto: hasta 3 fotos O 1 video (sin mezclar).
export const postMediaListSchema = z
  .array(postMediaItemSchema)
  .max(3)
  .refine(list => {
    const videos = list.filter(m => m.kind === 'video')
    if (videos.length === 0) return list.length <= 3
    return list.length === 1 // 1 video, sin fotos
  }, { message: 'media_rule_violation' })

export const postEditSchema = z
  .object({
    content: z.string().max(4000).nullable().optional(),
    // Rating Letterboxd-style: 0..5 en pasos de 0.5.
    rating: z
      .number()
      .min(0)
      .max(5)
      .refine(r => (r * 2) % 1 === 0, { message: 'rating_not_half_step' })
      .nullable()
      .optional(),
    moods: z.array(z.string().trim().max(60)).max(20).optional(),
    mediaList: postMediaListSchema.optional(),
  })
  // Al menos un campo debe venir para que el PATCH tenga sentido.
  .refine(
    body =>
      body.content !== undefined ||
      body.rating !== undefined ||
      body.moods !== undefined ||
      body.mediaList !== undefined,
    { message: 'empty_patch' },
  )

export type PostEditInput = z.infer<typeof postEditSchema>
