import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService } from '../services/audit-service';

interface CreateDocumentBody {
  documentCode?: string;
  title: string;
  classification: 'EVIDENCE' | 'DHF_RECORD' | 'SOP' | 'AUDIT_PACKAGE' | 'VALIDATION_REPORT';
  fileName: string;
  storageS3Uri: string;
  sha256Checksum: string;
  mimeType: string;
  fileSizeBytes: number;
  retentionExpirationDate?: string;
  attachedTo?: {
    entityType: 'INCIDENT' | 'INVESTIGATION' | 'CAPA' | 'ACTION' | 'EFFECTIVENESS_REVIEW';
    entityId: string;
  };
}

interface AddVersionBody {
  fileName: string;
  storageS3Uri: string;
  sha256Checksum: string;
  mimeType: string;
  fileSizeBytes: number;
  retentionExpirationDate?: string;
  reasonForChange?: string;
}

export async function evidenceRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/documents - Create controlled document with initial version
  fastify.post('/documents', async (req: FastifyRequest<{ Body: CreateDocumentBody }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Resolve uploader user
      const userRes = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1;', [orgId]);
      const uploaderId = userRes.rows[0]?.id;
      if (!uploaderId) throw new Error('NO_VALID_USER_IN_TENANT');

      // 2. Generate document code if not provided
      let docCode = body.documentCode;
      if (!docCode) {
        const countRes = await client.query('SELECT count(*) FROM documents WHERE organization_id = $1;', [orgId]);
        const count = parseInt(countRes.rows[0].count, 10) + 1;
        docCode = `DOC-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;
      }

      // 3. Insert document header
      const insertDocSql = `
        INSERT INTO documents (
          organization_id, document_code, title, classification, current_version_number, is_locked
        ) VALUES ($1, $2, $3, $4, 1, TRUE)
        RETURNING id, document_code, title, classification, current_version_number, created_at;
      `;
      const docRes = await client.query(insertDocSql, [orgId, docCode, body.title, body.classification]);
      const doc = docRes.rows[0];

      // 4. Insert initial version
      const retentionDate = body.retentionExpirationDate || new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const insertVerSql = `
        INSERT INTO document_versions (
          organization_id, document_id, version_number, file_name, storage_s3_uri,
          sha256_checksum, mime_type, file_size_bytes, virus_scan_status,
          retention_expiration_date, uploaded_by_id
        ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, 'CLEAN', $8, $9)
        RETURNING id, version_number, file_name, sha256_checksum, created_at;
      `;
      const verRes = await client.query(insertVerSql, [
        orgId,
        doc.id,
        body.fileName,
        body.storageS3Uri,
        body.sha256Checksum,
        body.mimeType,
        body.fileSizeBytes,
        retentionDate,
        uploaderId,
      ]);
      const ver = verRes.rows[0];

      // 5. Update document current_version_id
      await client.query(
        'UPDATE documents SET current_version_id = $3 WHERE organization_id = $1 AND id = $2;',
        [orgId, doc.id, ver.id]
      );

      // 6. Link entity attachment if requested
      if (body.attachedTo) {
        await client.query(
          `INSERT INTO entity_attachments (
             organization_id, document_id, entity_type, entity_id
           ) VALUES ($1, $2, $3, $4);`,
          [orgId, doc.id, body.attachedTo.entityType, body.attachedTo.entityId]
        );
      }

      // 7. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'documents',
        entityId: doc.id,
        action: 'INSERT',
        actorId: uploaderId,
        correlationId,
        reasonForChange: `Uploaded controlled document: ${doc.title} (${doc.document_code})`,
        afterState: { documentCode: doc.document_code, version: 1, sha256: body.sha256Checksum },
      });

      return { ...doc, currentVersion: ver };
    });

    reply.status(201).send(result);
  });

  // GET /api/v1/documents/:id - Get document metadata and full version history
  fastify.get('/documents/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const docId = req.params.id;

    const client = await fastify.pgPool.connect();
    try {
      await client.query('SET LOCAL app.current_organization_id = $1;', [orgId]);

      // 1. Fetch document header
      const docRes = await client.query(
        `SELECT d.*, dv.file_name as active_file_name, dv.sha256_checksum as active_sha256,
                dv.mime_type as active_mime_type, dv.storage_s3_uri as active_s3_uri
         FROM documents d
         LEFT JOIN document_versions dv ON d.organization_id = dv.organization_id AND d.current_version_id = dv.id
         WHERE d.organization_id = $1 AND d.id = $2;`,
        [orgId, docId]
      );

      if (docRes.rows.length === 0) {
        return reply.status(404).send({ error: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
      }
      const doc = docRes.rows[0];

      // 2. Fetch versions
      const verRes = await client.query(
        `SELECT dv.*, u.full_name as uploaded_by_name
         FROM document_versions dv
         JOIN users u ON dv.organization_id = u.organization_id AND dv.uploaded_by_id = u.id
         WHERE dv.organization_id = $1 AND dv.document_id = $2
         ORDER BY dv.version_number DESC;`,
        [orgId, docId]
      );

      // 3. Fetch linked entity attachments
      const attRes = await client.query(
        `SELECT ea.id, ea.entity_type, ea.entity_id, ea.created_at
         FROM entity_attachments ea
         WHERE ea.organization_id = $1 AND ea.document_id = $2;`,
        [orgId, docId]
      );

      reply.send({
        ...doc,
        versions: verRes.rows,
        attachments: attRes.rows,
      });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/documents/:id/versions - Upload/register new version
  fastify.post('/documents/:id/versions', async (req: FastifyRequest<{
    Params: { id: string };
    Body: AddVersionBody;
  }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const docId = req.params.id;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch current document
      const docRes = await client.query(
        'SELECT current_version_number, title, document_code FROM documents WHERE organization_id = $1 AND id = $2;',
        [orgId, docId]
      );
      if (docRes.rows.length === 0) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }
      const nextVerNumber = docRes.rows[0].current_version_number + 1;

      // 2. Resolve uploader user
      const userRes = await client.query('SELECT id FROM users WHERE organization_id = $1 LIMIT 1;', [orgId]);
      const uploaderId = userRes.rows[0]?.id;

      // 3. Insert new version
      const retentionDate = body.retentionExpirationDate || new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const insertSql = `
        INSERT INTO document_versions (
          organization_id, document_id, version_number, file_name, storage_s3_uri,
          sha256_checksum, mime_type, file_size_bytes, virus_scan_status,
          retention_expiration_date, uploaded_by_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CLEAN', $9, $10)
        RETURNING *;
      `;
      const verRes = await client.query(insertSql, [
        orgId,
        docId,
        nextVerNumber,
        body.fileName,
        body.storageS3Uri,
        body.sha256Checksum,
        body.mimeType,
        body.fileSizeBytes,
        retentionDate,
        uploaderId,
      ]);
      const newVersion = verRes.rows[0];

      // 4. Update document current version pointer
      await client.query(
        `UPDATE documents
         SET current_version_number = $3, current_version_id = $4
         WHERE organization_id = $1 AND id = $2;`,
        [orgId, docId, nextVerNumber, newVersion.id]
      );

      // 5. Audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'document_versions',
        entityId: newVersion.id,
        action: 'INSERT',
        actorId: uploaderId,
        correlationId,
        reasonForChange: body.reasonForChange || `Updated document to version ${nextVerNumber}`,
        afterState: { versionNumber: nextVerNumber, sha256: body.sha256Checksum },
      });

      return newVersion;
    });

    reply.status(201).send(result);
  });
}
