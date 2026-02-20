import { loadServiceConfig } from '@pfm/shared-config';

const config = loadServiceConfig('checks-engine');

export const port = config.port;
export const serviceName = config.serviceName;
export const databaseUrl = config.databaseUrl;

export const rulebookBaseUrl =
  process.env.RULEBOOK_BASE_URL ?? 'http://rulebook-service:8080';
export const directoryBaseUrl =
  process.env.DIRECTORY_BASE_URL ?? 'http://directory-service:8080';
export const worksProofIssuerBaseUrl =
  process.env.WORKS_PROOF_ISSUER_BASE_URL ?? 'http://works-proof-issuer:8080';
export const vendorProofIssuerBaseUrl =
  process.env.VENDOR_PROOF_ISSUER_BASE_URL ?? 'http://vendor-proof-issuer:8080';
