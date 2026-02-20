import { FastifyRequest, FastifyReply } from 'fastify';
import { createErrorEnvelope } from '@pfm/shared-http';

const ADMIN_ROLES = ['finance_admin', 'system_service'];

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const seedSecret = process.env.RULEBOOK_SEED_SECRET ?? process.env.DIRECTORY_SEED_SECRET;
  const headerSecret = request.headers['x-seed-secret'] as string | undefined;
  if (seedSecret && headerSecret && seedSecret === headerSecret) {
    return;
  }
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
    const hasAdmin = ADMIN_ROLES.some((r) => realmRoles.includes(r));
    if (!hasAdmin) {
      return reply.status(403).send(createErrorEnvelope('FORBIDDEN', 'Insufficient role for admin endpoint'));
    }
  } catch {
    return reply.status(401).send(createErrorEnvelope('UNAUTHORIZED', 'Invalid token'));
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
