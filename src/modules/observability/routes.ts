import { FastifyInstance } from 'fastify'
import os from 'os'

export const observabilityRoutes = async (app: FastifyInstance) => {

  app.get('/metrics', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      cpu: os.loadavg()[0].toFixed(2),
      node: process.version,
    }
  })
}