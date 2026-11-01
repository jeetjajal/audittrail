import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService } from '../services/audit-service';
import { config } from '../config';

interface UpdateOrganizationBody {
  name?: string;
  fdaEstablishmentId?: string;
  isoCertifications?: Array<{ standard: string; certificateNumber: string; validUntil: string }>;
}

export async function organizationRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/organization - Fetch tenant profile, regulatory IDs & medical device counts
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch organization
      const orgRes = await client.query(
        `SELECT id, name, slug, atlassian_cloud_id, atlassian_installation_id,
                fda_establishment_id, iso_certifications, is_active, created_at, updated_at
         FROM organizations
         WHERE id = $1;`,
        [orgId]
      );

      if (orgRes.rows.length === 0) {
        throw new Error('ORGANIZATION_NOT_FOUND');
      }
      const org = orgRes.rows[0];

      // 2. Aggregate device count
      const devRes = await client.query(
        'SELECT count(*) as total_devices FROM medical_devices WHERE organization_id = $1;',
        [orgId]
      );

      // 3. Aggregate active users count
      const userRes = await client.query(
        'SELECT count(*) as total_users FROM users WHERE organization_id = $1 AND is_active = TRUE;',
        [orgId]
      );

      return {
        ...org,
        totalDevices: parseInt(devRes.rows[0]?.total_devices || '0', 10),
        totalActiveUsers: parseInt(userRes.rows[0]?.total_users || '0', 10),
        retentionPolicy: {
          standard: '21 CFR § 820.180 & ISO 13485:2016 § 4.2.5',
          minimumYears: config.s3RetentionYears || 10,
          objectLockMode: config.s3ObjectLockMode || 'GOVERNANCE',
          storageWormEnabled: config.s3ObjectLockEnabled || false,
        },
      };
    });

    return reply.status(200).send(result);
  });

  // PUT /api/v1/organization - Update tenant profile & regulatory registrations
  fastify.put('/', async (req: FastifyRequest<{ Body: UpdateOrganizationBody }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch before state
      const beforeRes = await client.query('SELECT * FROM organizations WHERE id = $1;', [orgId]);
      if (beforeRes.rows.length === 0) throw new Error('ORGANIZATION_NOT_FOUND');
      const before = beforeRes.rows[0];

      // 2. Fetch actor
      const userRes = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1;', [orgId]);
      const actorId = userRes.rows[0]?.id;

      // 3. Update organization
      const updateSql = `
        UPDATE organizations
        SET name = COALESCE($2, name),
            fda_establishment_id = COALESCE($3, fda_establishment_id),
            iso_certifications = COALESCE($4, iso_certifications),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const updateRes = await client.query(updateSql, [
        orgId,
        body.name || null,
        body.fdaEstablishmentId || null,
        body.isoCertifications ? JSON.stringify(body.isoCertifications) : null,
      ]);
      const updated = updateRes.rows[0];

      // 4. Record tamper-evident audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'organizations',
        entityId: orgId,
        action: 'UPDATE',
        actorId,
        correlationId,
        reasonForChange: 'Updated organization profile and regulatory establishment identifiers',
        beforeState: { name: before.name, fdaEstablishmentId: before.fda_establishment_id },
        afterState: { name: updated.name, fdaEstablishmentId: updated.fda_establishment_id },
      });

      return updated;
    });

    return reply.status(200).send(result);
  });

  // GET /api/v1/organization/retention - Query regulatory retention guidelines
  fastify.get('/retention', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      regulatoryStandard: '21 CFR § 820.180, 21 CFR Part 11, ISO 13485:2016 Clause 4.2.5',
      requiredRetentionYears: config.s3RetentionYears || 10,
      wormObjectLockEnabled: config.s3ObjectLockEnabled || false,
      lockMode: config.s3ObjectLockMode || 'GOVERNANCE',
      description: 'Records shall be retained for a period of time equivalent to design and expected life of the device, but in no case less than 2 years from date of release for commercial distribution (or minimum 10 years for implantable Class III devices).',
    });
  });
}
