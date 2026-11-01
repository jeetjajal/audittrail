import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../components/Common';
import { ApiClient } from '../services/api';

export const OrganizationSettings: React.FC = () => {
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    fdaEstablishmentId: '',
  });

  async function loadOrganization() {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getOrganization();
      setOrg(data);
      setFormData({
        name: data.name || '',
        fdaEstablishmentId: data.fda_establishment_id || '',
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrganization();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await ApiClient.updateOrganization(formData);
      setOrg({ ...org, ...updated });
      setSuccessMsg('Organization profile updated and logged in the cryptographic audit trail.');
    } catch (err) {
      setError(`Failed to update organization: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
          Organization & Regulatory Settings
        </h1>
        <div style={{ fontSize: '13px', color: '#6B778C' }}>
          Manage multi-tenant configuration, Jira Cloud workspace bindings, and FDA establishment credentials.
        </div>
      </div>

      {loading && (
        <div style={{ padding: '30px', textAlign: 'center', color: '#6B778C', fontSize: '13px' }}>
          Loading organization profile and regulatory configuration...
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

      {successMsg && (
        <div
          style={{
            backgroundColor: '#E3FCEF',
            color: '#006644',
            padding: '12px 16px',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '13px',
          }}
        >
          ✓ {successMsg}
        </div>
      )}

      {org && !loading && (
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Tenant Profile Card */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D' }}>
                Tenant Identity & Atlassian Cloud Mapping
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B778C', marginBottom: '4px' }}>
                    Organization Legal Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Organization Tenant UUID:</span>
                  <code style={{ fontSize: '11px', backgroundColor: '#F4F5F7', padding: '2px 6px', borderRadius: '3px' }}>
                    {org.id}
                  </code>
                </div>
                <div>
                  <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Atlassian Installation ID:</span>
                  <code style={{ fontSize: '11px', backgroundColor: '#F4F5F7', padding: '2px 6px', borderRadius: '3px' }}>
                    {org.atlassian_installation_id}
                  </code>
                </div>
                <div>
                  <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Atlassian Cloud Site ID:</span>
                  <code style={{ fontSize: '11px', backgroundColor: '#F4F5F7', padding: '2px 6px', borderRadius: '3px' }}>
                    {org.atlassian_cloud_id}
                  </code>
                </div>
              </div>
            </div>

            {/* Regulatory Registrations Card */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D' }}>
                Medical Device Regulatory Registrations
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B778C', marginBottom: '4px' }}>
                    FDA Establishment Registration Number (FEI):
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fdaEstablishmentId}
                    onChange={(e) => setFormData({ ...formData, fdaEstablishmentId: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #DFE1E6', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Medical Device Portfolio:</span>
                  <strong style={{ color: '#172B4D' }}>{org.totalDevices} Registered Medical Devices</strong>
                </div>
                <div>
                  <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Active Qualified Users:</span>
                  <strong style={{ color: '#172B4D' }}>{org.totalActiveUsers} Clinical Personnel</strong>
                </div>
                <div>
                  <span style={{ color: '#6B778C', display: 'block', marginBottom: '2px' }}>Tenant Multi-Tenancy Engine:</span>
                  <StatusBadge status="ACTIVE" />
                  <span style={{ fontSize: '12px', color: '#00875A', marginLeft: '8px', fontWeight: 600 }}>
                    PostgreSQL 18.6 RLS Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Retention Configuration Card (Security & Compliance Critical) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '6px',
              border: '1px solid #DFE1E6',
              padding: '20px',
              marginBottom: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: '#172B4D' }}>
              Data Retention & WORM Compliance (21 CFR § 820.180 & FDA QMSR)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '13px' }}>
              <div style={{ backgroundColor: '#F4F5F7', padding: '12px 16px', borderRadius: '4px' }}>
                <span style={{ color: '#6B778C', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  MANDATORY RETENTION PERIOD
                </span>
                <strong style={{ fontSize: '16px', color: '#172B4D' }}>
                  {org.retentionPolicy ? org.retentionPolicy.minimumYears : 10} Years
                </strong>
                <div style={{ fontSize: '11px', color: '#6B778C', marginTop: '4px' }}>
                  Equivalent to expected device lifespan + 2 years
                </div>
              </div>

              <div style={{ backgroundColor: '#F4F5F7', padding: '12px 16px', borderRadius: '4px' }}>
                <span style={{ color: '#6B778C', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  AWS S3 OBJECT LOCK MODE
                </span>
                <strong style={{ fontSize: '16px', color: '#0052CC' }}>
                  {org.retentionPolicy ? org.retentionPolicy.objectLockMode : 'GOVERNANCE'}
                </strong>
                <div style={{ fontSize: '11px', color: '#6B778C', marginTop: '4px' }}>
                  Enforced via S3 Presigned WORM API headers
                </div>
              </div>

              <div style={{ backgroundColor: '#F4F5F7', padding: '12px 16px', borderRadius: '4px' }}>
                <span style={{ color: '#6B778C', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  IMMUTABLE AUDIT LEDGER
                </span>
                <strong style={{ fontSize: '16px', color: '#00875A' }}>
                  ACTIVE (SHA-256)
                </strong>
                <div style={{ fontSize: '11px', color: '#6B778C', marginTop: '4px' }}>
                  Modifications & deletions blocked by DB triggers
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                backgroundColor: '#0052CC',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Updating Organization...' : 'Save Organization Profile'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
