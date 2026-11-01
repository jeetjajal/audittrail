import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool, PoolClient } from 'pg';
import { config } from '../config';

export const dbPool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// In-memory tenant cache: installationId -> organizationId (TTL: 5 minutes)
const tenantCache = new Map<string, { orgId: string; expiresAt: number }>();

export async function resolveTenantOrganization(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.tenantOrganizationId) {
    return;
  }

  const forgeCtx = req.forgeContext;
  if (!forgeCtx) {
    reply.status(401).send({ error: 'UNAUTHENTICATED' });
    return;
  }

  const cacheKey = forgeCtx.installationId;
  const cached = tenantCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    req.tenantOrganizationId = cached.orgId;
    return;
  }

  // Lookup organization by installation ID or cloud ID
  const client = await dbPool.connect();
  try {
    const result = await client.query(
      `SELECT id FROM organizations 
       WHERE atlassian_installation_id = $1 OR atlassian_cloud_id = $2 
       LIMIT 1;`,
      [forgeCtx.installationId, forgeCtx.cloudId || '']
    );

    if (result.rows.length === 0) {
      reply.status(403).send({
        statusCode: 403,
        error: 'TENANT_NOT_REGISTERED',
        message: 'This Atlassian installation has not been onboarded into AuditTrail AI',
      });
      return;
    }

    const orgId = result.rows[0].id;
    tenantCache.set(cacheKey, { orgId, expiresAt: Date.now() + 300000 });
    req.tenantOrganizationId = orgId;
  } finally {
    client.release();
  }
}

/**
 * Executes database operations strictly within an isolated transaction
 * with transaction-scoped RLS context (SET LOCAL). Prevents connection leak.
 * Resolves Defect AUD-11.
 */
export async function withTenantTransaction<T>(
  organizationId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN;');
    // Transaction-scoped context (is_local = true) - automatically clears when COMMIT/ROLLBACK occurs
    await client.query("SELECT set_config('app.current_organization_id', $1, true);", [organizationId]);

    const result = await callback(client);

    await client.query('COMMIT;');
    return result;
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}
