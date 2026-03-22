import crypto from 'crypto'
import { prisma } from '../../utils/prisma'
import { webhookQueue } from '../../config/queue'
import { Role } from '@prisma/client'

export class WebhookService {

  // ─── REGISTER ENDPOINT ───────────────────────────────────

  async registerEndpoint(
    userId: string,
    orgId: string,
    url: string,
    events: string[]
  ) {
    // Only admins can register webhook endpoints
    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    })

    if (!membership || membership.role !== Role.ADMIN) {
      throw { statusCode: 403, message: 'Only admins can register webhook endpoints' }
    }

    // Generate a signing secret for this endpoint
    // Acme uses this secret to verify payloads came from InfraCore
    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`

    const endpoint = await prisma.webhookEndpoint.create({
      data: { url, events, secret, orgId },
    })

    return {
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        secret,           // shown once — Acme must store this
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt,
      },
      message: 'Store the secret safely — it will not be shown again',
    }
  }

  // ─── LIST ENDPOINTS ───────────────────────────────────────

  async listEndpoints(userId: string, orgId: string) {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    })

    if (!membership) {
      throw { statusCode: 403, message: 'You are not a member of this org' }
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { orgId },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        // secret is NEVER returned after creation
      },
    })

    return { endpoints }
  }

  // ─── DELETE ENDPOINT ──────────────────────────────────────

  async deleteEndpoint(userId: string, orgId: string, endpointId: string) {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    })

    if (!membership || membership.role !== Role.ADMIN) {
      throw { statusCode: 403, message: 'Only admins can delete webhook endpoints' }
    }

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, orgId },
    })

    if (!endpoint) {
      throw { statusCode: 404, message: 'Webhook endpoint not found' }
    }

    await prisma.webhookEndpoint.delete({
      where: { id: endpointId },
    })

    return { message: 'Webhook endpoint deleted successfully' }
  }

  // ─── TRIGGER EVENT ────────────────────────────────────────

  async triggerWebhook(
    orgId: string,
    eventType: string,
    payload: Record<string, string | number | boolean | null | object>
  ) {
    // Find all active endpoints subscribed to this event type
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        orgId,
        isActive: true,
        events: { has: eventType },
      },
    })

    if (endpoints.length === 0) return

    // For each endpoint, create a WebhookEvent record and push a job
    for (const endpoint of endpoints) {
      const event = await prisma.webhookEvent.create({
        data: {
          eventType,
          payload: payload as object,
          orgId,
          endpointId: endpoint.id,
          status: 'PENDING',
        },
      })

      // Push delivery job to BullMQ
      await webhookQueue.add('deliver-webhook', {
        eventId: event.id,
        endpointId: endpoint.id,
        url: endpoint.url,
        secret: endpoint.secret,
        eventType,
        payload,
      })
    }
  }

  // ─── LIST EVENTS ──────────────────────────────────────────

  async listEvents(userId: string, orgId: string) {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    })

    if (!membership) {
      throw { statusCode: 403, message: 'You are not a member of this org' }
    }

    const events = await prisma.webhookEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        eventType: true,
        payload: true,
        status: true,
        attempts: true,
        deliveredAt: true,
        createdAt: true,
        endpoint: {
          select: { url: true }
        },
      },
    })

    return { events }
  }
}