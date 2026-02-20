import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function migrate(): Promise<void> {
  const { execSync } = await import('child_process');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  try {
    execSync('npx prisma db push --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'ignore',
    });
  } catch {
    // ignore
  }
}
