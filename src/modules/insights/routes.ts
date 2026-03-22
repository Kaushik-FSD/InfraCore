import { FastifyInstance } from 'fastify'
import { InsightsService } from './service'
import { queryInsightSchema } from './schema'

export const insightRoutes = async (app: FastifyInstance) => {
  const insightsService = new InsightsService()

  // POST /orgs/:orgId/insights/query
  app.post('/:orgId/insights/query', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }

    const result = queryInsightSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }

    const { question } = result.data
    const response = await insightsService.queryInsights(
      request.authUser.userId,
      orgId,
      question
    )
    return reply.status(200).send(response)
  })

  // GET /orgs/:orgId/insights/summary
  app.get('/:orgId/insights/summary', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }
    const response = await insightsService.getSummary(
      request.authUser.userId,
      orgId
    )
    return reply.status(200).send(response)
  })
}