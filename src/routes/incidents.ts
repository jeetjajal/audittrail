import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService } from '../services/audit-service';

interface CreateIncidentBody {
  title: string;
  description: string;
  source: 'INTERNAL_AUDIT' | 'CUSTOMER_COMPLAINT' | 'PRODUCTION_LINE' | 'SUPPLIER_NC' | 'SERVICE_REPORT' | 'CLINICAL_TRIAL';
  severity: 'NEGLIGIBLE' | 'MINOR' | 'MAJOR' | 'CRITICAL';
  occurrenceDate: string;
  isMdrReportable?: boolean;
  mdrRationale?: string;
  patientImpactLevel?: 'NO_PATIENT_IMPACT' | 'MINOR_INJURY_TRANSIENT' | 'SERIOUS_INJURY_REVERSIBLE' | 'LIFE_THREATENING_PERMANENT' | 'DEATH';
  rpnScore?: number;
  jiraIssueKey?: string;
  devices?: Array<{
    deviceId: string;
    lotId?: string;
    unitId?: string;
    quantityAffected?: number;
  }>;
}

interface UpdateIncidentBody {
  title?: string;
  description?: string;
  severity?: 'NEGLIGIBLE' | 'MINOR' | 'MAJOR' | 'CRITICAL';
  rpnScore?: number;
  isMdrReportable?: boolean;
  mdrRationale?: string;
  patientImpactLevel?: 'NO_PATIENT_IMPACT' | 'MINOR_INJURY_TRANSIENT' | 'SERIOUS_INJURY_REVERSIBLE' | 'LIFE_THREATENING_PERMANENT' | 'DEATH';
  reasonForChange?: string;
}

interface AssignIncidentBody {
  assignedToUserId: string;
  notes?: string;
}

interface TransitionIncidentBody {
  toStatus: 'DRAFT' | 'SUBMITTED' | 'TRIAGED' | 'CONTAINMENT_ACTIVE' | 'INVESTIGATING' | 'RCA_REVIEW' | 'CAPA_EVALUATION' | 'CAPA_PENDING' | 'APPROVAL_PENDING' | 'CLOSED' | 'REOPENED' | 'CANCELLED';
  reasonForChange: string;
}

interface CreateInvestigationBody {
  leadInvestigatorId?: string;
  methodology?: 'FIVE_WHYS' | 'FISHBONE' | 'HYBRID' | 'FAULT_TREE';
  summary?: string;
  containmentActions?: string;
}

