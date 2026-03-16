import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    redis: Redis
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }

  interface FastifyRequest {
    authUser : {
      userId: string
      email: string
    }
  }
}

/*

When you do app.decorate('prisma', prisma) in the plugin, you're adding prisma onto the Fastify instance at runtime. JavaScript is fine with that — you can add properties to objects freely.
But TypeScript doesn't know about it. As far as TypeScript is concerned, FastifyInstance only has the properties Fastify defined — and prisma is not one of them.
So when you try to use it anywhere in your code:

app.prisma.user.findMany() // ❌ TypeScript error
// Property 'prisma' does not exist on type 'FastifyInstance'

What the file does:
declare module 'fastify' — we're opening up Fastify's existing type definitions and adding to them. We're not replacing anything, just extending.
interface FastifyInstance — this is the type that represents your app object everywhere in Fastify.
prisma: PrismaClient — we're telling TypeScript "FastifyInstance now has a prisma property of type PrismaClient."
After this, TypeScript knows about it:

app.prisma.user.findMany() // ✅ TypeScript is happy
*/