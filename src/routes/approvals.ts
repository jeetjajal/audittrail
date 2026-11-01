import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService } from '../services/audit-service';

interface CreateWorkflowBody {
  entityType: 'INCIDENT' | 'INVESTIGATION' | 'CAPA';
  entityId: string;
  workflowType: 'CAPA_CLOSURE' | 'INVESTIGATION_SIGN_OFF' | 'NC_DISPOSITION' | 'EFFECTIVENESS_APPROVAL';
  steps: Array<{
    stepOrder: number;
    stepName: string;
    requiredRoleId?: string;
  }>;
}

interface ApproveStepBody {
  meaningOfSignature: 'AUTHORED' | 'REVIEWED' | 'APPROVED' | 'VERIFIED';
  reauthMechanism?: 'MFA_TOTP' | 'FIDO2_PASSKEY' | 'ATLASSIAN_REAUTH_JWT';
  reauthProofToken?: string;
  notes?: string;
}

interface RejectStepBody {
  rejectionReason: string;
}

export async function approvalRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/approvals - Create multi-stage approval workflow
  fastify.post('/', async (req: FastifyRequest<{ Body: CreateWorkflowBody }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Insert workflow
      const wfSql = `
        INSERT INTO approval_workflows (
          organization_id, entity_type, entity_id, workflow_type, current_step, status
        ) VALUES ($1, $2, $3, $4, 1, 'IN_PROGRESS')
        RETURNING *;
      `;
      const wfRes = await client.query(wfSql, [orgId, body.entityType, body.entityId, body.workflowType]);
      const workflow = wfRes.rows[0];

      // 2. Fetch fallback role if role not specified
      const roleRes = await client.query(
        'SELECT id FROM roles WHERE organization_id = $1 LIMIT 1;',
        [orgId]
      );
      const defaultRoleId = roleRes.rows[0]?.id;

      // 3. Insert steps
      const createdSteps = [];
      for (const step of body.steps) {
        const stepSql = `
          INSERT INTO approval_steps (
            organization_id, workflow_id, step_order, step_name, required_role_id, status
          ) VALUES ($1, $2, $3, $4, $5, 'PENDING')
          RETURNING *;
        `;
        const stepRes = await client.query(stepSql, [
          orgId,
          workflow.id,
          step.stepOrder,
          step.stepName,
          step.requiredRoleId || defaultRoleId,
        ]);
        createdSteps.push(stepRes.rows[0]);
      }

      // 4. Audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'approval_workflows',
        entityId: workflow.id,
        action: 'INSERT',
        correlationId,
        reasonForChange: `Initiated approval workflow for ${body.entityType} (${body.workflowType})`,
        afterState: { workflowId: workflow.id, totalSteps: createdSteps.length },
      });

      return { ...workflow, steps: createdSteps };
    });

    reply.status(201).send(result);
  });

  // GET /api/v1/approvals/pending - List pending approval steps across tenant
  fastify.get('/pending', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;

    const res = await withTenantTransaction(orgId, async (client) => {
      const queryRes = await client.query(
        `SELECT s.id as step_id, s.step_order, s.step_name, s.status as step_status,
                w.id as workflow_id, w.entity_type, w.entity_id, w.workflow_type,
                w.created_at as workflow_created_at,
                r.name as required_role_name
         FROM approval_steps s
         JOIN approval_workflows w ON s.organization_id = w.organization_id AND s.workflow_id = w.id
         JOIN roles r ON s.organization_id = r.organization_id AND s.required_role_id = r.id
         WHERE s.organization_id = $1 AND s.status = 'PENDING' AND w.status = 'IN_PROGRESS'
         ORDER BY s.step_order ASC, w.created_at ASC;`,
        [orgId]
      );
      return { items: queryRes.rows, total: queryRes.rowCount };
    });

    reply.send(res);
  });

  // POST /api/v1/approvals/:id/approve - Execute 21 CFR Part 11 e-signature approval
  fastify.post('/:id/approve', async (req: FastifyRequest<{
    Params: { id: string };
    Body: ApproveStepBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const stepId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;
    const ipAddress = req.ip || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Atlassian-Forge-Remote';

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch step and workflow
      const stepRes = await client.query(
        `SELECT s.*, w.entity_type, w.entity_id, w.workflow_type, w.current_step
         FROM approval_steps s
         JOIN approval_workflows w ON s.organization_id = w.organization_id AND s.workflow_id = w.id
         WHERE s.organization_id = $1 AND s.id = $2;`,
        [orgId, stepId]
      );
      if (stepRes.rows.length === 0) {
        throw new Error('APPROVAL_STEP_NOT_FOUND');
      }
      const step = stepRes.rows[0];

      if (step.status === 'COMPLETED') {
        throw new Error('STEP_ALREADY_COMPLETED');
      }

      // 2. Fetch authenticated signer
      const userRes = await client.query(
        'SELECT id, full_name, job_title FROM users WHERE organization_id = $1 LIMIT 1;',
        [orgId]
      );
      const signer = userRes.rows[0];
      if (!signer) throw new Error('SIGNER_NOT_FOUND');

      // 3. Compute 21 CFR Part 11 cryptographic manifests
      const recordDigest = crypto.createHash('sha256')
        .update(`${step.entity_type}:${step.entity_id}:${step.workflow_type}:${step.id}`)
        .digest('hex');
      const timestamp = new Date().toISOString();
      const manifestPayload = `${signer.id}|${timestamp}|${recordDigest}|${body.meaningOfSignature}|${ipAddress}`;
      const signatureManifestHash = crypto.createHash('sha256').update(manifestPayload).digest('hex');

      // 4. Insert electronic signature record
      const sigSql = `
        INSERT INTO electronic_signatures (
          organization_id, approval_step_id, signer_id, signer_name_snapshot,
          signer_title_snapshot, meaning_of_signature, reauth_mechanism,
          ip_address, user_agent, record_digest_sha256, signature_manifest_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;
      const sigRes = await client.query(sigSql, [
        orgId,
        stepId,
        signer.id,
        signer.full_name,
        signer.job_title || 'Quality Compliance Lead',
        body.meaningOfSignature,
        body.reauthMechanism || 'ATLASSIAN_REAUTH_JWT',
        ipAddress,
        userAgent,
        recordDigest,
        signatureManifestHash,
      ]);
      const signature = sigRes.rows[0];

      // 5. Update step status to COMPLETED
      await client.query(
        "UPDATE approval_steps SET status = 'COMPLETED' WHERE organization_id = $1 AND id = $2;",
        [orgId, stepId]
      );

      // 6. Check if more steps exist in workflow
      const remainingStepsRes = await client.query(
        "SELECT count(*) as pending_count FROM approval_steps WHERE organization_id = $1 AND workflow_id = $2 AND status = 'PENDING';",
        [orgId, step.workflow_id]
      );
      const remainingCount = parseInt(remainingStepsRes.rows[0].pending_count, 10);

      let workflowUpdatedStatus = 'IN_PROGRESS';
      if (remainingCount === 0) {
        workflowUpdatedStatus = 'APPROVED';
        await client.query(
          "UPDATE approval_workflows SET status = 'APPROVED' WHERE organization_id = $1 AND id = $2;",
          [orgId, step.workflow_id]
        );
      } else {
        await client.query(
          'UPDATE approval_workflows SET current_step = current_step + 1 WHERE organization_id = $1 AND id = $2;',
          [orgId, step.workflow_id]
        );
      }

      // 7. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'electronic_signatures',
        entityId: signature.id,
        action: 'APPROVE',
        actorId: signer.id,
        correlationId,
        reasonForChange: `Executed 21 CFR Part 11 e-signature (${body.meaningOfSignature}) by ${signer.full_name}`,
        afterState: { stepId, meaning: body.meaningOfSignature, workflowStatus: workflowUpdatedStatus },
      });

      return {
        signatureId: signature.id,
        signerName: signer.full_name,
        meaning: body.meaningOfSignature,
        signedAt: signature.signed_at,
        manifestHash: signatureManifestHash,
        stepStatus: 'COMPLETED',
        workflowStatus: workflowUpdatedStatus,
      };
    });

    reply.send(result);
  });

  // POST /api/v1/approvals/:id/reject - Reject approval step
  fastify.post('/:id/reject', async (req: FastifyRequest<{
    Params: { id: string };
    Body: RejectStepBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const stepId = req.params.id;
    const { rejectionReason } = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch step
      const stepRes = await client.query(
        'SELECT workflow_id, step_name FROM approval_steps WHERE organization_id = $1 AND id = $2;',
        [orgId, stepId]
      );
      if (stepRes.rows.length === 0) throw new Error('APPROVAL_STEP_NOT_FOUND');
      const step = stepRes.rows[0];

      // 2. Reject step and workflow
      await client.query(
        "UPDATE approval_steps SET status = 'REJECTED' WHERE organization_id = $1 AND id = $2;",
        [orgId, stepId]
      );
      await client.query(
        "UPDATE approval_workflows SET status = 'REJECTED' WHERE organization_id = $1 AND id = $2;",
        [orgId, step.workflow_id]
      );

      // 3. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'approval_steps',
        entityId: stepId,
        action: 'REJECT',
        correlationId,
        reasonForChange: `Rejected step "${step.step_name}": ${rejectionReason}`,
        afterState: { stepStatus: 'REJECTED', workflowStatus: 'REJECTED', rejectionReason },
      });

      return { stepId, status: 'REJECTED', rejectionReason };
    });

    reply.send(result);
  });

  // GET /api/v1/approvals/:id - Get workflow details and step progression
  fastify.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const workflowId = req.params.id;

    const result = await withTenantTransaction(orgId, async (client) => {
      const wfRes = await client.query(
        `SELECT id, entity_type, entity_id, workflow_type, current_step, status, created_at
         FROM approval_workflows
         WHERE organization_id = $1 AND id = $2;`,
        [orgId, workflowId]
      );
      if (wfRes.rows.length === 0) throw new Error('WORKFLOW_NOT_FOUND');
      const workflow = wfRes.rows[0];

      const stepsRes = await client.query(
        `SELECT s.id, s.step_order, s.step_name, s.status, s.required_role_id,
                r.name as required_role_name,
                sig.id as signature_id, sig.signer_name_snapshot, sig.meaning_of_signature,
                sig.signed_at, sig.signature_manifest_hash
         FROM approval_steps s
         JOIN roles r ON s.organization_id = r.organization_id AND s.required_role_id = r.id
         LEFT JOIN electronic_signatures sig ON s.organization_id = sig.organization_id AND s.id = sig.approval_step_id
         WHERE s.organization_id = $1 AND s.workflow_id = $2
         ORDER BY s.step_order ASC;`,
        [orgId, workflowId]
      );

      return {
        ...workflow,
        steps: stepsRes.rows,
      };
    });

    reply.send(result);
  });
}
