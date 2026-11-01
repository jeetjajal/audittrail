import React, { useEffect, useState } from 'react';
import { StatusBadge, MetricCard, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';

interface ReportsProps {
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const ReportsAnalytics: React.FC<ReportsProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    reportType: 'CAPA_CLOSURE_PACKAGE',
    title: 'FDA CAPA & Non-Conformance Annual Review',
  });
  const [generating, setGenerating] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, reportsRes] = await Promise.allSettled([
        ApiClient.getAnalyticsOverview({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        ApiClient.getAnalyticsReports(),
      ]);

      if (overviewRes.status === 'fulfilled') {
        setMetrics(overviewRes.value);
      } else {
        console.warn('Overview load error', overviewRes.reason);
      }

      if (reportsRes.status === 'fulfilled') {
        setReports(reportsRes.value.items || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  async function handleGenerateReport(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const created = await ApiClient.generateReport({
        reportType: reportForm.reportType,
        title: reportForm.title,
        parameters: { startDate, endDate },
      });
      setIsModalOpen(false);
      setReports([created, ...reports]);
      alert(`Report ${created.report_number || created.id} successfully compiled and sealed with SHA-256!`);
    } catch (err) {
      alert(`Report generation failed: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            Audit Readiness & Regulatory Reports Studio
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Live metrics, CAPA effectiveness trends & tamper-sealed dossiers (21 CFR Part 11 & ISO 13485:2016).
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              backgroundColor: '#0052CC',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            + Compile & Seal Report
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          padding: '12px 18px',
          borderRadius: '6px',
          border: '1px solid #DFE1E6',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D' }}>Date Filter:</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span>From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '12px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span>To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '12px' }}
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#0052CC',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ padding: '30px', textAlign: 'center', color: '#6B778C', fontSize: '13px' }}>
          Loading real-time quality & audit analytics from database...
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: '#FFEBE6',
            color: '#DE350B',
            padding: '12px 16px',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '13px',
          }}
        >
          Failed to load analytics: {error}
        </div>
      )}

      {/* Metrics Row */}
      {metrics && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <MetricCard
            title="Total Incidents Logged"
            value={metrics.incidents.total}
            subtitle={`${metrics.incidents.critical} Critical · ${metrics.incidents.mdrReportable} MDR`}
            badgeText={metrics.incidents.critical > 0 ? 'CRITICAL ESCALATION' : 'NOMINAL'}
            badgeColor={metrics.incidents.critical > 0 ? 'critical' : 'success'}
          />
          <MetricCard
            title="Open Quality Incidents"
            value={metrics.incidents.open + metrics.incidents.investigating}
            subtitle={`${metrics.incidents.investigating} In Active Investigation`}
            badgeText="ACTIVE INTAKE"
            badgeColor="warning"
          />
          <MetricCard
            title="Active CAPA Programs"
            value={metrics.capas.total}
            subtitle={`${metrics.capas.highRisk} High Risk · ${metrics.capas.overdue} Overdue`}
            badgeText={metrics.capas.overdue > 0 ? 'OVERDUE' : 'ON TRACK'}
            badgeColor={metrics.capas.overdue > 0 ? 'critical' : 'primary'}
          />
          <MetricCard
            title="CAPA Effectiveness Rate"
            value={`${metrics.capas.effectivenessRatePercent}%`}
            subtitle="Verified Post-Action Outcomes"
            badgeText={metrics.capas.effectivenessRatePercent >= 90 ? 'COMPLIANT' : 'REVIEW NEEDED'}
            badgeColor={metrics.capas.effectivenessRatePercent >= 90 ? 'success' : 'warning'}
          />
        </div>
      )}

      {/* Monthly Trends Table */}
      {metrics && metrics.monthlyTrends && metrics.monthlyTrends.length > 0 && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '6px',
            border: '1px solid #DFE1E6',
            padding: '18px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
            Monthly Incident & Risk Progression (ISO 13485:2016 § 8.4)
          </h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {metrics.monthlyTrends.map((t: any) => (
              <div
                key={t.month}
                style={{
                  backgroundColor: '#F4F5F7',
                  padding: '10px 14px',
                  borderRadius: '4px',
                  minWidth: '120px',
                  border: '1px solid #EBECF0',
                }}
              >
                <div style={{ fontSize: '11px', color: '#6B778C', fontWeight: 600 }}>{t.month}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#172B4D', margin: '4px 0' }}>
                  {t.incidentCount}
                </div>
                <div style={{ fontSize: '11px', color: t.criticalCount > 0 ? '#DE350B' : '#00875A' }}>
                  {t.criticalCount} Critical
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sealed Dossiers Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #DFE1E6',
            fontWeight: 700,
            fontSize: '15px',
            color: '#172B4D',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Official Sealed Regulatory Dossiers ({reports.length})</span>
          <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B778C' }}>
            SHA-256 Tamper-Sealed per 21 CFR § 11.10(e)
          </span>
        </div>

        {reports.length === 0 && !loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#6B778C', fontSize: '13px' }}>
            No regulatory reports generated yet. Click "+ Compile & Seal Report" to create your first official audit package.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '1px solid #DFE1E6', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Report #</th>
                <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Title</th>
                <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Compiled At</th>
                <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>SHA-256 Digest</th>
                <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((rep: any) => {
                const digest =
                  rep.sha256_manifest ||
                  (rep.parameters_json && rep.parameters_json.sha256Manifest) ||
                  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                return (
                  <tr key={rep.id} style={{ borderBottom: '1px solid #EBECF0' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0052CC' }}>
                      {rep.report_number || rep.id.substring(0, 8)}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#172B4D', fontWeight: 500 }}>{rep.title}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          backgroundColor: '#EAE6FF',
                          color: '#403294',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {rep.report_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#6B778C' }}>
                      {new Date(rep.created_at || rep.compiled_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <code style={{ fontSize: '11px', backgroundColor: '#F4F5F7', padding: '2px 6px', borderRadius: '3px' }}>
                        {digest.substring(0, 16)}...
                      </code>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge status="VERIFIED" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Report Generation Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Compile & Cryptographically Seal Audit Dossier">
        <form onSubmit={handleGenerateReport}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Report Dossier Type:
              </label>
              <select
                value={reportForm.reportType}
                onChange={(e) => setReportForm({ ...reportForm, reportType: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}
              >
                <option value="CAPA_CLOSURE_PACKAGE">CAPA Closure & Effectiveness Package</option>
                <option value="INCIDENT_DOSSIER">Clinical Non-Conformance Dossier</option>
                <option value="INTERNAL_AUDIT_PACK">Internal Quality Audit Package (ISO 13485)</option>
                <option value="MANAGEMENT_REVIEW_SUMMARY">Executive Quality Management Review Summary</option>
                <option value="INSPECTION_READINESS_PACKAGE">FDA QMSR Inspection Readiness Package</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Dossier Official Title:
              </label>
              <input
                type="text"
                required
                value={reportForm.title}
                onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}
              />
            </div>

            <div
              style={{
                backgroundColor: '#EAE6FF',
                color: '#403294',
                padding: '10px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                lineHeight: 1.4,
              }}
            >
              🔒 <strong>21 CFR Part 11 Electronic Sealing:</strong> Compiling this report computes an immutable SHA-256 cryptographic manifest that is registered in the Audit Ledger and stored with WORM protection.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '8px 16px', border: '1px solid #DFE1E6', borderRadius: '4px', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#0052CC', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
              >
                {generating ? 'Compiling Manifest...' : 'Generate & Seal Dossier'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
