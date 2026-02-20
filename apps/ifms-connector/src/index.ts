import { checkConnection } from '@pfm/shared-db';
import { createServer } from '@pfm/shared-http';
import { loadServiceConfig } from '@pfm/shared-config';

const config = loadServiceConfig('ifms-connector');

async function main() {
  const app = await createServer({
    serviceName: config.serviceName,
    healthCheck: config.databaseUrl ? async () => ({ ok: await checkConnection(config.databaseUrl!) }) : undefined,
  });
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
