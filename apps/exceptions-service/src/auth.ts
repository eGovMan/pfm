import { FastifyRequest, FastifyReply } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';

const REDRESSAL_ROLE = 'redressal_authority';

export async function requireRedressal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send(createErrorEnvelope('UNAUTHORIZED', 'Missing or invalid Authorization header'));
  }
  const token = authHeader.slice(7);
  try {
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return reply.status(401).send(createErrorEnvelope('UNAUTHORIZED', 'Invalid token'));
    }
    const realmRoles: string[] = (payload.realm_access as { roles?: string[] })?.roles ?? [];
    if (!realmRoles.includes(REDRESSAL_ROLE)) {
      return reply.status(403).send(createErrorEnvelope('FORBIDDEN', 'Override requires redressal_authority role'));
    }
  } catch {
    return reply.status(401).send(createErrorEnvelope('UNAUTHORIZED', 'Invalid token'));
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
