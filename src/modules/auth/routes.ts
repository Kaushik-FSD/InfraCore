import { FastifyInstance } from 'fastify'
import { AuthService } from './service'
import { signupSchema, loginSchema, refreshSchema, logoutSchema } from './schema'

// src/modules/auth/routes.ts
export const authRoutes = async (app: FastifyInstance) => {
  const authService = new AuthService(app)

  app.post('/signup', async (request, reply) => {
    const result = signupSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }
    const { email, password } = result.data
    const response = await authService.signup(email, password)
    return reply.status(201).send(response)
  })

  app.post('/login', async (request, reply) => {
    const result = loginSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }
    const { email, password } = result.data
    const response = await authService.login(email, password)
    return reply.status(200).send(response)
  })

  app.post('/refresh', async (request, reply) => {
    const result = refreshSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }
    const { refreshToken } = result.data
    const response = await authService.refresh(refreshToken)
    return reply.status(200).send(response)
  })

  app.post('/logout', async (request, reply) => {
    const result = logoutSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }
    const { refreshToken } = result.data
    const response = await authService.logout(refreshToken)
    return reply.status(200).send(response)
  })
}