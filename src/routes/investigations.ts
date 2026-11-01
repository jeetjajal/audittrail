import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService } from '../services/audit-service';

interface AddRootCauseBody {
  statement: string;
  category: string;
  verificationMethod: string;
  isVerified?: boolean;
}

interface AddFiveWhysBody {
  stepNumber: number;
  whyQuestion: string;
  answer: string;
  evidenceDocumentId?: string;
}

interface AddFishboneBody {
  category: 'MAN' | 'MACHINE' | 'MATERIAL' | 'METHOD' | 'MEASUREMENT' | 'ENVIRONMENT';
  factor: string;
  isPrimaryCause?: boolean;
  notes?: string;
}

export async function investigationRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/investigations/:id - Get full investigation workspace
  fastify.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const invId = req.params.id;

    const data = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch investigation base
      const invRes = await client.query(
        `SELECT inv.*, u.full_name as lead_investigator_name, u.email as lead_investigator_email,
                i.incident_number, i.title as incident_title, i.severity as incident_severity
         FROM investigations inv
         JOIN users u ON inv.organization_id = u.organization_id AND inv.lead_investigator_id = u.id
         JOIN incidents i ON inv.organization_id = i.organization_id AND inv.incident_id = i.id
         WHERE inv.organization_id = $1 AND inv.id = $2;`,
        [orgId, invId]
      );

      if (invRes.rows.length === 0) {
        return null;
      }
      const investigation = invRes.rows[0];

      // 2. Fetch 5-Whys steps
      const whysRes = await client.query(
        `SELECT id, step_number, why_question, answer, evidence_document_id, created_at
         FROM rca_five_whys
         WHERE organization_id = $1 AND investigation_id = $2
         ORDER BY step_number ASC;`,
        [orgId, invId]
      );

      // 3. Fetch Fishbone nodes
      const fishboneRes = await client.query(
        `SELECT id, category, factor, is_primary_cause, notes, created_at
         FROM rca_fishbone_nodes
         WHERE organization_id = $1 AND investigation_id = $2
         ORDER BY created_at ASC;`,
        [orgId, invId]
      );

      // 4. Fetch Root Causes
      const causesRes = await client.query(
        `SELECT rc.*, u.full_name as verified_by_name
         FROM root_causes rc
         LEFT JOIN users u ON rc.organization_id = u.organization_id AND rc.verified_by_id = u.id
         WHERE rc.organization_id = $1 AND rc.investigation_id = $2
         ORDER BY rc.created_at ASC;`,
        [orgId, invId]
      );

      return {
        ...investigation,
        fiveWhys: whysRes.rows,
        fishboneNodes: fishboneRes.rows,
        rootCauses: causesRes.rows,
      };
    });

    if (!data) {
      return reply.status(404).send({ error: 'INVESTIGATION_NOT_FOUND', message: 'Investigation not found' });
    }

    reply.send(data);
  });

  // POST /api/v1/investigations/:id/root-causes - Add root cause
  fastify.post('/:id/root-causes', async (req: FastifyRequest<{
    Params: { id: string };
    Body: AddRootCauseBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const invId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Verify investigation exists
      const invRes = await client.query(
        'SELECT id, incident_id FROM investigations WHERE organization_id = $1 AND id = $2;',
        [orgId, invId]
      );
      if (invRes.rows.length === 0) {
        throw new Error('INVESTIGATION_NOT_FOUND');
      }

      // 2. Insert root cause
      const insertSql = `
        INSERT INTO root_causes (
          organization_id, investigation_id, statement, category, verification_method, is_verified
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const rcRes = await client.query(insertSql, [
        orgId,
        invId,
        body.statement,
        body.category,
        body.verificationMethod,
        body.isVerified || false,
      ]);
      const rootCause = rcRes.rows[0];

      // 3. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'root_causes',
        entityId: rootCause.id,
        action: 'INSERT',
        correlationId,
        reasonForChange: `Added root cause statement in category ${body.category}`,
        afterState: { statement: body.statement, category: body.category, isVerified: body.isVerified || false },
      });

      return rootCause;
    });

    reply.status(201).send(result);
  });

  // POST /api/v1/investigations/:id/five-whys - Add 5-Whys step
  fastify.post('/:id/five-whys', async (req: FastifyRequest<{
    Params: { id: string };
    Body: AddFiveWhysBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const invId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      const insertSql = `
        INSERT INTO rca_five_whys (
          organization_id, investigation_id, step_number, why_question, answer, evidence_document_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (organization_id, investigation_id, step_number) DO UPDATE
        SET why_question = EXCLUDED.why_question, answer = EXCLUDED.answer, evidence_document_id = EXCLUDED.evidence_document_id
        RETURNING *;
      `;
      const res = await client.query(insertSql, [
        orgId,
        invId,
        body.stepNumber,
        body.whyQuestion,
        body.answer,
        body.evidenceDocumentId || null,
      ]);

      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'rca_five_whys',
        entityId: res.rows[0].id,
        action: 'INSERT',
        correlationId,
        reasonForChange: `Recorded 5-Whys analysis step ${body.stepNumber}`,
        afterState: { stepNumber: body.stepNumber, whyQuestion: body.whyQuestion },
      });

      return res.rows[0];
    });

    reply.status(201).send(result);
  });

  // POST /api/v1/investigations/:id/fishbone - Add Ishikawa 6M fishbone node
  fastify.post('/:id/fishbone', async (req: FastifyRequest<{
    Params: { id: string };
    Body: AddFishboneBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const invId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      const insertSql = `
        INSERT INTO rca_fishbone_nodes (
          organization_id, investigation_id, category, factor, is_primary_cause, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const res = await client.query(insertSql, [
        orgId,
        invId,
        body.category,
        body.factor,
        body.isPrimaryCause || false,
        body.notes || null,
      ]);

      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'rca_fishbone_nodes',
        entityId: res.rows[0].id,
        action: 'INSERT',
        correlationId,
        reasonForChange: `Added Ishikawa fishbone factor under ${body.category}`,
        afterState: { category: body.category, factor: body.factor, isPrimaryCause: body.isPrimaryCause || false },
      });

      return res.rows[0];
    });

    reply.status(201).send(result);
  });
}
