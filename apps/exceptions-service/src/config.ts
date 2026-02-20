import { loadServiceConfig } from '@pfm/shared-config';

const config = loadServiceConfig('exceptions-service');

export const port = config.port;
export const serviceName = config.serviceName;
export const databaseUrl = config.databaseUrl;

export const auditBaseUrl = process.env.AUDIT_BASE_URL ?? 'http://audit-service:8080';
export const rulebookBaseUrl = process.env.RULEBOOK_BASE_URL ?? 'http://rulebook-service:8080';
