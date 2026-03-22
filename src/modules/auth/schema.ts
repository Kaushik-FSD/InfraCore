import { z } from 'zod'

export const signupSchema = {
  body: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  response: z.object({
    message: z.string(),
    user: z.object({
      id: z.string(),
      email: z.string(),
    }),
  }),
}

export const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
  response: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
  }),
}

export const refreshSchema = {
  body: z.object({
    refreshToken: z.string(),
  }),
  response: z.object({
    accessToken: z.string(),
  }),
}

export const logoutSchema = {
  body: z.object({
    refreshToken: z.string(),
  }),
  response: z.object({
    message: z.string(),
  }),
}