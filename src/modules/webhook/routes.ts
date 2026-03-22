import { FastifyInstance } from 'fastify'
import { WebhookService } from './service'
import { createEndpointSchema } from './schema'

export const webhookRoutes = async (app: FastifyInstance) => {
  const webhookService = new WebhookService()

  // POST /orgs/:orgId/webhooks/endpoints — register endpoint
  app.post('/:orgId/webhooks/endpoints', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }

    const result = createEndpointSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }

    const { url, events } = result.data
    const response = await webhookService.registerEndpoint(
      request.authUser.userId,
      orgId,
      url,
      events
    )
    return reply.status(201).send(response)
  })

  // GET /orgs/:orgId/webhooks/endpoints — list endpoints
  app.get('/:orgId/webhooks/endpoints', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }
    const response = await webhookService.listEndpoints(
      request.authUser.userId,
      orgId
    )
    return reply.status(200).send(response)
  })

  // DELETE /orgs/:orgId/webhooks/endpoints/:endpointId — delete endpoint
  app.delete('/:orgId/webhooks/endpoints/:endpointId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId, endpointId } = request.params as {
      orgId: string
      endpointId: string
    }
    const response = await webhookService.deleteEndpoint(
      request.authUser.userId,
      orgId,
      endpointId
    )
    return reply.status(200).send(response)
  })

  // GET /orgs/:orgId/webhooks/events — list events
  app.get('/:orgId/webhooks/events', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }
    const response = await webhookService.listEvents(
      request.authUser.userId,
      orgId
    )
    return reply.status(200).send(response)
  })
}