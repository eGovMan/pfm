import { createHash, sign, verify } from 'crypto';

/**
 * RFC 8785-style canonical JSON: sort object keys recursively, then stringify.
 * Arrays and primitives preserved; only object property order is canonicalized.
 */
export function canonicalSerialize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((v) => canonicalSerialize(v)).join(',') + ']';
  }
  const o = obj as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const parts = keys.map((k) => escapeKey(k) + ':' + canonicalSerialize(o[k]));
  return '{' + parts.join(',') + '}';
}

function escapeKey(k: string): string {
  return JSON.stringify(k);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Ed25519 uses one-shot sign (no digest); null algorithm per Node docs. */
export function signPayloadEd25519(payloadUtf8: string, privateKeyPem: string): string {
  const sig = sign(null, Buffer.from(payloadUtf8, 'utf8'), privateKeyPem);
  return sig.toString('base64');
}

export function verifySignatureEd25519(payloadUtf8: string, signatureBase64: string, publicKeyPem: string): boolean {
  try {
    return verify(null, Buffer.from(payloadUtf8, 'utf8'), publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}

/** Convert raw base64 (no PEM wrapper) to PEM for Node crypto. */
export function publicKeyPemFromBase64(base64: string): string {
  const b = base64.replace(/\s/g, '');
  return `-----BEGIN PUBLIC KEY-----\n${b}\n-----END PUBLIC KEY-----`;
}

/** Proof envelope shape for signing: payload is canonical JSON of proof without signature/canonicalHash. */
export interface ProofPayload {
  proofId: string;
  proofType: string;
  issuerId: string;
  issuedAt: string;
  validFrom?: string;
  validUntil?: string;
  statusEndpoint?: string;
  claims: Record<string, unknown>;
}

export function getProofPayloadToSign(proof: ProofPayload): string {
  return canonicalSerialize(proof);
}

/** Verify proof signature; proof must include payload fields and signature.value. */
export function verifyProofSignature(
  proof: ProofPayload & { signature?: { value: string }; canonicalHash?: string },
  publicKeyPem: string
): boolean {
  if (!proof.signature?.value) return false;
  const payloadOnly: ProofPayload = {
    proofId: proof.proofId,
    proofType: proof.proofType,
    issuerId: proof.issuerId,
    issuedAt: proof.issuedAt,
    validFrom: proof.validFrom,
    validUntil: proof.validUntil,
    statusEndpoint: proof.statusEndpoint,
    claims: proof.claims,
  };
  const payload = getProofPayloadToSign(payloadOnly);
  return verifySignatureEd25519(payload, proof.signature.value, publicKeyPem);
}
