import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '../config/env'

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
})

export const prisma = new PrismaClient({ adapter })

/*
 used by your running Node.js app
 needs the full adapter to query the DB at runtime
*/