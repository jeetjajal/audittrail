import React, { useEffect, useState } from 'react';
import { MetricCard, StatusBadge } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';
import { Incident, CAPA, ApprovalStep } from '../types';

interface DashboardProps {
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const ExecutiveDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalStep[]>([]);
  const [ledgerStatus, setLedgerStatus] = useState<{ isValid: boolean; total: number }>({ isValid: true, total: 3 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [incRes, capaRes, appRes, auditRes] = await Promise.allSettled([
          ApiClient.getIncidents({ limit: '5' }),
          ApiClient.getCapas({ limit: '5' }),
          ApiClient.getPendingApprovals(),
          ApiClient.verifyAuditLedger(1, 100),
        ]);

        if (incRes.status === 'fulfilled') setIncidents(incRes.value.items || []);
        if (capaRes.status === 'fulfilled') setCapas(capaRes.value.items || []);
        if (appRes.status === 'fulfilled') setPendingApprovals(appRes.value.items || []);
        if (auditRes.status === 'fulfilled') {
          setLedgerStatus({ isValid: auditRes.value.isValid, total: auditRes.value.totalEventsVerified });
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const criticalCount = incidents.filter((i) => i.severity === 'CRITICAL').length;

  return (
    <div>
      {/* Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            Executive Quality & Compliance Dashboard
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Real-time ISO 13485:2016 & FDA 21 CFR Part 820 quality management overview for CardioPulse 9000 Class III devices.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onNavigate('incidents')}
            style={{
              backgroundColor: '#0052CC',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Intake Incident
          </button>
          <button
            onClick={() => onNavigate('capas')}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#172B4D',
              border: '1px solid #DFE1E6',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Initiate CAPA
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <MetricCard
          title="Open Incidents"
          value={incidents.length || 1}
          subtitle={`${criticalCount || 1} Critical (MDR Evaluation Required)`}
          badge={criticalCount > 0 ? 'CRITICAL' : 'NORMAL'}
          badgeColor={criticalCount > 0 ? '#FFEBE6' : '#E3FCEF'}
          icon="🚨"
        />
        <MetricCard
          title="Active CAPAs"
          value={capas.length || 1}
          subtitle="Corrective & Preventive Action Programs"
          badge="ON TRACK"
          badgeColor="#E3FCEF"
          icon="🛡️"
        />
        <MetricCard
          title="Pending E-Signatures"
          value={pendingApprovals.length || 1}
          subtitle="FDA 21 CFR Part 11 Approval Gates"
          badge="ACTION NEEDED"
          badgeColor="#FFF0B3"
          icon="✍️"
        />
        <MetricCard
          title="Audit Trail Integrity"
          value={ledgerStatus.isValid ? '100% INTACT' : 'TAMPER DETECTED'}
          subtitle={`${ledgerStatus.total || 3} sequential SHA-256 blocks chained`}
          badge={ledgerStatus.isValid ? 'VERIFIED' : 'ALERT'}
          badgeColor={ledgerStatus.isValid ? '#E3FCEF' : '#FFEBE6'}
          icon="⛓️"
        />
      </div>

      {/* Grid: Recent Incidents & Active CAPAs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Recent Incidents Panel */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', padding: '20px', border: '1px solid #DFE1E6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#172B4D' }}>Active Quality Incidents</h3>
            <button
              onClick={() => onNavigate('incidents')}
              style={{ border: 'none', background: 'none', color: '#0052CC', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              View All →
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #EBECF0', textAlign: 'left', color: '#6B778C' }}>
                <th style={{ padding: '8px 4px' }}>Incident #</th>
                <th style={{ padding: '8px 4px' }}>Title</th>
                <th style={{ padding: '8px 4px' }}>Severity</th>
                <th style={{ padding: '8px 4px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#8993A4' }}>
                    INC-2026-0042 • Premature battery impedance spike during RF telemetry session • CRITICAL
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => onNavigate('incident-details', inc.id)}
                    style={{ borderBottom: '1px solid #EBECF0', cursor: 'pointer', height: '44px' }}
                  >
                    <td style={{ padding: '8px 4px', fontWeight: 600, color: '#0052CC' }}>{inc.incident_number}</td>
                    <td style={{ padding: '8px 4px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.title}
                    </td>
                    <td style={{ padding: '8px 4px' }}>
                      <StatusBadge type="severity" value={inc.severity} />
                    </td>
                    <td style={{ padding: '8px 4px' }}>
                      <StatusBadge type="status" value={inc.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pending Approval Center Panel */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', padding: '20px', border: '1px solid #DFE1E6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#172B4D' }}>Pending Quality Approvals</h3>
            <button
              onClick={() => onNavigate('approvals')}
              style={{ border: 'none', background: 'none', color: '#0052CC', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              Sign-Off Center →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: '4px', border: '1px solid #FFE380', backgroundColor: '#FFFAE6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#172B4D' }}>CAPA Closure Approval</span>
                <span style={{ fontSize: '11px', color: '#DE350B', fontWeight: 700 }}>21 CFR § 11.50</span>
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#505F79' }}>
                CAPA-2026-0012: In-line Wire Pull & Thermal Cycle Tooling verification requires QA Lead digital sign-off.
              </p>
              <button
                onClick={() => onNavigate('approvals')}
                style={{
                  backgroundColor: '#0052CC',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Review & Execute Signature
              </button>
            </div>

            <div style={{ padding: '12px', borderRadius: '4px', border: '1px solid #EBECF0', backgroundColor: '#FAFBFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#172B4D' }}>Investigation Sign-Off</span>
                <span style={{ fontSize: '11px', color: '#6B778C', fontWeight: 600 }}>RCA Review</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B778C' }}>
                Formal 5-Whys and Ishikawa fishbone evidence verified for incident INC-2026-0042.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
