import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import Redis from 'ioredis'
import { env } from '../config/env'

const redisPlugin: FastifyPluginAsync = async (app) => {
    const redis = new Redis(env.REDIS_URL)

    redis.on('connect', () => {
        app.log.info('Connected to Redis')
    })

    redis.on('error', (err) => {
        app.log.error({err}, ': Redis error')
    })

    app.decorate('redis', redis)

    app.addHook('onClose', async () => {
        await redis.quit()
    })
}

export default fp(redisPlugin);