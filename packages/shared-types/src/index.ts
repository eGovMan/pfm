export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    traceId?: string;
  };
}

export const SERVICE_VERSION = '0.1.0';

export type ProofStatus = 'VALID' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';

export interface ProofSignature {
  alg: string;
  keyId: string;
  value: string;
}

export interface ProofEnvelope {
  proofId: string;
  proofType: string;
  issuerId: string;
  issuedAt: string;
  validFrom?: string;
  validUntil?: string;
  statusEndpoint?: string;
  claims: Record<string, unknown>;
  signature?: ProofSignature;
  canonicalHash?: string;
}
