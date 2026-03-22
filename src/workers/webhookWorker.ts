import { Worker, Job } from 'bullmq'
import crypto from 'crypto'
import { prisma } from '../utils/prisma'
import { bullMQConnection } from '../config/queue'

interface WebhookJobData {
  eventId: string
  endpointId: string
  url: string
  secret: string
  eventType: string
  payload: Record<string, unknown>
}

const signPayload = (payload: string, secret: string): string => {
  return `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`
}

const processWebhook = async (job: Job<WebhookJobData>) => {
  const { eventId, url, secret, eventType, payload } = job.data

  // Increment attempts on the event record
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { attempts: { increment: 1 } },
  })

  // Prepare payload
  const body = JSON.stringify({
    id: eventId,
    eventType,
    payload,
    timestamp: new Date().toISOString(),
  })

  // Sign the payload
  const signature = signPayload(body, secret)

  // Send HTTP POST to endpoint
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': eventType,
    },
    body,
    signal: AbortSignal.timeout(10000), // 10 second timeout
  })

  if (!response.ok) {
    // Non-2xx response — throw so BullMQ retries
    throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`)
  }

  // 200 - Success from api — mark event as delivered
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    },
  })
}

export const startWebhookWorker = () => {
  const worker = new Worker('webhook-delivery', processWebhook, {
    connection: bullMQConnection,
    concurrency: 5, // process up to 5 jobs simultaneously
  })

  worker.on('completed', (job) => {
    console.log(`Webhook delivered: job ${job.id}`)
  })

  worker.on('failed', (job, error) => {
    console.error(`Webhook failed: job ${job?.id}`, error.message)

    // If all retries exhausted, mark event as FAILED
    if (job && job.attemptsMade >= 3) {
      prisma.webhookEvent.update({
        where: { id: job.data.eventId },
        data: { status: 'FAILED' },
      }).catch(console.error)
    }
  })

  console.log('Webhook worker started')
  return worker
}