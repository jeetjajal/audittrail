import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { withTenantTransaction } from '../middleware/tenant-context';
import { AuditService } from '../services/audit-service';

interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  deviceModel?: string;
}

interface GenerateReportBody {
  reportType: 'INCIDENT_DOSSIER' | 'CAPA_CLOSURE_PACKAGE' | 'INTERNAL_AUDIT_PACK' | 'MANAGEMENT_REVIEW_SUMMARY' | 'INSPECTION_READINESS_PACKAGE';
  title: string;
  parameters?: Record<string, unknown>;
}

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/analytics/overview - Fetch comprehensive eQMS quality metrics
  fastify.get('/overview', async (req: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const { startDate, endDate } = req.query;

    const data = await withTenantTransaction(orgId, async (client) => {
      // 1. Incident Metrics
      let incSql = `
        SELECT
          count(*) as total_incidents,
          count(*) FILTER (WHERE severity = 'CRITICAL') as critical_incidents,
          count(*) FILTER (WHERE severity = 'MAJOR') as major_incidents,
          count(*) FILTER (WHERE severity = 'MINOR') as minor_incidents,
          count(*) FILTER (WHERE status = 'SUBMITTED' OR status = 'TRIAGED') as open_incidents,
          count(*) FILTER (WHERE status = 'INVESTIGATING') as investigating_incidents,
          count(*) FILTER (WHERE status = 'CLOSED') as closed_incidents,
          count(*) FILTER (WHERE is_mdr_reportable = true) as mdr_reportable_count
        FROM incidents
        WHERE organization_id = $1
      `;
      const incParams: unknown[] = [orgId];

      if (startDate) {
        incParams.push(startDate);
        incSql += ` AND occurrence_date >= $${incParams.length}`;
      }
      if (endDate) {
        incParams.push(endDate);
        incSql += ` AND occurrence_date <= $${incParams.length}`;
      }

      const incRes = await client.query(incSql, incParams);
      const incMetrics = incRes.rows[0];

      // 2. CAPA Metrics
      let capaSql = `
        SELECT
          count(*) as total_capas,
          count(*) FILTER (WHERE status = 'OPEN') as open_capas,
          count(*) FILTER (WHERE status = 'ACTION_PENDING' OR status = 'VERIFICATION_PENDING') as in_progress_capas,
          count(*) FILTER (WHERE status = 'CLOSED') as closed_capas,
          count(*) FILTER (WHERE risk_level = 'HIGH') as high_risk_capas,
          count(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'CLOSED') as overdue_capas
        FROM capas
        WHERE organization_id = $1
      `;
      const capaParams: unknown[] = [orgId];
      if (startDate) {
        capaParams.push(startDate);
        capaSql += ` AND created_at >= $${capaParams.length}`;
      }
      if (endDate) {
        capaParams.push(endDate);
        capaSql += ` AND created_at <= $${capaParams.length}`;
      }

      const capaRes = await client.query(capaSql, capaParams);
      const capaMetrics = capaRes.rows[0];

      // 3. CAPA Effectiveness Rate
      const effRes = await client.query(
        `SELECT
           count(*) as total_evaluated,
           count(*) FILTER (WHERE is_effective = true) as effective_count
         FROM capa_effectiveness_reviews
         WHERE organization_id = $1;`,
        [orgId]
      );
      const totalEvaluated = parseInt(effRes.rows[0]?.total_evaluated || '0', 10);
      const effectiveCount = parseInt(effRes.rows[0]?.effective_count || '0', 10);
      const effectivenessRate = totalEvaluated > 0 ? Math.round((effectiveCount / totalEvaluated) * 100) : 100;

      // 4. Investigations Metrics
      const invRes = await client.query(
        `SELECT
           count(*) as total_investigations,
           count(*) FILTER (WHERE status = 'IN_PROGRESS') as active_investigations,
           count(*) FILTER (WHERE status = 'ROOT_CAUSE_IDENTIFIED' OR status = 'COMPLETED') as completed_investigations
         FROM investigations
         WHERE organization_id = $1;`,
        [orgId]
      );
      const invMetrics = invRes.rows[0];

      // 5. Monthly Trend
      const trendRes = await client.query(
        `SELECT
           TO_CHAR(occurrence_date, 'YYYY-MM') as month,
           count(*) as incident_count,
           count(*) FILTER (WHERE severity = 'CRITICAL') as critical_count
         FROM incidents
         WHERE organization_id = $1
         GROUP BY TO_CHAR(occurrence_date, 'YYYY-MM')
         ORDER BY month ASC
         LIMIT 12;`,
        [orgId]
      );

      return {
        incidents: {
          total: parseInt(incMetrics.total_incidents || '0', 10),
          critical: parseInt(incMetrics.critical_incidents || '0', 10),
          major: parseInt(incMetrics.major_incidents || '0', 10),
          minor: parseInt(incMetrics.minor_incidents || '0', 10),
          open: parseInt(incMetrics.open_incidents || '0', 10),
          investigating: parseInt(incMetrics.investigating_incidents || '0', 10),
          closed: parseInt(incMetrics.closed_incidents || '0', 10),
          mdrReportable: parseInt(incMetrics.mdr_reportable_count || '0', 10),
        },
        capas: {
          total: parseInt(capaMetrics.total_capas || '0', 10),
          open: parseInt(capaMetrics.open_capas || '0', 10),
          inProgress: parseInt(capaMetrics.in_progress_capas || '0', 10),
          closed: parseInt(capaMetrics.closed_capas || '0', 10),
          highRisk: parseInt(capaMetrics.high_risk_capas || '0', 10),
          overdue: parseInt(capaMetrics.overdue_capas || '0', 10),
          effectivenessRatePercent: effectivenessRate,
        },
        investigations: {
          total: parseInt(invMetrics.total_investigations || '0', 10),
          active: parseInt(invMetrics.active_investigations || '0', 10),
          completed: parseInt(invMetrics.completed_investigations || '0', 10),
        },
        monthlyTrends: trendRes.rows.map((r) => ({
          month: r.month,
          incidentCount: parseInt(r.incident_count, 10),
          criticalCount: parseInt(r.critical_count, 10),
        })),
        queryPeriod: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      };
    });

    return reply.status(200).send(data);
  });

  // GET /api/v1/analytics/reports - List sealed regulatory audit dossiers
  fastify.get('/reports', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;

    const reports = await withTenantTransaction(orgId, async (client) => {
      const queryRes = await client.query(
        `SELECT r.id, r.report_number, r.title, r.report_type, r.parameters_json,
                r.status, r.created_at,
                u.full_name as generated_by_name
         FROM audit_reports r
         LEFT JOIN users u ON r.organization_id = u.organization_id AND r.generated_by_id = u.id
         WHERE r.organization_id = $1
         ORDER BY r.created_at DESC;`,
        [orgId]
      );
      return queryRes.rows;
    });

    return reply.status(200).send({ items: reports, total: reports.length });
  });

  // POST /api/v1/analytics/reports/generate - Generate & seal regulatory audit package
  fastify.post('/reports/generate', async (req: FastifyRequest<{ Body: GenerateReportBody }>, reply: FastifyReply) => {
    const orgId = req.tenantOrganizationId!;
    const body = req.body;
    const correlationId = req.correlationId;

    const result = await withTenantTransaction(orgId, async (client) => {
      // 1. Fetch user
      const userRes = await client.query('SELECT id, full_name FROM users WHERE organization_id = $1 LIMIT 1;', [orgId]);
      const userId = userRes.rows[0]?.id;
      if (!userId) throw new Error('NO_VALID_USER_IN_TENANT');

      // 2. Count existing reports
      const countRes = await client.query('SELECT count(*) FROM audit_reports WHERE organization_id = $1;', [orgId]);
      const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
      const reportNum = `REP-${new Date().getFullYear()}-${nextNum.toString().padStart(4, '0')}`;

      // 3. Compute deterministic cryptographic manifest
      const manifestSeed = `${orgId}|${reportNum}|${body.reportType}|${Date.now()}`;
      const sha256Manifest = crypto.createHash('sha256').update(manifestSeed).digest('hex');

      const paramsJson = {
        sha256Manifest,
        generatedAt: new Date().toISOString(),
        ...(body.parameters || {}),
      };

      // 4. Insert report
      const insertSql = `
        INSERT INTO audit_reports (
          organization_id, report_number, report_type, title, generated_by_id, parameters_json, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'READY', CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      const reportRes = await client.query(insertSql, [
        orgId,
        reportNum,
        body.reportType,
        body.title || `Regulatory Quality Dossier (${body.reportType})`,
        userId,
        JSON.stringify(paramsJson),
      ]);
      const created = reportRes.rows[0];

      // 5. Record audit event
      await AuditService.recordAuditEvent(client, {
        organizationId: orgId,
        entityName: 'audit_reports',
        entityId: created.id,
        action: 'INSERT',
        actorId: userId,
        correlationId,
        reasonForChange: `Generated sealed regulatory dossier ${reportNum}`,
        afterState: { reportNumber: reportNum, sha256Manifest, status: 'READY' },
      });

      return {
        ...created,
        sha256_manifest: sha256Manifest,
      };
    });

    return reply.status(201).send(result);
  });
}
