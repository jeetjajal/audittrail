import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService } from '../services/audit-service';

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/audit/verify - Verify cryptographic ledger integrity
  fastify.get('/verify', async (req: FastifyRequest<{ Querystring: { fromSeq?: string; toSeq?: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const fromSeq = parseInt(req.query.fromSeq || '1', 10);
    const toSeq = parseInt(req.query.toSeq || '1000', 10);

    const result = await withTenantTransaction(orgId, async (client) => {
      return AuditService.verifyTenantChain(client, orgId, fromSeq, toSeq);
    });
    reply.send(result);
  });

  // GET /api/v1/audit/events - Query audit log with pagination
  fastify.get('/events', async (req: FastifyRequest<{ Querystring: { limit?: string; offset?: string; entityName?: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const entityName = req.query.entityName;

    const res = await withTenantTransaction(orgId, async (client) => {
      let query = `
        SELECT a.id, a.sequence_number, a.entity_name, a.entity_id, a.action,
               a.actor_id, a.correlation_id, a.reason_for_change, a.before_state, a.after_state,
               a.previous_event_hash, a.event_hash, a.created_at,
               u.full_name as actor_name, u.email as actor_email
        FROM audit_events a
        LEFT JOIN users u ON a.organization_id = u.organization_id AND a.actor_id = u.id
        WHERE a.organization_id = $1
      `;
      const params: unknown[] = [orgId];

      if (entityName) {
        params.push(entityName);
        query += ` AND a.entity_name = $${params.length}`;
      }

      query += ` ORDER BY a.sequence_number DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
      params.push(limit, offset);

      const queryRes = await client.query(query, params);
      return { events: queryRes.rows, total: queryRes.rowCount };
    });

    reply.send(res);
  });

  // GET /api/v1/audit/events/:id - Get single audit event by ID
  fastify.get('/events/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const eventId = req.params.id;

    const event = await withTenantTransaction(orgId, async (client) => {
      const res = await client.query(
        `SELECT a.*, u.full_name as actor_name, u.email as actor_email
         FROM audit_events a
         LEFT JOIN users u ON a.organization_id = u.organization_id AND a.actor_id = u.id
         WHERE a.organization_id = $1 AND a.id = $2;`,
        [orgId, eventId]
      );

      if (res.rows.length === 0) {
        return null;
      }
      return res.rows[0];
    });

    if (!event) {
      return reply.status(404).send({ error: 'AUDIT_EVENT_NOT_FOUND', message: 'Audit event record not found' });
    }

    reply.send(event);
  });
}
