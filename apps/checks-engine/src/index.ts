import { createServer } from '@pfm/shared-http';
import { port, serviceName } from './config.js';
import { registerRoutes } from './routes.js';

async function main() {
  const app = await createServer({
    serviceName,
    registerRoutes,
  });
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
