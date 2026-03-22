import { prisma } from '../../utils/prisma'

export class AuditService {

  async log(data: {
    action: string
    userId?: string
    orgId: string
    ipAddress?: string
    metadata?: Record<string, unknown>
  }) {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId,
        orgId: data.orgId,
        ipAddress: data.ipAddress,
        metadata: data.metadata as object,
      },
    })
  }

  async getLogs(userId: string, orgId: string) {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    })

    if (!membership) {
      throw { statusCode: 403, message: 'You are not a member of this org' }
    }

    const logs = await prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        user: {
          select: { id: true, email: true }
        }
      }
    })

    return { logs }
  }
}