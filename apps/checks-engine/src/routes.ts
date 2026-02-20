import type { FastifyInstance } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';
import { evaluate, type EvaluateRequest } from './evaluate.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: EvaluateRequest }>('/v1/checks/evaluate', async (request, reply) => {
    try {
      const body = request.body as EvaluateRequest;
      if (!body.caseId || !body.rulebookId || !body.rulebookVersion) {
        return reply.status(400).send(
          createErrorEnvelope('BAD_REQUEST', 'caseId, rulebookId, rulebookVersion required')
        );
      }
      if (!Array.isArray(body.proofRefs)) {
        return reply.status(400).send(
          createErrorEnvelope('BAD_REQUEST', 'proofRefs must be an array')
        );
      }
      const result = await evaluate(body);
      return reply.status(200).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Evaluation failed';
      return reply.status(500).send(createErrorEnvelope('EVALUATE_FAILED', message));
    }
  });
}
