import { z } from 'zod'

export const createOrgSchema = {
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    slug: z.string()
      .min(2)
      .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and hyphens'),
  }),
}

export const inviteMemberSchema = {
  body: z.object({
    email: z.string().email('Invalid email'),
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
  }),
}

export const updateMemberRoleSchema = {
  body: z.object({
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
  }),
}