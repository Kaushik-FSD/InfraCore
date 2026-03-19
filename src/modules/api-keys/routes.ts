import { FastifyInstance } from 'fastify'
import { ApiKeyService } from './service'
import { createApiKeySchema } from './schema'

export const apiKeyRoutes = async (app: FastifyInstance) => {
  const apiKeyService = new ApiKeyService()

  // POST /orgs/:orgId/api-keys — create api key
  app.post('/:orgId/api-keys', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }

    const result = createApiKeySchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }

    const { name, permissions, rateLimit, expiresAt } = result.data
    const response = await apiKeyService.createApiKey(
      request.authUser.userId,
      orgId,
      name,
      permissions,
      rateLimit,
      expiresAt
    )
    return reply.status(201).send(response)
  })

  // GET /orgs/:orgId/api-keys — list api keys
  app.get('/:orgId/api-keys', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }
    const response = await apiKeyService.listApiKeys(request.authUser.userId, orgId)
    return reply.status(200).send(response)
  })

  // DELETE /orgs/:orgId/api-keys/:keyId — revoke api key
  app.delete('/:orgId/api-keys/:keyId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId, keyId } = request.params as { orgId: string, keyId: string }
    const response = await apiKeyService.revokeApiKey(
      request.authUser.userId,
      orgId,
      keyId
    )
    return reply.status(200).send(response)
  })
}