import { loadServiceConfig } from '@pfm/shared-config';

const config = loadServiceConfig('ifms-connector');

export const port = config.port;
export const serviceName = config.serviceName;

export const ifmsBaseUrl = process.env.IFMS_BASE_URL ?? 'http://ifms-dummy:8080';
export const budgetBaseUrl = process.env.BUDGET_BASE_URL ?? 'http://budget-lock:8080';
export const auditBaseUrl = process.env.AUDIT_BASE_URL ?? 'http://audit-service:8080';
