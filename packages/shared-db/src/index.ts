import { Pool, type PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(connectionUrl: string): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: connectionUrl, max: 10 });
  }
  return pool;
}

export async function checkConnection(connectionUrl: string): Promise<boolean> {
  const p = getPool(connectionUrl);
  try {
    const client: PoolClient = await p.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}
