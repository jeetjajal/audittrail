import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { withTenantTransaction } from '../middleware/tenant-context';
import { CapaService, CreateCapaActionInput } from '../services/capa-service';
import { AuditService } from '../services/audit-service';

interface CreateCapaBody {
  incidentId?: string;
  investigationId?: string;
  capaType: 'CORRECTIVE' | 'PREVENTIVE';
  title: string;
  problemStatement: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate: string;
}

interface AddActionBody {
  actionNumber: number;
  actionType: 'PROCESS_CHANGE' | 'DMR_REVISION' | 'RETRAINING' | 'SUPPLIER_SCAR' | 'DEVICE_RECALL' | 'DESIGN_CHANGE' | 'SOFTWARE_PATCH';
  description: string;
  assigneeId: string;
  dueDate: string;
  dependsOnActionIds?: string[];
}

interface UpdateActionBody {
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'SUPERSEDED';
  completionNotes?: string;
  verifiedById?: string;
}

interface EffectivenessReviewBody {
  acceptanceCriteria: string;
  reviewPeriodDays?: number;
  scheduledDate: string;
  isEffective?: boolean;
  evidenceSummary?: string;
  unsuccessfulActionPlan?: string;
}

export async function capaRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/capas - Create new CAPA program
  fastify.post('/', async (req: FastifyRequest<{ Body: CreateCapaBody }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Generate formatted CAPA number (e.g. CAPA-2026-0001)
      const countRes = await client.query(
        'SELECT count(*) FROM capas WHERE organization_id = $1;',
        [orgId]
      );
      const seq = parseInt(countRes.rows[0].count, 10) + 1;
      const year = new Date().getFullYear();
      const capaNumber = `CAPA-${year}-${seq.toString().padStart(4, '0')}`;

      // 2. Fetch owner user
      const userRes = await client.query(
        'SELECT id FROM users WHERE organization_id = $1 LIMIT 1;',
        [orgId]
      );
      const ownerId = userRes.rows[0]?.id;
      if (!ownerId) {
        throw new Error('NO_VALID_USER_IN_TENANT');
      }

      // 3. Insert CAPA
      const insertSql = `
        INSERT INTO capas (
          organization_id, capa_number, incident_id, investigation_id, capa_type,
          title, problem_statement, status, risk_level, owner_id, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9, $10)
        RETURNING id, capa_number, title, capa_type, status, risk_level, created_at;
      `;
      const capaRes = await client.query(insertSql, [
        orgId,
        capaNumber,
        body.incidentId || null,
        body.investigationId || null,
        body.capaType,
        body.title,
        body.problemStatement,
        body.riskLevel,
        ownerId,
        body.dueDate,
      ]);
      const capa = capaRes.rows[0];

      // 4. Record atomic audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'capas',
        entityId: capa.id,
        action: 'INSERT',
        actorId: ownerId,
        correlationId,
        reasonForChange: 'Initiation of corrective and preventive action program',
        afterState: { capaNumber, status: 'OPEN', riskLevel: body.riskLevel },
      });

      return capa;
    });

    reply.status(201).send(result);
  });

  // GET /api/v1/capas - List CAPAs with filtering
  fastify.get('/', async (req: FastifyRequest<{
    Querystring: { status?: string; riskLevel?: string; limit?: string; offset?: string }
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const { status, riskLevel, limit = '50', offset = '0' } = req.query;

    const res = await withTenantTransaction(orgId, async (client) => {
      let query = `
        SELECT c.id, c.capa_number, c.title, c.capa_type, c.status, c.risk_level,
               c.due_date, c.created_at, c.closed_at,
               u.full_name as owner_name, u.email as owner_email,
               i.incident_number, i.title as incident_title
        FROM capas c
        JOIN users u ON c.organization_id = u.organization_id AND c.owner_id = u.id
        LEFT JOIN incidents i ON c.organization_id = i.organization_id AND c.incident_id = i.id
        WHERE c.organization_id = $1
      `;
      const params: unknown[] = [orgId];

      if (status) {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
      }
      if (riskLevel) {
        params.push(riskLevel);
        query += ` AND c.risk_level = $${params.length}`;
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const queryRes = await client.query(query, params);
      return { items: queryRes.rows, total: queryRes.rowCount };
    });

    reply.send(res);
  });

  // GET /api/v1/capas/:id - Get full CAPA details
  fastify.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const capaId = req.params.id;

    const capaData = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch CAPA base
      const capaRes = await client.query(
        `SELECT c.*, u.full_name as owner_name, u.email as owner_email,
                i.incident_number, i.title as incident_title, i.severity as incident_severity
         FROM capas c
         JOIN users u ON c.organization_id = u.organization_id AND c.owner_id = u.id
         LEFT JOIN incidents i ON c.organization_id = i.organization_id AND c.incident_id = i.id
         WHERE c.organization_id = $1 AND c.id = $2;`,
        [orgId, capaId]
      );

      if (capaRes.rows.length === 0) {
        return null;
      }
      const capa = capaRes.rows[0];

      // 2. Fetch actions with assignees
      const actRes = await client.query(
        `SELECT a.*, u.full_name as assignee_name, ver.full_name as verified_by_name
         FROM capa_actions a
         JOIN users u ON a.organization_id = u.organization_id AND a.assignee_id = u.id
         LEFT JOIN users ver ON a.organization_id = ver.organization_id AND a.verified_by_id = ver.id
         WHERE a.organization_id = $1 AND a.capa_id = $2
         ORDER BY a.action_number ASC;`,
        [orgId, capaId]
      );

      // 3. Fetch action dependencies
      const depRes = await client.query(
        `SELECT d.action_id, d.depends_on_action_id,
                a1.action_number as action_number,
                a2.action_number as depends_on_action_number
         FROM capa_action_dependencies d
         JOIN capa_actions a1 ON d.organization_id = a1.organization_id AND d.action_id = a1.id
         JOIN capa_actions a2 ON d.organization_id = a2.organization_id AND d.depends_on_action_id = a2.id
         WHERE d.organization_id = $1 AND a1.capa_id = $2;`,
        [orgId, capaId]
      );

      // 4. Fetch effectiveness reviews
      const effRes = await client.query(
        `SELECT er.*, u.full_name as evaluator_name
         FROM capa_effectiveness_reviews er
         LEFT JOIN users u ON er.organization_id = u.organization_id AND er.evaluator_id = u.id
         WHERE er.organization_id = $1 AND er.capa_id = $2
         ORDER BY er.scheduled_date DESC;`,
        [orgId, capaId]
      );

      return {
        ...capa,
        actions: actRes.rows,
        dependencies: depRes.rows,
        effectivenessReviews: effRes.rows,
      };
    });

    if (!capaData) {
      return reply.status(404).send({ error: 'CAPA_NOT_FOUND', message: 'CAPA record not found' });
    }

    reply.send(capaData);
  });

  // POST /api/v1/capas/:id/actions - Add Action with DAG Dependency Validation
  fastify.post('/:id/actions', async (req: FastifyRequest<{ Params: { id: string }; Body: AddActionBody }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const capaId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;

    const actionInput: CreateCapaActionInput = {
      organizationId: orgId,
      capaId,
      actionNumber: body.actionNumber,
      actionType: body.actionType,
      description: body.description,
      assigneeId: body.assigneeId,
      dueDate: body.dueDate,
      dependsOnActionIds: body.dependsOnActionIds,
    };

    const actionId = await withTenantTransaction(orgId, async (client) => {
      const userRes = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1;', [orgId]);
      const actorId = userRes.rows[0]?.id;

      return await CapaService.addCapaAction(client, actionInput, actorId, correlationId);
    });

    reply.status(201).send({ actionId, status: 'PENDING' });
  });

  // PATCH /api/v1/capas/actions/:actionId - Update action status/completion
  fastify.patch('/actions/:actionId', async (req: FastifyRequest<{
    Params: { actionId: string };
    Body: UpdateActionBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const actionId = req.params.actionId;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch current action
      const actRes = await client.query(
        'SELECT * FROM capa_actions WHERE organization_id = $1 AND id = $2;',
        [orgId, actionId]
      );
      if (actRes.rows.length === 0) {
        throw new Error('CAPA_ACTION_NOT_FOUND');
      }
      const before = actRes.rows[0];

      // 2. Build updates
      const updates: string[] = [];
      const values: unknown[] = [orgId, actionId];

      if (body.status !== undefined) {
        values.push(body.status);
        updates.push(`status = $${values.length}`);
        if (body.status === 'COMPLETED') {
          updates.push('completed_at = CURRENT_TIMESTAMP');
        } else if (body.status === 'VERIFIED') {
          updates.push('verified_at = CURRENT_TIMESTAMP');
          if (body.verifiedById) {
            values.push(body.verifiedById);
            updates.push(`verified_by_id = $${values.length}`);
          }
        }
      }
      if (body.completionNotes !== undefined) {
        values.push(body.completionNotes);
        updates.push(`completion_notes = $${values.length}`);
      }

      if (updates.length === 0) {
        return before;
      }

      const updateSql = `
        UPDATE capa_actions
        SET ${updates.join(', ')}
        WHERE organization_id = $1 AND id = $2
        RETURNING *;
      `;
      const updateRes = await client.query(updateSql, values);
      const after = updateRes.rows[0];

      // 3. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'capa_actions',
        entityId: actionId,
        action: 'UPDATE',
        correlationId,
        reasonForChange: `Updated action ${before.action_number} status to ${after.status}`,
        beforeState: { status: before.status, completionNotes: before.completion_notes },
        afterState: { status: after.status, completionNotes: after.completion_notes },
      });

      return after;
    });

    reply.send(result);
  });

  // POST /api/v1/capas/:id/effectiveness-review - Conduct or schedule effectiveness review
  fastify.post('/:id/effectiveness-review', async (req: FastifyRequest<{
    Params: { id: string };
    Body: EffectivenessReviewBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const capaId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch user as evaluator
      const userRes = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1;', [orgId]);
      const evaluatorId = userRes.rows[0]?.id;

      // 2. Insert effectiveness review record
      const evaluatedAt = body.isEffective !== undefined ? 'CURRENT_TIMESTAMP' : 'NULL';
      const insertSql = `
        INSERT INTO capa_effectiveness_reviews (
          organization_id, capa_id, review_period_days, acceptance_criteria, scheduled_date,
          evaluated_at, evaluator_id, is_effective, evidence_summary, unsuccessful_action_plan
        ) VALUES (
          $1, $2, $3, $4, $5,
          ${body.isEffective !== undefined ? 'CURRENT_TIMESTAMP' : 'NULL'},
          $6, $7, $8, $9
        )
        RETURNING *;
      `;
      const effRes = await client.query(insertSql, [
        orgId,
        capaId,
        body.reviewPeriodDays || 90,
        body.acceptanceCriteria,
        body.scheduledDate,
        body.isEffective !== undefined ? evaluatorId : null,
        body.isEffective !== undefined ? body.isEffective : null,
        body.evidenceSummary || null,
        body.unsuccessfulActionPlan || null,
      ]);
      const review = effRes.rows[0];

      // 3. Update CAPA status to EFFECTIVENESS_REVIEW if currently in implementation
      await client.query(
        `UPDATE capas SET status = 'EFFECTIVENESS_REVIEW'
         WHERE organization_id = $1 AND id = $2 AND status IN ('OPEN', 'ACTION_PLANNING', 'IMPLEMENTATION');`,
        [orgId, capaId]
      );

      // 4. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'capa_effectiveness_reviews',
        entityId: review.id,
        action: 'INSERT',
        actorId: evaluatorId,
        correlationId,
        reasonForChange: `Recorded CAPA effectiveness review: is_effective=${body.isEffective}`,
        afterState: { capaId, isEffective: body.isEffective, scheduledDate: body.scheduledDate },
      });

      return review;
    });

    reply.status(201).send(result);
  });

  // POST /api/v1/capas/:id/close - Close CAPA with full validation gating
  fastify.post('/:id/close', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const capaId = req.params.id;
    const correlationId = req.correlationId;

    await withTenantTransaction(orgId, async (client) => {
      // 1. Validate all gating requirements
      await CapaService.validateCapaClosure(client, orgId, capaId);

      // 2. Fetch actor
      const userRes = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1;', [orgId]);
      const actorId = userRes.rows[0]?.id;

      // 3. Update CAPA status to CLOSED
      await client.query(
        `UPDATE capas 
         SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = $1 AND id = $2;`,
        [orgId, capaId]
      );

      // 4. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'capas',
        entityId: capaId,
        action: 'STATUS_CHANGE',
        actorId,
        correlationId,
        reasonForChange: 'All corrective actions verified and effectiveness confirmed positive',
        afterState: { status: 'CLOSED' },
      });
    });

    reply.send({ capaId, status: 'CLOSED', message: 'CAPA successfully closed' });
  });
}
