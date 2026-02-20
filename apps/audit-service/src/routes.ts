import type { FastifyInstance } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';
import { prisma } from './db.js';
import {
  computeRecordHash,
  computeDecisionHash,
  getInitialHash,
} from './chain.js';

async function getPreviousHash(caseId: string): Promise<{ hash: string }> {
  const [lastDecision] = await prisma.decisionRecord.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { recordHash: true, createdAt: true },
  });
  const [lastEvent] = await prisma.statusEvent.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { eventHash: true, createdAt: true },
  });
  if (!lastDecision && !lastEvent) return { hash: getInitialHash() };
  if (!lastEvent) return { hash: lastDecision!.recordHash };
  if (!lastDecision) return { hash: lastEvent!.eventHash };
  return {
    hash: lastDecision.createdAt >= lastEvent.createdAt ? lastDecision.recordHash : lastEvent.eventHash,
  };
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/audit/decisionRecords
  app.post<{
    Body: {
      caseId: string;
      rulebookId: string;
      rulebookVersion: string;
      evaluatedAt: string;
      decision: string;
      reasons: unknown[];
      proofRefs: unknown[];
      proofChecks: unknown[];
      reservationId?: string;
    };
  }>('/v1/audit/decisionRecords', async (request, reply) => {
    const body = request.body as {
      caseId: string;
      rulebookId: string;
      rulebookVersion: string;
      evaluatedAt: string;
      decision: string;
      reasons: unknown[];
      proofRefs: unknown[];
      proofChecks: unknown[];
      reservationId?: string;
    };
    if (!body.caseId || !body.rulebookId || !body.rulebookVersion || body.decision == null) {
      return reply.status(400).send(
        createErrorEnvelope('BAD_REQUEST', 'caseId, rulebookId, rulebookVersion, decision required')
      );
    }
    try {
      const { hash: previousHash } = await getPreviousHash(body.caseId);
      const decisionPayload = {
        decision: body.decision,
        reasons: body.reasons ?? [],
        proofRefs: body.proofRefs ?? [],
        proofChecks: body.proofChecks ?? [],
        evaluatedAt: body.evaluatedAt,
        rulebookId: body.rulebookId,
        rulebookVersion: body.rulebookVersion,
        reservationId: body.reservationId ?? null,
      };
      const decisionHash = computeDecisionHash(decisionPayload);
      const recordPayload = {
        caseId: body.caseId,
        rulebookId: body.rulebookId,
        rulebookVersion: body.rulebookVersion,
        evaluatedAt: body.evaluatedAt,
        decision: body.decision,
        reasons: body.reasons ?? [],
        proofRefs: body.proofRefs ?? [],
        proofChecks: body.proofChecks ?? [],
        reservationId: body.reservationId ?? null,
        decisionHash,
      };
      const recordHash = computeRecordHash(previousHash, body.caseId, recordPayload);
      const created = await prisma.decisionRecord.create({
        data: {
          caseId: body.caseId,
          rulebookId: body.rulebookId,
          rulebookVersion: body.rulebookVersion,
          evaluatedAt: body.evaluatedAt,
          decision: body.decision,
          reasonsJson: JSON.stringify(body.reasons ?? []),
          proofRefsJson: JSON.stringify(body.proofRefs ?? []),
          proofChecksJson: JSON.stringify(body.proofChecks ?? []),
          reservationId: body.reservationId ?? null,
          decisionHash,
          previousHash,
          recordHash,
        },
      });
      return reply.status(201).send({
        id: created.id,
        caseId: created.caseId,
        recordHash: created.recordHash,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to record decision';
      return reply.status(500).send(createErrorEnvelope('AUDIT_FAILED', msg));
    }
  });

  // POST /v1/audit/statusEvents
  app.post<{
    Body: {
      caseId: string;
      source: string;
      eventType: string;
      eventTime: string;
      refs?: Record<string, unknown>;
    };
  }>('/v1/audit/statusEvents', async (request, reply) => {
    const body = request.body as {
      caseId: string;
      source: string;
      eventType: string;
      eventTime: string;
      refs?: Record<string, unknown>;
    };
    if (!body.caseId || !body.source || !body.eventType || !body.eventTime) {
      return reply.status(400).send(
        createErrorEnvelope('BAD_REQUEST', 'caseId, source, eventType, eventTime required')
      );
    }
    try {
      const { hash: previousHash } = await getPreviousHash(body.caseId);
      const eventPayload = {
        caseId: body.caseId,
        source: body.source,
        eventType: body.eventType,
        eventTime: body.eventTime,
        refs: body.refs ?? {},
      };
      const eventHash = computeRecordHash(previousHash, body.caseId, eventPayload);
      const created = await prisma.statusEvent.create({
        data: {
          caseId: body.caseId,
          source: body.source,
          eventType: body.eventType,
          eventTime: body.eventTime,
          refsJson: JSON.stringify(body.refs ?? {}),
          previousHash,
          eventHash,
        },
      });
      return reply.status(201).send({
        id: created.id,
        caseId: created.caseId,
        eventHash: created.eventHash,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to record event';
      return reply.status(500).send(createErrorEnvelope('AUDIT_FAILED', msg));
    }
  });

  // GET /v1/audit/cases/:caseId - full timeline (decisions + events in order)
  app.get<{ Params: { caseId: string } }>('/v1/audit/cases/:caseId', async (request, reply) => {
    const { caseId } = request.params;
    const decisions = await prisma.decisionRecord.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
    const events = await prisma.statusEvent.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
    const timeline: Array<{ type: 'decision'; data: unknown } | { type: 'event'; data: unknown }> = [];
    let i = 0,
      j = 0;
    while (i < decisions.length || j < events.length) {
      const d = decisions[i];
      const e = events[j];
      if (!e || (d && d.createdAt < e.createdAt)) {
        timeline.push({
          type: 'decision',
          data: {
            id: d!.id,
            caseId: d!.caseId,
            rulebookId: d!.rulebookId,
            rulebookVersion: d!.rulebookVersion,
            evaluatedAt: d!.evaluatedAt,
            decision: d!.decision,
            reasons: JSON.parse(d!.reasonsJson),
            proofRefs: JSON.parse(d!.proofRefsJson),
            proofChecks: JSON.parse(d!.proofChecksJson),
            reservationId: d!.reservationId ?? undefined,
            decisionHash: d!.decisionHash,
            previousHash: d!.previousHash,
            recordHash: d!.recordHash,
          },
        });
        i++;
      } else {
        timeline.push({
          type: 'event',
          data: {
            id: e!.id,
            caseId: e!.caseId,
            source: e!.source,
            eventType: e!.eventType,
            eventTime: e!.eventTime,
            refs: JSON.parse(e!.refsJson),
            previousHash: e!.previousHash,
            eventHash: e!.eventHash,
          },
        });
        j++;
      }
    }
    return reply.status(200).send({ caseId, timeline });
  });

  // GET /v1/audit/cases/:caseId/validate - recompute hashes and report integrity
  app.get<{ Params: { caseId: string } }>('/v1/audit/cases/:caseId/validate', async (request, reply) => {
    const { caseId } = request.params;
    const decisions = await prisma.decisionRecord.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
    const events = await prisma.statusEvent.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
    const merged: Array<{ type: 'decision' | 'event'; rec: typeof decisions[0] | typeof events[0] }> = [];
    let i = 0,
      j = 0;
    while (i < decisions.length || j < events.length) {
      const d = decisions[i];
      const e = events[j];
      if (!e || (d && d.createdAt < e.createdAt)) {
        merged.push({ type: 'decision', rec: d! });
        i++;
      } else {
        merged.push({ type: 'event', rec: e! });
        j++;
      }
    }
    let previousHash = getInitialHash();
    let ok = true;
    const results: Array<{ index: number; type: string; valid: boolean }> = [];
    for (let idx = 0; idx < merged.length; idx++) {
      const item = merged[idx]!;
      if (item.type === 'decision') {
        const rec = item.rec as (typeof decisions)[0];
        const reasons = JSON.parse(rec.reasonsJson);
        const proofRefs = JSON.parse(rec.proofRefsJson);
        const proofChecks = JSON.parse(rec.proofChecksJson);
        const decisionPayload = {
          decision: rec.decision,
          reasons,
          proofRefs,
          proofChecks,
          evaluatedAt: rec.evaluatedAt,
          rulebookId: rec.rulebookId,
          rulebookVersion: rec.rulebookVersion,
          reservationId: rec.reservationId ?? null,
        };
        const decisionHash = computeDecisionHash(decisionPayload);
        const recordPayload = {
          caseId: rec.caseId,
          rulebookId: rec.rulebookId,
          rulebookVersion: rec.rulebookVersion,
          evaluatedAt: rec.evaluatedAt,
          decision: rec.decision,
          reasons,
          proofRefs,
          proofChecks,
          reservationId: rec.reservationId ?? null,
          decisionHash,
        };
        const expectedRecordHash = computeRecordHash(previousHash, caseId, recordPayload);
        const valid = expectedRecordHash === rec.recordHash;
        if (!valid) ok = false;
        results.push({ index: idx, type: 'decision', valid });
        previousHash = rec.recordHash;
      } else {
        const rec = item.rec as (typeof events)[0];
        const eventPayload = {
          caseId: rec.caseId,
          source: rec.source,
          eventType: rec.eventType,
          eventTime: rec.eventTime,
          refs: JSON.parse(rec.refsJson),
        };
        const expectedEventHash = computeRecordHash(previousHash, caseId, eventPayload);
        const valid = expectedEventHash === rec.eventHash;
        if (!valid) ok = false;
        results.push({ index: idx, type: 'event', valid });
        previousHash = rec.eventHash;
      }
    }
    return reply.status(200).send({
      caseId,
      integrity: ok ? 'OK' : 'FAIL',
      results,
    });
  });
}