export async function incidentRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/incidents - Create new incident
  fastify.post('/', async (req: FastifyRequest<{ Body: CreateIncidentBody }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Generate human-readable incident number (e.g. INC-2026-0001)
      const countRes = await client.query(
        'SELECT count(*) FROM incidents WHERE organization_id = $1;',
        [orgId]
      );
      const incSeq = parseInt(countRes.rows[0].count, 10) + 1;
      const year = new Date().getFullYear();
      const incNumber = `INC-${year}-${incSeq.toString().padStart(4, '0')}`;

      // 2. Fetch or resolve reporter ID from users
      const userRes = await client.query(
        'SELECT id FROM users WHERE organization_id = $1 LIMIT 1;',
        [orgId]
      );
      const reporterId = userRes.rows[0]?.id;
      if (!reporterId) {
        throw new Error('NO_VALID_USER_IN_TENANT');
      }

      // 3. Insert incident
      const insertSql = `
        INSERT INTO incidents (
          organization_id, incident_number, title, description, source, severity, status,
          reported_by_id, occurrence_date, is_mdr_reportable, mdr_reportability_rationale,
          patient_impact_level, rpn_score, jira_issue_key
        ) VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, incident_number, title, severity, status, created_at;
      `;
      const incRes = await client.query(insertSql, [
        orgId,
        incNumber,
        body.title,
        body.description,
        body.source,
        body.severity,
        reporterId,
        body.occurrenceDate || new Date().toISOString(),
        body.isMdrReportable || false,
        body.mdrRationale || null,
        body.patientImpactLevel || 'NO_PATIENT_IMPACT',
        body.rpnScore || null,
        body.jiraIssueKey || null,
      ]);
      const incident = incRes.rows[0];

      // 4. Insert linked devices
      if (body.devices && body.devices.length > 0) {
        for (const dev of body.devices) {
          await client.query(
            `INSERT INTO incident_devices (
               organization_id, incident_id, device_id, lot_id, unit_id, quantity_affected
             ) VALUES ($1, $2, $3, $4, $5, $6);`,
            [orgId, incident.id, dev.deviceId, dev.lotId || null, dev.unitId || null, dev.quantityAffected || 1]
          );
        }
      }

      // 5. Initial status history record
      await client.query(
        `INSERT INTO incident_status_history (
           organization_id, incident_id, from_status, to_status, changed_by_id, reason_for_change
         ) VALUES ($1, $2, 'DRAFT', 'SUBMITTED', $3, 'Initial Incident Intake Submission');`,
        [orgId, incident.id, reporterId]
      );

      // 6. Record atomic audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'incidents',
        entityId: incident.id,
        action: 'INSERT',
        actorId: reporterId,
        correlationId,
        reasonForChange: 'Initial clinical non-conformance intake',
        afterState: { incidentNumber: incNumber, severity: body.severity, status: 'SUBMITTED' },
      });

      return incident;
    });

    reply.status(201).send({
      incidentId: result.id,
      incidentNumber: result.incident_number,
      title: result.title,
      severity: result.severity,
      status: result.status,
      createdAt: result.created_at,
    });
  });

  // GET /api/v1/incidents - List incidents with filtering
  fastify.get('/', async (req: FastifyRequest<{
    Querystring: { status?: string; severity?: string; limit?: string; offset?: string }
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const { status, severity, limit = '50', offset = '0' } = req.query;

    const res = await withTenantTransaction(orgId, async (client) => {
      let query = `
        SELECT i.id, i.incident_number, i.title, i.severity, i.status, i.source,
               i.occurrence_date, i.is_mdr_reportable, i.rpn_score, i.jira_issue_key,
               i.created_at, u.full_name as reported_by_name,
               assignee.full_name as assigned_to_name
        FROM incidents i
        LEFT JOIN users u ON i.organization_id = u.organization_id AND i.reported_by_id = u.id
        LEFT JOIN users assignee ON i.organization_id = assignee.organization_id AND i.assigned_to_id = assignee.id
        WHERE i.organization_id = $1
      `;
      const params: unknown[] = [orgId];

      if (status) {
        params.push(status);
        query += ` AND i.status = $${params.length}`;
      }
      if (severity) {
        params.push(severity);
        query += ` AND i.severity = $${params.length}`;
      }

      query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const result = await client.query(query, params);
      return { items: result.rows, total: result.rowCount };
    });

    reply.send(res);
  });

  // GET /api/v1/incidents/:id - Get full incident details
  fastify.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const incidentId = req.params.id;

    const incidentData = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch incident base
      const incRes = await client.query(
        `SELECT i.*, u.full_name as reported_by_name, u.email as reported_by_email,
                assignee.full_name as assigned_to_name, assignee.email as assigned_to_email
         FROM incidents i
         LEFT JOIN users u ON i.organization_id = u.organization_id AND i.reported_by_id = u.id
         LEFT JOIN users assignee ON i.organization_id = assignee.organization_id AND i.assigned_to_id = assignee.id
         WHERE i.organization_id = $1 AND i.id = $2;`,
        [orgId, incidentId]
      );

      if (incRes.rows.length === 0) {
        return null;
      }
      const incident = incRes.rows[0];

      // 2. Fetch linked devices
      const devRes = await client.query(
        `SELECT id.id, id.quantity_affected, md.id as device_id, md.model_number as device_model,
                md.device_name, md.udi_di, md.fda_risk_class as classification,
                dl.id as lot_id, dl.lot_batch_number as lot_number, dl.expiry_date as expiration_date,
                du.id as unit_id, du.serial_number, du.current_status as current_quarantine_status
         FROM incident_devices id
         JOIN medical_devices md ON id.organization_id = md.organization_id AND id.device_id = md.id
         LEFT JOIN device_lots dl ON id.organization_id = dl.organization_id AND id.lot_id = dl.id
         LEFT JOIN device_units du ON id.organization_id = du.organization_id AND id.unit_id = du.id
         WHERE id.organization_id = $1 AND id.incident_id = $2;`,
        [orgId, incidentId]
      );

      // 3. Fetch status history
      const histRes = await client.query(
        `SELECT h.id, h.from_status, h.to_status, h.reason_for_change, h.created_at,
                u.full_name as changed_by_name
         FROM incident_status_history h
         JOIN users u ON h.organization_id = u.organization_id AND h.changed_by_id = u.id
         WHERE h.organization_id = $1 AND h.incident_id = $2
         ORDER BY h.created_at ASC;`,
        [orgId, incidentId]
      );

      // 4. Fetch quarantine records
      const quarRes = await client.query(
        `SELECT q.*, dl.lot_batch_number as lot_number, u.full_name as quarantined_by_name
         FROM quarantine_records q
         JOIN device_lots dl ON q.organization_id = dl.organization_id AND q.lot_id = dl.id
         JOIN users u ON q.organization_id = u.organization_id AND q.quarantined_by_id = u.id
         WHERE q.organization_id = $1 AND q.incident_id = $2;`,
        [orgId, incidentId]
      );

      // 5. Fetch linked investigations
      const invRes = await client.query(
        `SELECT inv.*, u.full_name as lead_investigator_name
         FROM investigations inv
         JOIN users u ON inv.organization_id = u.organization_id AND inv.lead_investigator_id = u.id
         WHERE inv.organization_id = $1 AND inv.incident_id = $2;`,
        [orgId, incidentId]
      );

      return {
        ...incident,
        devices: devRes.rows,
        statusHistory: histRes.rows,
        quarantineRecords: quarRes.rows,
        investigations: invRes.rows,
      };
    });

    if (!incidentData) {
      return reply.status(404).send({ error: 'INCIDENT_NOT_FOUND', message: 'Incident not found' });
    }

    reply.send(incidentData);
  });

  // PATCH /api/v1/incidents/:id - Update incident details
  fastify.patch('/:id', async (req: FastifyRequest<{
    Params: { id: string };
    Body: UpdateIncidentBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const incidentId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch before state
      const beforeRes = await client.query(
        'SELECT * FROM incidents WHERE organization_id = $1 AND id = $2;',
        [orgId, incidentId]
      );
      if (beforeRes.rows.length === 0) {
        throw new Error('INCIDENT_NOT_FOUND');
      }
      const before = beforeRes.rows[0];

      // 2. Build dynamic update
      const updates: string[] = [];
      const values: unknown[] = [orgId, incidentId];

      if (body.title !== undefined) {
        values.push(body.title);
        updates.push(`title = $${values.length}`);
      }
      if (body.description !== undefined) {
        values.push(body.description);
        updates.push(`description = $${values.length}`);
      }
      if (body.severity !== undefined) {
        values.push(body.severity);
        updates.push(`severity = $${values.length}`);
      }
      if (body.rpnScore !== undefined) {
        values.push(body.rpnScore);
        updates.push(`rpn_score = $${values.length}`);
      }
      if (body.isMdrReportable !== undefined) {
        values.push(body.isMdrReportable);
        updates.push(`is_mdr_reportable = $${values.length}`);
      }
      if (body.mdrRationale !== undefined) {
        values.push(body.mdrRationale);
        updates.push(`mdr_reportability_rationale = $${values.length}`);
      }
      if (body.patientImpactLevel !== undefined) {
        values.push(body.patientImpactLevel);
        updates.push(`patient_impact_level = $${values.length}`);
      }

      if (updates.length === 0) {
        return before;
      }

      const updateSql = `
        UPDATE incidents
        SET ${updates.join(', ')}
        WHERE organization_id = $1 AND id = $2
        RETURNING *;
      `;
      const updateRes = await client.query(updateSql, values);
      const after = updateRes.rows[0];

      // 3. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'incidents',
        entityId: incidentId,
        action: 'UPDATE',
        correlationId,
        reasonForChange: body.reasonForChange || 'Incident field updates',
        beforeState: { title: before.title, severity: before.severity, rpn: before.rpn_score },
        afterState: { title: after.title, severity: after.severity, rpn: after.rpn_score },
      });

      return after;
    });

    reply.send(result);
  });

  // POST /api/v1/incidents/:id/assign - Assign investigator/owner
  fastify.post('/:id/assign', async (req: FastifyRequest<{
    Params: { id: string };
    Body: AssignIncidentBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const incidentId = req.params.id;
    const { assignedToUserId, notes } = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Verify user exists in tenant
      const userRes = await client.query(
        'SELECT id, full_name, email FROM users WHERE organization_id = $1 AND id = $2;',
        [orgId, assignedToUserId]
      );
      if (userRes.rows.length === 0) {
        throw new Error('ASSIGNEE_NOT_FOUND');
      }
      const assignee = userRes.rows[0];

      // 2. Update assignment
      const updateRes = await client.query(
        `UPDATE incidents
         SET assigned_to_id = $3
         WHERE organization_id = $1 AND id = $2
         RETURNING id, incident_number, assigned_to_id;`,
        [orgId, incidentId, assignedToUserId]
      );
      if (updateRes.rows.length === 0) {
        throw new Error('INCIDENT_NOT_FOUND');
      }

      // 3. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'incidents',
        entityId: incidentId,
        action: 'UPDATE',
        correlationId,
        reasonForChange: `Assigned incident to ${assignee.full_name}: ${notes || 'Quality investigation assignment'}`,
        afterState: { assignedToUserId, assigneeName: assignee.full_name },
      });

      return { ...updateRes.rows[0], assignee };
    });

    reply.send(result);
  });

  // POST /api/v1/incidents/:id/transition - Formal status transition
  fastify.post('/:id/transition', async (req: FastifyRequest<{
    Params: { id: string };
    Body: TransitionIncidentBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const incidentId = req.params.id;
    const { toStatus, reasonForChange } = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch current status
      const incRes = await client.query(
        'SELECT status, reported_by_id FROM incidents WHERE organization_id = $1 AND id = $2;',
        [orgId, incidentId]
      );
      if (incRes.rows.length === 0) {
        throw new Error('INCIDENT_NOT_FOUND');
      }
      const fromStatus = incRes.rows[0].status;

      // 2. Fetch actor
      const userRes = await client.query(
        'SELECT id FROM users WHERE organization_id = $1 LIMIT 1;',
        [orgId]
      );
      const actorId = userRes.rows[0]?.id;

      // 3. Update status
      const updateRes = await client.query(
        `UPDATE incidents
         SET status = $3, closed_at = CASE WHEN $3 = 'CLOSED' THEN CURRENT_TIMESTAMP ELSE closed_at END
         WHERE organization_id = $1 AND id = $2
         RETURNING id, incident_number, status, closed_at;`,
        [orgId, incidentId, toStatus]
      );

      // 4. Record status history
      await client.query(
        `INSERT INTO incident_status_history (
           organization_id, incident_id, from_status, to_status, changed_by_id, reason_for_change
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [orgId, incidentId, fromStatus, toStatus, actorId, reasonForChange]
      );

      // 5. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'incidents',
        entityId: incidentId,
        action: 'STATUS_CHANGE',
        actorId,
        correlationId,
        reasonForChange,
        beforeState: { status: fromStatus },
        afterState: { status: toStatus },
      });

      return updateRes.rows[0];
    });

    reply.send(result);
  });

  // POST /api/v1/incidents/:id/investigations - Start investigation
  fastify.post('/:id/investigations', async (req: FastifyRequest<{
    Params: { id: string };
    Body: CreateInvestigationBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const incidentId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Verify incident exists
      const incRes = await client.query(
        'SELECT id, incident_number FROM incidents WHERE organization_id = $1 AND id = $2;',
        [orgId, incidentId]
      );
      if (incRes.rows.length === 0) {
        throw new Error('INCIDENT_NOT_FOUND');
      }

      // 2. Resolve lead investigator
      let leadId = body.leadInvestigatorId;
      if (!leadId) {
        const userRes = await client.query(
          'SELECT id FROM users WHERE organization_id = $1 LIMIT 1;',
          [orgId]
        );
        leadId = userRes.rows[0]?.id;
      }

      // 3. Insert investigation
      const insertSql = `
        INSERT INTO investigations (
          organization_id, incident_id, lead_investigator_id, methodology, summary, containment_actions, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'IN_PROGRESS')
        ON CONFLICT (organization_id, incident_id) DO UPDATE
        SET methodology = EXCLUDED.methodology, summary = EXCLUDED.summary, containment_actions = EXCLUDED.containment_actions
        RETURNING *;
      `;
      const invRes = await client.query(insertSql, [
        orgId,
        incidentId,
        leadId,
        body.methodology || 'HYBRID',
        body.summary || 'Formal Root Cause Analysis initiated.',
        body.containmentActions || null,
      ]);
      const investigation = invRes.rows[0];

      // 4. Update incident status to INVESTIGATING if currently SUBMITTED
      await client.query(
        `UPDATE incidents SET status = 'INVESTIGATING'
         WHERE organization_id = $1 AND id = $2 AND status IN ('SUBMITTED', 'TRIAGED', 'CONTAINMENT_ACTIVE');`,
        [orgId, incidentId]
      );

      // 5. Audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'investigations',
        entityId: investigation.id,
        action: 'INSERT',
        actorId: leadId,
        correlationId,
        reasonForChange: `Initiated root cause investigation (${body.methodology || 'HYBRID'})`,
        afterState: { incidentId, methodology: body.methodology || 'HYBRID', status: 'IN_PROGRESS' },
      });

      return investigation;
    });

    reply.status(201).send(result);
  });

  // GET /api/v1/incidents/:id/evidence - Get linked evidence documents
  fastify.get('/:id/evidence', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const incidentId = req.params.id;

    const res = await withTenantTransaction(orgId, async (client) => {
      const queryRes = await client.query(
        `SELECT d.id as document_id, d.document_code, d.title, d.classification,
                dv.id as version_id, dv.version_number, dv.file_name, dv.storage_s3_uri,
                dv.sha256_checksum, dv.mime_type, dv.file_size_bytes, dv.virus_scan_status,
                dv.uploaded_by_id, dv.created_at as uploaded_at,
                ea.id as attachment_id, ea.entity_type
         FROM entity_attachments ea
         JOIN documents d ON ea.organization_id = d.organization_id AND ea.document_id = d.id
         JOIN document_versions dv ON d.organization_id = dv.organization_id AND d.current_version_id = dv.id
         WHERE ea.organization_id = $1 AND ea.entity_id = $2 AND ea.entity_type = 'INCIDENT'
         ORDER BY dv.created_at DESC;`,
        [orgId, incidentId]
      );
      return { items: queryRes.rows };
    });

    reply.send(res);
  });
}
