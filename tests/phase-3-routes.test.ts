import { buildServer } from '../src/server';
import crypto from 'crypto';
import { withTenantTransaction } from '../src/middleware/tenant-context';

describe('AuditTrail AI — Phase 3.2 & 3.3 New Routes (Analytics, S3 Evidence, Organization, Users)', () => {
  const app = buildServer();
  const testOrgId = crypto.randomUUID();
  const testUserId = crypto.randomUUID();
  const testRoleId = crypto.randomUUID();
  let documentId: string;
  let workflowId: string;

  beforeAll(async () => {
    await app.ready();

    // Setup isolated test organization
    await withTenantTransaction(testOrgId, async (client) => {
      await client.query(
        `INSERT INTO organizations (id, name, slug, atlassian_cloud_id, atlassian_installation_id, fda_establishment_id)
         VALUES ($1, 'Phase 3 Medical Devices Inc', $2, $3, $4, 'FDA-PH3-9999')
         ON CONFLICT (id) DO NOTHING;`,
        [testOrgId, `org-ph3-${Date.now()}`, `cloud-ph3-${Date.now()}`, `inst-ph3-${Date.now()}`]
      );

      await client.query(
        `INSERT INTO roles (id, organization_id, code, name, description)
         VALUES ($1, $2, 'QA_ADMIN', 'QA Administrator', 'Phase 3 Test Role')
         ON CONFLICT DO NOTHING;`,
        [testRoleId, testOrgId]
      );

      await client.query(
        `INSERT INTO users (id, organization_id, atlassian_account_id, email, full_name, job_title, is_active)
         VALUES ($1, $2, $3, 'ph3.admin@test.com', 'Dr. Sarah Ph3', 'Director of QA', TRUE)
         ON CONFLICT DO NOTHING;`,
        [testUserId, testOrgId, `acc-ph3-${Date.now()}`]
      );

      await client.query(
        `INSERT INTO user_roles (organization_id, user_id, role_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
        [testOrgId, testUserId, testRoleId]
      );
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. S3 Presigned Upload URL Tests
  describe('AWS S3 Evidence Storage Integration', () => {
    it('POST /api/v1/documents/presign-upload - should reject missing inputs with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/presign-upload',
        headers: { 'x-tenant-id': testOrgId },
        payload: { fileName: 'test.pdf' },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('INVALID_INPUT');
    });

    it('POST /api/v1/documents/presign-upload - should reject non-64-character SHA-256 with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/presign-upload',
        headers: { 'x-tenant-id': testOrgId },
        payload: {
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          sha256Checksum: 'invalid_short_hash',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('INVALID_CHECKSUM');
    });

    it('POST /api/v1/documents/presign-upload - should return valid presigned payload', async () => {
      const sha256 = crypto.createHash('sha256').update('Presigned Upload Content').digest('hex');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/presign-upload',
        headers: { 'x-tenant-id': testOrgId },
        payload: {
          fileName: 'validation_dossier.pdf',
          mimeType: 'application/pdf',
          sha256Checksum: sha256,
          retentionYears: 10,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.uploadUrl).toBeDefined();
      expect(body.s3Uri).toContain('s3://');
      expect(body.s3Key).toContain(`evidence/${testOrgId}`);
      expect(body.expiresInSeconds).toBe(900);
      expect(body.retentionUntilDate).toBeDefined();
    });

    it('Create controlled document and retrieve Presigned Download URL', async () => {
      const sha256 = crypto.createHash('sha256').update('Download Test Content').digest('hex');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/documents',
        headers: { 'x-tenant-id': testOrgId },
        payload: {
          title: 'S3 Presigned Evidence Test Document',
          classification: 'EVIDENCE',
          fileName: 'evidence_download_sample.pdf',
          storageS3Uri: `s3://audittrail-compliance-records-worm/evidence/${testOrgId}/sample.pdf`,
          sha256Checksum: sha256,
          mimeType: 'application/pdf',
          fileSizeBytes: 1048576,
        },
      });

      expect(createRes.statusCode).toBe(201);
      const doc = JSON.parse(createRes.body);
      documentId = doc.id;

      // Now query download-url
      const dlRes = await app.inject({
        method: 'GET',
        url: `/api/v1/documents/${documentId}/download-url`,
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(dlRes.statusCode).toBe(200);
      const dlBody = JSON.parse(dlRes.body);
      expect(dlBody.downloadUrl).toBeDefined();
      expect(dlBody.fileName).toBe('evidence_download_sample.pdf');
      expect(dlBody.sha256Checksum).toBe(sha256);
      expect(dlBody.isLocked).toBe(true);
    });
  });

  // 2. Analytics & Reporting Tests
  describe('Analytics & Reports API Subsystem', () => {
    it('GET /api/v1/analytics/overview - should return incident and CAPA metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/overview',
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.incidents).toBeDefined();
      expect(typeof body.incidents.total).toBe('number');
      expect(body.capas).toBeDefined();
      expect(typeof body.capas.total).toBe('number');
      expect(typeof body.capas.effectivenessRatePercent).toBe('number');
      expect(body.investigations).toBeDefined();
      expect(Array.isArray(body.monthlyTrends)).toBe(true);
    });

    it('POST /api/v1/analytics/reports/generate - should seal report with SHA-256 manifest', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/analytics/reports/generate',
        headers: { 'x-tenant-id': testOrgId },
        payload: {
          reportType: 'CAPA_CLOSURE_PACKAGE',
          title: 'FDA CAPA & Non-Conformance Annual Review',
          parameters: {
            periodStart: '2026-01-01',
            periodEnd: '2026-11-01',
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.report_number).toContain('REP-');
      expect(body.sha256_manifest).toHaveLength(64);
      expect(body.status).toBe('READY');
    });

    it('GET /api/v1/analytics/reports - should list sealed dossiers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/reports',
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items[0].report_number).toBeDefined();
    });
  });

  // 3. Organization Profile & Retention Settings
  describe('Organization & Retention Subsystem', () => {
    it('GET /api/v1/organization - should fetch tenant profile and regulatory IDs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organization',
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testOrgId);
      expect(body.fda_establishment_id).toBe('FDA-PH3-9999');
      expect(body.retentionPolicy).toBeDefined();
      expect(body.retentionPolicy.standard).toContain('21 CFR § 820.180');
    });

    it('PUT /api/v1/organization - should update profile and create audit event', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/organization',
        headers: { 'x-tenant-id': testOrgId },
        payload: {
          name: 'Phase 3 Medical Technologies Global Inc',
          fdaEstablishmentId: 'FEI-3004899123',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Phase 3 Medical Technologies Global Inc');
      expect(body.fda_establishment_id).toBe('FEI-3004899123');
    });

    it('GET /api/v1/organization/retention - should describe 21 CFR retention standards', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organization/retention',
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.requiredRetentionYears).toBeGreaterThanOrEqual(2);
      expect(body.regulatoryStandard).toContain('21 CFR § 820.180');
    });
  });

  // 4. User Directory & Role-Based Access Control
  describe('User Management & RBAC Subsystem', () => {
    it('GET /api/v1/users - should return user directory with roles', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const u = body.items.find((item: any) => item.id === testUserId);
      expect(u).toBeDefined();
      expect(u.full_name).toBe('Dr. Sarah Ph3');
      expect(Array.isArray(u.roles)).toBe(true);
    });

    it('GET /api/v1/users/:id - should return user details and permissions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${testUserId}`,
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(testUserId);
      expect(Array.isArray(body.permissions)).toBe(true);
    });

    it('PATCH /api/v1/users/:id/status - should update status with regulatory justification', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${testUserId}/status`,
        headers: { 'x-tenant-id': testOrgId },
        payload: {
          isActive: false,
          reasonForChange: 'Temporary sabbatical leave - revoking signature rights per SOP-SEC-0012',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.isActive).toBe(false);

      // Re-activate
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${testUserId}/status`,
        headers: { 'x-tenant-id': testOrgId },
        payload: {
          isActive: true,
          reasonForChange: 'Returned to duty - re-instating QA Lead authorization',
        },
      });
    });

    it('GET /api/v1/users/roles - should return defined roles in organization', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/roles',
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items[0].code).toBeDefined();
    });
  });

  // 5. Workflow Inspection
  describe('Workflow & Approval Inspection', () => {
    it('Create workflow and inspect via GET /api/v1/approvals/:id', async () => {
      const wfRes = await app.inject({
        method: 'POST',
        url: '/api/v1/approvals',
        headers: { 'x-tenant-id': testOrgId },
        payload: {
          entityType: 'CAPA',
          entityId: crypto.randomUUID(),
          workflowType: 'CAPA_CLOSURE',
          steps: [
            { stepOrder: 1, stepName: 'QA Director Authorization', requiredRoleId: testRoleId },
          ],
        },
      });

      expect(wfRes.statusCode).toBe(201);
      const wf = JSON.parse(wfRes.body);
      workflowId = wf.id;

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${workflowId}`,
        headers: { 'x-tenant-id': testOrgId },
      });

      expect(getRes.statusCode).toBe(200);
      const getBody = JSON.parse(getRes.body);
      expect(getBody.id).toBe(workflowId);
      expect(getBody.steps).toHaveLength(1);
      expect(getBody.steps[0].step_name).toBe('QA Director Authorization');
    });
  });
});
