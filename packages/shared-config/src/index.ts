export function getEnv(key: string, defaultValue?: string): string {
  const v = process.env[key];
  if (v !== undefined && v !== '') return v;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required env: ${key}`);
}

export function getEnvNumber(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return defaultValue;
  const n = Number(v);
  if (Number.isNaN(n)) return defaultValue;
  return n;
}

export interface ServiceConfig {
  serviceName: string;
  port: number;
  nodeEnv: string;
  logLevel: string;
  databaseUrl?: string;
}

export function loadServiceConfig(serviceName: string): ServiceConfig {
  return {
    serviceName,
    port: getEnvNumber('PORT', 8080),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    databaseUrl: process.env.DATABASE_URL,
  };
}
