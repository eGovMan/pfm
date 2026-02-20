import type { FastifyInstance } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';
import { prisma } from './db.js';
import { requireAdmin } from './auth.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/rulebooks/:rulebookId/versions
  app.get<{ Params: { rulebookId: string } }>('/v1/rulebooks/:rulebookId/versions', async (request, reply) => {
    const { rulebookId } = request.params;
    const rows = await prisma.rulebook.findMany({
      where: { rulebookId },
      orderBy: { createdAt: 'desc' },
      select: { version: true, createdAt: true, createdBy: true },
    });
    return reply.status(200).send({
      rulebookId,
      versions: rows.map((r) => ({
        version: r.version,
        createdAt: r.createdAt.toISOString(),
        createdBy: r.createdBy ?? undefined,
      })),
    });
  });

  // GET /v1/rulebooks/:rulebookId?version=
  app.get<{
    Params: { rulebookId: string };
    Querystring: { version?: string };
  }>('/v1/rulebooks/:rulebookId', async (request, reply) => {
    const { rulebookId } = request.params;
    const version = request.query.version;
    const where: { rulebookId: string; version?: string } = { rulebookId };
    if (version) where.version = version;
    const row = version
      ? await prisma.rulebook.findUnique({ where: { rulebookId_version: { rulebookId, version } } })
      : await prisma.rulebook.findFirst({ where: { rulebookId }, orderBy: { createdAt: 'desc' } });
    if (!row) {
      return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Rulebook version not found'));
    }
    const rules = JSON.parse(row.rulesJson) as unknown;
    const reasonCodes = JSON.parse(row.reasonCodesJson) as unknown;
    return reply.status(200).send({
      rulebookId: row.rulebookId,
      version: row.version,
      rulesJson: rules,
      reasonCodesJson: reasonCodes,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy ?? undefined,
    });
  });

  // GET /v1/rulebooks/:rulebookId/reasonCodes?version=
  app.get<{
    Params: { rulebookId: string };
    Querystring: { version?: string };
  }>('/v1/rulebooks/:rulebookId/reasonCodes', async (request, reply) => {
    const { rulebookId } = request.params;
    const version = request.query.version;
    const row = version
      ? await prisma.rulebook.findUnique({
          where: { rulebookId_version: { rulebookId, version } },
          select: { reasonCodesJson: true, version: true },
        })
      : await prisma.rulebook.findFirst({
          where: { rulebookId },
          orderBy: { createdAt: 'desc' },
          select: { reasonCodesJson: true, version: true },
        });
    if (!row) {
      return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Rulebook version not found'));
    }
    const reasonCodes = JSON.parse(row.reasonCodesJson) as unknown;
    return reply.status(200).send({ rulebookId, version: row.version, reasonCodes });
  });

  // POST /v1/admin/rulebooks
  app.post<{
    Body: {
      rulebookId: string;
      version: string;
      rulesJson: unknown;
      reasonCodesJson: unknown;
      createdBy?: string;
    };
  }>('/v1/admin/rulebooks', async (request, reply) => {
    await requireAdmin(request, reply);
    if (reply.sent) return;
    const { rulebookId, version, rulesJson, reasonCodesJson, createdBy } = request.body as {
      rulebookId: string;
      version: string;
      rulesJson: unknown;
      reasonCodesJson: unknown;
      createdBy?: string;
    };
    if (!rulebookId || !version) {
      return reply.status(400).send(createErrorEnvelope('BAD_REQUEST', 'rulebookId and version required'));
    }
    try {
      const created = await prisma.rulebook.upsert({
        where: { rulebookId_version: { rulebookId, version } },
        create: {
          rulebookId,
          version,
          rulesJson: JSON.stringify(rulesJson ?? []),
          reasonCodesJson: JSON.stringify(reasonCodesJson ?? {}),
          createdBy: createdBy ?? null,
        },
        update: {
          rulesJson: JSON.stringify(rulesJson ?? []),
          reasonCodesJson: JSON.stringify(reasonCodesJson ?? {}),
          createdBy: createdBy ?? undefined,
        },
      });
      return reply.status(201).send({
        rulebookId: created.rulebookId,
        version: created.version,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save rulebook';
      return reply.status(500).send(createErrorEnvelope('RULEBOOK_SAVE_FAILED', message));
    }
  });
}
