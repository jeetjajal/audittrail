import React, { useEffect, useState } from 'react';
import { StatusBadge, Modal } from '../components/Common';
import { ApiClient } from '../services/api';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reasonForChange, setReasonForChange] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.allSettled([
        ApiClient.getUsers(),
        ApiClient.getRoles(),
      ]);

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value.items || []);
      }
      if (rolesRes.status === 'fulfilled') {
        setRoles(rolesRes.value.items || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenStatusModal(user: any) {
    setSelectedUser(user);
    setReasonForChange('');
    setIsModalOpen(true);
  }

  async function handleToggleStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    if (!reasonForChange.trim()) {
      alert('A documented regulatory justification is mandatory per 21 CFR Part 11.');
      return;
    }

    setSubmitting(true);
    try {
      const nextStatus = !selectedUser.is_active;
      await ApiClient.updateUserStatus(selectedUser.id, nextStatus, reasonForChange);
      setUsers(
        users.map((u) => (u.id === selectedUser.id ? { ...u, is_active: nextStatus } : u))
      );
      setIsModalOpen(false);
      alert(`User ${selectedUser.full_name} status updated to ${nextStatus ? 'ACTIVE' : 'DEACTIVATED'}. Recorded in audit trail.`);
    } catch (err) {
      alert(`Failed to update user status: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            User Directory & Role-Based Access Control (RBAC)
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Authorized clinical personnel directory with 21 CFR Part 11 electronic signature rights.
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '30px', textAlign: 'center', color: '#6B778C', fontSize: '13px' }}>
          Loading authorized clinical user directory from database...
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
          {error}
        </div>
      )}

      {/* Users Table */}
      {!loading && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', overflow: 'hidden', marginBottom: '24px' }}>
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
            <span>Authorized Clinical Personnel ({users.length})</span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B778C' }}>
              Enforcing ISO 13485:2016 § 6.2 Competence & Training
            </span>
          </div>

          {users.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#6B778C', fontSize: '13px' }}>
              No clinical users registered for this organization tenant.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '1px solid #DFE1E6', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Personnel Name</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Email Address</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Clinical Job Title</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>eQMS Roles</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 14px', color: '#6B778C', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleNames = Array.isArray(u.roles) && u.roles.length > 0
                    ? u.roles.map((r: any) => r.name || r.code).join(', ')
                    : 'Standard Investigator';
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #EBECF0' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#172B4D' }}>
                        {u.full_name}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#6B778C' }}>{u.email}</td>
                      <td style={{ padding: '12px 14px', color: '#172B4D' }}>{u.job_title || 'Quality Engineer'}</td>
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
                          {roleNames}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={u.is_active ? 'ACTIVE' : 'DISMISSED'} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenStatusModal(u)}
                          style={{
                            background: 'none',
                            border: '1px solid #DFE1E6',
                            borderRadius: '3px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            color: u.is_active ? '#DE350B' : '#00875A',
                            fontWeight: 600,
                          }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Defined Roles Grid */}
      {roles.length > 0 && !loading && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '18px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700, color: '#172B4D' }}>
            System Roles & Signoff Authority Matrix
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {roles.map((r) => (
              <div
                key={r.id}
                style={{
                  backgroundColor: '#F4F5F7',
                  padding: '12px 14px',
                  borderRadius: '4px',
                  border: '1px solid #EBECF0',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#172B4D' }}>{r.name}</div>
                <div style={{ fontSize: '11px', color: '#6B778C', marginTop: '2px' }}><code>{r.code}</code></div>
                <div style={{ fontSize: '12px', color: '#6B778C', marginTop: '6px' }}>{r.description || 'Clinical role'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Modification Modal (21 CFR Part 11 Enforced) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser?.is_active ? 'Deactivate Clinical Personnel' : 'Activate Clinical Personnel'}
      >
        <form onSubmit={handleToggleStatus}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: '#172B4D' }}>
                You are about to change the authorization status of{' '}
                <strong>{selectedUser?.full_name}</strong> to{' '}
                <strong>{selectedUser?.is_active ? 'DEACTIVATED' : 'ACTIVE'}</strong>.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                Documented Reason for Access Modification:
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Completed annual qualification certification / Transfer to alternate facility..."
                value={reasonForChange}
                onChange={(e) => setReasonForChange(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '12px' }}
              />
            </div>

            <div
              style={{
                backgroundColor: '#FFEBE6',
                color: '#DE350B',
                padding: '10px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                lineHeight: 1.4,
              }}
            >
              ⚠️ <strong>Regulatory Compliance Notice:</strong> Deactivating a user immediately revokes electronic signature authorization across all active workflows. This action is permanently recorded in the cryptographic audit ledger.
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
                disabled={submitting}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: selectedUser?.is_active ? '#DE350B' : '#00875A',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {submitting ? 'Recording...' : 'Confirm & Log Audit Event'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
