import { readFileSync } from 'fs';
import { loadServiceConfig } from '@pfm/shared-config';

const config = loadServiceConfig('vendor-proof-issuer');

function getPrivateKeyPem(): string {
  const pem = process.env.ISSUER_PRIVATE_KEY_PEM;
  if (pem) return pem;
  const path = process.env.ISSUER_PRIVATE_KEY_PATH;
  if (path) {
    try {
      return readFileSync(path, 'utf8');
    } catch (e) {
      throw new Error(`Could not read private key from ${path}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error('ISSUER_PRIVATE_KEY_PEM or ISSUER_PRIVATE_KEY_PATH required');
}

export const issuerId = process.env.ISSUER_ID ?? 'did:web:vendor.demo.gov';
export const keyId = process.env.ISSUER_KEY_ID ?? 'key-1';
export const statusBaseUrl = process.env.STATUS_BASE_URL ?? 'http://vendor-proof-issuer:8080';
export const databaseUrl = config.databaseUrl;
export const port = config.port;
export const serviceName = config.serviceName;

let _privateKeyPem: string | null = null;
export function getPrivateKey(): string {
  if (!_privateKeyPem) _privateKeyPem = getPrivateKeyPem();
  return _privateKeyPem;
}
