import { checkConnection } from '@pfm/shared-db';
import { createServer } from '@pfm/shared-http';
import { port, serviceName, databaseUrl } from './config.js';
import { migrate } from './db.js';
import { registerRoutes } from './routes.js';

async function main() {
  const dbUrl = databaseUrl;
  if (dbUrl) {
    await migrate();
  }
  const app = await createServer({
    serviceName,
    healthCheck: dbUrl ? async () => ({ ok: await checkConnection(dbUrl) }) : undefined,
    registerRoutes,
  });
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
