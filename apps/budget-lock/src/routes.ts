import type { FastifyInstance } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';
import { prisma } from './db.js';

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes

function toNum(b: bigint): number {
  return Number(b);
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/admin/budget/heads - seed budget head (e.g. total for demo)
  app.post<{ Body: { budgetHead: string; total: number } }>('/v1/admin/budget/heads', async (request, reply) => {
    const { budgetHead, total } = request.body as { budgetHead?: string; total?: number };
    if (!budgetHead || total == null || total < 0) {
      return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'budgetHead and total (>=0) required'));
    }
    try {
      await prisma.budgetHead.upsert({
        where: { budgetHead },
        create: { budgetHead, total: BigInt(total), committed: BigInt(0), reserved: BigInt(0) },
        update: { total: BigInt(total) },
      });
      return reply.status(201).send({ budgetHead, total });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      return reply.status(500).send(createErrorEnvelope('BUDGET_HEAD_FAILED', msg));
    }
  });

  // POST /v1/budget/reserve
  app.post<{
    Body: { caseId: string; budgetHead: string; amount: number; ttlSeconds?: number };
  }>('/v1/budget/reserve', async (request, reply) => {
    const { caseId, budgetHead, amount, ttlSeconds } = request.body as {
      caseId: string;
      budgetHead: string;
      amount: number;
      ttlSeconds?: number;
    };
    if (!caseId || !budgetHead || amount == null || amount < 0) {
      return reply.status(400).send(
        createErrorEnvelope('BAD_REQUEST', 'caseId, budgetHead, amount (>=0) required')
      );
    }
    const ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const amountBigInt = BigInt(amount);

    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.budgetHead.upsert({
          where: { budgetHead },
          create: { budgetHead, total: BigInt(0), committed: BigInt(0), reserved: BigInt(0) },
          update: {},
        });
        const [headRow] = await tx.$queryRawUnsafe<Array<{ total: bigint; committed: bigint; reserved: bigint }>>(
          'SELECT total, committed, reserved FROM "BudgetHead" WHERE "budgetHead" = $1 FOR UPDATE',
          budgetHead
        );
        if (!headRow) throw new Error('HEAD_NOT_FOUND');
        const head = { budgetHead, ...headRow };
        const existing = await tx.reservation.findFirst({
          where: { caseId, budgetHeadId: budgetHead, status: 'RESERVED' },
          orderBy: { createdAt: 'desc' },
        });
        if (existing && new Date(existing.expiresAt) > new Date()) {
          return { reservation: existing, head };
        }
        const available = head.total - head.committed - head.reserved;
        if (amountBigInt > available) {
          throw new Error('INSUFFICIENT_HEADROOM');
        }
        const expiresAt = new Date(Date.now() + ttl * 1000);
        const reservation = await tx.reservation.create({
          data: {
            caseId,
            budgetHeadId: budgetHead,
            amount: amountBigInt,
            status: 'RESERVED',
            expiresAt,
          },
        });
        await tx.budgetHead.update({
          where: { budgetHead },
          data: { reserved: { increment: amountBigInt } },
        });
        const updatedHead = await tx.budgetHead.findUnique({ where: { budgetHead } });
        return { reservation, head: updatedHead ?? head };
      });

      const r = result.reservation;
      return reply.status(200).send({
        reservationId: r.id,
        caseId: r.caseId,
        budgetHead: r.budgetHeadId,
        amount: toNum(r.amount),
        reservedAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        status: r.status.toLowerCase(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reserve failed';
      if (msg === 'INSUFFICIENT_HEADROOM') {
        return reply.status(400).send(createErrorEnvelope('INSUFFICIENT_HEADROOM', 'Amount exceeds available headroom'));
      }
      return reply.status(500).send(createErrorEnvelope('RESERVE_FAILED', msg));
    }
  });

  // POST /v1/budget/confirm
  app.post<{ Body: { reservationId: string } }>('/v1/budget/confirm', async (request, reply) => {
    const { reservationId } = request.body as { reservationId?: string };
    if (!reservationId) {
      return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'reservationId required'));
    }
    try {
      await prisma.$transaction(async (tx) => {
        const r = await tx.reservation.findUnique({ where: { id: reservationId }, include: { budgetHead: true } });
        if (!r) throw new Error('NOT_FOUND');
        if (r.status !== 'RESERVED') throw new Error('INVALID_STATE');
        if (new Date(r.expiresAt) < new Date()) throw new Error('EXPIRED');
        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: 'CONFIRMED' },
        });
        await tx.budgetHead.update({
          where: { budgetHead: r.budgetHeadId },
          data: {
            reserved: { decrement: r.amount },
            committed: { increment: r.amount },
          },
        });
      });
      const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
      if (!r) return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Reservation not found'));
      return reply.status(200).send({
        reservationId: r.id,
        status: 'confirmed',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Confirm failed';
      if (msg === 'NOT_FOUND') return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Reservation not found'));
      if (msg === 'INVALID_STATE') return reply.status(409).send(createErrorEnvelope('INVALID_STATE', 'Reservation not in RESERVED state'));
      if (msg === 'EXPIRED') return reply.status(409).send(createErrorEnvelope('EXPIRED', 'Reservation has expired'));
      return reply.status(500).send(createErrorEnvelope('CONFIRM_FAILED', msg));
    }
  });

  // POST /v1/budget/release
  app.post<{ Body: { reservationId: string } }>('/v1/budget/release', async (request, reply) => {
    const { reservationId } = request.body as { reservationId?: string };
    if (!reservationId) {
      return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'reservationId required'));
    }
    try {
      await prisma.$transaction(async (tx) => {
        const r = await tx.reservation.findUnique({ where: { id: reservationId } });
        if (!r) throw new Error('NOT_FOUND');
        if (r.status !== 'RESERVED') {
          return;
        }
        const newStatus = new Date(r.expiresAt) < new Date() ? 'EXPIRED' : 'RELEASED';
        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: newStatus },
        });
        await tx.budgetHead.update({
          where: { budgetHead: r.budgetHeadId },
          data: { reserved: { decrement: r.amount } },
        });
      });
      const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
      if (!r) return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Reservation not found'));
      return reply.status(200).send({
        reservationId: r.id,
        status: r.status.toLowerCase(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Release failed';
      if (msg === 'NOT_FOUND') return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Reservation not found'));
      return reply.status(500).send(createErrorEnvelope('RELEASE_FAILED', msg));
    }
  });

  // GET /v1/budget/reservations/:reservationId - for connector to verify RESERVED before submit
  app.get<{ Params: { reservationId: string } }>('/v1/budget/reservations/:reservationId', async (request, reply) => {
    const { reservationId } = request.params;
    const r = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { budgetHead: true },
    });
    if (!r) {
      return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Reservation not found'));
    }
    return reply.status(200).send({
      reservationId: r.id,
      caseId: r.caseId,
      budgetHead: r.budgetHeadId,
      amount: toNum(r.amount),
      status: r.status,
      expiresAt: r.expiresAt.toISOString(),
    });
  });

  // GET /v1/budget/:budgetHead (debug)
  app.get<{ Params: { budgetHead: string } }>('/v1/budget/:budgetHead', async (request, reply) => {
    const { budgetHead } = request.params;
    const head = await prisma.budgetHead.findUnique({
      where: { budgetHead },
      include: { reservations: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!head) {
      return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Budget head not found'));
    }
    return reply.status(200).send({
      budgetHead: head.budgetHead,
      total: toNum(head.total),
      committed: toNum(head.committed),
      reserved: toNum(head.reserved),
      reservations: head.reservations.map((r) => ({
        reservationId: r.id,
        caseId: r.caseId,
        amount: toNum(r.amount),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      })),
    });
  });
}
