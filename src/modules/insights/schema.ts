import { z } from 'zod'

export const queryInsightSchema = {
  body: z.object({
    question: z.string()
      .min(10, 'Question must be at least 10 characters')
      .max(500, 'Question must be under 500 characters'),
  }),
}