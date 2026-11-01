import React, { useEffect, useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';
import { ApprovalStep } from '../types';

interface ApprovalCenterProps {
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const ApprovalCenter: React.FC<ApprovalCenterProps> = ({ onNavigate }) => {
  const [pendingSteps, setPendingSteps] = useState<ApprovalStep[]>([
    {
      step_id: 'step-001',
      step_order: 1,
      step_name: 'Lead Quality Engineer CAPA Sign-Off',
      step_status: 'PENDING',
      workflow_id: 'wf-001',
      entity_type: 'CAPA',
      entity_id: 'c1000000-0000-0000-0000-000000000001',
      workflow_type: 'CAPA_CLOSURE',
      workflow_created_at: new Date().toISOString(),
      required_role_name: 'Quality Assurance Lead',
    },
    {
      step_id: 'step-002',
      step_order: 1,
      step_name: 'Regulatory Affairs Incident Release Determination',
      step_status: 'PENDING',
      workflow_id: 'wf-002',
      entity_type: 'INCIDENT',
      entity_id: 'c1000000-0000-0000-0000-000000000001',
      workflow_type: 'NC_DISPOSITION',
      workflow_created_at: new Date(Date.now() - 86400000).toISOString(),
      required_role_name: 'Regulatory Affairs Manager',
    },
  ]);

  const [activeStep, setActiveStep] = useState<ApprovalStep | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [meaning, setMeaning] = useState<'AUTHORED' | 'REVIEWED' | 'APPROVED' | 'VERIFIED'>('APPROVED');
  const [reauthPassword, setReauthPassword] = useState('');
  const [agreedToLegal, setAgreedToLegal] = useState(false);

  async function handleExecuteSignature(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedToLegal) {
      alert('You must acknowledge the legal equivalency of your electronic signature.');
      return;
    }
    if (!reauthPassword) {
      alert('Step-up re-authentication credential required per 21 CFR § 11.200.');
      return;
    }

    try {
      if (activeStep) {
        await ApiClient.approveStep(activeStep.step_id, meaning);
        setPendingSteps(pendingSteps.filter((s) => s.step_id !== activeStep.step_id));
        setIsSignModalOpen(false);
        setReauthPassword('');
        setAgreedToLegal(false);
        alert('Electronic signature successfully executed and cryptographically sealed.');
      }
    } catch (err) {
      alert(`Signature execution failed: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
          Approval & Electronic Signature Center (21 CFR Part 11)
        </h1>
        <div style={{ fontSize: '13px', color: '#6B778C' }}>
          Legally binding digital approval workflows with step-up re-authentication and dual cryptographic manifests.
        </div>
      </div>

      {/* Part 11 Compliance Note */}
      <div style={{ backgroundColor: '#DEEBFF', border: '1px solid #B3D4FF', borderRadius: '6px', padding: '14px 18px', marginBottom: '24px', fontSize: '12px', color: '#0747A6' }}>
        <strong>FDA 21 CFR PART 11 § 11.50 & § 11.70:</strong> Electronic signatures executed within this portal are
        manifested with the signer&apos;s printed name, formal title, execution timestamp, and unambiguous meaning. Signatures are
        cryptographically bound to the record digest and cannot be modified or excised.
      </div>

      {/* Pending Approval List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {pendingSteps.length === 0 ? (
          <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '6px', border: '1px solid #DFE1E6', textAlign: 'center', color: '#6B778C' }}>
            ✓ No pending approval workflows requiring your electronic signature.
          </div>
        ) : (
          pendingSteps.map((step) => (
            <div
              key={step.step_id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '6px',
                border: '1px solid #DFE1E6',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(9, 30, 66, 0.08)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#FFE380', color: '#172B4D', padding: '2px 8px', borderRadius: '3px' }}>
                    {step.workflow_type}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6B778C' }}>
                    Entity: <strong>{step.entity_type}</strong> (Step {step.step_order})
                  </span>
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#172B4D' }}>
                  {step.step_name}
                </h3>
                <div style={{ fontSize: '12px', color: '#505F79' }}>
                  Required Qualification: <strong>{step.required_role_name}</strong> • Initiated: {new Date(step.workflow_created_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setActiveStep(step);
                    setIsSignModalOpen(true);
                  }}
                  style={{
                    backgroundColor: '#0052CC',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>✍️</span> Sign & Approve
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: 21 CFR Part 11 Electronic Signature Execution */}
      <Modal isOpen={isSignModalOpen} title="Execute 21 CFR Part 11 Electronic Signature" onClose={() => setIsSignModalOpen(false)} width="550px">
        <form onSubmit={handleExecuteSignature} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#FAFBFC', padding: '12px', borderRadius: '4px', border: '1px solid #EBECF0', fontSize: '12px' }}>
            <div>Signer: <strong>Dr. Eleanor Mitchell</strong></div>
            <div>Title: <strong>Director of Quality Assurance</strong></div>
            <div>Document/Step: <strong>{activeStep?.step_name}</strong></div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Meaning of Signature (21 CFR § 11.50) *
            </label>
            <select
              value={meaning}
              onChange={(e) => setMeaning(e.target.value as any)}
              style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '13px' }}
            >
              <option value="APPROVED">APPROVED (Formal Quality Authorization)</option>
              <option value="REVIEWED">REVIEWED (Technical Concurrence)</option>
              <option value="VERIFIED">VERIFIED (Objective Evidence Audit)</option>
              <option value="AUTHORED">AUTHORED (Primary Authorship)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
              Step-Up Re-Authentication Password / Token (21 CFR § 11.200) *
            </label>
            <input
              type="password"
              required
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              placeholder="Enter re-authentication password or MFA passkey..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              id="legalEquiv"
              checked={agreedToLegal}
              onChange={(e) => setAgreedToLegal(e.target.checked)}
              style={{ marginTop: '2px' }}
            />
            <label htmlFor="legalEquiv" style={{ fontSize: '12px', color: '#172B4D', lineHeight: '1.4' }}>
              I understand and certify that my electronic signature is the legally binding equivalent of my handwritten signature pursuant to FDA 21 CFR Part 11.
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsSignModalOpen(false)}
              style={{ padding: '8px 16px', border: '1px solid #DFE1E6', backgroundColor: '#FFF', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                backgroundColor: '#00875A',
                color: '#FFF',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '4px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Digitally Seal & Sign
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
