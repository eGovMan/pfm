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

export interface VendorEligibilityClaim {
  canonicalVendorId: string;
  mappedIds?: { ifmsVendorCode?: string; eprocVendorId?: string };
  bankValidated: boolean;
  blacklisted: boolean;
  taxStatus?: string;
  complianceFlags?: Record<string, unknown>;
}

export function issueVendorEligibilityProof(claims: VendorEligibilityClaim): ProofEnvelope {
  const proofId = randomUUID();
  const now = new Date().toISOString();
  const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const statusEndpoint = `${statusBaseUrl}/v1/proofs/${proofId}/status`;

  const claimsObj: Record<string, unknown> = {
    canonicalVendorId: claims.canonicalVendorId,
    bankValidated: claims.bankValidated,
    blacklisted: claims.blacklisted,
  };
  if (claims.mappedIds) claimsObj.mappedIds = claims.mappedIds;
  if (claims.taxStatus != null) claimsObj.taxStatus = claims.taxStatus;
  if (claims.complianceFlags != null) claimsObj.complianceFlags = claims.complianceFlags;

  const payload: ProofPayload = {
    proofId,
    proofType: 'VendorEligibilityProof',
    issuerId,
    issuedAt: now,
    validFrom: now,
    validUntil,
    statusEndpoint,
    claims: claimsObj,
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
