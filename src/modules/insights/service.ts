import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '../../utils/prisma'
import { env } from '../../config/env'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)

export class InsightsService {

  async queryInsights(userId: string, orgId: string, question: string) {
    // Check user is a member of this org
    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    })

    if (!membership) {
      throw { statusCode: 403, message: 'You are not a member of this org' }
    }

    // Fetch org data to give Gemini context
    const [org, apiKeys, recentAuditLogs, webhookStats] = await Promise.all([

      // Org basic info
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, slug: true, createdAt: true }
      }),

      // API keys with usage
      prisma.apiKey.findMany({
        where: { orgId },
        select: {
          name: true,
          permissions: true,
          usageCount: true,
          rateLimit: true,
          lastUsedAt: true,
          createdAt: true,
          revokedAt: true,
        }
      }),

      // Recent audit logs
      prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          action: true,
          metadata: true,
          createdAt: true,
          user: { select: { email: true } }
        }
      }),

      // Webhook delivery stats
      prisma.webhookEvent.groupBy({
        by: ['status'],
        where: { orgId },
        _count: { status: true }
      }),
    ])

    // Build context for Gemini
    const context = `
    You are an AI assistant analyzing API usage data for a SaaS platform called InfraCore.
    You are analyzing data for organization: "${org?.name}" (${org?.slug}).
    Organization created: ${org?.createdAt}

    API KEYS:
    ${apiKeys.map(k => `
    - Name: ${k.name}
    Permissions: ${k.permissions.join(', ')}
    Total usage: ${k.usageCount} requests
    Rate limit: ${k.rateLimit} requests/day
    Last used: ${k.lastUsedAt || 'never'}
    Created: ${k.createdAt}
    Status: ${k.revokedAt ? 'revoked' : 'active'}
    `).join('')}

    RECENT ACTIVITY (last 50 actions):
    ${recentAuditLogs.map(l => `
    - Action: ${l.action}
    By: ${l.user?.email || 'system'}
    When: ${l.createdAt}
    Details: ${JSON.stringify(l.metadata)}
    `).join('')}

    WEBHOOK DELIVERY STATS:
    ${webhookStats.map(s => `- ${s.status}: ${s._count.status} events`).join('\n')}

    Based on this data, answer the following question clearly and concisely.
    If the data doesn't contain enough information to answer, say so honestly.
    Keep your answer under 200 words.
    `

    // Send to Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent(`${context}\n\nQuestion: ${question}`)
    const answer = result.response.text()

    return {
      question,
      answer,
      dataSnapshot: {
        totalApiKeys: apiKeys.length,
        activeApiKeys: apiKeys.filter(k => !k.revokedAt).length,
        totalAuditEvents: recentAuditLogs.length,
        webhookStats,
      }
    }
  }

  async getSummary(userId: string, orgId: string) {
    // Reuse queryInsights with a default summary question
    return this.queryInsights(
      userId,
      orgId,
      'Give me a brief summary of this organization\'s API usage, recent activity, and anything noteworthy or unusual.'
    )
  }
}