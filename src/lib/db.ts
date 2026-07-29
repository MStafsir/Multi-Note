import { PrismaClient } from '@prisma/client'
import { resolve } from 'path'

// ============================================================
// Database Client — resolves SQLite path to absolute for reliability
// SQLite relative paths (file:./db/custom.db) can fail when the
// process CWD changes. We resolve to absolute path at startup.
// ============================================================

/**
 * Resolve DATABASE_URL to an absolute path if it's a SQLite relative path.
 * This ensures the database file is always found regardless of process CWD.
 */
function resolveDatabaseUrl(): string {
  let dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'

  // If it's a SQLite relative path (file:./...), resolve to absolute
  if (dbUrl.startsWith('file:./')) {
    const relativePath = dbUrl.replace('file:', '')
    const absolutePath = resolve(process.cwd(), relativePath)
    dbUrl = `file:${absolutePath}`
  }

  return dbUrl
}

// Set the resolved DATABASE_URL before creating PrismaClient
// This ensures Prisma uses the absolute path
const resolvedUrl = resolveDatabaseUrl()
process.env.DATABASE_URL = resolvedUrl

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
