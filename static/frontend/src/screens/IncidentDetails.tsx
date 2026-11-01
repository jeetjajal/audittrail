import React, { useEffect, useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';
import { Incident } from '../types';

interface IncidentDetailsProps {
  incidentId: string;
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const IncidentDetails: React.FC<IncidentDetailsProps> = ({ incidentId, onNavigate }) => {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('INVESTIGATING');
  const [transitionReason, setTransitionReason] = useState('');

  async function loadDetails() {
    setLoading(true);
    try {
      const data = await ApiClient.getIncident(incidentId);
      setIncident(data);
    } catch (err) {
      console.error('Failed to load incident details', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [incidentId]);

  async function handleTransitionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transitionReason) {
      alert('Please provide an official justification for this lifecycle transition');
      return;
    }
    try {
      await ApiClient.transitionIncident(incidentId, newStatus, transitionReason);
      setIsTransitionModalOpen(false);
      setTransitionReason('');
      loadDetails();
    } catch (err) {
      alert(`Transition failed: ${(err as Error).message}`);
    }
  }

  if (loading || !incident) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6B778C' }}>
        Loading complete clinical incident dossier...
      </div>
    );
  }

  return (
    <div>
      {/* Top Banner & Breadcrumb */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => onNavigate('incidents')}
          style={{ border: 'none', background: 'none', color: '#0052CC', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
        >
          ← Back to Incident Registry
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsTransitionModalOpen(true)}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#172B4D',
              border: '1px solid #DFE1E6',
              padding: '6px 12px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Advance Lifecycle Status
          </button>
          <button
            onClick={() => onNavigate('ai-assistant', incidentId)}
            style={{
              backgroundColor: '#6554C0',
              color: '#FFFFFF',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>✨</span> AI Hypothesis Assistant
          </button>
          <button
            onClick={() => onNavigate('investigation', incidentId)}
            style={{
              backgroundColor: '#0052CC',
              color: '#FFFFFF',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            🔬 Investigation Workspace
          </button>
        </div>
      </div>

      {/* Main Title Header */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '6px',
          border: '1px solid #DFE1E6',
          padding: '24px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0052CC' }}>{incident.incident_number}</span>
              <StatusBadge type="severity" value={incident.severity} />
              <StatusBadge type="status" value={incident.status} />
              {incident.is_mdr_reportable && (
                <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#FFEBE6', color: '#DE350B', padding: '2px 6px', borderRadius: '3px' }}>
                  21 CFR PART 803 MDR
                </span>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#172B4D' }}>{incident.title}</h1>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: '#6B778C' }}>
            <div>Occurrence: <strong>{new Date(incident.occurrence_date).toLocaleDateString()}</strong></div>
            <div>Reported By: <strong>{incident.reported_by_name || 'Dr. Eleanor Mitchell'}</strong></div>
          </div>
        </div>

        <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#172B4D', margin: '0 0 16px 0', backgroundColor: '#F4F5F7', padding: '14px', borderRadius: '4px' }}>
          {incident.description}
        </p>

        <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: '#6B778C', borderTop: '1px solid #EBECF0', paddingTop: '12px' }}>
          <div>Risk Priority Number (RPN): <strong style={{ color: '#172B4D' }}>{incident.rpn_score || 240}</strong></div>
          <div>Channel: <strong style={{ color: '#172B4D' }}>{incident.source}</strong></div>
          <div>Patient Impact: <strong style={{ color: '#172B4D' }}>{incident.patient_impact_level}</strong></div>
          {incident.jira_issue_key && (
            <div>Jira Link: <strong style={{ color: '#0052CC' }}>{incident.jira_issue_key}</strong></div>
          )}
        </div>
      </div>

      {/* Grid: Traceability Triad & Quarantine Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Device Traceability Triad Panel (FDA QMSR 21 CFR § 820.65) */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
            Medical Device Traceability Triad (21 CFR § 820.65)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', backgroundColor: '#FAFBFC', padding: '14px', borderRadius: '4px', border: '1px solid #EBECF0' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B778C', textTransform: 'uppercase' }}>Medical Device Model</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0052CC', marginTop: '4px' }}>
                {incident.devices?.[0]?.device_model || 'CardioPulse 9000'}
              </div>
              <div style={{ fontSize: '11px', color: '#6B778C', marginTop: '2px' }}>
                Class III Implantable Pacemaker
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B778C', textTransform: 'uppercase' }}>Manufacturing Lot #</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', marginTop: '4px' }}>
                {incident.devices?.[0]?.lot_number || 'LOT-2026-03B'}
              </div>
              <div style={{ fontSize: '11px', color: '#6B778C', marginTop: '2px' }}>
                Sterilization: EtO Validated
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B778C', textTransform: 'uppercase' }}>Serialized Unit ID</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', marginTop: '4px' }}>
                {incident.devices?.[0]?.serial_number || 'CP9-2026-0042'}
              </div>
              <div style={{ fontSize: '11px', color: '#DE350B', fontWeight: 600, marginTop: '2px' }}>
                Status: QUARANTINED
              </div>
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#6B778C' }}>
            UDI-DI: <code>(01)00850012345001(21)SN9000-A01</code> • Composite integrity constraints validated.
          </div>
        </div>

        {/* Quarantine Hold Record */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
            Suspect Inventory Quarantine Hold
          </h3>
          <div style={{ padding: '12px', borderRadius: '4px', backgroundColor: '#FFEBE6', border: '1px solid #FFBDAD' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#DE350B' }}>HOLD # QHOLD-2026-0042</span>
              <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#DE350B', color: '#FFFFFF', padding: '1px 6px', borderRadius: '2px' }}>ACTIVE HOLD</span>
            </div>
            <div style={{ fontSize: '12px', color: '#172B4D', marginBottom: '4px' }}>
              <strong>Location:</strong> Cleanroom B Quarantine Cage • Bin 14-C
            </div>
            <div style={{ fontSize: '12px', color: '#172B4D', marginBottom: '4px' }}>
              <strong>Units Held:</strong> 124 units from Lot LOT-2026-03B
            </div>
            <div style={{ fontSize: '11px', color: '#505F79' }}>
              Reason: Immediate containment pursuant to RF telemetry impedance drop report.
            </div>
          </div>
        </div>
      </div>

      {/* Status History Timeline */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
          Lifecycle Status Transition Audit History
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(incident.statusHistory && incident.statusHistory.length > 0) ? (
            incident.statusHistory.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid #EBECF0' }}>
                <span style={{ fontSize: '18px' }}>⏱️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B4D' }}>
                      {item.from_status} → {item.to_status}
                    </span>
                    <span style={{ fontSize: '11px', color: '#8993A4' }}>
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#505F79' }}>
                    Reason: {item.reason_for_change}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B778C', marginTop: '2px' }}>
                    Authorizing User: {item.changed_by_name || 'Dr. Eleanor Mitchell'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: '13px', color: '#6B778C' }}>
              Initial status transition: DRAFT → SUBMITTED (Intake submission).
            </div>
          )}
        </div>
      </div>

      {/* Modal: Advance Lifecycle Status */}
      <Modal isOpen={isTransitionModalOpen} title="Advance Incident Lifecycle Status" onClose={() => setIsTransitionModalOpen(false)}>
        <form onSubmit={handleTransitionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Target Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            >
              <option value="TRIAGED">TRIAGED (Risk Assessment Completed)</option>
              <option value="CONTAINMENT_ACTIVE">CONTAINMENT ACTIVE (Physical Lot Quarantined)</option>
              <option value="INVESTIGATING">INVESTIGATING (RCA Initiated)</option>
              <option value="RCA_REVIEW">RCA REVIEW (5-Whys / Fishbone In Progress)</option>
              <option value="CAPA_EVALUATION">CAPA EVALUATION (Determining Corrective Actions)</option>
              <option value="CLOSED">CLOSED (Formal Investigation Verified)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Regulatory Justification / Transition Reason *
            </label>
            <textarea
              required
              rows={3}
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              placeholder="State the objective regulatory reason for this status change..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsTransitionModalOpen(false)}
              style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #DFE1E6', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#0052CC', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
            >
              Confirm Status Transition
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
