import { FastifyInstance } from 'fastify';
import { prisma } from './db.js';
import { requireAdmin } from './auth.js';
import { createErrorEnvelope } from '@pfm/shared-http';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/participants/:participantId
  app.get<{ Params: { participantId: string } }>('/v1/participants/:participantId', async (request, reply) => {
    const { participantId } = request.params;
    const participant = await prisma.participant.findUnique({
      where: { participantId },
      include: { endpoints: true, keys: true },
    });
    if (!participant) {
      return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Participant not found'));
    }
    const endpoints: Record<string, string> = {};
    for (const e of participant.endpoints) {
      endpoints[e.service] = e.baseUrl;
    }
    return reply.status(200).send({
      participantId: participant.participantId,
      name: participant.name,
      roles: participant.roles,
      status: participant.status,
      createdAt: participant.createdAt.toISOString(),
      endpoints,
      keys: participant.keys.map((k) => ({ keyId: k.keyId, publicKey: k.publicKey, algorithm: k.alg })),
    });
  });

  // GET /v1/participants?role=&proofType=
  app.get<{ Querystring: { role?: string; proofType?: string } }>('/v1/participants', async (request, reply) => {
    const { role, proofType } = request.query;
    const where: { roles?: { has?: string }; status?: string } = { status: 'ACTIVE' };
    if (role) where.roles = { has: role };
    const participants = await prisma.participant.findMany({
      where,
      include: { endpoints: true, keys: true },
    });
    let list = participants;
    if (proofType) {
      const allowed = await prisma.permission.findMany({
        where: { action: 'issue_proof', proofType, effect: 'ALLOW' },
        select: { participantId: true },
      });
      const ids = new Set(allowed.map((p) => p.participantId));
      list = list.filter((p) => ids.has(p.participantId));
    }
    return reply.status(200).send({
      participants: list.map((p) => ({
        participantId: p.participantId,
        name: p.name,
        roles: p.roles,
        status: p.status,
        endpoints: Object.fromEntries(p.endpoints.map((e) => [e.service, e.baseUrl])),
        keys: p.keys.map((k) => ({ keyId: k.keyId, algorithm: k.alg })),
      })),
    });
  });

  // GET /v1/participants/:participantId/keys
  app.get<{ Params: { participantId: string } }>('/v1/participants/:participantId/keys', async (request, reply) => {
    const keys = await prisma.key.findMany({
      where: { participantId: request.params.participantId, status: 'ACTIVE' },
    });
    return reply.status(200).send({
      keys: keys.map((k) => ({ keyId: k.keyId, publicKey: k.publicKey, algorithm: k.alg })),
    });
  });

  // GET /v1/permissions/:participantId
  app.get<{ Params: { participantId: string } }>('/v1/permissions/:participantId', async (request, reply) => {
    const permissions = await prisma.permission.findMany({
      where: { participantId: request.params.participantId },
    });
    return reply.status(200).send({
      permissions: permissions.map((p) => ({
        participantId: p.participantId,
        action: p.action,
        proofType: p.proofType ?? undefined,
        resource: p.resource ?? undefined,
        effect: p.effect,
      })),
    });
  });

  // GET /v1/permissions/isAllowed?participantId=&action=&proofType=
  app.get<{
    Querystring: { participantId: string; action: string; proofType?: string };
  }>('/v1/permissions/isAllowed', async (request, reply) => {
    const { participantId, action, proofType } = request.query;
    if (!participantId || !action) {
      return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'participantId and action required'));
    }
    const where: { participantId: string; action: string; effect: string; proofType?: string | null } = {
      participantId,
      action,
      effect: 'ALLOW',
    };
    if (proofType) where.proofType = proofType;
    const allow = await prisma.permission.findFirst({ where });
    const denyWhere = { ...where, effect: 'DENY' as const };
    if (proofType) (denyWhere as { proofType?: string | null }).proofType = proofType;
    const deny = await prisma.permission.findFirst({ where: denyWhere });
    const allowed = !!allow && !deny;
    return reply.status(200).send({ allowed });
  });

  // POST /v1/admin/participants/bulk (Keycloak-protected)
  app.post<{ Body: { participants: Array<{ participantId: string; name: string; roles: string[]; endpoints?: Record<string, string>; keys?: Array<{ keyId: string; publicKey: string; alg?: string }> }> } }>(
    '/v1/admin/participants/bulk',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { participants } = request.body;
      if (!Array.isArray(participants)) {
        return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'participants array required'));
      }
      for (const p of participants) {
        await prisma.participant.upsert({
          where: { participantId: p.participantId },
          create: {
            participantId: p.participantId,
            name: p.name,
            roles: p.roles ?? [],
            status: 'ACTIVE',
          },
          update: { name: p.name, roles: p.roles ?? [] },
        });
        if (p.endpoints) {
          for (const [service, baseUrl] of Object.entries(p.endpoints)) {
            await prisma.endpoint.upsert({
              where: {
                participantId_service: { participantId: p.participantId, service },
              },
              create: { participantId: p.participantId, service, baseUrl },
              update: { baseUrl },
            });
          }
        }
        if (p.keys?.length) {
          for (const k of p.keys) {
            await prisma.key.upsert({
              where: {
                participantId_keyId: { participantId: p.participantId, keyId: k.keyId },
              },
              create: {
                participantId: p.participantId,
                keyId: k.keyId,
                publicKey: k.publicKey,
                alg: k.alg ?? 'Ed25519',
                status: 'ACTIVE',
              },
              update: { publicKey: k.publicKey, alg: k.alg ?? 'Ed25519' },
            });
          }
        }
      }
      return reply.status(201).send({ ok: true, count: participants.length });
    }
  );

  // POST /v1/admin/permissions/bulk (Keycloak-protected)
  app.post<{ Body: { permissions: Array<{ participantId: string; action: string; proofType?: string; resource?: string; effect: string }> } }>(
    '/v1/admin/permissions/bulk',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { permissions } = request.body;
      if (!Array.isArray(permissions)) {
        return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'permissions array required'));
      }
      const participantIds = [...new Set(permissions.map((p) => p.participantId))];
      await prisma.permission.deleteMany({ where: { participantId: { in: participantIds } } });
      for (const p of permissions) {
        await prisma.permission.create({
          data: {
            participantId: p.participantId,
            action: p.action,
            proofType: p.proofType ?? null,
            resource: p.resource ?? null,
            effect: p.effect,
          },
        });
      }
      return reply.status(201).send({ ok: true, count: permissions.length });
    }
  );
}
