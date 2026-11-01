import React, { useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';

interface RootCauseAnalysisProps {
  investigationId?: string;
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const RootCauseAnalysis: React.FC<RootCauseAnalysisProps> = ({ investigationId, onNavigate }) => {
  // Sample initial state mirroring seed data
  const [fiveWhys, setFiveWhys] = useState([
    { step: 1, q: 'Why did telemetry communication fail intermittently?', a: 'RF antenna impedance spiked above 50 Ohms during interrogation.' },
    { step: 2, q: 'Why did RF antenna impedance spike?', a: 'RF circuit trace experienced sub-surface micro-cracks.' },
    { step: 3, q: 'Why did the RF circuit trace crack?', a: 'Thermal cycling in the hermetic welding chamber exceeded maximum expansion delta.' },
    { step: 4, q: 'Why did thermal expansion delta exceed tolerance?', a: 'Pre-heating dwell time was reduced from 45 seconds to 20 seconds during shift change.' },
    { step: 5, q: 'Why was pre-heating dwell time reduced?', a: 'SOP-MFG-0082 was missing explicit parameter interlock on machine controller #3.' },
  ]);

  const [fishboneNodes, setFishboneNodes] = useState([
    { category: 'MACHINE', factor: 'Welder controller interlock bypassed during manual override', isPrimary: true },
    { category: 'METHOD', factor: 'SOP-MFG-0082 missing mandatory dual-signoff for dwell time adjustment', isPrimary: false },
    { category: 'MATERIAL', factor: 'Substrate copper trace thickness at lower limit of tolerance (17.5 µm)', isPrimary: false },
    { category: 'ENVIRONMENT', factor: 'Cleanroom HVAC humidity excursion during shift 2', isPrimary: false },
  ]);

  const [rootCauses, setRootCauses] = useState([
    {
      id: 'rc-1',
      statement: 'Lack of automated software parameter interlock on ultrasonic welder controller allowed unauthorized dwell time reduction.',
      category: 'PROCESS_EQUIPMENT',
      verificationMethod: 'Independent failure reproduction: 20-second dwell produced identical micro-cracking in test substrate.',
      isVerified: true,
      verifiedBy: 'Dr. Eleanor Mitchell',
    },
  ]);

  const [isWhyModalOpen, setIsWhyModalOpen] = useState(false);
  const [isFishboneModalOpen, setIsFishboneModalOpen] = useState(false);
  const [isCauseModalOpen, setIsCauseModalOpen] = useState(false);

  // Form states
  const [newWhy, setNewWhy] = useState({ q: '', a: '' });
  const [newFishbone, setNewFishbone] = useState({ category: 'MACHINE', factor: '', isPrimary: false });
  const [newCause, setNewCause] = useState({ statement: '', category: 'PROCESS_EQUIPMENT', verificationMethod: '' });

  async function handleAddWhy(e: React.FormEvent) {
    e.preventDefault();
    const newStep = { step: fiveWhys.length + 1, q: newWhy.q, a: newWhy.a };
    if (investigationId) {
      try {
        await ApiClient.addFiveWhys(investigationId, {
          stepNumber: newStep.step,
          question: newStep.q,
          answer: newStep.a,
        });
      } catch (err) {
        console.warn('Backend addFiveWhys fallback to client state:', err);
      }
    }
    setFiveWhys([...fiveWhys, newStep]);
    setIsWhyModalOpen(false);
    setNewWhy({ q: '', a: '' });
  }

  async function handleAddFishbone(e: React.FormEvent) {
    e.preventDefault();
    const node = { ...newFishbone, category: newFishbone.category as any };
    if (investigationId) {
      try {
        await ApiClient.addFishbone(investigationId, {
          category: node.category,
          causeFactor: node.factor,
          isPrimaryContributory: node.isPrimary,
        });
      } catch (err) {
        console.warn('Backend addFishbone fallback to client state:', err);
      }
    }
    setFishboneNodes([...fishboneNodes, node]);
    setIsFishboneModalOpen(false);
    setNewFishbone({ category: 'MACHINE', factor: '', isPrimary: false });
  }

  async function handleAddCause(e: React.FormEvent) {
    e.preventDefault();
    const causeId = `rc-${Date.now()}`;
    if (investigationId) {
      try {
        await ApiClient.addRootCause(investigationId, {
          statement: newCause.statement,
          category: newCause.category,
          verificationMethod: newCause.verificationMethod,
          isPrimary: true,
        });
      } catch (err) {
        console.warn('Backend addRootCause fallback to client state:', err);
      }
    }
    setRootCauses([
      ...rootCauses,
      {
        id: causeId,
        statement: newCause.statement,
        category: newCause.category,
        verificationMethod: newCause.verificationMethod,
        isVerified: true,
        verifiedBy: 'Dr. Eleanor Mitchell',
      },
    ]);
    setIsCauseModalOpen(false);
    setNewCause({ statement: '', category: 'PROCESS_EQUIPMENT', verificationMethod: '' });
  }

  return (
    <div>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            Root Cause Analysis (RCA) Studio
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Structured 5-Whys Iteration, 6M Ishikawa Diagramming & Root Cause Verification (ISO 13485:2016 § 8.5.2).
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsWhyModalOpen(true)}
            style={{ backgroundColor: '#FFFFFF', color: '#172B4D', border: '1px solid #DFE1E6', padding: '8px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          >
            + Add Why Step
          </button>
          <button
            onClick={() => setIsFishboneModalOpen(true)}
            style={{ backgroundColor: '#FFFFFF', color: '#172B4D', border: '1px solid #DFE1E6', padding: '8px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          >
            + Add 6M Factor
          </button>
          <button
            onClick={() => setIsCauseModalOpen(true)}
            style={{ backgroundColor: '#0052CC', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          >
            + Confirm Verified Root Cause
          </button>
        </div>
      </div>

      {/* Verified Root Causes Section */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🎯</span> Verified Formal Root Causes
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rootCauses.map((rc) => (
            <div key={rc.id} style={{ padding: '16px', borderRadius: '4px', backgroundColor: '#F4F5F7', border: '1px solid #EBECF0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#DEEBFF', color: '#0747A6', padding: '2px 8px', borderRadius: '3px' }}>
                    {rc.category}
                  </span>
                  <StatusBadge type="status" value={rc.isVerified ? 'VERIFIED' : 'PENDING'} />
                </div>
                <span style={{ fontSize: '12px', color: '#6B778C' }}>Verified By: <strong>{rc.verifiedBy}</strong></span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                {rc.statement}
              </div>
              <div style={{ fontSize: '12px', color: '#505F79' }}>
                <strong>Verification Method:</strong> {rc.verificationMethod}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: 5-Whys Chain & Ishikawa Fishbone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* 5-Whys Iteration */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
            5-Whys Iterative Questioning Chain
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {fiveWhys.map((w) => (
              <div key={w.step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: '#0052CC',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    flexShrink: 0,
                  }}
                >
                  {w.step}
                </div>
                <div style={{ flex: 1, backgroundColor: '#FAFBFC', padding: '10px 14px', borderRadius: '4px', border: '1px solid #EBECF0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0747A6', marginBottom: '4px' }}>
                    Q: {w.q}
                  </div>
                  <div style={{ fontSize: '13px', color: '#172B4D' }}>
                    A: {w.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ishikawa 6M Diagram Nodes */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
            Ishikawa 6M Cause-and-Effect Analysis
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {fishboneNodes.map((fn, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  borderRadius: '4px',
                  border: `1px solid ${fn.isPrimary ? '#FFBDAD' : '#EBECF0'}`,
                  backgroundColor: fn.isPrimary ? '#FFEBE6' : '#FAFBFC',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: fn.isPrimary ? '#DE350B' : '#0747A6' }}>
                    {fn.category}
                  </span>
                  {fn.isPrimary && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#DE350B', backgroundColor: '#FFFFFF', padding: '1px 6px', borderRadius: '2px', border: '1px solid #DE350B' }}>
                      PRIMARY CONTRIBUTOR
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#172B4D' }}>{fn.factor}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Add Why */}
      <Modal isOpen={isWhyModalOpen} title="Add 5-Whys Step" onClose={() => setIsWhyModalOpen(false)}>
        <form onSubmit={handleAddWhy} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Question *</label>
            <input required type="text" value={newWhy.q} onChange={(e) => setNewWhy({ ...newWhy, q: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Answer *</label>
            <input required type="text" value={newWhy.a} onChange={(e) => setNewWhy({ ...newWhy, a: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="submit" style={{ backgroundColor: '#0052CC', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Add Step</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add 6M Factor */}
      <Modal isOpen={isFishboneModalOpen} title="Add 6M Ishikawa Factor" onClose={() => setIsFishboneModalOpen(false)}>
        <form onSubmit={handleAddFishbone} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Category *</label>
            <select value={newFishbone.category} onChange={(e) => setNewFishbone({ ...newFishbone, category: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}>
              <option value="MAN">MAN (Personnel / Training)</option>
              <option value="MACHINE">MACHINE (Equipment / Interlocks)</option>
              <option value="MATERIAL">MATERIAL (Components / Suppliers)</option>
              <option value="METHOD">METHOD (SOPs / Procedures)</option>
              <option value="MEASUREMENT">MEASUREMENT (Inspection / Metrology)</option>
              <option value="ENVIRONMENT">ENVIRONMENT (Cleanroom / ESD)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Contributing Factor *</label>
            <input required type="text" value={newFishbone.factor} onChange={(e) => setNewFishbone({ ...newFishbone, factor: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="checkbox" id="primaryCheck" checked={newFishbone.isPrimary} onChange={(e) => setNewFishbone({ ...newFishbone, isPrimary: e.target.checked })} />
            <label htmlFor="primaryCheck" style={{ fontSize: '13px' }}>Mark as Primary Contributor</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="submit" style={{ backgroundColor: '#0052CC', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Add Factor</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Root Cause */}
      <Modal isOpen={isCauseModalOpen} title="Record Verified Root Cause" onClose={() => setIsCauseModalOpen(false)}>
        <form onSubmit={handleAddCause} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Root Cause Statement *</label>
            <textarea required rows={3} value={newCause.statement} onChange={(e) => setNewCause({ ...newCause, statement: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>Verification Method *</label>
            <input required type="text" value={newCause.verificationMethod} onChange={(e) => setNewCause({ ...newCause, verificationMethod: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="submit" style={{ backgroundColor: '#0052CC', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Record Verified Cause</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
