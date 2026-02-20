import {
  verifyProofSignature,
  publicKeyPemFromBase64,
  type ProofPayload,
} from '@pfm/shared-crypto';
import type { ProofEnvelope } from '@pfm/shared-types';
import {
  rulebookBaseUrl,
  directoryBaseUrl,
  worksProofIssuerBaseUrl,
  vendorProofIssuerBaseUrl,
} from './config.js';

export interface ProofRef {
  proofId: string;
  proofType: string;
  issuerId: string;
  proof?: ProofEnvelope;
}

export interface EvaluateRequest {
  caseId: string;
  vendorId: string;
  workId: string;
  milestoneId: string;
  amount: number;
  budgetHead: string;
  proofRefs: ProofRef[];
  rulebookId: string;
  rulebookVersion: string;
}

export interface Reason {
  code: string;
  severity: 'HOLD' | 'DENY';
  message: string;
  overrideAllowed: boolean;
}

export interface ProofCheck {
  proofType: string;
  proofId: string;
  status: 'valid' | 'invalid';
  checks: {
    signature?: string;
    issuer?: string;
    expiry?: string;
    revocation?: string;
  };
}

export interface EvaluateResponse {
  caseId: string;
  decision: 'APPROVE' | 'HOLD' | 'DENY';
  reasons: Reason[];
  proofChecks: ProofCheck[];
  requiredActions: string[];
  evaluatedAt: string;
}

interface Rule {
  checkId: string;
  name: string;
  type: string;
  proofType?: string;
  required?: boolean;
  reasonCode: string;
  severity: 'HOLD' | 'DENY';
  claimPath?: string;
  expected?: boolean;
}

interface ReasonCodeDef {
  code: string;
  message: string;
  severity: 'HOLD' | 'DENY';
  overrideAllowed: boolean;
}

async function getRulebook(rulebookId: string, version: string): Promise<{ rules: Rule[]; reasonCodes: Record<string, ReasonCodeDef> }> {
  const url = `${rulebookBaseUrl}/v1/rulebooks/${encodeURIComponent(rulebookId)}?version=${encodeURIComponent(version)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Rulebook fetch failed: ${r.status}`);
  const j = (await r.json()) as { rulesJson?: unknown; reasonCodesJson?: unknown };
  return {
    rules: Array.isArray(j.rulesJson) ? (j.rulesJson as Rule[]) : [],
    reasonCodes: typeof j.reasonCodesJson === 'object' && j.reasonCodesJson !== null ? (j.reasonCodesJson as Record<string, ReasonCodeDef>) : {},
  };
}

async function getParticipant(participantId: string): Promise<{ keys: Array<{ publicKey: string }> }> {
  const url = `${directoryBaseUrl}/v1/participants/${encodeURIComponent(participantId)}`;
  const r = await fetch(url);
  if (!r.ok) return { keys: [] };
  const j = (await r.json()) as { keys?: Array<{ publicKey: string }> };
  return { keys: j.keys ?? [] };
}

async function isAllowed(participantId: string, action: string, proofType: string): Promise<boolean> {
  const url = `${directoryBaseUrl}/v1/permissions/isAllowed?participantId=${encodeURIComponent(participantId)}&action=${encodeURIComponent(action)}&proofType=${encodeURIComponent(proofType)}`;
  const r = await fetch(url);
  if (!r.ok) return false;
  const j = (await r.json()) as { allowed?: boolean };
  return j.allowed === true;
}

function issuerBaseUrl(issuerId: string): string {
  if (issuerId === 'did:web:works.demo.gov') return worksProofIssuerBaseUrl;
  if (issuerId === 'did:web:vendor.demo.gov') return vendorProofIssuerBaseUrl;
  return '';
}

