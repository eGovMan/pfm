import { prisma } from './db.js';

const INTERVAL_MS = 60_000; // 60 seconds

export function startExpiryJob(): void {
  setInterval(async () => {
    try {
      const expired = await prisma.reservation.findMany({
        where: { status: 'RESERVED', expiresAt: { lt: new Date() } },
        select: { id: true, budgetHeadId: true, amount: true },
      });
      for (const r of expired) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.reservation.update({
              where: { id: r.id },
              data: { status: 'EXPIRED' },
            });
            await tx.budgetHead.update({
              where: { budgetHead: r.budgetHeadId },
              data: { reserved: { decrement: r.amount } },
            });
          });
        } catch {
          // continue with next
        }
      }
    } catch {
      // ignore
    }
  }, INTERVAL_MS);
}
