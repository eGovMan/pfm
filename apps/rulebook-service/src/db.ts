import { PrismaClient } from './generated/prisma/index.js';

export const prisma = new PrismaClient();

export async function migrate(): Promise<void> {
  const { execSync } = await import('child_process');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  try {
    execSync('npx prisma db push --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('Rulebook DB migrate failed:', e instanceof Error ? e.message : e);
    throw e;
  }
}