async function fetchProof(proofRef: ProofRef): Promise<ProofEnvelope | null> {
  if (proofRef.proof) return proofRef.proof;
  const base = issuerBaseUrl(proofRef.issuerId);
  if (!base) return null;
  const url = `${base}/v1/proofs/${encodeURIComponent(proofRef.proofId)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return (await r.json()) as ProofEnvelope;
}

async function fetchProofStatus(proofRef: ProofRef): Promise<string> {
  const base = issuerBaseUrl(proofRef.issuerId);
  if (!base) return 'UNKNOWN';
  const url = `${base}/v1/proofs/${encodeURIComponent(proofRef.proofId)}/status`;
  const r = await fetch(url);
  if (!r.ok) return 'UNKNOWN';
  const j = (await r.json()) as { status?: string };
  return j.status ?? 'UNKNOWN';
}

export async function evaluate(req: EvaluateRequest): Promise<EvaluateResponse> {
  const { caseId, rulebookId, rulebookVersion, vendorId, workId, milestoneId, proofRefs } = req;
  const evaluatedAt = new Date().toISOString();
  const reasons: Reason[] = [];
  const proofChecks: ProofCheck[] = [];
  const requiredActions: string[] = [];

  const { reasonCodes } = await getRulebook(rulebookId, rulebookVersion);

  const proofsByType = new Map<string, { proof: ProofEnvelope; ref: ProofRef }>();

  for (const ref of proofRefs) {
    const proof = await fetchProof(ref);
    const status = await fetchProofStatus(ref);
    const participant = await getParticipant(ref.issuerId);
    const publicKeyPem = participant.keys[0]?.publicKey
      ? publicKeyPemFromBase64(participant.keys[0].publicKey)
      : '';
    const signatureOk = !!(proof && publicKeyPem && verifyProofSignature(proof as ProofPayload & { signature?: { value: string }; canonicalHash?: string }, publicKeyPem));
    const issuerOk: boolean = await isAllowed(ref.issuerId, 'issue_proof', ref.proofType);
    const notExpired = proof?.validUntil ? new Date(proof.validUntil) > new Date() : false;
    const notRevoked = status === 'VALID';

    proofChecks.push({
      proofType: ref.proofType,
      proofId: ref.proofId,
      status: signatureOk && issuerOk && notExpired && notRevoked ? 'valid' : 'invalid',
      checks: {
        signature: signatureOk ? 'valid' : 'invalid',
        issuer: issuerOk ? 'authorized' : 'unauthorized',
        expiry: notExpired ? 'not_expired' : 'expired',
        revocation: notRevoked ? 'not_revoked' : 'revoked',
      },
    });

    if (!signatureOk && proof) {
      const rc = reasonCodes['INVALID_PROOF_SIGNATURE'];
      reasons.push({
        code: 'INVALID_PROOF_SIGNATURE',
        severity: 'DENY',
        message: rc?.message ?? 'Proof signature is invalid',
        overrideAllowed: rc?.overrideAllowed ?? false,
      });
    }
    if (!issuerOk) {
      const rc = reasonCodes['UNAUTHORIZED_ISSUER'];
      reasons.push({
        code: 'UNAUTHORIZED_ISSUER',
        severity: 'DENY',
        message: rc?.message ?? 'Proof issuer is not authorized',
        overrideAllowed: rc?.overrideAllowed ?? false,
      });
    }
    if (proof && !notExpired) {
      const rc = reasonCodes['PROOF_EXPIRED'];
      reasons.push({
        code: 'PROOF_EXPIRED',
        severity: 'DENY',
        message: rc?.message ?? 'Proof has expired',
        overrideAllowed: rc?.overrideAllowed ?? false,
      });
    }
    if (!notRevoked) {
      const rc = reasonCodes['PROOF_REVOKED'];
      reasons.push({
        code: 'PROOF_REVOKED',
        severity: 'DENY',
        message: rc?.message ?? 'Proof has been revoked',
        overrideAllowed: rc?.overrideAllowed ?? false,
      });
    }

    if (proof) proofsByType.set(ref.proofType, { proof, ref });
  }

  const workProof = proofsByType.get('WorkCompletionProof');
  const vendorProof = proofsByType.get('VendorEligibilityProof');

  if (!workProof) {
    const rc = reasonCodes['MISSING_WORK_COMPLETION_PROOF'];
    reasons.push({
      code: 'MISSING_WORK_COMPLETION_PROOF',
      severity: 'DENY',
      message: rc?.message ?? 'Work completion proof is required',
      overrideAllowed: rc?.overrideAllowed ?? false,
    });
  } else if (workProof.proof.claims) {
    const w = workProof.proof.claims as Record<string, unknown>;
    if (String(w.workId) !== workId || String(w.milestoneId) !== milestoneId) {
      const rc = reasonCodes['WORK_MILESTONE_MISMATCH'];
      reasons.push({
        code: 'WORK_MILESTONE_MISMATCH',
        severity: 'DENY',
        message: rc?.message ?? 'Work proof does not match payment milestone',
        overrideAllowed: rc?.overrideAllowed ?? false,
      });
    }
  }

  if (!vendorProof) {
    const rc = reasonCodes['MISSING_VENDOR_ELIGIBILITY_PROOF'];
    reasons.push({
      code: 'MISSING_VENDOR_ELIGIBILITY_PROOF',
      severity: 'DENY',
      message: rc?.message ?? 'Vendor eligibility proof is required',
      overrideAllowed: rc?.overrideAllowed ?? false,
    });
  } else if (vendorProof.proof.claims) {
    const v = vendorProof.proof.claims as Record<string, unknown>;
    if (String(v.canonicalVendorId) !== vendorId) {
      const rc = reasonCodes['VENDOR_ID_MISMATCH'];
      reasons.push({
        code: 'VENDOR_ID_MISMATCH',
        severity: 'DENY',
        message: rc?.message ?? 'Vendor proof does not match payment vendor',
        overrideAllowed: rc?.overrideAllowed ?? false,
      });
    }
    if (v.blacklisted === true) {
      const rc = reasonCodes['VENDOR_BLACKLISTED'];
      reasons.push({
        code: 'VENDOR_BLACKLISTED',
        severity: 'DENY',
        message: rc?.message ?? 'Vendor is blacklisted',
        overrideAllowed: rc?.overrideAllowed ?? false,
      });
    }
    if (v.bankValidated !== true) {
      const rc = reasonCodes['VENDOR_BANK_NOT_VALIDATED'];
      reasons.push({
        code: 'VENDOR_BANK_NOT_VALIDATED',
        severity: 'HOLD',
        message: rc?.message ?? 'Vendor bank account not validated',
        overrideAllowed: rc?.overrideAllowed ?? true,
      });
    }
  }

  let decision: 'APPROVE' | 'HOLD' | 'DENY' = 'APPROVE';
  if (reasons.some((r) => r.severity === 'DENY')) decision = 'DENY';
  else if (reasons.some((r) => r.severity === 'HOLD')) decision = 'HOLD';

  return {
    caseId,
    decision,
    reasons,
    proofChecks,
    requiredActions,
    evaluatedAt,
  };
}
