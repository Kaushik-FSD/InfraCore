import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { ApiKeyService } from '../modules/api-keys/service'

const apiKeyAuthPlugin: FastifyPluginAsync = async (app) => {
  const apiKeyService = new ApiKeyService()

  app.decorate(
    'authenticateApiKey',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawKey = request.headers['x-api-key'] as string

      if (!rawKey) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'API key required',
          },
        })
      }

      try {
        const result = await apiKeyService.verifyApiKey(rawKey)
        request.apiKeyOrg = result
      } catch (err: any) {
        return reply.status(err.statusCode || 401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: err.message || 'Invalid API key',
          },
        })
      }
    }
  )
}

export default fp(apiKeyAuthPlugin)