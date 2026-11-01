import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';
import { Investigation } from '../types';

interface InvestigationWorkspaceProps {
  incidentId?: string;
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const InvestigationWorkspace: React.FC<InvestigationWorkspaceProps> = ({ incidentId, onNavigate }) => {
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [methodology, setMethodology] = useState<string>('HYBRID');
  const [summary, setSummary] = useState('');
  const [containment, setContainment] = useState('');

  useEffect(() => {
    async function loadInv() {
      setLoading(true);
      try {
        if (incidentId) {
          const inc = await ApiClient.getIncident(incidentId);
          if (inc.investigations && inc.investigations.length > 0) {
            const invDetail = await ApiClient.getInvestigation(inc.investigations[0].id);
            setInvestigation(invDetail);
            setMethodology(invDetail.methodology);
            setSummary(invDetail.summary);
            setContainment(invDetail.containment_actions || '');
          }
        }
      } catch (err) {
        console.error('Failed to load investigation workspace', err);
      } finally {
        setLoading(false);
      }
    }
    loadInv();
  }, [incidentId]);

  async function handleStartOrUpdateInvestigation() {
    if (!incidentId) return;
    try {
      const inv = await ApiClient.startInvestigation(incidentId, {
        methodology,
        summary: summary || 'Comprehensive failure analysis on RF telemetry capacitor impedance.',
        containmentActions: containment || 'Lot LOT-2026-03B quarantined. Supplier SCAR issued.',
      });
      setInvestigation(inv);
      alert('Investigation workspace updated successfully!');
    } catch (err) {
      alert(`Operation failed: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            Root Cause Investigation Workspace
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Formal investigation protocol per ISO 13485:2016 § 8.5.2 & FDA 21 CFR § 820.100.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onNavigate('root-cause', investigation?.id)}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#0052CC',
              border: '1px solid #0052CC',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🌲 Open 5-Whys & Fishbone Studio →
          </button>
          <button
            onClick={() => onNavigate('ai-assistant', incidentId)}
            style={{
              backgroundColor: '#6554C0',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✨ AI Root Cause Hypotheses
          </button>
        </div>
      </div>

      {/* Overview Card */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#172B4D' }}>
              Investigation Status:
            </span>
            <StatusBadge type="status" value={investigation?.status || 'IN_PROGRESS'} />
          </div>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Lead Investigator: <strong>{investigation?.lead_investigator_name || 'Dr. Eleanor Mitchell'}</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
              Investigation Methodology *
            </label>
            <select
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            >
              <option value="HYBRID">Hybrid (5-Whys Iteration + 6M Ishikawa Fishbone)</option>
              <option value="FIVE_WHYS">5-Whys Root Cause Chain</option>
              <option value="FISHBONE">Ishikawa 6M Cause-and-Effect Diagram</option>
              <option value="FAULT_TREE">Fault Tree Analysis (FTA)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
              Immediate Containment Actions Taken
            </label>
            <input
              type="text"
              value={containment || 'Physical segregation of Lot LOT-2026-03B in Cleanroom B cage.'}
              onChange={(e) => setContainment(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
            Investigation Narrative & Physical Observations *
          </label>
          <textarea
            rows={4}
            value={summary || 'Destructive failure analysis revealed micro-fissures in internal wire bonds of RF telemetry module due to thermal stress.'}
            onChange={(e) => setSummary(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '4px', border: '1px solid #DFE1E6', fontSize: '13px', lineHeight: '1.5' }}
          />
        </div>

        <button
          onClick={handleStartOrUpdateInvestigation}
          style={{
            backgroundColor: '#0052CC',
            color: '#FFFFFF',
            border: 'none',
            padding: '8px 18px',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save Investigation Record
        </button>
      </div>

      {/* Investigation Progress Stages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '6px', border: '1px solid #DFE1E6' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: '8px' }}>
            Stage 1: Containment
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#006644', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✓</span> Inventory Quarantined
          </div>
          <p style={{ fontSize: '12px', color: '#6B778C', margin: '6px 0 0 0' }}>
            124 units safely held under QHOLD-2026-0042.
          </p>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '6px', border: '1px solid #DFE1E6' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: '8px' }}>
            Stage 2: Root Cause Analysis
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0052CC', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🌲</span> 5-Whys & 6M Active
          </div>
          <p style={{ fontSize: '12px', color: '#6B778C', margin: '6px 0 0 0' }}>
            Wire bond thermal fatigue verified by SEM analysis.
          </p>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '6px', border: '1px solid #DFE1E6' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: '8px' }}>
            Stage 3: CAPA Initiation
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0052CC', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🛡️</span> CAPA-2026-0012 Linked
          </div>
          <p style={{ fontSize: '12px', color: '#6B778C', margin: '6px 0 0 0' }}>
            Action items in implementation phase.
          </p>
        </div>
      </div>
    </div>
  );
};
