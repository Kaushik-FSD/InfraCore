import { Queue } from 'bullmq'
import { env } from './env'

const redisUrl = new URL(env.REDIS_URL)

// Export connection separately so both Queue and Worker can use it
export const bullMQConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
  maxRetriesPerRequest: null,
}

export const webhookQueue = new Queue('webhook-delivery', {
  connection: bullMQConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})