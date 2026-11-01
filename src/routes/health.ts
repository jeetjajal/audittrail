import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dbPool } from '../middleware/tenant-context';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /health - Basic liveness probe
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'audittrail-ai-remote-backend',
      version: '2.1.0',
    });
  });

  // GET /health/ready - Readiness probe (checks pool responsiveness)
  fastify.get('/health/ready', async (_req: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    try {
      const client = await dbPool.connect();
      try {
        const res = await client.query('SELECT 1 as alive;');
        const latencyMs = Date.now() - startTime;
        if (res.rows[0]?.alive === 1) {
          return reply.status(200).send({
            status: 'READY',
            database: 'CONNECTED',
            pool: {
              total: dbPool.totalCount,
              idle: dbPool.idleCount,
              waiting: dbPool.waitingCount,
            },
            latencyMs,
            timestamp: new Date().toISOString(),
          });
        }
        return reply.status(503).send({
          status: 'UNREADY',
          database: 'UNEXPECTED_RESPONSE',
          latencyMs,
        });
      } finally {
        client.release();
      }
    } catch (err) {
      return reply.status(503).send({
        status: 'UNREADY',
        database: 'DISCONNECTED',
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /api/v1/health/database - Detailed database diagnostic endpoint
  fastify.get('/api/v1/health/database', async (_req: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    try {
      const client = await dbPool.connect();
      try {
        // Query version and current user role
        const roleRes = await client.query('SELECT current_user, current_database(), version();');
        const countRes = await client.query(
          "SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
        );
        const rlsRes = await client.query(
          "SELECT count(*) as rls_tables FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"
        );
        const latencyMs = Date.now() - startTime;

        return reply.status(200).send({
          status: 'UP',
          database: 'CONNECTED',
          databaseName: roleRes.rows[0]?.current_database,
          applicationRole: roleRes.rows[0]?.current_user,
          postgresVersion: roleRes.rows[0]?.version?.split(' on ')[0],
          totalTables: parseInt(countRes.rows[0]?.total_tables || '0', 10),
          rlsEnforcedTables: parseInt(rlsRes.rows[0]?.rls_tables || '0', 10),
          poolStats: {
            total: dbPool.totalCount,
            idle: dbPool.idleCount,
            waiting: dbPool.waitingCount,
          },
          latencyMs,
          timestamp: new Date().toISOString(),
        });
      } finally {
        client.release();
      }
    } catch (err) {
      return reply.status(500).send({
        status: 'DOWN',
        database: 'ERROR',
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}
