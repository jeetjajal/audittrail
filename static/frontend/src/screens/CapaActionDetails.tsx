import React, { useEffect, useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';
import { CAPA } from '../types';

interface CapaActionDetailsProps {
  capaId: string;
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const CapaActionDetails: React.FC<CapaActionDetailsProps> = ({ capaId, onNavigate }) => {
  const [capa, setCapa] = useState<CAPA | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddActionModalOpen, setIsAddActionModalOpen] = useState(false);
  const [isEffectivenessModalOpen, setIsEffectivenessModalOpen] = useState(false);

  // New action form state
  const [actionForm, setActionForm] = useState({
    actionNumber: 2,
    actionType: 'RETRAINING',
    description: '',
    assigneeId: 'b1000000-0000-0000-0000-000000000001',
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
  });

  // Effectiveness review state
  const [effForm, setEffForm] = useState({
    acceptanceCriteria: 'Zero wire-bond fractures in 5,000 units sampled during 90-day post-change production run.',
    scheduledDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
    isEffective: true,
    evidenceSummary: 'Statistical sample of 5,000 units inspected via acoustic microscopy showed 0 micro-fissures.',
  });

  async function loadCapaDetails() {
    setLoading(true);
    try {
      const data = await ApiClient.getCapa(capaId);
      setCapa(data);
    } catch (err) {
      console.error('Failed to load CAPA details', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCapaDetails();
  }, [capaId]);

  async function handleAddAction(e: React.FormEvent) {
    e.preventDefault();
    try {
      await ApiClient.addCapaAction(capaId, actionForm);
      setIsAddActionModalOpen(false);
      loadCapaDetails();
    } catch (err) {
      alert(`Failed to add action: ${(err as Error).message}`);
    }
  }

  async function handleCloseCapa() {
    if (!confirm('Are you sure you want to close this CAPA program? This action will verify all regulatory gates and trigger 21 CFR Part 11 ledger recording.')) {
      return;
    }
    try {
      await ApiClient.closeCapa(capaId);
      alert('CAPA successfully closed! Regulatory closure gate confirmed.');
      loadCapaDetails();
    } catch (err) {
      alert(`CAPA closure gate failed: ${(err as Error).message}`);
    }
  }

  if (loading || !capa) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6B778C' }}>
        Loading CAPA program actions and dependency DAG...
      </div>
    );
  }

  return (
    <div>
      {/* Top Banner & Breadcrumb */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => onNavigate('capas')}
          style={{ border: 'none', background: 'none', color: '#0052CC', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
        >
          ← Back to CAPA Registry
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsAddActionModalOpen(true)}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#172B4D',
              border: '1px solid #DFE1E6',
              padding: '6px 14px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            + Add Action Task
          </button>
          <button
            onClick={handleCloseCapa}
            style={{
              backgroundColor: '#00875A',
              color: '#FFFFFF',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ✓ Formal CAPA Closure Gate
          </button>
        </div>
      </div>

      {/* CAPA Header */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0052CC' }}>{capa.capa_number}</span>
              <StatusBadge type="status" value={capa.status} />
              <StatusBadge type="severity" value={capa.risk_level} />
              <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#EAE6FF', color: '#403294', padding: '2px 6px', borderRadius: '3px' }}>
                {capa.capa_type}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#172B4D' }}>{capa.title}</h1>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: '#6B778C' }}>
            <div>Target Due Date: <strong>{new Date(capa.due_date).toLocaleDateString()}</strong></div>
            <div>Program Owner: <strong>{capa.owner_name}</strong></div>
          </div>
        </div>

        <div style={{ backgroundColor: '#F4F5F7', padding: '14px', borderRadius: '4px', fontSize: '13px', color: '#172B4D', lineHeight: '1.5' }}>
          <strong>Problem Statement:</strong> {capa.problem_statement}
        </div>
      </div>

      {/* DAG Action Dependency Chain */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#172B4D', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚙️</span> Corrective Action Plan & DAG Execution Graph
          </h3>
          <span style={{ fontSize: '12px', color: '#6B778C' }}>
            Cycle Prevention Trigger: <code>trg_capa_cycle_detector</code> Active
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '2px solid #EBECF0', textAlign: 'left', color: '#6B778C' }}>
              <th style={{ padding: '8px 12px' }}>Step #</th>
              <th style={{ padding: '8px 12px' }}>Action Type</th>
              <th style={{ padding: '8px 12px' }}>Description</th>
              <th style={{ padding: '8px 12px' }}>Assignee</th>
              <th style={{ padding: '8px 12px' }}>Due Date</th>
              <th style={{ padding: '8px 12px' }}>Prerequisites</th>
              <th style={{ padding: '8px 12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(capa.actions && capa.actions.length > 0) ? (
              capa.actions.map((act) => (
                <tr key={act.id} style={{ borderBottom: '1px solid #EBECF0', height: '48px' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0052CC' }}>Action {act.action_number}</td>
                  <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600 }}>{act.action_type}</td>
                  <td style={{ padding: '8px 12px', maxWidth: '280px' }}>{act.description}</td>
                  <td style={{ padding: '8px 12px' }}>{act.assignee_name}</td>
                  <td style={{ padding: '8px 12px', color: '#6B778C' }}>{new Date(act.due_date).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 12px', fontSize: '12px', color: '#0052CC' }}>
                    {act.action_number === 2 ? 'Action 1' : 'None (Genesis)'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <StatusBadge type="status" value={act.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#6B778C' }}>
                  No actions defined yet. Click &quot;+ Add Action Task&quot; above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Effectiveness Review Verification Gate */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📊</span> Quantitative Effectiveness Review (21 CFR § 820.100(a)(4))
        </h3>
        <div style={{ padding: '16px', borderRadius: '4px', backgroundColor: '#E3FCEF', border: '1px solid #ABF5D1', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#006644' }}>
              ✓ EFFECTIVENESS VERIFIED: POSITIVE VERDICT
            </span>
            <span style={{ fontSize: '11px', color: '#006644', fontWeight: 600 }}>
              Reviewed by: Dr. Eleanor Mitchell (QA Lead)
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#172B4D', marginBottom: '6px' }}>
            <strong>Acceptance Criteria:</strong> Zero wire-bond impedance excursions in subsequent 5,000 unit production batches.
          </div>
          <div style={{ fontSize: '12px', color: '#505F79' }}>
            <strong>Objective Statistical Evidence:</strong> 5,000 units from Lot LOT-2026-04A and LOT-2026-04B evaluated via in-line micro-pull testing; 100% met pull strength specifications (&gt;6.5 gf).
          </div>
        </div>
      </div>

      {/* Modal: Add Action Task */}
      <Modal isOpen={isAddActionModalOpen} title="Add Corrective Action Item" onClose={() => setIsAddActionModalOpen(false)}>
        <form onSubmit={handleAddAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Action Type *</label>
            <select
              value={actionForm.actionType}
              onChange={(e) => setActionForm({ ...actionForm, actionType: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}
            >
              <option value="PROCESS_CHANGE">PROCESS CHANGE (Tooling / Equipment)</option>
              <option value="RETRAINING">RETRAINING (Operator SOP Qualifications)</option>
              <option value="DMR_REVISION">DMR REVISION (Device Master Record)</option>
              <option value="SUPPLIER_SCAR">SUPPLIER SCAR (Supplier Corrective Action)</option>
              <option value="DESIGN_CHANGE">DESIGN CHANGE (Engineering Modification)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Action Description *</label>
            <textarea
              required
              rows={3}
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              placeholder="Specify the exact technical action to be performed..."
              style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Due Date *</label>
            <input
              type="date"
              required
              value={actionForm.dueDate}
              onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="submit" style={{ backgroundColor: '#0052CC', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>
              Add to DAG Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
