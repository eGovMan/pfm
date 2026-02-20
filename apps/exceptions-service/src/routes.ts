import type { FastifyInstance } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';
import { prisma } from './db.js';
import { requireRedressal } from './auth.js';
import { auditBaseUrl, rulebookBaseUrl } from './config.js';

async function getLastDecision(caseId: string): Promise<{
  rulebookId: string;
  rulebookVersion: string;
  reasons: Array<{ code: string }>;
} | null> {
  const r = await fetch(`${auditBaseUrl}/v1/audit/cases/${encodeURIComponent(caseId)}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { timeline?: Array<{ type: string; data: unknown }> };
  const timeline = j.timeline ?? [];
  for (let i = timeline.length - 1; i >= 0; i--) {
    const entry = timeline[i];
    if (entry && entry.type === 'decision') {
      const d = entry.data as { rulebookId?: string; rulebookVersion?: string; reasons?: Array<{ code?: string }> };
      return {
        rulebookId: d.rulebookId ?? '',
        rulebookVersion: d.rulebookVersion ?? '',
        reasons: (d.reasons ?? []).map((x) => ({ code: x.code ?? '' })),
      };
    }
  }
  return null;
}

async function getReasonCodes(rulebookId: string, version: string): Promise<Record<string, { overrideAllowed?: boolean }>> {
  const r = await fetch(
    `${rulebookBaseUrl}/v1/rulebooks/${encodeURIComponent(rulebookId)}/reasonCodes?version=${encodeURIComponent(version)}`
  );
  if (!r.ok) return {};
  const j = (await r.json()) as { reasonCodes?: Record<string, { overrideAllowed?: boolean }> };
  return j.reasonCodes ?? {};
}

async function postAuditEvent(caseId: string, source: string, eventType: string, refs: Record<string, unknown>): Promise<void> {
  await fetch(`${auditBaseUrl}/v1/audit/statusEvents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId,
      source,
      eventType,
      eventTime: new Date().toISOString(),
      refs,
    }),
  });
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/exceptions/appeal
  app.post<{
    Body: { caseId: string; reason: string; raisedBy?: string };
  }>('/v1/exceptions/appeal', async (request, reply) => {
    const body = request.body as { caseId?: string; reason?: string; raisedBy?: string };
    if (!body.caseId || !body.reason) {
      return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'caseId and reason required'));
    }
    try {
      const created = await prisma.appeal.create({
        data: {
          caseId: body.caseId,
          raisedBy: body.raisedBy ?? 'unknown',
          reason: body.reason,
          status: 'PENDING',
        },
      });
      return reply.status(201).send({
        appealId: created.id,
        caseId: created.caseId,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create appeal';
      return reply.status(500).send(createErrorEnvelope('APPEAL_FAILED', msg));
    }
  });

  // POST /v1/exceptions/override
  app.post<{
    Body: { caseId: string; reasonCodesOverridden: string[]; justification: string; performedBy?: string };
  }>('/v1/exceptions/override', async (request, reply) => {
    await requireRedressal(request, reply);
    if (reply.sent) return;
    const body = request.body as { caseId?: string; reasonCodesOverridden?: string[]; justification?: string; performedBy?: string };
    if (!body.caseId || !Array.isArray(body.reasonCodesOverridden) || !body.justification?.trim()) {
      return reply.status(400).send(
        createErrorEnvelope('BAD_REQUEST', 'caseId, reasonCodesOverridden array, and justification required')
      );
    }
    try {
      const lastDecision = await getLastDecision(body.caseId);
      if (!lastDecision) {
        return reply.status(400).send(createErrorEnvelope('NO_DECISION', 'No decision found for case'));
      }
      const reasonCodes = await getReasonCodes(lastDecision.rulebookId, lastDecision.rulebookVersion);
      for (const code of body.reasonCodesOverridden) {
        const def = reasonCodes[code];
        if (def && def.overrideAllowed === false) {
          return reply.status(403).send(
            createErrorEnvelope('OVERRIDE_DISALLOWED', `Reason code ${code} does not allow override`)
          );
        }
      }
      const created = await prisma.override.create({
        data: {
          caseId: body.caseId,
          performedBy: body.performedBy ?? 'unknown',
          reasonCodesOverridden: JSON.stringify(body.reasonCodesOverridden),
          justification: body.justification,
        },
      });
      await postAuditEvent(body.caseId, 'exceptions-service', 'override_applied', {
        overrideId: created.id,
        reasonCodesOverridden: body.reasonCodesOverridden,
        performedBy: created.performedBy,
      });
      return reply.status(201).send({
        overrideId: created.id,
        caseId: created.caseId,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Override failed';
      return reply.status(500).send(createErrorEnvelope('OVERRIDE_FAILED', msg));
    }
  });

  // GET /v1/exceptions/cases/:caseId
  app.get<{ Params: { caseId: string } }>('/v1/exceptions/cases/:caseId', async (request, reply) => {
    const { caseId } = request.params;
    const [appeals, overrides] = await Promise.all([
      prisma.appeal.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } }),
      prisma.override.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return reply.status(200).send({
      caseId,
      appeals: appeals.map((a) => ({
        appealId: a.id,
        raisedBy: a.raisedBy,
        reason: a.reason,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
      })),
      overrides: overrides.map((o) => ({
        overrideId: o.id,
        performedBy: o.performedBy,
        reasonCodesOverridden: JSON.parse(o.reasonCodesOverridden) as string[],
        justification: o.justification,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  });
}
