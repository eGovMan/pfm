const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';

export const keycloakUrl =
  (import.meta.env.VITE_KEYCLOAK_URL as string) || `http://${host}:8088`;
export const keycloakRealm = (import.meta.env.VITE_KEYCLOAK_REALM as string) || 'pfm-demo';
export const keycloakClient = (import.meta.env.VITE_KEYCLOAK_CLIENT as string) || 'bill-ui';

const apiHost = (import.meta.env.VITE_API_HOST as string) || host;
const apiBase = `http://${apiHost}`;

export const urls = {
  directory: `${apiBase}:8081`,
  worksProof: `${apiBase}:8082`,
  vendorProof: `${apiBase}:8083`,
  rulebook: `${apiBase}:8084`,
  checks: `${apiBase}:8085`,
  budget: `${apiBase}:8086`,
  audit: `${apiBase}:8087`,
  exceptions: `${apiBase}:8089`,
  connector: `${apiBase}:8091`,
} as const;
