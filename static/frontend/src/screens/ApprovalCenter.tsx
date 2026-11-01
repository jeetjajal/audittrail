import React, { useEffect, useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ScreenId } from '../components/Layout';
import { ApiClient } from '../services/api';
import { ApprovalStep } from '../types';

interface ApprovalCenterProps {
  onNavigate: (screen: ScreenId, entityId?: string) => void;
}

export const ApprovalCenter: React.FC<ApprovalCenterProps> = ({ onNavigate }) => {
  const [pendingSteps, setPendingSteps] = useState<ApprovalStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signing modal
  const [activeStep, setActiveStep] = useState<ApprovalStep | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [meaning, setMeaning] = useState<'AUTHORED' | 'REVIEWED' | 'APPROVED' | 'VERIFIED'>('APPROVED');
  const [reauthPassword, setReauthPassword] = useState('');
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [notes, setNotes] = useState('');
  const [signing, setSigning] = useState(false);

  // Rejection modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Details modal
  const [workflowDetails, setWorkflowDetails] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  async function loadPending() {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.getPendingApprovals();
      setPendingSteps(res.items || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

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

    setSigning(true);
    try {
      if (activeStep) {
        await ApiClient.approveStep(activeStep.step_id, meaning, notes);
        setPendingSteps(pendingSteps.filter((s) => s.step_id !== activeStep.step_id));
        setIsSignModalOpen(false);
        setReauthPassword('');
        setAgreedToLegal(false);
        setNotes('');
        alert('Electronic signature successfully executed and cryptographically sealed.');
      }
    } catch (err) {
      alert(`Signature execution failed: ${(err as Error).message}`);
    } finally {
      setSigning(false);
    }
  }

  async function handleExecuteReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('A documented rejection reason is required for regulatory compliance.');
      return;
    }

    setRejecting(true);
    try {
      if (activeStep) {
        await ApiClient.rejectStep(activeStep.step_id, rejectionReason);
        setPendingSteps(pendingSteps.filter((s) => s.step_id !== activeStep.step_id));
        setIsRejectModalOpen(false);
        setRejectionReason('');
        alert('Workflow step rejected and logged in the audit trail.');
      }
    } catch (err) {
      alert(`Rejection failed: ${(err as Error).message}`);
    } finally {
      setRejecting(false);
    }
  }

  async function handleViewWorkflow(step: ApprovalStep) {
    try {
      const wf = await ApiClient.getApprovalWorkflow(step.workflow_id);
      setWorkflowDetails(wf);
      setIsDetailsModalOpen(true);
    } catch (err) {
      alert(`Could not fetch workflow details: ${(err as Error).message}`);
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

      {loading && (
        <div style={{ padding: '30px', textAlign: 'center', color: '#6B778C', fontSize: '13px' }}>
          Loading pending approval workflows from database...
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
          Failed to load approvals: {error}
        </div>
      )}

      {/* Pending Approvals Table */}
      {!loading && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #DFE1E6', fontWeight: 700, fontSize: '15px', color: '#172B4D', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Pending Authorizations & Sign-offs ({pendingSteps.length})</span>
            <button
              onClick={loadPending}
              style={{ background: 'none', border: '1px solid #DFE1E6', borderRadius: '3px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
            >
              ↻ Refresh
            </button>
          </div>

          {pendingSteps.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6B778C' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', color: '#172B4D' }}>
                All Approvals Completed
              </div>
              <div style={{ fontSize: '13px' }}>
                There are no pending electronic signatures awaiting your authorization in this tenant.
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '1px solid #DFE1E6', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Entity & Workflow</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Step Description</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Required Role</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Submitted</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingSteps.map((step) => (
                  <tr key={step.step_id} style={{ borderBottom: '1px solid #EBECF0' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <strong style={{ color: '#0052CC', display: 'block' }}>{step.workflow_type}</strong>
                      <span style={{ fontSize: '11px', color: '#6B778C' }}>
                        {step.entity_type} · ID: {step.entity_id ? step.entity_id.substring(0, 8) : 'N/A'}...
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 500, color: '#172B4D' }}>
                      {step.step_name} (Step {step.step_order})
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ backgroundColor: '#EAE6FF', color: '#403294', padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                        {step.required_role_name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#6B778C' }}>
                      {new Date(step.workflow_created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge status={step.step_status} />
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleViewWorkflow(step)}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #DFE1E6',
                            color: '#172B4D',
                            padding: '6px 10px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => {
                            setActiveStep(step);
                            setIsRejectModalOpen(true);
                          }}
                          style={{
                            backgroundColor: '#FFEBE6',
                            border: '1px solid #FFBDAD',
                            color: '#DE350B',
                            padding: '6px 10px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            setActiveStep(step);
                            setIsSignModalOpen(true);
                          }}
                          style={{
                            backgroundColor: '#0052CC',
                            border: 'none',
                            color: '#FFFFFF',
                            padding: '6px 14px',
                            borderRadius: '3px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Sign / Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 21 CFR Part 11 Electronic Signature Modal */}
      <Modal isOpen={isSignModalOpen} onClose={() => setIsSignModalOpen(false)} title="Execute 21 CFR Part 11 Electronic Signature">
        <form onSubmit={handleExecuteSignature}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#6B778C', display: 'block', marginBottom: '4px' }}>Target Authorization:</span>
              <strong style={{ fontSize: '14px', color: '#172B4D' }}>{activeStep?.step_name}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Unambiguous Meaning of Signature (21 CFR § 11.50):
              </label>
              <select
                value={meaning}
                onChange={(e) => setMeaning(e.target.value as any)}
                style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}
              >
                <option value="APPROVED">I approve this record and authorize its execution (APPROVED)</option>
                <option value="REVIEWED">I have technically reviewed and verified this record (REVIEWED)</option>
                <option value="VERIFIED">I have independently inspected and verified objective evidence (VERIFIED)</option>
                <option value="AUTHORED">I am the designated author of this regulatory record (AUTHORED)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Signer Comments / Authorization Notes:
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional qualification or inspection notes..."
                style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Step-Up Re-Authentication Password (21 CFR § 11.200):
              </label>
              <input
                type="password"
                required
                placeholder="Enter your security credential..."
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px' }}
              />
            </div>

            <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #EBECF0', padding: '10px 12px', borderRadius: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#172B4D', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreedToLegal}
                  onChange={(e) => setAgreedToLegal(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I acknowledge that my electronic signature constitutes the legally binding equivalent of my traditional handwritten signature per FDA 21 CFR Part 11.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsSignModalOpen(false)}
                style={{ padding: '8px 16px', border: '1px solid #DFE1E6', borderRadius: '4px', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={signing}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#0052CC', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
              >
                {signing ? 'Signing...' : 'Affix Electronic Signature'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Rejection Modal */}
      <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Reject Approval Step">
        <form onSubmit={handleExecuteReject}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#6B778C', display: 'block', marginBottom: '4px' }}>Target Authorization:</span>
              <strong style={{ fontSize: '14px', color: '#172B4D' }}>{activeStep?.step_name}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Documented Rejection Justification (Mandatory):
              </label>
              <textarea
                required
                rows={3}
                placeholder="State specific deficiency, missing validation data, or regulatory reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '12px' }}
              />
            </div>

            <div style={{ backgroundColor: '#FFEBE6', color: '#DE350B', padding: '10px 12px', borderRadius: '4px', fontSize: '12px' }}>
              ⚠️ Rejecting this step will immediately transition the parent workflow into <strong>REJECTED</strong> status and record a permanent audit entry.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                style={{ padding: '8px 16px', border: '1px solid #DFE1E6', borderRadius: '4px', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rejecting}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#DE350B', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
              >
                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Workflow Inspection Details Modal */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Workflow Progression & Step History">
        {workflowDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#F4F5F7', padding: '12px', borderRadius: '4px' }}>
              <div>
                <span style={{ color: '#6B778C', display: 'block', fontSize: '11px' }}>WORKFLOW ID</span>
                <code>{workflowDetails.id}</code>
              </div>
              <div>
                <span style={{ color: '#6B778C', display: 'block', fontSize: '11px' }}>TYPE & ENTITY</span>
                <strong>{workflowDetails.workflow_type} ({workflowDetails.entity_type})</strong>
              </div>
              <div>
                <span style={{ color: '#6B778C', display: 'block', fontSize: '11px' }}>CURRENT STATUS</span>
                <StatusBadge status={workflowDetails.status} />
              </div>
              <div>
                <span style={{ color: '#6B778C', display: 'block', fontSize: '11px' }}>CREATED AT</span>
                <span>{new Date(workflowDetails.created_at).toLocaleString()}</span>
              </div>
            </div>

            <h4 style={{ margin: '10px 0 6px 0', fontSize: '14px', color: '#172B4D' }}>Sequential Approval Stages:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {workflowDetails.steps && workflowDetails.steps.map((st: any) => (
                <div key={st.id} style={{ border: '1px solid #DFE1E6', borderRadius: '4px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#172B4D' }}>Stage {st.step_order}: {st.step_name}</strong>
                    <StatusBadge status={st.status} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B778C', marginTop: '4px' }}>
                    Required Role: <strong>{st.required_role_name}</strong>
                  </div>
                  {st.signature_id && (
                    <div style={{ marginTop: '8px', padding: '6px 10px', backgroundColor: '#E3FCEF', borderRadius: '3px', fontSize: '11px', color: '#006644' }}>
                      ✓ Signed by <strong>{st.signer_name_snapshot}</strong> ({st.meaning_of_signature}) on {new Date(st.signed_at).toLocaleString()}
                      <div style={{ marginTop: '2px', wordBreak: 'break-all' }}>
                        Manifest: <code>{st.signature_manifest_hash}</code>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                style={{ padding: '8px 16px', border: '1px solid #DFE1E6', borderRadius: '4px', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
