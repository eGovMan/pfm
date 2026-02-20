import type { FastifyInstance } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';
import { ifmsBaseUrl, budgetBaseUrl, auditBaseUrl } from './config.js';

export interface PaymentPassport {
  caseId: string;
  amount: number;
  budgetHead: string;
  vendorId: string;
  workId: string;
  milestoneId: string;
  rulebookId: string;
  rulebookVersion: string;
  proofRefs: Array<{ proofType: string; proofId: string }>;
  reservationId: string;
  decision: string;
  decisionHash: string;
  issuedAt: string;
}

function required(...fields: (string | number | undefined | null)[]): boolean {
  return fields.every((f) => f != null && f !== '');
}

async function getLatestDecisionHash(caseId: string): Promise<string | null> {
  const res = await fetch(`${auditBaseUrl}/v1/audit/cases/${encodeURIComponent(caseId)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { timeline?: Array<{ type: string; data: { decisionHash?: string } }> };
  const timeline = data.timeline ?? [];
  for (let i = timeline.length - 1; i >= 0; i--) {
    const item = timeline[i];
    if (item.type === 'decision' && item.data?.decisionHash) {
      return item.data.decisionHash as string;
    }
  }
  return null;
}

async function postAuditEvent(
  caseId: string,
  eventType: string,
  refs: Record<string, unknown>
): Promise<void> {
  await fetch(`${auditBaseUrl}/v1/audit/statusEvents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId,
      source: 'ifms-connector',
      eventType,
      eventTime: new Date().toISOString(),
      refs,
    }),
  });
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: PaymentPassport }>('/v1/connector/submitPayment', async (request, reply) => {
    const passport = request.body as unknown as PaymentPassport;

    if (
      !required(
        passport.caseId,
        passport.amount,
        passport.budgetHead,
        passport.vendorId,
        passport.workId,
        passport.milestoneId,
        passport.rulebookId,
        passport.rulebookVersion,
        passport.reservationId,
        passport.decision,
        passport.decisionHash,
        passport.issuedAt
      )
    ) {
      return reply.status(400).send(
        createErrorEnvelope('BAD_REQUEST', 'caseId, amount, budgetHead, vendorId, workId, milestoneId, rulebookId, rulebookVersion, reservationId, decision, decisionHash, issuedAt required')
      );
    }

    if (passport.decision !== 'APPROVE') {
      return reply.status(400).send(
        createErrorEnvelope('INVALID_DECISION', 'decision must be APPROVE')
      );
    }

    const resReservation = await fetch(
      `${budgetBaseUrl}/v1/budget/reservations/${encodeURIComponent(passport.reservationId)}`
    );
    if (!resReservation.ok) {
      if (resReservation.status === 404) {
        return reply.status(400).send(createErrorEnvelope('RESERVATION_NOT_FOUND', 'Reservation not found'));
      }
      return reply.status(502).send(createErrorEnvelope('BUDGET_UNAVAILABLE', 'Could not verify reservation'));
    }
    const reservation = (await resReservation.json()) as { status: string };
    if (reservation.status !== 'RESERVED') {
      return reply.status(400).send(
        createErrorEnvelope('RESERVATION_NOT_RESERVED', `Reservation status is ${reservation.status}`)
      );
    }

    const latestDecisionHash = await getLatestDecisionHash(passport.caseId);
    if (latestDecisionHash === null) {
      return reply.status(400).send(createErrorEnvelope('NO_DECISION', 'No decision record found for case'));
    }
    if (latestDecisionHash !== passport.decisionHash) {
      return reply.status(400).send(createErrorEnvelope('DECISION_HASH_MISMATCH', 'decisionHash does not match audit'));
    }

    let voucherNo: string | undefined;
    try {
      const voucherRes = await fetch(`${ifmsBaseUrl}/v1/ifms/voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: passport.caseId,
          amount: passport.amount,
          budgetHead: passport.budgetHead,
          vendorId: passport.vendorId,
          description: `Work ${passport.workId} / ${passport.milestoneId}`,
        }),
      });
      if (!voucherRes.ok) {
        const err = (await voucherRes.json()) as { error?: { code?: string; message?: string } };
        throw new Error(err?.error?.message ?? `IFMS voucher ${voucherRes.status}`);
      }
      const voucherData = (await voucherRes.json()) as { voucherNo: string };
      voucherNo = voucherData.voucherNo;

      const payRes = await fetch(`${ifmsBaseUrl}/v1/ifms/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherNo }),
      });
      if (!payRes.ok) {
        const err = (await payRes.json()) as { error?: { code?: string; message?: string } };
        throw new Error(err?.error?.message ?? `IFMS pay ${payRes.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'IFMS failed';
      await fetch(`${budgetBaseUrl}/v1/budget/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: passport.reservationId }),
      }).catch(() => {});
      await postAuditEvent(passport.caseId, 'payment_failed', {
        reason: msg,
        voucherNo: voucherNo ?? undefined,
      }).catch(() => {});
      return reply.status(502).send(createErrorEnvelope('IFMS_FAILED', msg));
    }

    const confirmRes = await fetch(`${budgetBaseUrl}/v1/budget/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId: passport.reservationId }),
    });
    if (!confirmRes.ok) {
      await postAuditEvent(passport.caseId, 'payment_failed', {
        reason: 'Budget confirm failed after IFMS pay',
        voucherNo: voucherNo ?? undefined,
      }).catch(() => {});
      return reply.status(502).send(createErrorEnvelope('CONFIRM_FAILED', 'Budget confirm failed'));
    }

    await postAuditEvent(passport.caseId, 'voucher_created', { voucherNo: voucherNo! }).catch(() => {});
    await postAuditEvent(passport.caseId, 'payment_completed', { voucherNo: voucherNo! }).catch(() => {});

    return reply.status(200).send({
      caseId: passport.caseId,
      voucherNo,
      status: 'paid',
    });
  });
}
