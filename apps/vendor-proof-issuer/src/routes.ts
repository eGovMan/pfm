import type { FastifyInstance } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';
import { issueVendorEligibilityProof, getStatus, setStatus, getProof, type VendorEligibilityClaim } from './proofs.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: VendorEligibilityClaim;
  }>('/v1/proofs/issue', async (request, reply) => {
    try {
      const body = request.body as VendorEligibilityClaim;
      if (body.canonicalVendorId == null || typeof body.bankValidated !== 'boolean' || typeof body.blacklisted !== 'boolean') {
        return reply.status(400).send(
          createErrorEnvelope('BAD_REQUEST', 'canonicalVendorId, bankValidated, blacklisted required')
        );
      }
      const proof = issueVendorEligibilityProof(body);
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

  app.post<{ Params: { proofId: string } }>('/v1/admin/proofs/:proofId/revoke', async (request, reply) => {
    const ok = setStatus(request.params.proofId, 'REVOKED');
    if (!ok) return reply.status(404).send(createErrorEnvelope('NOT_FOUND', 'Proof not found'));
    return reply.status(200).send({ status: 'REVOKED' });
  });
}
