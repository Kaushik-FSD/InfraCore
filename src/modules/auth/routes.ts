import { FastifyInstance } from 'fastify'
import { AuthService } from './service'
import { signupSchema, loginSchema, refreshSchema, logoutSchema } from './schema'
import { request } from 'node:http'

export const authRoutes = async (app : FastifyInstance) => {
    const authService = new AuthService(app)

    // /signup
    app.post('/signup', async (request, reply) => {
        const {email, password} = signupSchema.body.parse(request.body)

        const result = await authService.signup(email, password)
        return reply.status(201).send(result)
    })

    app.post('/login', async (request, reply) => {
        const {email, password} = loginSchema.body.parse(request.body)

        const result = await authService.login(email, password)
        return reply.send(result)
    })

    // POST /auth/refresh
    app.post('/refresh', async (request, reply) => {
        const { refreshToken } = refreshSchema.body.parse(request.body)

        const result = await authService.refresh(refreshToken)
        return reply.status(200).send(result)
    })

    // POST /auth/logout
    app.post('/logout', async (request, reply) => {
        const { refreshToken } = logoutSchema.body.parse(request.body)

        const result = await authService.logout(refreshToken)
        return reply.status(200).send(result)
    })
}