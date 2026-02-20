// Placeholder for Sprint 2: canonical JSON (RFC 8785) and Ed25519 signing/verification
export function canonicalSerialize(_obj: unknown): string {
  return JSON.stringify(_obj);
}

export function sha256Hex(_input: string): string {
  return ''; // Stub; implement with crypto.createHash in Sprint 2
}
