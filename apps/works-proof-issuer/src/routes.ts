import type { FastifyInstance } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';
import { issueWorkCompletionProof, getStatus, setStatus, getProof, type WorkCompletionClaim } from './proofs.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: WorkCompletionClaim;
  }>('/v1/proofs/issue', async (request, reply) => {
    try {
      const body = request.body as WorkCompletionClaim;
      if (!body.workId || !body.milestoneId || !body.completionDate) {
        return reply.status(400).send(
          createErrorEnvelope('BAD_REQUEST', 'workId, milestoneId, completionDate required')
        );
      }
      const proof = issueWorkCompletionProof(body);
      return reply.status(201).send(proof);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Issue failed';
      return reply.status(500).send(createErrorEnvelope('ISSUE_FAILED', message));
    }
  });

  app.get<{ Params: { proofId: string } }>('/v1/proofs/:proofId/status', async (request, reply) => {
    const status = getStatus(request.params.proofId);
    return reply.status(200).send({ status });
  });

  app.get<{ Params: { proofId: string } }>('/v1/proofs/:proofId', async (request, reply) => {
    const proof = getProof(request.params.proofId);
    if (!proof) return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Proof not found'));
    return reply.status(200).send(proof);
  });

  app.post<{ Params: { proofId: string }; Body: { status: string } }>(
    '/v1/admin/proofs/:proofId/revoke',
    async (request, reply) => {
      const ok = setStatus(request.params.proofId, 'REVOKED');
      if (!ok) return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Proof not found'));
      return reply.status(200).send({ status: 'REVOKED' });
    }
  );
}
