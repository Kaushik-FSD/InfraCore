import { z } from 'zod'

export const createEndpointSchema = {
  body: z.object({
    url: z.string().url('Must be a valid URL'),
    events: z.array(
      z.enum([
        'org.member_added',
        'org.member_removed',
        'org.member_role_updated',
        'api_key.created',
        'api_key.revoked',
      ])
    ).min(1, 'Subscribe to at least one event'),
  }),
}