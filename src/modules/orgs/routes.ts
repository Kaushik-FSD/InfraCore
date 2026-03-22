import { FastifyInstance } from 'fastify'
import { OrgService } from './service'
import { createOrgSchema, inviteMemberSchema, updateMemberRoleSchema } from './schema'
import { Role } from '@prisma/client'

export const orgRoutes = async (app: FastifyInstance) => {
  const orgService = new OrgService()

  // POST /orgs — create org
  app.post('/', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const result = createOrgSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }

    const { name, slug } = result.data
    // request has authUser obj because we are adding it in the authenticate file
    const response = await orgService.createOrg(request.authUser.userId, name, slug)
    return reply.status(201).send(response)
  })

  // GET /orgs/:orgId — get org details
  app.get('/:orgId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }
    const response = await orgService.getOrg(request.authUser.userId, orgId)
    return reply.status(200).send(response)
  })

  // POST /orgs/:orgId/members — invite member
  app.post('/:orgId/members', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId } = request.params as { orgId: string }

    const result = inviteMemberSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }

    const { email, role } = result.data
    const response = await orgService.inviteMember(
      request.authUser.userId,
      orgId,
      email,
      role as Role
    )
    return reply.status(201).send(response)
  })

  // PATCH /orgs/:orgId/members/:memberId — update member role
  app.patch('/:orgId/members/:memberId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId, memberId } = request.params as { orgId: string, memberId: string }

    const result = updateMemberRoleSchema.body.safeParse(request.body)
    if (!result.success) {
      throw Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        validation: result.error.issues,
      })
    }

    const { role } = result.data
    const response = await orgService.updateMemberRole(
      request.authUser.userId,
      orgId,
      memberId,
      role as Role
    )
    return reply.status(200).send(response)
  })

  // DELETE /orgs/:orgId/members/:memberId — remove member
  app.delete('/:orgId/members/:memberId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { orgId, memberId } = request.params as { orgId: string, memberId: string }

    const response = await orgService.removeMember(
      request.authUser.userId,
      orgId,
      memberId
    )
    return reply.status(200).send(response)
  })
}