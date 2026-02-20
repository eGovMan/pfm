import cors from '@fastify/cors';
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SERVICE_VERSION, type HealthResponse, type ErrorEnvelope } from '@pfm/shared-types';

export type { FastifyInstance, FastifyRequest, FastifyReply };

export interface CreateServerOptions {
  serviceName: string;
  registerRoutes?: (app: FastifyInstance) => Promise<void> | void;
  healthCheck?: () => Promise<{ ok: boolean }>;
}

export function createErrorEnvelope(code: string, message: string, details?: unknown, traceId?: string): ErrorEnvelope {
  return {
    error: { code, message, ...(details !== undefined && { details }), ...(traceId && { traceId }) },
  };
}

export async function createServer(opts: CreateServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR';
    const message = err.message ?? 'Internal server error';
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    reply.status(status).send(createErrorEnvelope(code, message));
  });

  app.get<{ Reply: HealthResponse }>('/health', async (_req, reply) => {
    let status: 'ok' | 'degraded' = 'ok';
    if (opts.healthCheck) {
      try {
        const { ok } = await opts.healthCheck();
        if (!ok) status = 'degraded';
      } catch {
        status = 'degraded';
      }
    }
    return reply.status(200).send({
      status,
      service: opts.serviceName,
      version: SERVICE_VERSION,
    });
  });

  app.get('/v1/info', async (_req, reply) => {
    return reply.status(200).send({
      service: opts.serviceName,
      version: SERVICE_VERSION,
    });
  });

  if (opts.registerRoutes) await opts.registerRoutes(app);

  return app;
}
