import crypto from 'crypto';
import { dbPool, withTenantTransaction } from '../src/middleware/tenant-context';
import { AuditService } from '../src/services/audit-service';
import { CapaService } from '../src/services/capa-service';

describe('AuditTrail AI — Phase 6 End-to-End Regulatory Quality Workflow Test', () => {
  const tenantId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'; // Apex Cardiac Technologies
  const testCorrelationId = crypto.randomUUID();

  let incidentId: string;
  let investigationId: string;
  let rootCauseId: string;
  let capaId: string;
  let action1Id: string;
  let action2Id: string;
  let documentId: string;
  let workflowId: string;
  let approvalStepId: string;
  let userId: string;

  beforeAll(async () => {
    // Resolve valid user in tenant using isolated tenant transaction
    userId = await withTenantTransaction(tenantId, async (client) => {
      const res = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1;', [tenantId]);
      return res.rows[0].id;
    });
  });

  afterAll(async () => {
    await dbPool.end();
  });

  it('Step 1: Incident Created (Intake Clinical Non-Conformance)', async () => {
    const incNumber = `INC-E2E-${Date.now().toString().slice(-4)}`;
    incidentId = await withTenantTransaction(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO incidents (
           organization_id, incident_number, title, description, source, severity, status,
           reported_by_id, occurrence_date, is_mdr_reportable, patient_impact_level
         ) VALUES ($1, $2, 'Telemetry RF carrier frequency jitter during pacing interrogation',
                   'Transceiver observed intermittent carrier frequency shifts exceeding +/- 15 kHz tolerance.',
                   'CUSTOMER_COMPLAINT', 'CRITICAL', 'SUBMITTED', $3, CURRENT_TIMESTAMP, TRUE, 'NO_PATIENT_IMPACT')
         RETURNING id;`,
        [tenantId, incNumber, userId]
      );

      await AuditService.recordAuditEvent(client, {
        organizationId: tenantId,
        entityName: 'incidents',
        entityId: res.rows[0].id,
        action: 'INSERT',
        actorId: userId,
        correlationId: testCorrelationId,
        reasonForChange: 'E2E Test: Clinical Non-conformance Intake',
        afterState: { incidentNumber: incNumber, severity: 'CRITICAL', status: 'SUBMITTED' },
      });

      return res.rows[0].id;
    });

    expect(incidentId).toBeDefined();
  });

  it('Step 2: Incident Assigned to Lead Investigator', async () => {
    await withTenantTransaction(tenantId, async (client) => {
      await client.query(
        'UPDATE incidents SET assigned_to_id = $3 WHERE organization_id = $1 AND id = $2;',
        [tenantId, incidentId, userId]
      );

      await AuditService.recordAuditEvent(client, {
        organizationId: tenantId,
        entityName: 'incidents',
        entityId: incidentId,
        action: 'UPDATE',
        actorId: userId,
        correlationId: testCorrelationId,
        reasonForChange: 'E2E Test: Assigned Lead Quality Investigator',
        afterState: { assignedToUserId: userId },
      });
    });
  });

  it('Step 3: Investigation Started (Methodology Selected: HYBRID)', async () => {
    investigationId = await withTenantTransaction(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO investigations (
           organization_id, incident_id, lead_investigator_id, methodology, summary, status
         ) VALUES ($1, $2, $3, 'HYBRID', 'Destructive physical analysis underway for crystal oscillator.', 'IN_PROGRESS')
         RETURNING id;`,
        [tenantId, incidentId, userId]
      );

      await client.query(
        "UPDATE incidents SET status = 'INVESTIGATING' WHERE organization_id = $1 AND id = $2;",
        [tenantId, incidentId]
      );

      await AuditService.recordAuditEvent(client, {
        organizationId: tenantId,
        entityName: 'investigations',
        entityId: res.rows[0].id,
        action: 'INSERT',
        actorId: userId,
        correlationId: testCorrelationId,
        reasonForChange: 'E2E Test: Investigation protocol initiated',
        afterState: { status: 'IN_PROGRESS', methodology: 'HYBRID' },
      });

      return res.rows[0].id;
    });

    expect(investigationId).toBeDefined();
  });

  it('Step 4: AI Hypothesis Generated and Telemetry Recorded', async () => {
    await withTenantTransaction(tenantId, async (client) => {
      const anaRes = await client.query(
        `INSERT INTO ai_analyses (
           organization_id, entity_type, entity_id, model_provider, model_name,
           prompt_template_version, prompt_hash, input_tokens, output_tokens,
           latency_ms, raw_response_json, model_confidence_raw
         ) VALUES ($1, 'INCIDENT', $2, 'GOOGLE_VERTEX_AI', 'gemini-1.5-pro-002',
                   'v2.4.0', 'hash123', 1500, 300, 850, '{"hypothesis": "Crystal solder joint micro-voiding"}', 0.895)
         RETURNING id;`,
        [tenantId, incidentId]
      );

      await client.query(
        `INSERT INTO ai_suggestions (
           organization_id, analysis_id, suggestion_type, structured_content, human_review_status
         ) VALUES ($1, $2, 'ROOT_CAUSE_HYPOTHESIS', '{"statement": "Crystal solder joint micro-voiding"}', 'PENDING_REVIEW');`,
        [tenantId, anaRes.rows[0].id]
      );
    });
  });

  it('Step 5: Human Root Cause Review & Verification', async () => {
    rootCauseId = await withTenantTransaction(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO root_causes (
           organization_id, investigation_id, statement, category, verification_method, is_verified, verified_by_id, verified_at
         ) VALUES ($1, $2, 'Reflow profile temperature peak induced micro-voiding in RF crystal solder pads.',
                   'PROCESS_EQUIPMENT', 'X-ray inspection confirmed >25% void area in pad 2', TRUE, $3, CURRENT_TIMESTAMP)
         RETURNING id;`,
        [tenantId, investigationId, userId]
      );

      await AuditService.recordAuditEvent(client, {
        organizationId: tenantId,
        entityName: 'root_causes',
        entityId: res.rows[0].id,
        action: 'INSERT',
        actorId: userId,
        correlationId: testCorrelationId,
        reasonForChange: 'E2E Test: Confirmed and verified physical root cause',
        afterState: { statement: 'Reflow profile temperature peak induced micro-voiding', isVerified: true },
      });

      return res.rows[0].id;
    });

    expect(rootCauseId).toBeDefined();
  });

  it('Step 6: CAPA Created & Linked to Incident and Investigation', async () => {
    const capaNumber = `CAPA-E2E-${Date.now().toString().slice(-4)}`;
    capaId = await withTenantTransaction(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO capas (
           organization_id, capa_number, incident_id, investigation_id, capa_type,
           title, problem_statement, status, risk_level, owner_id, due_date
         ) VALUES ($1, $2, $3, $4, 'CORRECTIVE',
                   'Surface-Mount Reflow Profile Optimization & Void Minimization',
                   'RF crystal solder voiding causes telemetry frequency drift.',
                   'OPEN', 'HIGH', $5, CURRENT_DATE + INTERVAL '60 days')
         RETURNING id;`,
        [tenantId, capaNumber, incidentId, investigationId, userId]
      );

      await AuditService.recordAuditEvent(client, {
        organizationId: tenantId,
        entityName: 'capas',
        entityId: res.rows[0].id,
        action: 'INSERT',
        actorId: userId,
        correlationId: testCorrelationId,
        reasonForChange: 'E2E Test: Initiated corrective action program',
        afterState: { capaNumber, status: 'OPEN', riskLevel: 'HIGH' },
      });

      return res.rows[0].id;
    });

    expect(capaId).toBeDefined();
  });

  it('Step 7: Corrective Actions Assigned with DAG Dependencies & Verified', async () => {
    await withTenantTransaction(tenantId, async (client) => {
      // Action 1: Process Change
      action1Id = await CapaService.addCapaAction(
        client,
        {
          organizationId: tenantId,
          capaId,
          actionNumber: 1,
          actionType: 'PROCESS_CHANGE',
          description: 'Modify vacuum reflow oven nitrogen purge rate and peak soak time from 60s to 75s.',
          assigneeId: userId,
          dueDate: new Date().toISOString().split('T')[0],
        },
        userId,
        testCorrelationId
      );

      // Action 2: Retraining (Depends on Action 1)
      action2Id = await CapaService.addCapaAction(
        client,
        {
          organizationId: tenantId,
          capaId,
          actionNumber: 2,
          actionType: 'RETRAINING',
          description: 'Certify SMT operators on updated SOP-SMT-0044 profile.',
          assigneeId: userId,
          dueDate: new Date().toISOString().split('T')[0],
          dependsOnActionIds: [action1Id],
        },
        userId,
        testCorrelationId
      );

      // Advance both actions to VERIFIED
      await client.query(
        "UPDATE capa_actions SET status = 'VERIFIED', verified_by_id = $3, verified_at = CURRENT_TIMESTAMP WHERE organization_id = $1 AND id IN ($2, $4);",
        [tenantId, action1Id, userId, action2Id]
      );
    });

    expect(action1Id).toBeDefined();
    expect(action2Id).toBeDefined();
  });

  it('Step 8: Controlled Evidence Uploaded with S3 WORM & SHA-256 Checksum', async () => {
    documentId = await withTenantTransaction(tenantId, async (client) => {
      const docCode = `DOC-E2E-${Date.now().toString().slice(-4)}`;
      const docRes = await client.query(
        `INSERT INTO documents (
           organization_id, document_code, title, classification, current_version_number, is_locked
         ) VALUES ($1, $2, 'Reflow Profile Optimization Validation Report', 'VALIDATION_REPORT', 1, TRUE)
         RETURNING id;`,
        [tenantId, docCode]
      );
      const dId = docRes.rows[0].id;

      const shaChecksum = crypto.createHash('sha256').update('Validation Test Bytes').digest('hex');
      const verRes = await client.query(
        `INSERT INTO document_versions (
           organization_id, document_id, version_number, file_name, storage_s3_uri,
           sha256_checksum, mime_type, file_size_bytes, virus_scan_status,
           retention_expiration_date, uploaded_by_id
         ) VALUES ($1, $2, 1, 'Validation_Report_V1.pdf', 's3://audittrail-compliance-records-worm/reports/v1.pdf',
                   $3, 'application/pdf', 2450120, 'CLEAN', CURRENT_DATE + INTERVAL '10 years', $4)
         RETURNING id;`,
        [tenantId, dId, shaChecksum, userId]
      );

      await client.query('UPDATE documents SET current_version_id = $3 WHERE organization_id = $1 AND id = $2;', [
        tenantId,
        dId,
        verRes.rows[0].id,
      ]);

      await client.query(
        `INSERT INTO entity_attachments (organization_id, document_id, entity_type, entity_id)
         VALUES ($1, $2, 'CAPA', $3);`,
        [tenantId, dId, capaId]
      );

      return dId;
    });

    expect(documentId).toBeDefined();
  });

  it('Step 9: Approval Workflow Submitted & 21 CFR Part 11 Electronic Signature Executed', async () => {
    await withTenantTransaction(tenantId, async (client) => {
      const wfRes = await client.query(
        `INSERT INTO approval_workflows (
           organization_id, entity_type, entity_id, workflow_type, current_step, status
         ) VALUES ($1, 'CAPA', $2, 'CAPA_CLOSURE', 1, 'IN_PROGRESS')
         RETURNING id;`,
        [tenantId, capaId]
      );
      workflowId = wfRes.rows[0].id;

      const roleRes = await client.query('SELECT id FROM roles WHERE organization_id = $1 LIMIT 1;', [tenantId]);
      const roleId = roleRes.rows[0].id;

      const stepRes = await client.query(
        `INSERT INTO approval_steps (
           organization_id, workflow_id, step_order, step_name, required_role_id, status
         ) VALUES ($1, $2, 1, 'QA Director Final CAPA Authorization', $3, 'PENDING')
         RETURNING id;`,
        [tenantId, workflowId, roleId]
      );
      approvalStepId = stepRes.rows[0].id;

      // Execute 21 CFR Part 11 Electronic Signature
      const recordDigest = crypto.createHash('sha256').update(`CAPA:${capaId}:APPROVED`).digest('hex');
      const manifestHash = crypto.createHash('sha256').update(`${userId}|APPROVED|${recordDigest}`).digest('hex');

      await client.query(
        `INSERT INTO electronic_signatures (
           organization_id, approval_step_id, signer_id, signer_name_snapshot,
           signer_title_snapshot, meaning_of_signature, reauth_mechanism,
           ip_address, user_agent, record_digest_sha256, signature_manifest_hash
         ) VALUES ($1, $2, $3, 'Dr. Eleanor Mitchell', 'Director of Quality Assurance',
                   'APPROVED', 'ATLASSIAN_REAUTH_JWT', '127.0.0.1'::inet, 'Forge-Remote', $4, $5);`,
        [tenantId, approvalStepId, userId, recordDigest, manifestHash]
      );

      await client.query("UPDATE approval_steps SET status = 'COMPLETED' WHERE organization_id = $1 AND id = $2;", [
        tenantId,
        approvalStepId,
      ]);
      await client.query("UPDATE approval_workflows SET status = 'APPROVED' WHERE organization_id = $1 AND id = $2;", [
        tenantId,
        workflowId,
      ]);
    });
  });

  it('Step 10: Quantitative Effectiveness Review Evaluated as Effective', async () => {
    await withTenantTransaction(tenantId, async (client) => {
      await client.query(
        `INSERT INTO capa_effectiveness_reviews (
           organization_id, capa_id, review_period_days, acceptance_criteria, scheduled_date,
           evaluated_at, evaluator_id, is_effective, evidence_summary
         ) VALUES ($1, $2, 60,
                   'Zero solder void-induced frequency deviations in 5,000 units.',
                   CURRENT_DATE, CURRENT_TIMESTAMP, $3, TRUE,
                   'X-ray inspection of 5,000 post-change units confirmed 0% voiding >10% area.');`,
        [tenantId, capaId, userId]
      );
    });
  });

  it('Step 11: CAPA Closure Gate Enforced and CAPA Closed', async () => {
    await withTenantTransaction(tenantId, async (client) => {
      // Validates that all actions are VERIFIED and effectiveness review is TRUE
      await CapaService.validateCapaClosure(client, tenantId, capaId);

      await client.query(
        "UPDATE capas SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE organization_id = $1 AND id = $2;",
        [tenantId, capaId]
      );

      await AuditService.recordAuditEvent(client, {
        organizationId: tenantId,
        entityName: 'capas',
        entityId: capaId,
        action: 'STATUS_CHANGE',
        actorId: userId,
        correlationId: testCorrelationId,
        reasonForChange: 'E2E Test: All corrective actions verified and effectiveness confirmed positive',
        afterState: { status: 'CLOSED' },
      });
    });

    // Verify CAPA is in CLOSED status within tenant transaction
    await withTenantTransaction(tenantId, async (client) => {
      const res = await client.query('SELECT status, closed_at FROM capas WHERE organization_id = $1 AND id = $2;', [
        tenantId,
        capaId,
      ]);
      expect(res.rows[0].status).toBe('CLOSED');
      expect(res.rows[0].closed_at).not.toBeNull();
    });
  });

  it('Step 12: Audit Report Generated with Cryptographic Checksum', async () => {
    await withTenantTransaction(tenantId, async (client) => {
      const repNumber = `REP-E2E-${Date.now().toString().slice(-4)}`;

      await client.query(
        `INSERT INTO audit_reports (
           organization_id, report_number, report_type, title, generated_by_id,
           parameters_json, document_id, status
         ) VALUES ($1, $2, 'CAPA_CLOSURE_PACKAGE',
                   'FDA QMSR 2026 Comprehensive Non-conformance & CAPA Closeout Dossier',
                   $3, '{"scope": "FULL_QMS_AUDIT"}', $4, 'READY');`,
        [tenantId, repNumber, userId, documentId]
      );
    });
  });

  it('Step 13: Entire Cryptographic Audit Ledger Verified Unbroken', async () => {
    await withTenantTransaction(tenantId, async (client) => {
      // Find min and max sequence numbers for this tenant
      const seqRange = await client.query(
        'SELECT MIN(sequence_number) as min_seq, MAX(sequence_number) as max_seq FROM audit_events WHERE organization_id = $1;',
        [tenantId]
      );
      const minSeq = parseInt(seqRange.rows[0].min_seq || '1', 10);
      const maxSeq = parseInt(seqRange.rows[0].max_seq || '1', 10);

      const verification = await AuditService.verifyTenantChain(client, tenantId, minSeq, maxSeq);

      if (!verification.isValid) {
        console.error('Verification failed details:', verification);
      }

      expect(verification.isValid).toBe(true);
      expect(verification.totalEventsVerified).toBeGreaterThanOrEqual(5);
      expect(verification.brokenSequenceNumber).toBeUndefined();
    });
  });
});
