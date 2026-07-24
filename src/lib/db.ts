import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In development, always create a fresh PrismaClient to ensure
// schema changes (like workspace models) are picked up after prisma generate.
// In production, use the singleton pattern to avoid connection pool exhaustion.
if (process.env.NODE_ENV === 'production') {
  globalForPrisma.prisma ??= new PrismaClient({ log: ['query'] })
} else {
  // Development: create fresh client each time module is re-evaluated
  // Disconnect previous instance to prevent leaked connections
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {})
  }
  globalForPrisma.prisma = new PrismaClient({ log: ['query'] })
}

export const db = globalForPrisma.prisma
