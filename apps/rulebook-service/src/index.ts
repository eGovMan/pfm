import { checkConnection } from '@pfm/shared-db';
import { createServer } from '@pfm/shared-http';
import { loadServiceConfig } from '@pfm/shared-config';
import { migrate } from './db.js';
import { registerRoutes } from './routes.js';

const config = loadServiceConfig('rulebook-service');

async function main() {
  if (config.databaseUrl) {
    await migrate();
  }
  const app = await createServer({
    serviceName: config.serviceName,
    healthCheck: config.databaseUrl ? async () => ({ ok: await checkConnection(config.databaseUrl!) }) : undefined,
    registerRoutes,
  });
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
