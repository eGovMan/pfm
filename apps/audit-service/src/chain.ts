import { canonicalSerialize, sha256Hex } from '@pfm/shared-crypto';

const INITIAL_HASH = '';

export function computeRecordHash(previousHash: string, caseId: string, payload: Record<string, unknown>): string {
  const payloadStr = canonicalSerialize(payload);
  const input = previousHash + '|' + caseId + '|' + payloadStr;
  return sha256Hex(input);
}

export function computeDecisionHash(payload: Record<string, unknown>): string {
  return sha256Hex(canonicalSerialize(payload));
}

export function getInitialHash(): string {
  return INITIAL_HASH;
}

export { INITIAL_HASH };
