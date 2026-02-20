import { randomUUID } from 'crypto';
import {
  getProofPayloadToSign,
  signPayloadEd25519,
  sha256Hex,
  type ProofPayload,
} from '@pfm/shared-crypto';
import type { ProofEnvelope, ProofSignature, ProofStatus } from '@pfm/shared-types';
import { getPrivateKey, issuerId, keyId, statusBaseUrl } from './config.js';

const store = new Map<string, { proof: ProofEnvelope; status: ProofStatus }>();

export interface WorkCompletionClaim {
  workId: string;
  milestoneId: string;
  completionDate: string;
  measurementBookRef?: string;
  amountCertified?: number;
  evidenceRef?: string;
}

export function issueWorkCompletionProof(claims: WorkCompletionClaim): ProofEnvelope {
  const proofId = randomUUID();
  const now = new Date().toISOString();
  const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const statusEndpoint = `${statusBaseUrl}/v1/proofs/${proofId}/status`;

  const payload: ProofPayload = {
    proofId,
    proofType: 'WorkCompletionProof',
    issuerId,
    issuedAt: now,
    validFrom: now,
    validUntil,
    statusEndpoint,
    claims: {
      workId: claims.workId,
      milestoneId: claims.milestoneId,
      completionDate: claims.completionDate,
      ...(claims.measurementBookRef != null && { measurementBookRef: claims.measurementBookRef }),
      ...(claims.amountCertified != null && { amountCertified: claims.amountCertified }),
      ...(claims.evidenceRef != null && { evidenceRef: claims.evidenceRef }),
    },
  };

  const canonical = getProofPayloadToSign(payload);
  const privateKey = getPrivateKey();
  const signatureValue = signPayloadEd25519(canonical, privateKey);
  const signature: ProofSignature = { alg: 'Ed25519', keyId, value: signatureValue };

  const proof: ProofEnvelope = {
    ...payload,
    signature,
    canonicalHash: sha256Hex(canonical),
  };

  store.set(proofId, { proof, status: 'VALID' });
  return proof;
}

export function getStatus(proofId: string): ProofStatus {
  const entry = store.get(proofId);
  if (!entry) return 'UNKNOWN';
  if (entry.status === 'VALID' && entry.proof.validUntil && new Date(entry.proof.validUntil) < new Date()) {
    return 'EXPIRED';
  }
  return entry.status;
}

export function setStatus(proofId: string, status: ProofStatus): boolean {
  const entry = store.get(proofId);
  if (!entry) return false;
  store.set(proofId, { ...entry, status });
  return true;
}

export function getProof(proofId: string): ProofEnvelope | undefined {
  return store.get(proofId)?.proof;
}
