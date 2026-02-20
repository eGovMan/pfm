export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    traceId?: string;
  };
}

export const SERVICE_VERSION = '0.1.0';
