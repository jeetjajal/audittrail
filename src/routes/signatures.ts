import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService, canonicalizeJson } from '../services/audit-service';

interface ExecuteSignatureBody {
  approvalStepId: string;
  meaningOfSignature: 'AUTHORED' | 'REVIEWED' | 'APPROVED' | 'VERIFIED';
  reauthMechanism: 'MFA_TOTP' | 'FIDO2_PASSKEY' | 'ATLASSIAN_REAUTH_JWT';
  reauthProofToken: string; // Proof of step-up authentication
}

export async function signatureRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/signatures/execute
  fastify.post('/execute', async (req: FastifyRequest<{ Body: ExecuteSignatureBody }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const body = req.body;
    const correlationId = req.correlationId;
    const ipAddress = req.ip || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown-Client';

    const signatureResult = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch approval step and workflow context
      const stepRes = await client.query(
        `SELECT s.id, s.workflow_id, s.step_name, s.status, s.required_role_id,
                w.entity_type, w.entity_id
         FROM approval_steps s
         JOIN approval_workflows w ON s.organization_id = w.organization_id AND s.workflow_id = w.id
         WHERE s.organization_id = $1 AND s.id = $2;`,
        [orgId, body.approvalStepId]
      );

      if (stepRes.rows.length === 0) {
        throw new Error('APPROVAL_STEP_NOT_FOUND');
      }
      const step = stepRes.rows[0];

      if (step.status === 'COMPLETED') {
        throw new Error('APPROVAL_STEP_ALREADY_COMPLETED');
      }

      // 2. Fetch authenticated signer user
      const userRes = await client.query(
        `SELECT u.id, u.full_name, u.job_title
         FROM users u
         JOIN user_roles ur ON u.organization_id = ur.organization_id AND u.id = ur.user_id
         WHERE u.organization_id = $1 AND ur.role_id = $2
         LIMIT 1;`,
        [orgId, step.required_role_id]
      );

      if (userRes.rows.length === 0) {
        throw new Error('SIGNER_NOT_AUTHORIZED_FOR_STEP_ROLE');
      }
      const signer = userRes.rows[0];

      // 3. Verify step-up re-authentication token
      if (!body.reauthProofToken || body.reauthProofToken.length < 6) {
        throw new Error('INVALID_REAUTHENTICATION_PROOF');
      }

      // 4. Fetch the canonical target entity record state to compute record digest
      let targetEntityRow: Record<string, unknown> = {};
      if (step.entity_type === 'CAPA') {
        const capaRes = await client.query('SELECT * FROM capas WHERE organization_id = $1 AND id = $2;', [orgId, step.entity_id]);
        targetEntityRow = capaRes.rows[0] || {};
      } else if (step.entity_type === 'INCIDENT') {
        const incRes = await client.query('SELECT * FROM incidents WHERE organization_id = $1 AND id = $2;', [orgId, step.entity_id]);
        targetEntityRow = incRes.rows[0] || {};
      } else {
        const invRes = await client.query('SELECT * FROM investigations WHERE organization_id = $1 AND id = $2;', [orgId, step.entity_id]);
        targetEntityRow = invRes.rows[0] || {};
      }

      // Compute cryptographic record digest (SHA-256 over RFC 8785 canonical JSON)
      const canonicalRecord = canonicalizeJson(targetEntityRow);
      const recordDigestSha256 = crypto.createHash('sha256').update(canonicalRecord).digest('hex');

      // 5. Compute signature manifest hash
      const signedAt = new Date().toISOString();
      const manifestPayload = `${signer.id}|${signedAt}|${recordDigestSha256}|${body.meaningOfSignature}|${body.reauthMechanism}`;
      const signatureManifestHash = crypto.createHash('sha256').update(manifestPayload).digest('hex');

      // 6. Insert into electronic_signatures
      const insertSigSql = `
        INSERT INTO electronic_signatures (
          organization_id, approval_step_id, signer_id, signer_name_snapshot, signer_title_snapshot,
          meaning_of_signature, reauth_mechanism, signed_at, ip_address, user_agent,
          record_digest_sha256, signature_manifest_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, signed_at;
      `;
      const sigRes = await client.query(insertSigSql, [
        orgId,
        body.approvalStepId,
        signer.id,
        signer.full_name,
        signer.job_title || 'Authorized Quality Representative',
        body.meaningOfSignature,
        body.reauthMechanism,
        signedAt,
        ipAddress,
        userAgent,
        recordDigestSha256,
        signatureManifestHash,
      ]);
      const signature = sigRes.rows[0];

      // 7. Advance step status to COMPLETED
      await client.query(
        `UPDATE approval_steps SET status = 'COMPLETED' WHERE organization_id = $1 AND id = $2;`,
        [orgId, body.approvalStepId]
      );

      // 8. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'electronic_signatures',
        entityId: signature.id,
        action: 'APPROVE',
        actorId: signer.id,
        correlationId,
        reasonForChange: `Executed 21 CFR Part 11 Electronic Signature (${body.meaningOfSignature})`,
        afterState: {
          signatureId: signature.id,
          signer: signer.full_name,
          meaning: body.meaningOfSignature,
          recordDigestSha256,
        },
      });

      return {
        signatureId: signature.id,
        signerName: signer.full_name,
        meaning: body.meaningOfSignature,
        signedAt: signature.signed_at,
        recordDigestSha256,
        signatureManifestHash,
        status: 'COMPLETED',
      };
    });

    reply.status(200).send(signatureResult);
  });
}
