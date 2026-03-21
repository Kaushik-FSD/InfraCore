import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

const rateLimiterPlugin: FastifyPluginAsync = async (app) => {
  app.decorate(
    'checkRateLimit',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Only runs if request has apiKeyOrg attached
      if (!request.apiKeyOrg) return

      const { keyId, rateLimit } = request.apiKeyOrg
      const today = new Date().toISOString().split('T')[0] // 2026-03-15
      const redisKey = `ratelimit:${keyId}:${today}`

      // Get current count
      const current = await app.redis.get(redisKey)
      const count = current ? parseInt(current) : 0

      if (count >= rateLimit) {
        return reply.status(429).send({
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: `Rate limit exceeded. Limit is ${rateLimit} requests per day.`,
            details: {
              limit: rateLimit,
              used: count,
              resetsAt: `${today}T23:59:59Z`,
            },
          },
        })
      }

      // Increment counter
      const pipeline = app.redis.pipeline()
      /*
      What is pipeline?

      Normally when you run two Redis commands, they make two separate network calls
      Two round trips. Each round trip has network latency. Small but it adds up across thousands of requests.

      Pipeline batches multiple commands into one network call, Same result, half the network round trips.
      We need both commands to always run together:

      INCR — increment the counter
      EXPIRE — set/refresh the 24hr TTL

      If we did them separately and the server crashed between the two commands, the counter would exist in Redis forever with no expiry — rate limit would never reset. Sending them together reduces that risk window significantly.
      */
      pipeline.incr(redisKey)
      pipeline.expire(redisKey, 60 * 60 * 24) // 24 hours TTL
      await pipeline.exec()
    }
  )
}

export default fp(rateLimiterPlugin)