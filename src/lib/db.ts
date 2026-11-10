import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Only enable query logging in development to avoid I/O overhead in production
const isDev = process.env.NODE_ENV !== 'production'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })

if (isDev) globalForPrisma.prisma = db
