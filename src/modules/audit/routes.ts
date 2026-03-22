import { FastifyInstance } from 'fastify'
import { AuditService } from './service'

export const auditRoutes = async (app: FastifyInstance) => {
  const auditService = new AuditService()

  app.get('/:orgId/audit-logs', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }
    const response = await auditService.getLogs(request.authUser.userId, orgId)
    return reply.status(200).send(response)
  })
}