import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

const authenticatePlugin: FastifyPluginAsync = async (app) => {
  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = await request.jwtVerify<{
          userId: string
          email: string
        }>(); // we are saying the structure of payload from jwt using generics

        //After verifying the token, we attach the payload to request.authUser
        request.authUser = {
          userId: payload.userId,
          email: payload.email,
        }
      } catch {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token',
          },
        })
      }
    }
  )
}

export default fp(authenticatePlugin)