import Fastify from "fastify";
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import {env} from './config/env'

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

  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? '*' : false, // Adjust for production
  })

  await app.register(helmet)

  await app.register(jwt, {
    secret: env.JWT_SECRET
  })

  app.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  return app;
}