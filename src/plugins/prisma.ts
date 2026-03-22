import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { prisma } from '../utils/prisma'

const prismaPlugin: FastifyPluginAsync = async (app) => {
  await prisma.$connect()

  app.decorate('prisma', prisma)

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export default fp(prismaPlugin)