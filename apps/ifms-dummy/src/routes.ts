import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { createErrorEnvelope } from '@pfm/shared-http';
import { prisma } from './db.js';
import { failRateNum, voucherDelayMs, payDelayMs } from './config.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldFail(forceFail?: boolean): boolean {
  if (forceFail) return true;
  if (failRateNum <= 0) return false;
  return Math.random() < failRateNum;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/ifms/voucher
  app.post<{
    Body: {
      caseId: string;
      amount: number;
      budgetHead: string;
      vendorId: string;
      description?: string;
      forceFail?: boolean;
    };
  }>('/v1/ifms/voucher', async (request, reply) => {
    const body = request.body as {
      caseId?: string;
      amount?: number;
      budgetHead?: string;
      vendorId?: string;
      description?: string;
      forceFail?: boolean;
    };
    if (!body.caseId || body.amount == null || !body.budgetHead || !body.vendorId) {
      return reply.status(400).send(
        createErrorEnvelope('BAD_REQUEST', 'caseId, amount, budgetHead, vendorId required')
      );
    }
    await delay(voucherDelayMs);
    if (shouldFail(body.forceFail)) {
      return reply.status(503).send(createErrorEnvelope('IFMS_UNAVAILABLE', 'Simulated failure'));
    }
    const id = randomUUID();
    const voucherNo = 'VOUCHER-' + id.slice(0, 8).toUpperCase();
    try {
      const v = await prisma.voucher.create({
        data: {
          voucherNo,
          caseId: body.caseId,
          amount: BigInt(body.amount),
          budgetHead: body.budgetHead,
          vendorId: body.vendorId,
          description: body.description ?? null,
          status: 'created',
        },
      });
      return reply.status(201).send({
        voucherNo: v.voucherNo,
        caseId: v.caseId,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      return reply.status(500).send(createErrorEnvelope('VOUCHER_FAILED', msg));
    }
  });

  // POST /v1/ifms/pay
  app.post<{ Body: { voucherNo: string; forceFail?: boolean } }>('/v1/ifms/pay', async (request, reply) => {
    const { voucherNo, forceFail } = request.body as { voucherNo?: string; forceFail?: boolean };
    if (!voucherNo) {
      return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'voucherNo required'));
    }
    await delay(payDelayMs);
    if (shouldFail(forceFail)) {
      return reply.status(503).send(createErrorEnvelope('IFMS_UNAVAILABLE', 'Simulated payment failure'));
    }
    const v = await prisma.voucher.findUnique({ where: { voucherNo } });
    if (!v) {
      return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Voucher not found'));
    }
    if (v.status === 'paid') {
      return reply.status(409).send(createErrorEnvelope('ALREADY_PAID', 'Voucher already paid'));
    }
    const paidAt = new Date();
    await prisma.voucher.update({
      where: { voucherNo },
      data: { status: 'paid', paidAt },
    });
    return reply.status(200).send({
      voucherNo,
      caseId: v.caseId,
      status: 'paid',
      paidAt: paidAt.toISOString(),
    });
  });

  // GET /v1/ifms/status/:caseId
  app.get<{ Params: { caseId: string } }>('/v1/ifms/status/:caseId', async (request, reply) => {
    const { caseId } = request.params;
    const vouchers = await prisma.voucher.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });
    const latest = vouchers[0];
    if (!latest) {
      return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'No voucher for case'));
    }
    return reply.status(200).send({
      caseId,
      status: latest.status,
      voucherNo: latest.voucherNo,
      paidAt: latest.paidAt?.toISOString() ?? undefined,
    });
  });
}
