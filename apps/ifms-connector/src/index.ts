import { createServer } from '@pfm/shared-http';
import { loadServiceConfig } from '@pfm/shared-config';
import { registerRoutes } from './routes.js';

const config = loadServiceConfig('ifms-connector');

async function main() {
  const app = await createServer({
    serviceName: config.serviceName,
    registerRoutes,
  });
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
