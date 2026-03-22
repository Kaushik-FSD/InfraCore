import { z } from 'zod'

export const createApiKeySchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    permissions: z.array(
      z.enum(['read', 'write', 'delete'])
    ).min(1, 'At least one permission required'),
    rateLimit: z.number().int().min(1).max(100000).default(1000),
    expiresAt: z.string().datetime().optional(),
  }),
}