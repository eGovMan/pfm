const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
const apiHost = (import.meta.env?.VITE_API_HOST as string) || host;

export const auditBaseUrl = `http://${apiHost}:8087`;
export const exceptionsBaseUrl = `http://${apiHost}:8089`;
