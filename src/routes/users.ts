import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService } from '../services/audit-service';

interface UpdateUserStatusBody {
  isActive: boolean;
  reasonForChange: string;
}

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/users - List authorized clinical users with their roles
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;

    const users = await withTenantTransaction(orgId, async (client) => {
      const queryRes = await client.query(
        `SELECT u.id, u.atlassian_account_id, u.email, u.full_name, u.job_title,
                u.department, u.is_active, u.created_at,
                COALESCE(
                  json_agg(
                    json_build_object('id', r.id, 'code', r.code, 'name', r.name)
                  ) FILTER (WHERE r.id IS NOT NULL), '[]'::json
                ) as roles
         FROM users u
         LEFT JOIN user_roles ur ON u.organization_id = ur.organization_id AND u.id = ur.user_id
         LEFT JOIN roles r ON ur.organization_id = r.organization_id AND ur.role_id = r.id
         WHERE u.organization_id = $1
         GROUP BY u.id
         ORDER BY u.full_name ASC;`,
        [orgId]
      );
      return queryRes.rows;
    });

    return reply.status(200).send({ items: users, total: users.length });
  });

  // GET /api/v1/users/:id - Fetch user details & granted permissions
  fastify.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const userId = req.params.id;

    const user = await withTenantTransaction(orgId, async (client) => {
      const userRes = await client.query(
        `SELECT u.id, u.atlassian_account_id, u.email, u.full_name, u.job_title,
                u.department, u.is_active, u.created_at
         FROM users u
         WHERE u.organization_id = $1 AND u.id = $2;`,
        [orgId, userId]
      );

      if (userRes.rows.length === 0) {
        throw new Error('USER_NOT_FOUND');
      }

      // Fetch user's permissions
      const permRes = await client.query(
        `SELECT DISTINCT p.code, p.module, p.description
         FROM user_roles ur
         JOIN role_permissions rp ON ur.organization_id = rp.organization_id AND ur.role_id = rp.role_id
         JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.organization_id = $1 AND ur.user_id = $2;`,
        [orgId, userId]
      );

      return {
        ...userRes.rows[0],
        permissions: permRes.rows.map((p) => p.code),
      };
    });

    return reply.status(200).send(user);
  });

  // PATCH /api/v1/users/:id/status - Activate or deactivate user (with 21 CFR Part 11 audit)
  fastify.patch('/:id/status', async (req: FastifyRequest<{
    Params: { id: string };
    Body: UpdateUserStatusBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const targetUserId = req.params.id;
    const { isActive, reasonForChange } = req.body;
    const correlationId = req.correlationId;

    if (!reasonForChange) {
      return reply.status(400).send({
        error: 'INVALID_INPUT',
        message: 'A documented reasonForChange is mandatory for regulatory access modification',
      });
    }

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch current user state
      const beforeRes = await client.query(
        'SELECT id, full_name, email, is_active FROM users WHERE organization_id = $1 AND id = $2;',
        [orgId, targetUserId]
      );
      if (beforeRes.rows.length === 0) throw new Error('USER_NOT_FOUND');
      const before = beforeRes.rows[0];

      // 2. Resolve actor
      const actorRes = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1;', [orgId]);
      const actorId = actorRes.rows[0]?.id;

      // 3. Update status
      await client.query(
        'UPDATE users SET is_active = $3, updated_at = CURRENT_TIMESTAMP WHERE organization_id = $1 AND id = $2;',
        [orgId, targetUserId, isActive]
      );

      // 4. Record tamper-evident audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'users',
        entityId: targetUserId,
        action: 'STATUS_CHANGE',
        actorId,
        correlationId,
        reasonForChange: `Changed user active status to ${isActive}: ${reasonForChange}`,
        beforeState: { isActive: before.is_active },
        afterState: { isActive },
      });

      return {
        userId: targetUserId,
        fullName: before.full_name,
        isActive,
        updatedAt: new Date().toISOString(),
      };
    });

    return reply.status(200).send(result);
  });

  // GET /api/v1/roles - List defined roles in organization
  fastify.get('/roles', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;

    const roles = await withTenantTransaction(orgId, async (client) => {
      const queryRes = await client.query(
        `SELECT r.id, r.code, r.name, r.description, r.is_system,
                count(ur.user_id) as assigned_users_count
         FROM roles r
         LEFT JOIN user_roles ur ON r.organization_id = ur.organization_id AND r.id = ur.role_id
         WHERE r.organization_id = $1
         GROUP BY r.id
         ORDER BY r.name ASC;`,
        [orgId]
      );
      return queryRes.rows;
    });

    return reply.status(200).send({ items: roles, total: roles.length });
  });

  // GET /api/v1/permissions - List system regulatory permissions
  fastify.get('/permissions', async (_req: FastifyRequest, reply: FastifyReply) => {
    const permissions = await withTenantTransaction('00000000-0000-0000-0000-000000000000', async (client) => {
      const queryRes = await client.query(
        'SELECT id, code, module, description FROM permissions ORDER BY module ASC, code ASC;'
      );
      return queryRes.rows;
    });

    return reply.status(200).send({ items: permissions, total: permissions.length });
  });
}
