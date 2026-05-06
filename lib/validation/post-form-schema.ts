import { z } from 'zod'

export const postDetailsSchema = z.object({
  content: z.string().max(4000).optional(),
  comment: z.string().max(4000).optional(),
  description: z.string().max(4000).optional(),
})

export function validatePostDetailsInput(input: unknown) {
  return postDetailsSchema.safeParse(input)
}
