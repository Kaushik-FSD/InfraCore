import Fastify from "fastify";
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import {env} from './config/env'
import prismaPlugin from "./plugins/prisma"
import { authRoutes } from "./modules/auth/routes";
import redisPlugin from './plugins/redis'
import errorHandlerPlugin from "./plugins/errorHandler";
import authenticatePlugin from './plugins/authenticate'
import { orgRoutes } from "./modules/orgs/routes";
import { apiKeyRoutes } from './modules/api-keys/routes'
import apiKeyAuthPlugin from './plugins/apiKeyAuth'
import rateLimiterPlugin from './plugins/rateLimiter'
import { WebhookService } from "./modules/webhook/service";

export const buildApp = async () => {
    const app = Fastify({
        logger: {
            transport: {
                target: 'pino-pretty',
                options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                },
            },
        },
    })

  await app.register(errorHandlerPlugin)
  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? '*' : false, // Adjust for production
  })

  await app.register(helmet)
  await app.register(prismaPlugin) //DB connection plugin
  await app.register(redisPlugin) // Redis connection plugin
  await app.register(jwt, {
    secret: env.JWT_SECRET
  })


  await app.register(authenticatePlugin)
  await app.register(apiKeyAuthPlugin)
  await app.register(rateLimiterPlugin)
  await app.register(authRoutes, { prefix: '/auth' }) // Register auth routes with /auth prefix
  await app.register(orgRoutes, { prefix: '/orgs' })
  await app.register(apiKeyRoutes, { prefix: '/orgs' })

  // app.get('/health', async (request, reply) => {
  //   return { status: 'ok', timestamp: new Date().toISOString() }
  // })

  // //auth protected route for test
  // app.get('/protected', {preHandler: [app.authenticate]}, async (request, reply) => {
  //   return { userId: request.authUser.userId }
  // })

  // Test rate limit route
  // app.get('/test-rate-limit', {
  //   preHandler: [app.authenticateApiKey, app.checkRateLimit]
  // }, async (request) => {
  //   return { 
  //     message: 'Request successful',
  //     org: request.apiKeyOrg 
  //   }
  // })

  // // Test webhook service manually - WE SKIPPED THIS WEBHOOK TESTING
  // app.post('/test-webhook', {
  //   preHandler: [app.authenticate]
  // }, async (request, reply) => {
  //   const webhookService = new WebhookService()
  //   const { orgId } = request.body as { orgId: string }
    
  //   await webhookService.triggerWebhook(
  //     orgId,
  //     'org.member_added',
  //     { userId: 'test_user', role: 'MEMBER', triggeredAt: new Date().toISOString() }
  //   )
    
  //   return reply.status(200).send({ message: 'Webhook triggered' })
  // })

  return app;
}